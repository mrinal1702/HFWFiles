"""
Validate one or more *_FinalPoints.csv files before Supabase upload.

Usage:
  python Tests/validate_final_points.py path/to/Match_FinalPoints.csv [more...]
  python Tests/validate_final_points.py "Matches_Raw/World Cup 2026/*_FinalPoints.csv"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_TESTS = Path(__file__).resolve().parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from final_points import validate_final_points_csv  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate FinalPoints CSV keeper rows and totals.")
    parser.add_argument("paths", nargs="+", help="FinalPoints CSV file(s) or glob")
    args = parser.parse_args()

    files: list[Path] = []
    for raw in args.paths:
        p = Path(raw)
        if "*" in raw or "?" in raw:
            files.extend(sorted(Path().glob(raw) if not p.is_absolute() else p.parent.glob(p.name)))
        else:
            files.append(p)

    if not files:
        raise SystemExit("No files matched.")

    failed = 0
    for fp in files:
        try:
            validate_final_points_csv(fp)
            print(f"OK  {fp}")
        except ValueError as exc:
            failed += 1
            print(f"FAIL  {fp}\n  {exc}", file=sys.stderr)

    if failed:
        raise SystemExit(f"{failed} file(s) failed validation.")
    print(f"\nAll {len(files)} file(s) passed.")


if __name__ == "__main__":
    main()
