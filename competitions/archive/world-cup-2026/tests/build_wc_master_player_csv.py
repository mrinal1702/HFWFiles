"""
Build master_player_list.csv from World Cup 2026 squad JSON files.

Reads all *_Squad.json files from Player_List/World Cup 2026/ and writes
a new master_player_list.csv to Player_List/.

Usage:
    python build_wc_master_player_csv.py
"""

import csv
import json
import re
import sys
from pathlib import Path


_TESTS = Path(__file__).resolve().parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import finalize_player_display_name  # noqa: E402


RAW_DIR = Path(r"C:\Users\trive\HFWFiles\Player_List\World Cup 2026")
OUT_CSV = Path(r"C:\Users\trive\HFWFiles\Player_List\master_player_list.csv")

POSITION_ROLE_MAP: dict[str, str] = {
    "AM": "Midfielder",
    "CB": "Defender",
    "CM": "Midfielder",
    "defender": "Defender",
    "DM": "Midfielder",
    "forward": "Forward",
    "GK": "Goalkeeper",
    "keeper": "Goalkeeper",
    "LB": "Defender",
    "LM": "Midfielder",
    "LW": "Forward",
    "LWB": "Defender",
    "midfielder": "Midfielder",
    "RB": "Defender",
    "RM": "Midfielder",
    "RW": "Forward",
    "RWB": "Defender",
    "ST": "Forward",
}


