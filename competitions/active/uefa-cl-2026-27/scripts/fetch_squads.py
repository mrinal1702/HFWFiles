"""Scrape one FotMob squad into the UCL 2026/27 player-pool (competition-scoped only)."""
from __future__ import annotations

import json
import random
import re
import sys
import time
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup

_REPO = Path(__file__).resolve().parents[4]
_TESTS = _REPO / "Tests"
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import (  # noqa: E402
    finalize_player_display_name,
    fetch_player_display_name_and_primary_position,
)

_COMP = Path(__file__).resolve().parents[1]
OUT_DIR = _COMP / "player-pool" / "squads"


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
        position_fallback = position_raw.split(",")[0].strip() if position_raw else None
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


def enrich_players(rows: list[dict]) -> list[dict]:
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
            time.sleep(0.5)
    return out


def file_name(team_name: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "_", team_name).strip("_")
    return f"{safe}_Squad.json"


def scrape_team(team: dict) -> Path:
    squad_url = team.get("squad_url") or (
        f"https://www.fotmob.com/en-GB/teams/{team['team_id']}/squad/{team['slug']}"
    )
    print(f"Scraping {team['team_name']}: {squad_url}")
    html = fetch_html(squad_url)
    table_rows = parse_squad_table_rows(html)
    print(f"  {len(table_rows)} players in squad table")
    players = enrich_players(table_rows)
    payload = {
        "team_name": team["team_name"],
        "team_id": team["team_id"],
        "squad_url": squad_url,
        "players": players,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / file_name(team["team_name"])
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Wrote {out_path}")
    return out_path


def main() -> None:
    teams_path = _COMP / "player-pool" / "teams.json"
    teams = json.loads(teams_path.read_text(encoding="utf-8"))["teams"]
    only = {a.replace("--only=", "") for a in sys.argv if a.startswith("--only=")}
    for team in teams:
        if only and team["team_name"] not in only and team.get("slug") not in only:
            continue
        scrape_team(team)
        time.sleep(random.uniform(1.0, 2.0))


if __name__ == "__main__":
    main()
