"""Build master_player_list.csv from UCL squad JSON files in this competition folder."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[4]
_TESTS = _REPO / "Tests"
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import finalize_player_display_name  # noqa: E402

_COMP = Path(__file__).resolve().parents[1]
RAW_DIR = _COMP / "player-pool" / "squads"
OUT_CSV = _COMP / "player-pool" / "master_player_list.csv"

POSITION_ROLE_MAP: dict[str, str] = {
    "AM": "Midfielder", "CB": "Defender", "CM": "Midfielder", "defender": "Defender",
    "DM": "Midfielder", "forward": "Forward", "GK": "Goalkeeper", "keeper": "Goalkeeper",
    "LB": "Defender", "LM": "Midfielder", "LW": "Forward", "LWB": "Defender",
    "midfielder": "Midfielder", "RB": "Defender", "RM": "Midfielder", "RW": "Forward",
    "RWB": "Defender", "ST": "Forward",
}


def map_position_to_role(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s in POSITION_ROLE_MAP:
        return POSITION_ROLE_MAP[s]
    return {k.lower(): v for k, v in POSITION_ROLE_MAP.items()}.get(s.lower())


def load_player_rows(json_path: Path) -> list[dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    rows = []
    team_name = data.get("team_name")
    team_id = data.get("team_id")
    squad_url = data.get("squad_url", "")
    for p in data.get("players", []):
        rows.append({
            "player_id": p.get("player_id"),
            "player_name": p.get("player_name"),
            "team_id": team_id,
            "team_name": team_name,
            "position": p.get("position"),
            "href": p.get("href"),
            "source_file": json_path.name,
            "_squad_url": squad_url,
        })
    return rows


def collapse_goalkeepers(rows: list[dict]) -> list[dict]:
    gk_rows, non_gk_rows = [], []
    for row in rows:
        if map_position_to_role(str(row.get("position") or "").strip()) == "Goalkeeper":
            gk_rows.append(row)
        else:
            non_gk_rows.append(row)
    seen = {}
    for row in gk_rows:
        tid = row["team_id"]
        if tid is not None and tid not in seen:
            seen[tid] = row
    bundles = []
    for tid, rep in seen.items():
        bundles.append({
            "player_id": 90_000_000 + int(tid),
            "player_name": f"{rep['team_name']} Keepers",
            "team_id": rep["team_id"],
            "team_name": rep["team_name"],
            "position": "GK",
            "href": rep.get("_squad_url") or rep.get("href", ""),
            "source_file": rep["source_file"],
        })
    return non_gk_rows + bundles


def main() -> None:
    files = sorted(RAW_DIR.glob("*_Squad.json"))
    all_rows = []
    for fp in files:
        all_rows.extend(load_player_rows(fp))
    all_rows = collapse_goalkeepers(all_rows)
    for r in all_rows:
        r.pop("_squad_url", None)

    master = []
    for row in all_rows:
        raw = row.get("position")
        if not raw or str(raw).strip() == "Coach":
            continue
        mapped = map_position_to_role(raw)
        if mapped is None:
            continue
        master.append({
            "player_id": row["player_id"],
            "player_name": finalize_player_display_name(row.get("player_name")),
            "team_id": row["team_id"],
            "team_name": row["team_name"],
            "position": mapped,
            "href": row.get("href"),
            "source_files": row.get("source_file"),
        })
    master.sort(key=lambda r: (str(r["player_name"] or "").lower(), str(r["player_id"] or "")))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["player_id", "player_name", "team_id", "team_name", "position", "href", "source_files"],
        )
        w.writeheader()
        w.writerows(master)
    print(f"Wrote {len(master)} players from {len(files)} squad file(s) -> {OUT_CSV}")


if __name__ == "__main__":
    main()
