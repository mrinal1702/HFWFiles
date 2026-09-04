"""Quality check for the World Cup master_player_list.csv."""
import csv
from collections import Counter
from pathlib import Path

csv_path = Path(r"C:\Users\trive\HFWFiles\Player_List\master_player_list.csv")
rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig")))

print(f"=== BASIC STATS ===")
print(f"Total rows: {len(rows)}")

# 1. Positions breakdown
pos_counts = Counter(r["position"] for r in rows)
print(f"\n=== POSITIONS ===")
for pos, count in sorted(pos_counts.items()):
    print(f"  {pos}: {count}")

# 2. Goalkeeper check — exactly 1 bundle per team
print(f"\n=== GOALKEEPER CHECK ===")
gk_rows = [r for r in rows if r["position"] == "Goalkeeper"]
print(f"  Total GK rows: {len(gk_rows)} (expect 48)")
teams_with_gk = Counter(r["team_name"] for r in gk_rows)
all_teams = sorted({r["team_name"] for r in rows})
teams_missing_gk = [t for t in all_teams if t not in teams_with_gk]
teams_multiple_gk = {t: c for t, c in teams_with_gk.items() if c > 1}
if teams_multiple_gk:
    print(f"  PROBLEM - Teams with >1 GK row: {teams_multiple_gk}")
else:
    print(f"  OK - Every team has exactly 1 GK row")
if teams_missing_gk:
    print(f"  PROBLEM - Teams missing GK row: {teams_missing_gk}")
else:
    print(f"  OK - All 48 teams have a GK row")
non_bundles = [r for r in gk_rows if "Keepers" not in r["player_name"]]
if non_bundles:
    for r in non_bundles:
        print(f"  PROBLEM - Individual GK not collapsed: {r['player_name']} ({r['team_name']})")
else:
    print(f"  OK - All GK rows are Keepers bundles")

# 3. Duplicate player IDs
print(f"\n=== DUPLICATE PLAYER IDs ===")
id_counts = Counter(r["player_id"] for r in rows)
dupes = {pid: count for pid, count in id_counts.items() if count > 1}
if dupes:
    print(f"  PROBLEM - {len(dupes)} duplicate player IDs:")
    for pid, count in list(dupes.items())[:20]:
        dupe_rows = [r for r in rows if r["player_id"] == pid]
        for dr in dupe_rows:
            print(f"    ID {pid}: {dr['player_name']} ({dr['team_name']})")
else:
    print(f"  OK - No duplicate player IDs")

# 4. Synthetic GK ID validation
print(f"\n=== SYNTHETIC GK ID CHECK ===")
bad_synth = []
for r in gk_rows:
    pid = int(r["player_id"])
    tid = int(r["team_id"])
    expected = 90_000_000 + tid
    if pid != expected:
        bad_synth.append((r, expected))
if bad_synth:
    print(f"  PROBLEM - {len(bad_synth)} keeper bundles with wrong synthetic ID:")
    for r, exp in bad_synth:
        print(f"    {r['player_name']}: id={r['player_id']}, expected={exp}")
else:
    print(f"  OK - All 48 keeper bundles have correct synthetic IDs (90000000 + team_id)")

# 5. Missing required fields
print(f"\n=== MISSING FIELDS ===")
for field in ["player_id", "player_name", "team_id", "team_name", "position", "href"]:
    missing = [r for r in rows if not r.get(field, "").strip()]
    if missing:
        print(f"  PROBLEM - {len(missing)} rows missing '{field}':")
        for r in missing[:5]:
            print(f"    {r['player_name']} ({r['team_name']})")
    else:
        print(f"  OK - '{field}': all present")

# 6. Team count and squad sizes
print(f"\n=== TEAMS ({len(all_teams)} total, expect 48) ===")
team_counts = Counter(r["team_name"] for r in rows)
if len(all_teams) != 48:
    print(f"  PROBLEM - Expected 48 teams, got {len(all_teams)}")
else:
    print(f"  OK - 48 teams present")
small = {t: c for t, c in team_counts.items() if c < 10}
if small:
    print(f"  Teams with <10 players (possible issue):")
    for t, c in sorted(small.items()):
        print(f"    {t}: {c} players")
else:
    print(f"  OK - All teams have 10+ players")
