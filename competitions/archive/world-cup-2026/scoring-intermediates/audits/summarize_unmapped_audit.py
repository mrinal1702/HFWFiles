"""Print owned-player subset of GW1 unmapped position audit."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
audit = json.loads((ROOT / "Scores/gw1_lineup_only_scoring_audit.json").read_text(encoding="utf-8"))
differs = audit["lineup_baseline_differs_from_listed"]

owned: set[int] = set()
for f in [
    "Scores/best_xi_auction_5_gw1.json",
    "Scores/best_xi_auction_6_gw1.json",
    "Scores/best_xi_auction_7_gw1.json",
]:
    d = json.loads((ROOT / f).read_text(encoding="utf-8"))
    for m in d["managers"]:
        for pid in m.get("squad_player_ids") or []:
            owned.add(int(pid))
        for pid in m.get("best_xi_player_ids") or []:
            owned.add(int(pid))

print("=== Lineup usual for scoring DIFFERS from master listed (all 32) ===")
for r in sorted(differs, key=lambda x: x["player_name"]):
    own = "OWNED" if r["player_id"] in owned else ""
    print(
        f"{r['player_name']} ({r['player_id']}) {own} | {r['match']} | "
        f"listed={r['listed_position']} scoring={r['scoring_counting_role']} "
        f"lineup={r['lineup_usual']} | tp={r['topplayers_key'] or '-'} "
        f"posId={r['granular_position_id']}"
    )

rows = json.loads((ROOT / "Scores/gw1_unmapped_position_audit.json").read_text(encoding="utf-8"))
owned_concern = [r for r in rows if r["player_id"] in owned and r["flag_user_concern"]]
owned_differs = [r for r in differs if r["player_id"] in owned]

print()
print(f"Owned on auctions 5/6/7 in lineup≠listed group: {len(owned_differs)}")
for r in sorted(owned_differs, key=lambda x: x["player_name"]):
    print(f"  {r['player_name']} | listed {r['listed_position']} -> scored as {r['scoring_counting_role']}")

print()
print(f"Owned in unmapped-topPlayers + lineup=listed group: {len(owned_concern)}")
