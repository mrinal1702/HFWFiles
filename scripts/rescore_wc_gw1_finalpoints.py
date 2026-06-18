"""Backward-compatible entry point for GW1 batch rescore. Prefer scripts/rescore_finalpoints.py."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.argv = [sys.argv[0], "--matches-dir", str(_ROOT / "Matches_Raw" / "World Cup 2026"), *sys.argv[1:]]
runpy.run_path(str(_ROOT / "scripts" / "rescore_finalpoints.py"), run_name="__main__")
