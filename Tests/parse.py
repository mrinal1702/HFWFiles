import json
import re
import urllib.request
from pathlib import Path


ROOT = Path(r"C:\Users\trive\HFWFiles")
RAW_FILES_DIR = ROOT / "Player_List" / "Raw_Files"
MATCH_FILE = ROOT / "Tests" / "Match1.json"
OUTPUT_FILE = ROOT / "Tests" / "player_core_extracted.json"


def parse_player_id(href: str) -> int | None:
    match = re.search(r"/players/(\d+)/", href or "")
    return int(match.group(1)) if match else None


def clean_player_name(raw_name: str) -> str:
    if not raw_name:
        return ""

    name = raw_name.replace("icInjury", "")
    name = re.split(
        r"(Injured\s*-|Knock\s*-|Strain injury\s*-|Knee injury\s*-|Broken foot\s*-|"
        r"Hamstring injury\s*-|Cruciate ligament injury\s*-|Calf injury\s*-|"
        r"Thigh injury\s*-|Ankle injury\s*-)",
        name,
    )[0]

    # Remove accidental country+digits suffix from scraped labels.
    countries = (
        "Portugal|Spain|Brazil|Uruguay|France|Denmark|Netherlands|Poland|England|"
        "Sweden|Mozambique|Angola|Senegal|Greece|Georgia|Belgium|Japan|Ivory Coast|"
        "Colombia|USA|Germany"
    )
    name = re.sub(rf"({countries})\d+$", "", name).strip()

    return name.strip()


def extract_club_from_player_page(player_href: str) -> tuple[int | None, str | None]:
    try:
        req = urllib.request.Request(player_href, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
    except Exception:
        return None, None

    match = re.search(r"/teams/(\d+)/overview/([a-z0-9\-]+)", html)
    if not match:
        return None, None

    club_id = int(match.group(1))
    slug = match.group(2)
    club_name = " ".join(
        "CP" if part.lower() == "cp" else part.capitalize() for part in slug.split("-")
    )
    return club_id, club_name


def build_rows() -> list[dict]:
    squad_files = [
        RAW_FILES_DIR / "Sporting_CP_Squad.json",
        RAW_FILES_DIR / "Barcelona_Squad.json",
    ]
    rows: list[dict] = []

    for squad_file in squad_files:
        with squad_file.open("r", encoding="utf-8") as f:
            players = json.load(f)

        for item in players:
            rows.append(
                {
                    "source_file": squad_file.name,
                    "player_id": parse_player_id(item.get("href", "")),
                    "player_name": clean_player_name(item.get("name", "")),
                    "href": item.get("href"),
                }
            )

    # De-duplicate within each squad source by player_id.
    deduped = {}
    for row in rows:
        deduped[(row["source_file"], row["player_id"])] = row
    rows = list(deduped.values())

    # Resolve club id/name by sampling one player page per squad source.
    club_lookup: dict[str, tuple[int | None, str | None]] = {}
    for source_file in sorted({r["source_file"] for r in rows}):
        sample = next(r for r in rows if r["source_file"] == source_file and r["href"])
        club_lookup[source_file] = extract_club_from_player_page(sample["href"])

    for row in rows:
        club_id, club_name = club_lookup.get(row["source_file"], (None, None))
        row["club_id"] = club_id
        row["club_name"] = club_name
        row["position"] = None  # set from Match1 for Barcelona where available

    return rows


def enrich_positions_from_match1(rows: list[dict]) -> dict:
    with MATCH_FILE.open("r", encoding="utf-8") as f:
        match_data = json.load(f)

    lineup = match_data.get("content", {}).get("lineup", {})
    home_team = lineup.get("homeTeam", {})

    if home_team.get("id") != 8634:
        return {}

    barca_players = list(home_team.get("starters", [])) + list(home_team.get("subs", []))
    coach = home_team.get("coach")
    if coach:
        barca_players.append(coach)

    position_map = {0: "Goalkeeper", 1: "Defender", 2: "Midfielder", 3: "Forward"}
    match_barca = {}
    for p in barca_players:
        player_id = p.get("id")
        if player_id is None:
            continue
        match_barca[int(player_id)] = {
            "name": p.get("name"),
            "position": position_map.get(p.get("usualPlayingPositionId")),
        }

    for row in rows:
        if row["source_file"] == "Barcelona_Squad.json":
            match_player = match_barca.get(row["player_id"])
            if match_player:
                row["position"] = match_player["position"]

    return match_barca


def consistency_report(rows: list[dict], match_barca: dict) -> None:
    barca_rows = [r for r in rows if r["source_file"] == "Barcelona_Squad.json"]
    barca_ids = {r["player_id"] for r in barca_rows if r["player_id"] is not None}
    match_ids = set(match_barca.keys())

    common_ids = sorted(barca_ids & match_ids)
    only_in_barca_file = sorted(barca_ids - match_ids)
    only_in_match = sorted(match_ids - barca_ids)

    def normalize(text: str) -> str:
        return re.sub(r"[^a-z]", "", (text or "").lower())

    mismatches = []
    for player_id in common_ids:
        name_file = next(r["player_name"] for r in barca_rows if r["player_id"] == player_id)
        name_match = match_barca[player_id]["name"]
        if normalize(name_file) != normalize(name_match):
            mismatches.append((player_id, name_file, name_match))

    print(f"Barcelona players in squad file: {len(barca_ids)}")
    print(f"Barcelona players in Match1 lineup/coaching: {len(match_ids)}")
    print(f"Common player IDs: {len(common_ids)}")
    print(f"Only in Barcelona squad file: {len(only_in_barca_file)} -> {only_in_barca_file}")
    print(f"Only in Match1: {len(only_in_match)} -> {only_in_match}")
    print(f"Name mismatches on common IDs: {len(mismatches)}")
    for mismatch in mismatches:
        print("MISMATCH:", mismatch)


def main() -> None:
    rows = build_rows()
    match_barca = enrich_positions_from_match1(rows)

    export_rows = sorted(
        (
            {
                "player_id": r["player_id"],
                "player_name": r["player_name"],
                "club_id": r["club_id"],
                "club_name": r["club_name"],
                "position": r["position"],
                "source_file": r["source_file"],
            }
            for r in rows
        ),
        key=lambda x: (x["source_file"], x["player_id"] or 0),
    )

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(export_rows, f, ensure_ascii=False, indent=2)

    print(f"Wrote: {OUTPUT_FILE}")
    print(f"Total unique extracted players: {len(export_rows)}")
    consistency_report(rows, match_barca)


if __name__ == "__main__":
    main()