"""
Score one match for any competition round and register it everywhere — no code edits.

  python scoring-engine/score_match.py --competition uefa-cl-2026-27 --round mw02 --url "<fotmob match url>"
  python scoring-engine/score_match.py --competition uefa-cl-2026-27 --round mw02 --from-json path/to/match.json

Steps (same scoring as the MW1 UCL scorer):
  1. fetch the FotMob match JSON (or copy --from-json)
  2. point_simulator.py + calculate_keeper_points.py → final_points.merge_outfield_and_keepers
  3. write competitions/<tier>/<slug>/rounds/<round>/matches/<match-slug>/
       {match.json, final-points.csv, intermediates/<Home>_Vs_<Away>.json + *_Points / *_KeeperPoints / *_FinalPoints}
  4. copy FinalPoints to auction-app/data/competitions/<slug>/match-scores/<Home>_<Away>_FinalPoints.csv
  5. upsert the fixture in rounds/<round>/round.json and the sheet in
     auction-app/data/competitions/<slug>/sheets.json (gw = round_number) → the app shows it
  6. validate the FinalPoints

Re-running for the same FotMob match id replaces its outputs in place (same slug/title).
--root lets a test run write into a scratch copy of the repo layout instead of the real repo.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

ENGINE = Path(__file__).resolve().parent
REPO = ENGINE.parent
if str(ENGINE) not in sys.path:
    sys.path.insert(0, str(ENGINE))

# Agents run this with piped output; Windows' default console code page cannot print player
# names like "Dragusin" with diacritics. Force UTF-8 here and in every child step.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
CHILD_ENV = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}


def label_part(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "", name) or "Unknown"


def kebab(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-") or "unknown"


def read_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, data: dict) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def find_competition(root: Path, slug: str, allow_archived: bool) -> Path:
    active = root / "competitions" / "active" / slug
    if active.is_dir():
        return active
    archived = root / "competitions" / "archive" / slug
    if archived.is_dir():
        if not allow_archived:
            raise SystemExit(f"Refusing: {slug} is archived (pass --allow-archived for an approved amendment).")
        return archived
    raise SystemExit(f"Competition not found: {slug}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--competition", required=True)
    ap.add_argument("--round", required=True, help="round slug, e.g. mw02")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--url", help="FotMob match URL")
    src.add_argument("--from-json", type=Path, help="already-fetched FotMob match JSON")
    ap.add_argument("--match-slug", help="override the folder/sheet slug (default: existing fixture or home-away)")
    ap.add_argument("--root", type=Path, default=REPO, help="repo root to write into (tests use a scratch copy)")
    ap.add_argument("--allow-archived", action="store_true")
    args = ap.parse_args()

    root = args.root.resolve()
    comp_dir = find_competition(root, args.competition, args.allow_archived)
    round_dir = comp_dir / "rounds" / args.round
    round_path = round_dir / "round.json"
    if not round_path.exists():
        raise SystemExit(f"Missing {round_path} — create it first (node scripts/gameweek.mjs init-round …).")
    rnd = read_json(round_path)
    if rnd.get("competition_slug") != args.competition or rnd.get("round_slug") != args.round:
        raise SystemExit(f"{round_path} names {rnd.get('competition_slug')}/{rnd.get('round_slug')}, not {args.competition}/{args.round}")
    sheets_path = root / "auction-app" / "data" / "competitions" / args.competition / "sheets.json"
    if not sheets_path.exists():
        raise SystemExit(f"Missing {sheets_path} — the competition has no app sheet manifest yet.")
    sheets = read_json(sheets_path)

    # 1) match JSON
    tmp = Path(tempfile.mkdtemp(prefix="score_match_"))
    tmp_json = tmp / "_fetch.json"
    if args.url:
        subprocess.run([sys.executable, str(ENGINE / "fetch_fotmob_match.py"), args.url, "--out", str(tmp_json)],
                       check=True, cwd=str(REPO), env=CHILD_ENV)
    else:
        shutil.copyfile(args.from_json, tmp_json)
        man = args.from_json.with_suffix(".manifest.json")
        if man.exists():
            shutil.copyfile(man, tmp / "_fetch.manifest.json")
    data = read_json(tmp_json)
    g = data["general"]
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    match_id = int(g.get("matchId") or 0)
    if not match_id:
        raise SystemExit("Match JSON has no general.matchId")

    fixtures = rnd.setdefault("fixtures", [])
    existing_fx = next((f for f in fixtures if int(f.get("fotmob_match_id") or 0) == match_id), None)
    existing_sheet = next((s for s in sheets["sheets"] if int(s.get("fotmob_match_id") or 0) == match_id), None)
    match_slug = args.match_slug or (existing_fx or {}).get("match_slug") or kebab(f"{home} {away}")
    label = f"{label_part(home)}_{label_part(away)}"

    # 2–3) score into the match folder
    match_dir = round_dir / "matches" / match_slug
    inter = match_dir / "intermediates"
    inter.mkdir(parents=True, exist_ok=True)
    json_path = inter / f"{label_part(home)}_Vs_{label_part(away)}.json"
    shutil.copyfile(tmp_json, json_path)
    if (tmp / "_fetch.manifest.json").exists():
        shutil.copyfile(tmp / "_fetch.manifest.json", json_path.with_suffix(".manifest.json"))

    for script, suffix in (("point_simulator.py", "_Points.csv"), ("calculate_keeper_points.py", "_KeeperPoints.csv")):
        out = inter / f"{label}{suffix}"
        proc = subprocess.run([sys.executable, str(ENGINE / script), str(json_path), "--out", str(out)], cwd=str(ENGINE), env=CHILD_ENV)
        if not out.exists():
            raise SystemExit(f"Missing output from {script}: {out}")
        if proc.returncode != 0:
            print(f"warning: {script} exited {proc.returncode}")

    import pandas as pd
    from final_points import merge_outfield_and_keepers

    merged = merge_outfield_and_keepers(
        pd.read_csv(inter / f"{label}_Points.csv"),
        pd.read_csv(inter / f"{label}_KeeperPoints.csv"),
        match_data=data,
        validate=True,
    )
    fp = inter / f"{label}_FinalPoints.csv"
    merged.to_csv(fp, index=False, encoding="utf-8")
    (inter / f"{label}_Outfield_Points.csv").write_text((inter / f"{label}_Points.csv").read_text(encoding="utf-8"), encoding="utf-8")
    (match_dir / "final-points.csv").write_text(fp.read_text(encoding="utf-8"), encoding="utf-8")

    # 4) app copy
    app_csv_dir = root / "auction-app" / "data" / "competitions" / args.competition / "match-scores"
    app_csv_dir.mkdir(parents=True, exist_ok=True)
    app_file = f"{label}_FinalPoints.csv"
    (app_csv_dir / app_file).write_text(fp.read_text(encoding="utf-8"), encoding="utf-8")

    write_json(match_dir / "match.json", {
        "competition_slug": args.competition,
        "round_slug": args.round,
        "match_slug": match_slug,
        "fotmob_match_id": match_id,
        "source_url": args.url or (existing_fx or {}).get("source_url") or "",
        "home_team": home,
        "away_team": away,
        "raw_json_path": f"intermediates/{json_path.name}",
        "final_points_path": "final-points.csv",
        "validation_status": "validated",
        "scoring_policy_version": rnd.get("algorithm_version", "1.0"),
        "file_hashes": {},
    })

    # 5) manifests
    fx = {"match_slug": match_slug, "fotmob_match_id": match_id, "home_team": home, "away_team": away, "status": "scored"}
    if existing_fx:
        existing_fx.update(fx)
    else:
        fixtures.append(fx)
    scored = sum(1 for f in fixtures if f.get("status") == "scored")
    expected = rnd.get("expected_match_count")
    rnd["scoring_state"] = "complete" if expected and scored >= expected else "in_progress"
    write_json(round_path, rnd)

    n = int(rnd["round_number"])
    sheet = {
        "slug": (existing_sheet or {}).get("slug", match_slug),
        "title": (existing_sheet or {}).get("title", f"{home} vs {away}"),
        "subtitle": (existing_sheet or {}).get("subtitle", sheets["subtitle_template"].replace("{n}", str(n))),
        "gw": n,
        "fotmob_match_id": match_id,
        "file": app_file,
    }
    if existing_sheet:
        existing_sheet.clear()
        existing_sheet.update(sheet)
    else:
        sheets["sheets"].append(sheet)
    write_json(sheets_path, sheets)

    # 6) validate
    subprocess.run([sys.executable, str(ENGINE / "validate_final_points.py"), str(match_dir / "final-points.csv")], check=True, env=CHILD_ENV)
    shutil.rmtree(tmp, ignore_errors=True)

    print(f"Scored {home} vs {away} (FotMob {match_id}) → {args.competition}/{args.round}/{match_slug}: "
          f"{len(merged)} rows; fixtures scored {scored}/{expected or '?'}; sheet gw {n} ({sheet['slug']})")


if __name__ == "__main__":
    main()
