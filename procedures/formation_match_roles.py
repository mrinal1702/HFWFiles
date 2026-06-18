"""
Helpers for best-XI / formation: match-level outfield roles using the same rules as scoring.

Import from procedures/ with repo root working directory, or ensure `Tests` is on PYTHONPATH.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent.parent
_TESTS = _ROOT / "Tests"
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from position_roles import (  # noqa: E402
    GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD,
    lineup_granular_position_id_by_player,
    resolve_outfield_position_id_for_scoring,
    role_override_by_player,
    WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS,
)


def load_match_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def outfield_roles_by_player_for_match(content: dict[str, Any]) -> dict[int, int]:
    """
    player_id -> 1 DEF / 2 MID / 3 FWD for everyone in playerStats who is not a GK,
    using the same resolution as scoring (lineup + usualPosition + topPlayers overrides).
    """
    player_stats = content.get("playerStats") or {}
    out: dict[int, int] = {}
    for pid_str, pdata in player_stats.items():
        if not isinstance(pdata, dict):
            continue
        try:
            pid = int(pdata.get("id", pid_str))
        except (TypeError, ValueError):
            continue
        pos = resolve_outfield_position_id_for_scoring(content, pid, pdata)
        if pos is not None:
            out[pid] = pos
    return out


__all__ = [
    "GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD",
    "WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS",
    "lineup_granular_position_id_by_player",
    "load_match_json",
    "outfield_roles_by_player_for_match",
    "resolve_outfield_position_id_for_scoring",
    "role_override_by_player",
]
