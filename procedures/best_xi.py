"""
Best XI selector (local / backend): one auction user, one gameweek.

Uses the same in-game position resolution as scoring (position_roles / formation_match_roles).
Does not deploy or touch the web app.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

_ROOT = Path(__file__).resolve().parent.parent
_PROC = Path(__file__).resolve().parent
_TESTS = _ROOT / "Tests"
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))
if str(_PROC) not in sys.path:
    sys.path.insert(0, str(_PROC))

from formation_match_roles import (  # noqa: E402
    load_match_json,
    outfield_roles_by_player_for_match,
)

# --- Formations: (defenders, midfielders, forwards), sum = 10 outfield ---
ALLOWED_FORMATIONS: tuple[tuple[int, int, int], ...] = (
    (3, 5, 2),
    (3, 4, 3),
    (4, 5, 1),
    (4, 4, 2),
    (4, 3, 3),
    (5, 4, 1),
    (5, 3, 2),
)

ROLE_DEF, ROLE_MID, ROLE_FWD = "D", "M", "F"
POS_TO_ROLE = {
    "defender": ROLE_DEF,
    "midfielder": ROLE_MID,
    "forward": ROLE_FWD,
}


def _norm_pos(s: str | None) -> str | None:
    if not s:
        return None
    x = str(s).strip().lower()
    return POS_TO_ROLE.get(x) or POS_TO_ROLE.get(x.rstrip("s"))  # defensive


def _role_id_to_letter(rid: int) -> str | None:
    if rid == 1:
        return ROLE_DEF
    if rid == 2:
        return ROLE_MID
    if rid == 3:
        return ROLE_FWD
    return None


@dataclass
class OutfieldCandidate:
    player_id: int
    player_name: str
    score: int
    eligible_roles: frozenset[str]
    listed_label: str | None  # Defender / Midfielder / Forward or None


@dataclass
class OutfieldPick:
    player_id: int
    player_name: str
    role: str  # D / M / F
    score: int
    flexible: bool


@dataclass
class BestXIResult:
    auction_user_id: str
    gw_id: int
    formation_label: str  # e.g. "4-4-2"
    formation_tuple: tuple[int, int, int]
    goalkeeper_id: int | None
    goalkeeper_name: str
    goalkeeper_score: int
    outfield: list[OutfieldPick]
    empty_outfield_slots: int
    total_points: int


def load_master_player_list(path: Path) -> dict[int, dict[str, Any]]:
    """player_id -> {player_name, team_id, team_name, position}."""
    out: dict[int, dict[str, Any]] = {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                pid = int(row.get("player_id") or row.get("Player_ID") or -1)
            except (TypeError, ValueError):
                continue
            if pid < 0:
                continue
            out[pid] = {
                "player_name": (row.get("player_name") or "").strip(),
                "team_id": int(row["team_id"]) if row.get("team_id") not in (None, "") else None,
                "team_name": (row.get("team_name") or "").strip(),
                "position": (row.get("position") or "").strip(),
            }
    return out


def load_gw_scores_csv(path: Path) -> dict[int, int]:
    """
    player_id -> non-negative integer score. Duplicate player_id rows are summed (should be rare).
    """
    acc: dict[int, int] = {}
    with path.open(encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                pid = int(row.get("player_id") or -1)
            except (TypeError, ValueError):
                continue
            try:
                sc = int(float(row.get("score") or 0))
            except (TypeError, ValueError):
                sc = 0
            sc = max(0, sc)
            acc[pid] = acc.get(pid, 0) + sc
    return acc


def keeper_score(player_id: int, team_id: int | None, scores: dict[int, int]) -> int:
    """Try player_id, then team_id (keeper unit row in GW CSV)."""
    s = scores.get(player_id)
    if s is not None:
        return max(0, s)
    if team_id is not None:
        s2 = scores.get(int(team_id))
        if s2 is not None:
            return max(0, s2)
    return 0


def union_match_roles_for_gameweek(match_json_paths: Iterable[Path]) -> dict[int, frozenset[str]]:
    """
    For each player_id, union of {D,M,F} roles across all match files (same rules as scoring).
    Players absent from a file are simply omitted for that file.
    """
    union: dict[int, set[str]] = {}
    for p in match_json_paths:
        if not p.is_file():
            continue
        data = load_match_json(p)
        if not isinstance(data, dict):
            continue
        content = data.get("content") or {}
        per = outfield_roles_by_player_for_match(content)
        for pid, rid in per.items():
            letter = _role_id_to_letter(rid)
            if letter is None:
                continue
            union.setdefault(pid, set()).add(letter)
    return {pid: frozenset(s) for pid, s in union.items()}


def build_eligible_roles(
    listed_position: str | None,
    match_roles: frozenset[str] | None,
) -> frozenset[str]:
    """
    Listed from master (Defender/Midfielder/Forward) plus optional match union.
    If match_roles is non-empty, eligibility = listed_roles ∪ match_roles.
    If match_roles is empty, only listed roles count (rule: missing in-game → listed only).
    """
    listed_set: set[str] = set()
    if listed_position:
        lab = listed_position.strip().lower()
        if lab == "goalkeeper":
            pass
        else:
            r = _norm_pos(listed_position)
            if r:
                listed_set.add(r)

    m = match_roles or frozenset()
    if len(m) > 0:
        return frozenset(listed_set | set(m))
    return frozenset(listed_set)


def _outfield_candidates(
    squad_ids: list[int],
    master: dict[int, dict[str, Any]],
    scores: dict[int, int],
    match_roles_union: dict[int, frozenset[str]],
) -> list[OutfieldCandidate]:
    rows: list[OutfieldCandidate] = []
    for pid in squad_ids:
        meta = master.get(pid) or {}
        pos = meta.get("position") or ""
        if str(pos).strip().lower() == "goalkeeper":
            continue
        name = meta.get("player_name") or f"player_{pid}"
        sc = max(0, scores.get(pid, 0))
        listed_label = None
        pl = str(pos).strip()
        if pl:
            listed_label = pl if pl[0].isupper() else pl.capitalize()
        elig = build_eligible_roles(pos, match_roles_union.get(pid))
        if not elig:
            continue
        rows.append(
            OutfieldCandidate(
                player_id=pid,
                player_name=name,
                score=sc,
                eligible_roles=elig,
                listed_label=listed_label if listed_label and listed_label != "Goalkeeper" else None,
            )
        )
    # Stable order: higher score first, then player_id (for deterministic ties)
    rows.sort(key=lambda x: (-x.score, x.player_id))
    return rows


def _pick_goalkeeper(
    squad_ids: list[int],
    master: dict[int, dict[str, Any]],
    scores: dict[int, int],
) -> tuple[int | None, str, int]:
    """Among squad GKs, take the one with highest GW score (no separate 'best GK' rule)."""
    gks: list[tuple[int, int, str]] = []
    for pid in squad_ids:
        meta = master.get(pid) or {}
        if str(meta.get("position") or "").strip().lower() != "goalkeeper":
            continue
        tid = meta.get("team_id")
        tid_i = int(tid) if tid is not None else None
        sc = keeper_score(pid, tid_i, scores)
        name = meta.get("player_name") or f"player_{pid}"
        gks.append((pid, sc, name))
    if not gks:
        return None, "", 0
    gks.sort(key=lambda x: (-x[1], x[0]))
    pid, sc, name = gks[0]
    return pid, name, sc


def _flexible_for_pick(listed_label: str | None, role: str, eligible: frozenset[str]) -> bool:
    if len(eligible) > 1:
        return True
    if not listed_label:
        return len(eligible) > 1
    lr = _norm_pos(listed_label)
    return lr is not None and lr != role


def _solve_formation(
    players: tuple[OutfieldCandidate, ...],
    nd: int,
    nm: int,
    nf: int,
) -> tuple[int, list[tuple[str, OutfieldCandidate]]]:
    """
    Maximize sum of scores with at most nd/nm/nf per line and at most 10 outfielders.
    Returns (total, list of (role, player)).
    """
    n = len(players)
    roles_order = (ROLE_DEF, ROLE_MID, ROLE_FWD)

    @lru_cache(maxsize=None)
    def best(i: int, a: int, b: int, c: int) -> int:
        if i == n:
            return 0
        if a + b + c >= 10:
            return 0
        p = players[i]
        s0 = best(i + 1, a, b, c)
        best_v = s0
        if ROLE_DEF in p.eligible_roles and a < nd:
            best_v = max(best_v, p.score + best(i + 1, a + 1, b, c))
        if ROLE_MID in p.eligible_roles and b < nm:
            best_v = max(best_v, p.score + best(i + 1, a, b + 1, c))
        if ROLE_FWD in p.eligible_roles and c < nf:
            best_v = max(best_v, p.score + best(i + 1, a, b, c + 1))
        return best_v

    total = best(0, 0, 0, 0)

    @lru_cache(maxsize=None)
    def reconstruct(i: int, a: int, b: int, c: int) -> list[tuple[str, OutfieldCandidate]]:
        if i == n:
            return []
        if a + b + c >= 10:
            return []
        p = players[i]
        if best(i, a, b, c) == best(i + 1, a, b, c):
            return reconstruct(i + 1, a, b, c)
        if ROLE_DEF in p.eligible_roles and a < nd:
            if best(i, a, b, c) == p.score + best(i + 1, a + 1, b, c):
                return [(ROLE_DEF, p)] + reconstruct(i + 1, a + 1, b, c)
        if ROLE_MID in p.eligible_roles and b < nm:
            if best(i, a, b, c) == p.score + best(i + 1, a, b + 1, c):
                return [(ROLE_MID, p)] + reconstruct(i + 1, a, b + 1, c)
        if ROLE_FWD in p.eligible_roles and c < nf:
            if best(i, a, b, c) == p.score + best(i + 1, a, b, c + 1):
                return [(ROLE_FWD, p)] + reconstruct(i + 1, a, b, c + 1)
        return reconstruct(i + 1, a, b, c)

    picks = reconstruct(0, 0, 0, 0)
    return total, picks


def compute_best_xi(
    auction_user_id: str,
    gw_id: int,
    squad_player_ids: list[int],
    gw_scores_by_player: dict[int, int],
    master_players: dict[int, dict[str, Any]],
    match_json_paths: list[Path] | None = None,
) -> BestXIResult:
    """
    Core API: all inputs as in-memory structures. match_json_paths optional (listed-only eligibility if None).
    """
    match_union = union_match_roles_for_gameweek(match_json_paths or [])
    candidates = _outfield_candidates(squad_player_ids, master_players, gw_scores_by_player, match_union)
    players_tuple = tuple(candidates)

    gk_id, gk_name, gk_score = _pick_goalkeeper(squad_player_ids, master_players, gw_scores_by_player)

    best_total = -1
    best_form: tuple[int, int, int] | None = None
    best_picks: list[tuple[str, OutfieldCandidate]] = []

    for nd, nm, nf in ALLOWED_FORMATIONS:
        tot, picks = _solve_formation(players_tuple, nd, nm, nf)
        if tot > best_total:
            best_total = tot
            best_form = (nd, nm, nf)
            best_picks = picks

    if best_form is None:
        best_form = (4, 4, 2)
        best_picks = []

    nd, nm, nf = best_form
    label = f"{nd}-{nm}-{nf}"

    outfield_rows: list[OutfieldPick] = []
    for role, oc in best_picks:
        fl = _flexible_for_pick(oc.listed_label, role, oc.eligible_roles)
        outfield_rows.append(
            OutfieldPick(
                player_id=oc.player_id,
                player_name=oc.player_name,
                role=role,
                score=oc.score,
                flexible=fl,
            )
        )

    empty = 10 - len(outfield_rows)
    xi_total = gk_score + sum(p.score for p in outfield_rows)

    return BestXIResult(
        auction_user_id=str(auction_user_id),
        gw_id=int(gw_id),
        formation_label=label,
        formation_tuple=(nd, nm, nf),
        goalkeeper_id=gk_id,
        goalkeeper_name=gk_name or ("(none)" if gk_id is None else ""),
        goalkeeper_score=gk_score,
        outfield=outfield_rows,
        empty_outfield_slots=max(0, empty),
        total_points=xi_total,
    )


def parse_squad_arg(path_or_csv: str) -> list[int]:
    """Comma-separated list or path to file with one player_id per line."""
    p = Path(path_or_csv)
    if p.is_file():
        ids: list[int] = []
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            ids.append(int(line.split(",")[0].strip()))
        return ids
    return [int(x.strip()) for x in path_or_csv.split(",") if x.strip()]


def format_result_text(r: BestXIResult) -> str:
    lines = [
        f"auction_user_id: {r.auction_user_id}",
        f"gw_id: {r.gw_id}",
        f"formation: {r.formation_label} {r.formation_tuple}",
        f"goalkeeper: id={r.goalkeeper_id} name={r.goalkeeper_name!r} score={r.goalkeeper_score}",
        f"outfield ({len(r.outfield)} / 10, empty_slots={r.empty_outfield_slots}):",
    ]
    for o in r.outfield:
        flex = "flex" if o.flexible else "fixed"
        lines.append(
            f"  {o.role}  id={o.player_id}  {o.player_name!r}  score={o.score}  ({flex})"
        )
    lines.append(f"total_points: {r.total_points}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute best XI for a squad and gameweek (local).")
    parser.add_argument("--auction-user-id", default="local-test", help="Label for output only.")
    parser.add_argument("--gw-id", type=int, default=1)
    parser.add_argument(
        "--master",
        type=Path,
        default=_ROOT / "Player_List" / "master_player_list.csv",
        help="Master player list CSV (position column).",
    )
    parser.add_argument("--scores", type=Path, required=True, help="GW scores CSV (player_id, score, ...).")
    parser.add_argument(
        "--matches-dir",
        type=Path,
        default=None,
        help="Folder of match JSON files for this GW (optional; listed-only if omitted).",
    )
    parser.add_argument(
        "--squad",
        required=True,
        help="Comma-separated player_ids or path to a text file with one id per line.",
    )
    args = parser.parse_args()

    master = load_master_player_list(args.master)
    scores = load_gw_scores_csv(args.scores)
    squad = parse_squad_arg(str(args.squad))

    match_paths: list[Path] | None = None
    if args.matches_dir is not None:
        md = Path(args.matches_dir)
        if md.is_dir():
            match_paths = sorted(md.glob("*.json"))
        else:
            raise SystemExit(f"Not a directory: {md}")

    r = compute_best_xi(
        auction_user_id=args.auction_user_id,
        gw_id=args.gw_id,
        squad_player_ids=squad,
        gw_scores_by_player=scores,
        master_players=master,
        match_json_paths=match_paths,
    )
    print(format_result_text(r))


if __name__ == "__main__":
    main()
