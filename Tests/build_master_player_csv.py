import csv
import json
import re
import sys
from pathlib import Path


_TESTS = Path(__file__).resolve().parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import finalize_player_display_name  # noqa: E402


RAW_DIR = Path(r"C:\Users\trive\HFWFiles\Player_List\Raw_Files")
OUT_CSV = Path(r"C:\Users\trive\HFWFiles\Player_List\master_player_list.csv")

# FotMob primary codes -> fantasy role (single label in exported CSV).
# LW / RW stay Forward (not Midfielder).
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
    "midfielder": "Midfielder",
    "RB": "Defender",
    "RM": "Midfielder",
    "RW": "Forward",
    "ST": "Forward",
}


def map_position_to_role(raw: str | None) -> str | None:
    """Return mapped role, or None if unknown code (not Coach — handle upstream)."""
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
    """
    Replace `position` with mapped role. Rows that cannot be mapped are dropped.
    Returns (new_rows, stats) with keys skipped_empty, skipped_coach, skipped_unmapped.
    """
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

    # New schema: object with team metadata + players list.
    if isinstance(data, dict) and isinstance(data.get("players"), list):
        team_name = data.get("team_name") or normalize_team_name_from_file(json_path.name)
        team_id = data.get("team_id")
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
                }
            )
        return rows

    # Legacy schema: list of {"name","href"}.
    if isinstance(data, list):
        team_name = normalize_team_name_from_file(json_path.name)
        for p in data:
            href = p.get("href")
            player_id = None
            if href:
                match = re.search(r"/players/(\d+)/", href)
                if match:
                    player_id = int(match.group(1))
            rows.append(
                {
                    "player_id": player_id,
                    "player_name": p.get("name"),
                    "team_id": None,
                    "team_name": team_name,
                    "position": None,
                    "href": href,
                    "source_file": json_path.name,
                }
            )
        return rows

    return rows


def build_master_unique(rows: list[dict]) -> list[dict]:
    # Deduplicate by player_id; if missing, fallback to player_name+href key.
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
    all_rows = []
    for fp in files:
        all_rows.extend(load_player_rows(fp))

    master = build_master_unique(all_rows)
    master_mapped, stats = apply_role_map_to_master(master)

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig: BOM helps Excel on Windows recognize UTF-8 when opening the CSV.
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

    print(f"Input squad files: {len(files)}")
    print(f"Raw rows loaded: {len(all_rows)}")
    print(f"Unique players (before role map / drops): {len(master)}")
    print(
        "Skipped: empty position=%(skipped_empty)s, Coach=%(skipped_coach)s, unmapped=%(skipped_unmapped)s"
        % stats
    )
    print(f"Unique players written: {len(master_mapped)}")
    print(f"Wrote: {OUT_CSV}")


if __name__ == "__main__":
    main()
