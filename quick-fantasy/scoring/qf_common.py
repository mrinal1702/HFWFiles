"""Shared helpers for Quick Fantasy fixture scripts. Writes only under quick-fantasy/data/."""
from __future__ import annotations

import json
import os
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
QF_ROOT = HERE.parent
REPO = QF_ROOT.parent
ENGINE = REPO / "scoring-engine"
FIXTURES_DIR = QF_ROOT / "data" / "fixtures"

# Keeper units use the same id convention as the main game's pools: 90_000_000 + FotMob team id.
# (FinalPoints keeper rows carry the bare team id; scores.csv maps them back to this pool id.)
KEEPER_ID_BASE = 90_000_000
POOL_COLUMNS = ["player_id", "player_name", "team_id", "team_name", "position"]

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
CHILD_ENV = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}


def kebab(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-") or "unknown"


def read_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, data: dict) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def keeper_pool_id(team_id: int) -> int:
    return KEEPER_ID_BASE + int(team_id)


def ensure_inside_qf(p: Path) -> Path:
    """Refuse any write target outside quick-fantasy/ (isolation guard)."""
    rp = p.resolve()
    if QF_ROOT.resolve() not in (rp, *rp.parents):
        raise SystemExit(f"Refusing to write outside quick-fantasy/: {rp}")
    return rp


def find_fixture(ref: str) -> Path:
    """Accept a fixture folder path or a FotMob match id."""
    p = Path(ref)
    if p.is_dir() and (p / "fixture.json").exists():
        return ensure_inside_qf(p)
    if ref.isdigit():
        hits = sorted(FIXTURES_DIR.glob(f"*_{ref}"))
        if len(hits) == 1:
            return hits[0]
        if len(hits) > 1:
            raise SystemExit(f"Several fixture folders for match {ref}: {[h.name for h in hits]}")
    raise SystemExit(f"Fixture not found: {ref} (pass a folder under {FIXTURES_DIR} or a FotMob match id)")
