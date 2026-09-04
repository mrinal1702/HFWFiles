"""
Scrape FotMob squad pages for World Cup 2026 national teams, then enrich each
player via their profile page: canonical display name + primary position
(__NEXT_DATA__).

Rate limits:
- ~0.5s between each player profile request
- ~1–2s pause after finishing each team (before the next squad fetch)
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


OUT_DIR = Path(r"C:\Users\trive\HFWFiles\Player_List\World Cup 2026")

# World Cup 2026 national teams — add more as needed.
# FotMob national team URL format: /en-GB/teams/{team_id}/squad/{slug}
TEAMS = [
    {"team_name": "Mexico", "team_id": 6710, "slug": "mexico"},
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
        print(f"    [{i+1}/{len(rows)}] {row['raw_name']} ({row['player_id']})...")
        name, pos = fetch_player_display_name_and_primary_position(row["href"])
        if not name:
            name = finalize_player_display_name(row.get("raw_name") or "") or ""
        if not pos:
            pos = row.get("position_fallback")

        print(f"      -> name={name!r}  pos={pos!r}")
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
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = []

    for idx, team in enumerate(TEAMS, start=1):
        squad_url = f"https://www.fotmob.com/en-GB/teams/{team['team_id']}/squad/{team['slug']}"
        print(f"\n[{idx}/{len(TEAMS)}] Squad page: {team['team_name']} -> {squad_url}")

        html = fetch_html(squad_url)
        table_rows = parse_squad_table_rows(html)
        print(f"  Found {len(table_rows)} players in squad table.")

        if not table_rows:
            print("  WARNING: No players found — the squad table may not be in the HTML.")
            print("  Saving raw HTML for inspection...")
            (OUT_DIR / f"{team['team_name']}_raw.html").write_text(html, encoding="utf-8")
            continue

        print(f"  Fetching profile name + primary position for each player...")
        players = enrich_players_with_profiles(table_rows, pause_between_players_s=0.5)

        payload = {
            "team_name": team["team_name"],
            "team_id": team["team_id"],
            "squad_url": squad_url,
            "players": players,
        }

        out_path = OUT_DIR / file_name(team["team_name"])
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        summary.append((team["team_name"], team["team_id"], len(players), str(out_path)))

        if idx < len(TEAMS):
            sleep_s = round(random.uniform(1.0, 2.0), 2)
            print(f"  Saved {len(players)} players -> {out_path.name}. Pausing {sleep_s}s.")
            time.sleep(sleep_s)
        else:
            print(f"  Saved {len(players)} players -> {out_path.name}.")

    print("\n--- Summary ---")
    for team_name, team_id, count, out in summary:
        print(f"  {team_name} ({team_id}): {count} players -> {out}")


if __name__ == "__main__":
    main()