def map_position_to_role(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s in POSITION_ROLE_MAP:
        return POSITION_ROLE_MAP[s]
    key = s.lower()
    lower_map = {k.lower(): v for k, v in POSITION_ROLE_MAP.items()}
    return lower_map.get(key)


def apply_role_map_to_master(rows: list[dict]) -> tuple[list[dict], dict[str, int]]:
    stats = {"skipped_coach": 0, "skipped_unmapped": 0, "skipped_empty": 0}
    out: list[dict] = []
    for r in rows:
        raw = r.get("position")
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            stats["skipped_empty"] += 1
            continue
        if str(raw).strip() == "Coach":
            stats["skipped_coach"] += 1
            continue
        mapped = map_position_to_role(raw)
        if mapped is None:
            stats["skipped_unmapped"] += 1
            print(f"  WARNING: unmapped position {raw!r} for {r.get('player_name')} ({r.get('player_id')})")
            continue
        row = dict(r)
        row["position"] = mapped
        out.append(row)
    return out, stats


def normalize_team_name_from_file(file_name: str) -> str:
    base = file_name.replace("_Squad.json", "")
    return base.replace("_", " ").strip()


def load_player_rows(json_path: Path) -> list[dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    rows = []

    if isinstance(data, dict) and isinstance(data.get("players"), list):
        team_name = data.get("team_name") or normalize_team_name_from_file(json_path.name)
        team_id = data.get("team_id")
        squad_url = data.get("squad_url", "")
        for p in data["players"]:
            rows.append(
                {
                    "player_id": p.get("player_id"),
                    "player_name": p.get("player_name"),
                    "team_id": team_id,
                    "team_name": team_name,
                    "position": p.get("position"),
                    "href": p.get("href"),
                    "source_file": json_path.name,
                    # kept only for collapse_goalkeepers; not written to CSV
                    "_squad_url": squad_url,
                }
            )
        return rows

    return rows


def collapse_goalkeepers(rows: list[dict]) -> list[dict]:
    """
    Replace all individual GK rows for each national team with a single
    '{Team} Keepers' row using a synthetic player_id.

    Synthetic ID scheme: 90_000_000 + team_id
      - Deterministic and unique per team
      - Far above real FotMob player IDs (currently ~1.9 M max)

    Scoring note: when player_name ends with ' Keepers', the scoring pipeline
    should query the match data for any GK from team_name and use their stats
    rather than looking up a specific player_id.
    """
    # Identify GKs by mapping through POSITION_ROLE_MAP so "keeper", "GK", etc. all caught
    gk_rows: list[dict] = []
    non_gk_rows: list[dict] = []
    for row in rows:
        if map_position_to_role(str(row.get("position") or "").strip()) == "Goalkeeper":
            gk_rows.append(row)
        else:
            non_gk_rows.append(row)

    # Build one keeper-bundle row per team (keyed by team_id).
    seen_teams: dict = {}
    for row in gk_rows:
        tid = row["team_id"]
        if tid not in seen_teams:
            seen_teams[tid] = row  # first GK seen carries the team metadata

    keeper_bundle_rows: list[dict] = []
    for tid, rep in seen_teams.items():
        synthetic_id = 90_000_000 + int(tid)
        keeper_bundle_rows.append(
            {
                "player_id": synthetic_id,
                "player_name": f"{rep['team_name']} Keepers",
                "team_id": rep["team_id"],
                "team_name": rep["team_name"],
                "position": "GK",
                "href": rep.get("_squad_url") or rep.get("href", ""),
                "source_file": rep["source_file"],
                "_squad_url": rep.get("_squad_url", ""),
            }
        )

    return non_gk_rows + keeper_bundle_rows


def build_master_unique(rows: list[dict]) -> list[dict]:
    grouped = {}
    for row in rows:
        key = row["player_id"]
        if key is None:
            key = f"NOID::{(row['player_name'] or '').strip()}::{row.get('href') or ''}"
        grouped.setdefault(key, []).append(row)

    master = []
    for key, entries in grouped.items():
        best = next((e for e in entries if e.get("team_id") is not None), entries[0])
        teams = sorted({e["team_name"] for e in entries if e.get("team_name")})
        team_ids = sorted({str(e["team_id"]) for e in entries if e.get("team_id") is not None})
        sources = sorted({e["source_file"] for e in entries if e.get("source_file")})

        master.append(
            {
                "player_id": best.get("player_id"),
                "player_name": finalize_player_display_name(best.get("player_name")),
                "team_id": ";".join(team_ids),
                "team_name": ";".join(teams),
                "position": best.get("position"),
                "href": best.get("href"),
                "source_files": ";".join(sources),
            }
        )

    master.sort(key=lambda r: (str(r["player_name"] or "").lower(), str(r["player_id"] or "")))
    return master


def main() -> None:
    files = sorted(RAW_DIR.glob("*_Squad.json"))
    if not files:
        print(f"No *_Squad.json files found in {RAW_DIR}")
        return

    all_rows = []
    for fp in files:
        rows = load_player_rows(fp)
        print(f"  Loaded {len(rows)} rows from {fp.name}")
        all_rows.extend(rows)

    # Collapse per-team GKs into a single '{Team} Keepers' bundle row.
    gk_count_before = sum(1 for r in all_rows if map_position_to_role(str(r.get("position") or "").strip()) == "Goalkeeper")
    all_rows = collapse_goalkeepers(all_rows)
    gk_count_after = sum(1 for r in all_rows if str(r.get("position") or "").strip() == "GK")
    print(f"  GK collapse: {gk_count_before} individual GK rows -> {gk_count_after} Keepers bundle(s)")

    # Strip the internal _squad_url scratch field before building the master.
    for r in all_rows:
        r.pop("_squad_url", None)

    master = build_master_unique(all_rows)
    master_mapped, stats = apply_role_map_to_master(master)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "player_id",
                "player_name",
                "team_id",
                "team_name",
                "position",
                "href",
                "source_files",
            ],
        )
        writer.writeheader()
        writer.writerows(master_mapped)

    print(f"\nInput squad files : {len(files)}")
    print(f"Raw rows loaded   : {len(all_rows)}")
    print(f"Unique players (before role map): {len(master)}")
    print(
        f"Skipped — empty position: {stats['skipped_empty']}, "
        f"Coach: {stats['skipped_coach']}, "
        f"unmapped: {stats['skipped_unmapped']}"
    )
    print(f"Unique players written: {len(master_mapped)}")
    print(f"Wrote: {OUT_CSV}")


if __name__ == "__main__":
    main()
