"""
Re-score GW1 matches for position-map affected players owned on auction squads.

Run from repo root: python Scores/rescore_owned_affected_gw1.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "Tests"
sys.path.insert(0, str(TESTS))

from point_simulator import simulate_points  # noqa: E402

# Owned on GW1 squads (auctions 5/6/7) — from audit
OWNED_AFFECTED: list[dict] = [
    {"player_id": 292462, "name": "Mohamed Salah", "json": "Belgium_Vs_Egypt.json"},
    {"player_id": 356406, "name": "John McGinn", "json": "Haiti_Vs_Scotland.json"},
    {"player_id": 1735453, "name": "Yan Diomande", "json": "IvoryCoast_Vs_Ecuador.json"},
    {"player_id": 442277, "name": "Miguel Almirón", "json": "USA_Vs_Paraguay.json"},
    {"player_id": 1031656, "name": "Maxi Araújo", "json": "SaudiArabia_Vs_Uruguay.json"},
    {"player_id": 526827, "name": "Konrad Laimer", "json": "Austria_Vs_Jordan.json"},
    {"player_id": 692984, "name": "Ousmane Dembélé", "json": "France_Vs_Senegal.json"},
]

MATCH_DIR = ROOT / "Matches_Raw" / "World Cup 2026"
RAW_DIR = MATCH_DIR


def _finalpoints_path_for_json(json_name: str) -> Path:
    """Belgium_Vs_Egypt.json -> Belgium_Egypt_FinalPoints.csv"""
    stem = json_name.replace("_Vs_", "_").replace(".json", "")
    return RAW_DIR / f"{stem}_FinalPoints.csv"


def load_old_final(player_id: int, fp_path: Path) -> dict | None:
    if not fp_path.is_file():
        return None
    with fp_path.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                if int(row.get("player_id") or -1) != player_id:
                    continue
            except (TypeError, ValueError):
                continue
            return {
                "position": row.get("position"),
                "stats_score": float(row.get("stats_score") or 0),
                "endowment_score": float(row.get("endowment_score") or 0),
                "final_score": int(float(row.get("final_score") or 0)),
            }
    return None


def main() -> None:
    rows_out: list[dict] = []
    json_seen: set[str] = set()

    for entry in OWNED_AFFECTED:
        json_name = entry["json"]
        pid = entry["player_id"]
        fp_old = _finalpoints_path_for_json(json_name)

        if json_name not in json_seen:
            json_seen.add(json_name)
            json_path = MATCH_DIR / json_name
            with json_path.open(encoding="utf-8") as f:
                data = json.load(f)
            sim = simulate_points(data)
            # Also build per-player lookup from simulation
            if not hasattr(main, "_sim_cache"):
                main._sim_cache = {}  # type: ignore[attr-defined]
            main._sim_cache[json_name] = sim  # type: ignore[attr-defined]

        sim: pd.DataFrame = main._sim_cache[json_name]  # type: ignore[attr-defined]
        new_row = sim[sim["player_id"] == pid]
        if new_row.empty:
            print(f"WARNING: no simulated row for {entry['name']} ({pid})")
            continue
        r = new_row.iloc[0]
        old = load_old_final(pid, fp_old)
        new_final = int(max(0, round(float(r["total_points"]))))
        rows_out.append(
            {
                "player_id": pid,
                "player_name": entry["name"],
                "match": json_name.replace("_Vs_", " vs ").replace(".json", ""),
                "old_role": old["position"] if old else "?",
                "new_role": str(r.get("role", "?")),
                "old_stats": old["stats_score"] if old else None,
                "new_stats": round(float(r["stat_points_total"]), 2),
                "old_endowment": old["endowment_score"] if old else None,
                "new_endowment": round(float(r["endowed_points"]), 2),
                "old_final": old["final_score"] if old else None,
                "new_final": new_final,
                "delta": new_final - (old["final_score"] if old else 0),
            }
        )

    out_csv = ROOT / "Scores" / "gw1_owned_affected_rescore.csv"
    out_json = ROOT / "Scores" / "gw1_owned_affected_rescore.json"
    out_json.write_text(json.dumps(rows_out, indent=2), encoding="utf-8")
    if rows_out:
        with out_csv.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
            w.writeheader()
            w.writerows(rows_out)

    print(f"{'Player':<22} {'Old role':<10} {'New role':<10} {'Old':>5} {'New':>5} {'Delta':>5}")
    print("-" * 62)
    for r in rows_out:
        print(
            f"{r['player_name']:<22} {r['old_role']:<10} {r['new_role']:<10} "
            f"{r['old_final']:>5} {r['new_final']:>5} {r['delta']:>+5}"
        )
    print(f"\nWrote {out_csv} and {out_json}")


if __name__ == "__main__":
    main()
