"""
Create (or refresh) a Quick Fantasy fixture from club player lists. Writes only under
quick-fantasy/data/fixtures/<YYYY-MM-DD>_<home>-<away>_<matchId>/.

  python quick-fantasy/scoring/build_fixture.py --match-id 4813650 \
      --home "Liverpool" --away "Manchester United" --kickoff 2026-12-05T17:30:00+00:00 \
      --players path/to/liverpool.csv path/to/man-utd.csv

--players takes one or more CSVs with at least: player_id, player_name, team_id, team_name, position
(the same columns as a competition's master_player_list.csv, so an existing pool can be passed
as-is; it is only read, never changed). Rows for other clubs are ignored.

Rules applied:
  - player ids must be FotMob ids (scoring matches on them); duplicates are refused
  - individual goalkeepers are replaced by one "<Club> Keepers" entry per club
    (id 90_000_000 + team id), exactly like the main game
  - non-playing rows (Coach etc.) are dropped
Refuses to touch a fixture that has already been scored unless --force.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

from qf_common import (
    FIXTURES_DIR, KEEPER_ID_BASE, POOL_COLUMNS, ensure_inside_qf, kebab, keeper_pool_id,
    read_json, write_json,
)

OUTFIELD = {"defender", "midfielder", "forward"}


def norm_position(raw: str) -> str | None:
    p = (raw or "").strip().lower()
    if p in OUTFIELD:
        return p.capitalize()
    if p in {"goalkeeper", "keeper", "gk"}:
        return "Goalkeeper"
    return None  # coach / unknown → not biddable


def load_rows(paths: list[Path]) -> list[dict]:
    rows: list[dict] = []
    for path in paths:
        with path.open(encoding="utf-8-sig", newline="") as fh:
            reader = csv.DictReader(fh)
            missing = [c for c in POOL_COLUMNS if c not in (reader.fieldnames or [])]
            if missing:
                raise SystemExit(f"{path}: missing columns {missing}")
            for r in reader:
                rows.append({c: (r.get(c) or "").strip() for c in POOL_COLUMNS} | {"_src": path.name})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--match-id", type=int, required=True, help="FotMob match id")
    ap.add_argument("--home", required=True, help="home club name, as written in the player list")
    ap.add_argument("--away", required=True, help="away club name, as written in the player list")
    ap.add_argument("--kickoff", required=True, help="ISO time with offset, e.g. 2026-12-05T17:30:00+00:00")
    ap.add_argument("--players", type=Path, nargs="+", required=True)
    ap.add_argument("--force", action="store_true", help="allow rebuilding a fixture that was already scored")
    args = ap.parse_args()

    kickoff = datetime.fromisoformat(args.kickoff)
    if kickoff.tzinfo is None:
        raise SystemExit("--kickoff needs a UTC offset, e.g. 2026-12-05T17:30:00+00:00")

    clubs = {args.home: "home", args.away: "away"}
    rows = [r for r in load_rows(args.players) if r["team_name"] in clubs]

    team_ids: dict[str, int] = {}
    pool: dict[int, dict] = {}
    for r in rows:
        pos = norm_position(r["position"])
        if pos is None:
            continue
        try:
            pid, tid = int(r["player_id"]), int(r["team_id"])
        except ValueError:
            raise SystemExit(f"Non-numeric id in {r['_src']}: {r}")
        prev = team_ids.setdefault(r["team_name"], tid)
        if prev != tid:
            raise SystemExit(f"{r['team_name']} has two team ids ({prev}, {tid})")
        if pos == "Goalkeeper":
            continue  # replaced by the club's Keepers unit below
        if pid >= KEEPER_ID_BASE:
            raise SystemExit(f"Outfield player with a keeper-unit id: {r}")
        if pid in pool:
            raise SystemExit(f"Duplicate player id {pid}: {pool[pid]['player_name']} / {r['player_name']}")
        pool[pid] = {"player_id": pid, "player_name": r["player_name"], "team_id": tid,
                     "team_name": r["team_name"], "position": pos}

    for club in clubs:
        if club not in team_ids:
            raise SystemExit(f"No rows for club {club!r} in the player lists (check the spelling)")
        tid = team_ids[club]
        kid = keeper_pool_id(tid)
        pool[kid] = {"player_id": kid, "player_name": f"{club} Keepers", "team_id": tid,
                     "team_name": club, "position": "Goalkeeper"}

    folder = FIXTURES_DIR / f"{kickoff.date().isoformat()}_{kebab(args.home)}-{kebab(args.away)}_{args.match_id}"
    others = [p for p in FIXTURES_DIR.glob(f"*_{args.match_id}") if p != folder]
    if others:
        raise SystemExit(f"Match {args.match_id} already has a fixture folder: {others[0]} (kickoff changed? rename it first)")
    ensure_inside_qf(folder)
    meta_path = folder / "fixture.json"
    if meta_path.exists() and read_json(meta_path).get("status") == "scored" and not args.force:
        raise SystemExit(f"{folder.name} is already scored; pass --force to rebuild its player list")

    order = {"Goalkeeper": 0, "Defender": 1, "Midfielder": 2, "Forward": 3}
    ordered = sorted(pool.values(), key=lambda p: (clubs[p["team_name"]] != "home", order[p["position"]], p["player_name"]))
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / "players.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=POOL_COLUMNS)
        w.writeheader()
        w.writerows(ordered)

    per_club = {c: sum(1 for p in ordered if p["team_name"] == c) for c in clubs}
    write_json(meta_path, {
        "fotmob_match_id": args.match_id,
        "home_team": args.home,
        "home_team_id": team_ids[args.home],
        "away_team": args.away,
        "away_team_id": team_ids[args.away],
        "kickoff_utc": kickoff.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "open",
        "players": per_club,
        "player_list_sources": sorted({r["_src"] for r in rows}),
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    })
    print(f"Fixture {folder.name}: {per_club} (incl. one Keepers entry per club) → {folder}")


if __name__ == "__main__":
    main()
