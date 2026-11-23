"""
Score a Quick Fantasy fixture after full time, with the normal HFW scoring engine.
Writes only inside the fixture folder (quick-fantasy/data/fixtures/<...>/).

  python quick-fantasy/scoring/score_fixture.py --fixture 4813650            # fetch from FotMob by id
  python quick-fantasy/scoring/score_fixture.py --fixture 4813650 --url "<fotmob match url>"
  python quick-fantasy/scoring/score_fixture.py --fixture <folder> --from-json path/to/match.json

Same steps as scoring-engine/score_match.py (point_simulator + calculate_keeper_points →
final_points.merge_outfield_and_keepers + validate), but it never touches competitions/ or
auction-app/. Outputs:
  final-points.csv  standard FinalPoints (same columns as the main game; keeper rows use team id)
  scores.csv        one row per fixture player (pool id): final_score, played. Players who
                    didn't play score 0. This is what the game reads.
  raw/              FotMob JSON + intermediate CSVs (git-ignored; re-creatable)
"""
from __future__ import annotations

import argparse
import csv
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from qf_common import CHILD_ENV, ENGINE, ensure_inside_qf, find_fixture, keeper_pool_id, read_json, write_json


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", required=True, help="fixture folder or FotMob match id")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--url", help="FotMob match URL (default: fetch by the fixture's match id)")
    src.add_argument("--from-json", type=Path, help="already-fetched FotMob match JSON")
    args = ap.parse_args()

    folder = find_fixture(args.fixture)
    meta = read_json(folder / "fixture.json")
    match_id = int(meta["fotmob_match_id"])
    raw = ensure_inside_qf(folder / "raw")
    raw.mkdir(parents=True, exist_ok=True)
    json_path = raw / "match.json"

    # 1) match JSON
    if args.from_json:
        shutil.copyfile(args.from_json, json_path)
    else:
        cmd = [sys.executable, str(ENGINE / "fetch_fotmob_match.py")]
        cmd += [args.url] if args.url else ["--match-id", str(match_id)]
        subprocess.run(cmd + ["--out", str(json_path)], check=True, cwd=str(ENGINE), env=CHILD_ENV)
    data = read_json(json_path)
    g = data.get("general") or {}
    if int(g.get("matchId") or 0) != match_id:
        raise SystemExit(f"Match JSON is FotMob {g.get('matchId')}, but this fixture is {match_id}")
    if not g.get("finished", (data.get("header") or {}).get("status", {}).get("finished")):
        print("warning: FotMob does not mark this match as finished; scores may be provisional")

    # 2) score (same scripts as score_match.py, outputs kept in raw/)
    outs = {}
    for script, name in (("point_simulator.py", "outfield_points.csv"), ("calculate_keeper_points.py", "keeper_points.csv")):
        out = raw / name
        proc = subprocess.run([sys.executable, str(ENGINE / script), str(json_path), "--out", str(out)],
                              cwd=str(ENGINE), env=CHILD_ENV)
        if not out.exists():
            raise SystemExit(f"Missing output from {script}: {out}")
        if proc.returncode != 0:
            print(f"warning: {script} exited {proc.returncode}")
        outs[name] = out

    sys.path.insert(0, str(ENGINE))
    import pandas as pd
    from final_points import merge_outfield_and_keepers

    merged = merge_outfield_and_keepers(
        pd.read_csv(outs["outfield_points.csv"]), pd.read_csv(outs["keeper_points.csv"]),
        match_data=data, validate=True,
    )
    fp = folder / "final-points.csv"
    merged.to_csv(fp, index=False, encoding="utf-8")
    subprocess.run([sys.executable, str(ENGINE / "validate_final_points.py"), str(fp)], check=True, env=CHILD_ENV)

    # 3) map onto the fixture's player list
    scored: dict[int, dict] = {}
    for r in merged.to_dict("records"):
        pid = int(r["player_id"])
        if str(r["position"]).lower() == "goalkeeper":
            pid = keeper_pool_id(pid)  # keeper rows carry the team id
        scored[pid] = r

    with (folder / "players.csv").open(encoding="utf-8", newline="") as fh:
        pool = list(csv.DictReader(fh))
    pool_ids = {int(p["player_id"]) for p in pool}
    rows = []
    for p in pool:
        hit = scored.get(int(p["player_id"]))
        rows.append({"player_id": p["player_id"], "player_name": p["player_name"], "team_name": p["team_name"],
                     "final_score": int(hit["final_score"]) if hit is not None else 0,
                     "played": "true" if hit is not None else "false"})
    with (folder / "scores.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["player_id", "player_name", "team_name", "final_score", "played"])
        w.writeheader()
        w.writerows(rows)

    not_in_pool = [f"{r['player_name']} ({r['team_name']}, {int(r['final_score'])})"
                   for pid, r in scored.items() if pid not in pool_ids]
    played = sum(1 for r in rows if r["played"] == "true")
    meta.update({
        "status": "scored",
        "scored_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "score_summary": {"final_points_rows": len(merged), "pool_players": len(rows),
                          "pool_players_who_played": played, "scored_but_not_in_pool": len(not_in_pool)},
    })
    write_json(folder / "fixture.json", meta)

    print(f"Scored {meta['home_team']} vs {meta['away_team']} (FotMob {match_id}): "
          f"{len(merged)} FinalPoints rows; {played}/{len(rows)} pool players played")
    if not_in_pool:
        print("Played but not in the player list (nobody could own them):")
        for s in not_in_pool:
            print(f"  - {s}")


if __name__ == "__main__":
    main()
