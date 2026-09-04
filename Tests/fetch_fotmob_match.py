"""
Fetch FotMob match JSON from a match page URL or match id, then optionally run scoring.

Examples:
  python Tests/fetch_fotmob_match.py "https://www.fotmob.com/en-GB/matches/canada-vs-bosnia-herzegovina/23f1qo#4667757:tab=stats"
  python Tests/fetch_fotmob_match.py --match-id 4667757 --out "Matches_Raw/World Cup 2026/Canada_Vs_BosniaAndHerzegovina.json"
  python Tests/fetch_fotmob_match.py <url> --score --scores-dir "Matches_Raw/World Cup 2026"
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
_REPO = Path(__file__).resolve().parent.parent
_TESTS = Path(__file__).resolve().parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from fotmob_player_profile import fetch_html, parse_next_data


MATCH_PAYLOAD_KEYS = ("general", "header", "nav", "ongoing", "hasPendingVAR", "content", "seo")


def parse_match_id_from_url(url: str) -> int | None:
    """Extract numeric match id from hash (#4667757) or path segment if present."""
    if "#" in url:
        frag = url.split("#", 1)[1]
        m = re.match(r"(\d+)", frag)
        if m:
            return int(m.group(1))
    m = re.search(r"/matches/[^/]+/(\d+)(?:[/?#]|$)", url)
    if m:
        return int(m.group(1))
    return None


def fetch_match_details(match_id: int) -> dict[str, Any]:
    api = f"https://www.fotmob.com/api/data/matchDetails?matchId={match_id}"
    html = fetch_html(api)
    data = json.loads(html)
    if not isinstance(data, dict) or "general" not in data:
        raise ValueError(f"Unexpected matchDetails payload for matchId={match_id}")
    return data


def fetch_match_from_page_url(page_url: str) -> tuple[dict[str, Any], int]:
    """Fallback: scrape __NEXT_DATA__ from the public match page."""
    clean = page_url.split("#")[0]
    html = fetch_html(clean)
    nd = parse_next_data(html)
    if not nd:
        raise ValueError("Could not parse __NEXT_DATA__ from match page")
    pp = nd.get("props", {}).get("pageProps", {})
    if "general" not in pp:
        raise ValueError("pageProps missing general block")
    payload = {k: pp[k] for k in MATCH_PAYLOAD_KEYS if k in pp}
    match_id = int(payload["general"]["matchId"])
    return payload, match_id


def slug_team(name: str) -> str:
    compact = re.sub(r"[^A-Za-z0-9]+", "", name or "")
    return compact or "Unknown"


def default_json_name(data: dict[str, Any]) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{slug_team(home)}_Vs_{slug_team(away)}.json"


def visual_urls(match_id: int, page_url: str | None = None) -> dict[str, str]:
    base = page_url.split("#")[0] if page_url else f"https://www.fotmob.com/en-GB/match/{match_id}"
    return {
        "match_page": base,
        "stats_tab": f"{base}#{match_id}:tab=stats",
        "lineup_tab": f"{base}#{match_id}:tab=lineups",
        "commentary_tab": f"{base}#{match_id}:tab=commentary",
        "api_match_details": f"https://www.fotmob.com/api/data/matchDetails?matchId={match_id}",
    }


def write_manifest(path: Path, *, source_url: str, match_id: int, json_path: Path, urls: dict[str, str]) -> Path:
    g = json.loads(json_path.read_text(encoding="utf-8")).get("general") or {}
    home = (g.get("homeTeam") or {}).get("name")
    away = (g.get("awayTeam") or {}).get("name")
    manifest = {
        "match_id": match_id,
        "home_team": home,
        "away_team": away,
        "source_url": source_url,
        "json_path": str(json_path.relative_to(_REPO)).replace("\\", "/"),
        "visual_links": urls,
        "note": "visual_links are for browser viewing only; scoring uses the saved JSON file.",
    }
    out = path.with_suffix(".manifest.json")
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def run_scoring(json_path: Path, scores_dir: Path) -> None:
    """Run outfield + keeper + final points; write CSVs into scores_dir."""
    scores_dir.mkdir(parents=True, exist_ok=True)
    py = sys.executable

    for script, extra in (
        ("point_simulator.py", ["--out", str(scores_dir / _output_base(json_path, "_Points.csv"))]),
        ("calculate_keeper_points.py", ["--out", str(scores_dir / _output_base(json_path, "_KeeperPoints.csv"))]),
    ):
        subprocess.run([py, str(_TESTS / script), str(json_path), *extra], check=True, cwd=str(_TESTS))

    # presentation_final_points reads from Tests/ by default — run inline merge instead
    data = json.loads(json_path.read_text(encoding="utf-8"))
    base = _match_label(data)
    _merge_final_points(
        scores_dir / f"{base}_Points.csv",
        scores_dir / f"{base}_KeeperPoints.csv",
        scores_dir / f"{base}_FinalPoints.csv",
        json_path,
    )
    outfield_src = scores_dir / f"{base}_Points.csv"
    outfield_dst = scores_dir / f"{base}_Outfield_Points.csv"
    if outfield_src.exists():
        outfield_dst.write_text(outfield_src.read_text(encoding="utf-8"), encoding="utf-8")


def _match_label(data: dict[str, Any]) -> str:
    g = data.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name") or "Home"
    away = (g.get("awayTeam") or {}).get("name") or "Away"
    return f"{slug_team(home)}_{slug_team(away)}"


def _output_base(json_path: Path, suffix: str) -> str:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    return f"{_match_label(data)}{suffix}"


def _merge_final_points(outfield_path: Path, keepers_path: Path, out_path: Path, json_path: Path) -> None:
    import pandas as pd

    from final_points import merge_outfield_and_keepers

    outfield = pd.read_csv(outfield_path)
    keepers = pd.read_csv(keepers_path)
    match_data = json.loads(json_path.read_text(encoding="utf-8"))
    merged = merge_outfield_and_keepers(outfield, keepers, match_data=match_data, validate=True)
    merged.to_csv(out_path, index=False, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch FotMob match JSON and optionally score it.")
    parser.add_argument("url", nargs="?", help="FotMob match page URL (hash may contain match id)")
    parser.add_argument("--match-id", type=int, default=None, help="Numeric FotMob match id")
    parser.add_argument("--out", type=Path, default=None, help="Output JSON path")
    parser.add_argument("--score", action="store_true", help="Run scoring pipeline after fetch")
    parser.add_argument(
        "--scores-dir",
        type=Path,
        default=_REPO / "Matches_Raw" / "World Cup 2026",
        help="Directory for score CSV outputs when --score is set",
    )
    parser.add_argument(
        "--copy-to-app",
        type=Path,
        default=_REPO / "auction-app" / "data" / "match-scores",
        help="Also copy FinalPoints CSV here (set empty to skip)",
    )
    args = parser.parse_args()

    source_url = args.url or ""
    match_id = args.match_id
    if match_id is None and args.url:
        match_id = parse_match_id_from_url(args.url)
    if match_id is None and args.url:
        _, match_id = fetch_match_from_page_url(args.url)
    if match_id is None:
        raise SystemExit("Provide a match URL (with #matchId) or --match-id")

    print(f"Fetching matchId={match_id} ...")
    try:
        payload = fetch_match_details(match_id)
    except Exception as exc:
        if not args.url:
            raise
        print(f"  API fetch failed ({exc}); trying page scrape...")
        payload, match_id = fetch_match_from_page_url(args.url)

    g = payload.get("general") or {}
    home = (g.get("homeTeam") or {}).get("name")
    away = (g.get("awayTeam") or {}).get("name")
    print(f"  {home} vs {away}")

    out_path = args.out
    if out_path is None:
        out_dir = _REPO / "Matches_Raw" / "World Cup 2026"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / default_json_name(payload)
    else:
        out_path = out_path if out_path.is_absolute() else _REPO / out_path
        out_path.parent.mkdir(parents=True, exist_ok=True)

    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote raw JSON -> {out_path}")

    urls = visual_urls(match_id, args.url or None)
    manifest_path = write_manifest(out_path, source_url=source_url or urls["match_page"], match_id=match_id, json_path=out_path, urls=urls)
    print(f"Wrote manifest -> {manifest_path}")
    print("\nVisual links (browser only):")
    for label, link in urls.items():
        print(f"  {label}: {link}")

    if args.score:
        print("\nRunning scoring pipeline...")
        run_scoring(out_path, args.scores_dir.resolve())
        base = _match_label(payload)
        final_path = args.scores_dir.resolve() / f"{base}_FinalPoints.csv"
        print(f"\nFinal points -> {final_path}")
        if args.copy_to_app:
            app_dir = args.copy_to_app if args.copy_to_app.is_absolute() else _REPO / args.copy_to_app
            app_dir.mkdir(parents=True, exist_ok=True)
            app_copy = app_dir / final_path.name
            app_copy.write_text(final_path.read_text(encoding="utf-8"), encoding="utf-8")
            print(f"Copied to app data -> {app_copy}")

        import pandas as pd

        df = pd.read_csv(final_path).sort_values("final_score", ascending=False)
        print("\nTop 15 scorers:")
        print(df.head(15).to_string(index=False))


if __name__ == "__main__":
    main()
