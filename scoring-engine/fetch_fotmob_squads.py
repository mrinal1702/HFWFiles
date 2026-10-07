"""
Scrape FotMob squad pages for configured teams, then enrich each player via
their profile page: canonical display name + primary position (__NEXT_DATA__).

Rate limits:
- ~0.5s between each player profile request
- ~1–2s pause after finishing each club (before the next squad fetch)
"""

from __future__ import annotations

import json
import random
import re
import sys
import time
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

_TESTS = Path(__file__).resolve().parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import (  # noqa: E402
    finalize_player_display_name,
    fetch_player_display_name_and_primary_position,
)


OUT_DIR = Path(r"C:\Users\trive\HFWFiles\Player_List\Raw_Files")

TEAMS = [
    {"team_name": "AFC Bournemouth", "team_id": 8678, "slug": "afc-bournemouth"},
    {"team_name": "Arsenal", "team_id": 9825, "slug": "arsenal"},
    {"team_name": "Aston Villa", "team_id": 10252, "slug": "aston-villa"},
    {"team_name": "Brentford", "team_id": 9937, "slug": "brentford"},
    {"team_name": "Brighton & Hove Albion", "team_id": 10204, "slug": "brighton-hove-albion"},
    {"team_name": "Chelsea", "team_id": 8455, "slug": "chelsea"},
    {"team_name": "Coventry City", "team_id": 8669, "slug": "coventry-city"},
    {"team_name": "Crystal Palace", "team_id": 9826, "slug": "crystal-palace"},
    {"team_name": "Everton", "team_id": 8668, "slug": "everton"},
    {"team_name": "Fulham", "team_id": 9879, "slug": "fulham"},
    {"team_name": "Hull City", "team_id": 8667, "slug": "hull-city"},
    {"team_name": "Ipswich Town", "team_id": 9902, "slug": "ipswich-town"},
    {"team_name": "Leeds United", "team_id": 8463, "slug": "leeds-united"},
    {"team_name": "Liverpool", "team_id": 8650, "slug": "liverpool"},
    {"team_name": "Manchester City", "team_id": 8456, "slug": "manchester-city"},
    {"team_name": "Manchester United", "team_id": 10260, "slug": "manchester-united"},
    {"team_name": "Newcastle United", "team_id": 10261, "slug": "newcastle-united"},
    {"team_name": "Nottingham Forest", "team_id": 10203, "slug": "nottingham-forest"},
    {"team_name": "Sunderland", "team_id": 8472, "slug": "sunderland"},
    {"team_name": "Tottenham Hotspur", "team_id": 8586, "slug": "tottenham-hotspur"},
]


def fetch_html(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        },
    )
    return urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")


def parse_squad_table_rows(html: str) -> list[dict]:
    """Squad table: player link + optional fallback position from second column."""
    soup = BeautifulSoup(html, "html.parser")
    rows_out: list[dict] = []
    for row in soup.select("table tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue
        first_link = cells[0].find("a", href=True)
        if not first_link:
            continue
        href = first_link["href"]
        if "/players/" not in href:
            continue

        full_href = "https://www.fotmob.com" + href if href.startswith("/") else href
        match = re.search(r"/players/(\d+)/", full_href)
        if not match:
            continue
        player_id = int(match.group(1))
        raw_name = first_link.get_text(strip=True)
        position_raw = cells[1].get_text(" ", strip=True) if len(cells) > 1 else ""
        position_fallback = None
        if position_raw:
            position_fallback = position_raw.split(",")[0].strip()

        rows_out.append(
            {
                "player_id": player_id,
                "href": full_href,
                "raw_name": raw_name,
                "position_fallback": position_fallback,
            }
        )

    deduped: dict[int, dict] = {}
    for r in rows_out:
        deduped[r["player_id"]] = r
    return sorted(deduped.values(), key=lambda x: x["player_id"])


def enrich_players_with_profiles(
    rows: list[dict], pause_between_players_s: float = 0.5
) -> list[dict]:
    out: list[dict] = []
    for i, row in enumerate(rows):
        name, pos = fetch_player_display_name_and_primary_position(row["href"])
        if not name:
            name = finalize_player_display_name(row.get("raw_name") or "") or ""
        if not pos:
            pos = row.get("position_fallback")

        out.append(
            {
                "player_id": row["player_id"],
                "player_name": name,
                "position": pos,
                "href": row["href"],
            }
        )
        if i < len(rows) - 1:
            time.sleep(pause_between_players_s)
    return out


def file_name(team_name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "_", team_name).strip("_")
    return f"{safe}_Squad.json"


def main() -> None:
    # Default: skip clubs that already have a Raw_Files JSON (append-friendly for many teams).
    # Pass --force to re-scrape every team in TEAMS.
    force = "--force" in sys.argv

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = []
    skipped = []

    for idx, team in enumerate(TEAMS, start=1):
        out_path = OUT_DIR / file_name(team["team_name"])
        if out_path.exists() and not force:
            print(f"[{idx}/{len(TEAMS)}] Skip (exists): {team['team_name']} -> {out_path.name}")
            skipped.append(team["team_name"])
            continue

        squad_url = f"https://www.fotmob.com/en-GB/teams/{team['team_id']}/squad/{team['slug']}"
        print(f"[{idx}/{len(TEAMS)}] Squad page: {team['team_name']} -> {squad_url}")

        html = fetch_html(squad_url)
        table_rows = parse_squad_table_rows(html)
        print(f"  Found {len(table_rows)} players; fetching profile name + primary position...")
        players = enrich_players_with_profiles(table_rows, pause_between_players_s=0.5)

        payload = {
            "team_name": team["team_name"],
            "team_id": team["team_id"],
            "squad_url": squad_url,
            "players": players,
        }

        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        summary.append((team["team_name"], team["team_id"], len(players), str(out_path)))

        sleep_s = round(random.uniform(1.0, 2.0), 2)
        print(f"  Saved {len(players)} players -> {out_path.name}. Pausing {sleep_s}s before next club.")
        time.sleep(sleep_s)

    print("\nDone. Summary:")
    for team_name, team_id, count, out in summary:
        print(f"- {team_name} ({team_id}): {count} players -> {out}")
    if skipped:
        print(f"Skipped (already on disk): {', '.join(skipped)}")
    if not summary and not skipped:
        print("(nothing to do)")


if __name__ == "__main__":
    main()
