from pathlib import Path
import json
import re
import sys
import subprocess

REPO = Path(r"c:\Users\trive\HFWFiles")
TESTS = REPO / "Tests"
sys.path.insert(0, str(TESTS))

URL = sys.argv[1]
MATCH_SLUG = sys.argv[2]
FOTMOB_ID = int(sys.argv[3]) if len(sys.argv) > 3 else None

MATCH_DIR = REPO / "competitions/active/uefa-cl-2026-27/rounds/mw01/matches" / MATCH_SLUG
INTER = MATCH_DIR / "intermediates"
MS = REPO / "auction-app/data/competitions/uefa-cl-2026-27/match-scores"
INTER.mkdir(parents=True, exist_ok=True)
MS.mkdir(parents=True, exist_ok=True)

tmp_json = INTER / "_fetch.json"
subprocess.run(
    [sys.executable, str(TESTS / "fetch_fotmob_match.py"), URL, "--out", str(tmp_json)],
    check=True,
    cwd=str(REPO),
)

data = json.loads(tmp_json.read_text(encoding="utf-8"))
g = data["general"]
home = (g.get("homeTeam") or {}).get("name") or "Home"
away = (g.get("awayTeam") or {}).get("name") or "Away"
match_id = int(g.get("matchId") or FOTMOB_ID or 0)

def slug(n: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "", n) or "Unknown"

label = f"{slug(home)}_{slug(away)}"
json_name = f"{slug(home)}_Vs_{slug(away)}.json"
json_path = INTER / json_name
if json_path.exists():
    json_path.unlink()
tmp_json.replace(json_path)
man_src = INTER / "_fetch.manifest.json"
man_dst = json_path.with_suffix(".manifest.json")
if man_src.exists():
    if man_dst.exists():
        man_dst.unlink()
    man_src.replace(man_dst)

print(f"home={home} away={away} label={label} matchId={match_id}")

for script, suffix in (
    ("point_simulator.py", "_Points.csv"),
    ("calculate_keeper_points.py", "_KeeperPoints.csv"),
):
    out = INTER / f"{label}{suffix}"
    proc = subprocess.run(
        [sys.executable, str(TESTS / script), str(json_path), "--out", str(out)],
        cwd=str(TESTS),
    )
    if not out.exists():
        raise SystemExit(f"Missing output from {script}: {out}")
    if proc.returncode != 0:
        print(f"warning: {script} exited {proc.returncode}")

import pandas as pd
from final_points import merge_outfield_and_keepers

outfield = pd.read_csv(INTER / f"{label}_Points.csv")
keepers = pd.read_csv(INTER / f"{label}_KeeperPoints.csv")
match_data = json.loads(json_path.read_text(encoding="utf-8"))
merged = merge_outfield_and_keepers(outfield, keepers, match_data=match_data, validate=True)
fp = INTER / f"{label}_FinalPoints.csv"
merged.to_csv(fp, index=False, encoding="utf-8")
(INTER / f"{label}_Outfield_Points.csv").write_text(
    (INTER / f"{label}_Points.csv").read_text(encoding="utf-8"), encoding="utf-8"
)
(MATCH_DIR / "final-points.csv").write_text(fp.read_text(encoding="utf-8"), encoding="utf-8")
(MS / f"{label}_FinalPoints.csv").write_text(fp.read_text(encoding="utf-8"), encoding="utf-8")

print("rows", len(merged))
print(merged.sort_values("final_score", ascending=False).head(12).to_string(index=False))

meta = {
    "competition_slug": "uefa-cl-2026-27",
    "round_slug": "mw01",
    "match_slug": MATCH_SLUG,
    "fotmob_match_id": match_id,
    "source_url": URL,
    "home_team": home,
    "away_team": away,
    "raw_json_path": f"intermediates/{json_name}",
    "final_points_path": "final-points.csv",
    "validation_status": "validated",
    "scoring_policy_version": "1.0",
    "file_hashes": {},
}
(MATCH_DIR / "match.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
print(f"FINAL_CSV={fp}")
print(f"LABEL={label}")
print(f"TITLE={home} vs {away}")
