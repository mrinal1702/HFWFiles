"""
Fetch locked gameweek squads from Supabase and compute Best XI locally.

Does not write to Supabase — prints a summary and optionally saves JSON.

Usage (repo root):
  python procedures/compute_auction_best_xi.py --auction-id 7 --gw-id 1
  python procedures/compute_auction_best_xi.py --auction-id 7 --gw-id 1 --output out/best_xi_7_gw1.json
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent.parent
_PROC = Path(__file__).resolve().parent
if str(_PROC) not in sys.path:
    sys.path.insert(0, str(_PROC))

from best_xi import BestXIResult, compute_best_xi, load_master_player_list  # noqa: E402

_DEFAULT_MASTER = _ROOT / "Player_List" / "master_player_list.csv"
_DEFAULT_MATCHES = _ROOT / "Matches_Raw" / "World Cup 2026"
_ENV_LOCAL = _ROOT / "auction-app" / ".env.local"


def _load_env_local(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip()
    return out


class SupabaseClient:
    def __init__(self, url: str, key: str) -> None:
        self._base = url.rstrip("/")
        self._key = key

    def _request(self, table: str, query: str) -> list[dict[str, Any]]:
        encoded = urllib.parse.urlencode({"select": "*"}, safe="*(),.")
        # query already contains filter params like auction_id=eq.7
        url = f"{self._base}/rest/v1/{table}?{query}&{encoded}"
        req = urllib.request.Request(
            url,
            headers={
                "apikey": self._key,
                "Authorization": f"Bearer {self._key}",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {table} HTTP {exc.code}: {body}") from exc
        if not isinstance(data, list):
            raise RuntimeError(f"Unexpected Supabase response for {table}")
        return data

    def gameweek_squads(self, auction_id: int, game_week_id: int) -> list[dict[str, Any]]:
        q = f"auction_id=eq.{auction_id}&game_week_id=eq.{game_week_id}"
        return self._request("gameweek_squads", q)

    def auction_users(self, auction_id: int) -> list[dict[str, Any]]:
        q = f"auction_id=eq.{auction_id}&order=id.asc"
        return self._request("auction_users", q)

    def player_scores(self, game_week_id: int, player_ids: list[int]) -> dict[int, int]:
        if not player_ids:
            return {}
        scores: dict[int, int] = {}
        batch_size = 200
        for i in range(0, len(player_ids), batch_size):
            batch = player_ids[i : i + batch_size]
            id_list = ",".join(str(x) for x in batch)
            q = f"game_week_id=eq.{game_week_id}&player_id=in.({id_list})"
            rows = self._request("player_scores", q)
            for row in rows:
                try:
                    pid = int(row["player_id"])
                    scores[pid] = max(0, int(float(row.get("score") or 0)))
                except (TypeError, ValueError, KeyError):
                    continue
        return scores


def _gw_match_json_paths(matches_dir: Path) -> list[Path]:
    if not matches_dir.is_dir():
        return []
    paths: list[Path] = []
    for p in sorted(matches_dir.glob("*.json")):
        if "manifest" in p.name.lower():
            continue
        if "_Vs_" not in p.name and "_vs_" not in p.name:
            continue
        paths.append(p)
    return paths


def _result_to_dict(r: BestXIResult, user_name: str) -> dict[str, Any]:
    xi_ids = set()
    if r.goalkeeper_id is not None:
        xi_ids.add(r.goalkeeper_id)
    for o in r.outfield:
        xi_ids.add(o.player_id)

    return {
        "auction_user_id": r.auction_user_id,
        "user_name": user_name,
        "gw_id": r.gw_id,
        "formation": r.formation_label,
        "formation_tuple": list(r.formation_tuple),
        "total_points": r.total_points,
        "goalkeeper": {
            "player_id": r.goalkeeper_id,
            "player_name": r.goalkeeper_name,
            "score": r.goalkeeper_score,
        },
        "outfield": [
            {
                "player_id": o.player_id,
                "player_name": o.player_name,
                "role": o.role,
                "score": o.score,
                "flexible": o.flexible,
            }
            for o in r.outfield
        ],
        "best_xi_player_ids": sorted(xi_ids),
        "empty_outfield_slots": r.empty_outfield_slots,
    }


def _format_summary(row: dict[str, Any]) -> str:
    lines = [
        f"{row['user_name']} (user {row['auction_user_id']}): "
        f"{row['total_points']} pts — {row['formation']}",
    ]
    gk = row["goalkeeper"]
    if gk["player_id"] is not None:
        lines.append(f"  GK  {gk['player_name']} ({gk['player_id']}) = {gk['score']}")
    for o in row["outfield"]:
        flex = " flex" if o["flexible"] else ""
        lines.append(f"  {o['role']}  {o['player_name']} ({o['player_id']}) = {o['score']}{flex}")
    if row["empty_outfield_slots"]:
        lines.append(f"  ({row['empty_outfield_slots']} empty outfield slot(s))")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compute Best XI from Supabase gameweek_squads (local, read-only)."
    )
    parser.add_argument("--auction-id", type=int, required=True)
    parser.add_argument("--gw-id", type=int, default=1)
    parser.add_argument("--master", type=Path, default=_DEFAULT_MASTER)
    parser.add_argument(
        "--matches-dir",
        type=Path,
        default=_DEFAULT_MATCHES,
        help="Folder of match JSON files for in-match role eligibility.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional JSON output path.",
    )
    parser.add_argument(
        "--env",
        type=Path,
        default=_ENV_LOCAL,
        help="Path to auction-app/.env.local for Supabase credentials.",
    )
    args = parser.parse_args()

    env = _load_env_local(args.env)
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit(
            f"Missing Supabase credentials in {args.env}. "
            "Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    if not args.master.is_file():
        raise SystemExit(f"Master player list not found: {args.master}")

    sb = SupabaseClient(url, key)
    users = sb.auction_users(args.auction_id)
    if not users:
        raise SystemExit(f"No auction_users for auction_id={args.auction_id}")

    name_by_id = {int(u["id"]): str(u.get("name") or f"user_{u['id']}") for u in users}
    squads = sb.gameweek_squads(args.auction_id, args.gw_id)
    if not squads:
        raise SystemExit(
            f"No gameweek_squads rows for auction_id={args.auction_id}, game_week_id={args.gw_id}"
        )

    squad_by_user: dict[int, list[int]] = {}
    for row in squads:
        uid = int(row["auction_user_id"])
        pid = int(row["player_id"])
        squad_by_user.setdefault(uid, []).append(pid)

    all_player_ids = sorted({pid for ids in squad_by_user.values() for pid in ids})
    gw_scores = sb.player_scores(args.gw_id, all_player_ids)

    master = load_master_player_list(args.master)
    match_paths = _gw_match_json_paths(args.matches_dir)

    print(
        f"Auction {args.auction_id}, GW {args.gw_id}: "
        f"{len(squad_by_user)} managers, {len(squads)} squad rows, "
        f"{len(gw_scores)}/{len(all_player_ids)} players with scores, "
        f"{len(match_paths)} match JSON files for roles."
    )
    print()

    results: list[dict[str, Any]] = []
    for uid in sorted(squad_by_user.keys(), key=lambda x: name_by_id.get(x, "")):
        squad_ids = squad_by_user[uid]
        missing_scores = [pid for pid in squad_ids if pid not in gw_scores]
        r = compute_best_xi(
            auction_user_id=str(uid),
            gw_id=args.gw_id,
            squad_player_ids=squad_ids,
            gw_scores_by_player=gw_scores,
            master_players=master,
            match_json_paths=match_paths,
        )
        row = _result_to_dict(r, name_by_id.get(uid, str(uid)))
        row["squad_size"] = len(squad_ids)
        row["missing_score_player_ids"] = missing_scores
        results.append(row)
        print(_format_summary(row))
        print()

    results.sort(key=lambda x: (-x["total_points"], x["user_name"]))

    payload = {
        "auction_id": args.auction_id,
        "gw_id": args.gw_id,
        "managers": results,
        "meta": {
            "squad_rows": len(squads),
            "match_json_files": len(match_paths),
            "players_with_scores": len(gw_scores),
        },
    }

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Wrote {args.output}")

    print("-- Leaderboard (Best XI totals) --")
    for rank, row in enumerate(results, start=1):
        print(f"  {rank}. {row['user_name']}: {row['total_points']} ({row['formation']})")


if __name__ == "__main__":
    main()
