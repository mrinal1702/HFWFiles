"""Build Shakhtar squad from recent FotMob match lineups (squad page returns 500)."""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

_REPO = Path(__file__).resolve().parents[4]
_TESTS = _REPO / "Tests"
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import fetch_player_display_name_and_primary_position, finalize_player_display_name

TEAM_ID = 9728
TEAM_NAME = "Shakhtar Donetsk"
SQUAD_URL = "https://www.fotmob.com/en-GB/teams/9728/overview/shakhtar-donetsk"


def api_get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.loads(urllib.request.urlopen(req, timeout=25).read())


def shakhtar_match_ids() -> list[int]:
    data = api_get(f"https://www.fotmob.com/api/data/teams?id={TEAM_ID}")
    ids: list[int] = []

    def walk(obj):
        if isinstance(obj, dict):
            home = obj.get("home") or {}
            away = obj.get("away") or {}
            mid = obj.get("id")
            if mid and (
                str(home.get("id")) == str(TEAM_ID) or str(away.get("id")) == str(TEAM_ID)
            ):
                if obj.get("status", {}).get("finished") or obj.get("notStarted") is False:
                    ids.append(int(mid))
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(data.get("fixtures", {}))
    # de-dupe preserve order
    seen = set()
    out = []
    for mid in ids:
        if mid not in seen:
            seen.add(mid)
            out.append(mid)
    return out[:6]


def players_from_match(match_id: int) -> list[dict]:
    data = api_get(f"https://www.fotmob.com/api/data/matchDetails?matchId={match_id}")
    lu = data.get("content", {}).get("lineup", {})
    rows = []
    for side in ("homeTeam", "awayTeam"):
        team = lu.get(side) or {}
        if int(team.get("id") or 0) != TEAM_ID:
            continue
        for bucket in ("starters", "subs", "unavailable"):
            for p in team.get(bucket) or []:
                pid = p.get("id")
                if not pid:
                    continue
                href = f"https://www.fotmob.com/en-GB/players/{pid}/{re.sub(r'[^a-z0-9]+','-', (p.get('name') or '').lower()).strip('-')}"
                pos = p.get("position")
                if not pos and p.get("positionId") is not None:
                    pos = str(p.get("positionId"))
                rows.append(
                    {
                        "player_id": int(pid),
                        "player_name": finalize_player_display_name(p.get("name")),
                        "position": pos,
                        "href": href,
                        "source_match": match_id,
                    }
                )
    return rows


def main() -> None:
    match_ids = shakhtar_match_ids()
    print("Shakhtar finished matches to scan:", match_ids)
    by_id: dict[int, dict] = {}
    for mid in match_ids:
        for row in players_from_match(mid):
            by_id.setdefault(row["player_id"], row)
    print(f"Unique players from lineups: {len(by_id)}")

    players = []
    for i, (pid, row) in enumerate(sorted(by_id.items())):
        name, pos = fetch_player_display_name_and_primary_position(row["href"])
        players.append(
            {
                "player_id": pid,
                "player_name": name or row["player_name"],
                "position": pos or row.get("position"),
                "href": row["href"],
            }
        )
        if i < len(by_id) - 1:
            time.sleep(0.5)

    out = {
        "team_name": TEAM_NAME,
        "team_id": TEAM_ID,
        "squad_url": SQUAD_URL,
        "_source_note": "FotMob squad page returns HTTP 500; roster built from recent match lineups.",
        "players": players,
    }
    out_path = (
        _REPO
        / "competitions/active/uefa-cl-2026-27/player-pool/squads/Shakhtar_Donetsk_Squad.json"
    )
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(players)} players -> {out_path}")


if __name__ == "__main__":
    main()
