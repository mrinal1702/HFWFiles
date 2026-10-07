"""Regression: topPlayers CB/DEF labels do not override lineup midfielders."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_TESTS = Path(__file__).resolve().parent
_ROOT = _TESTS.parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from position_roles import resolve_outfield_position_id_for_scoring  # noqa: E402

_ARG_EGY = _ROOT / "Matches_Raw" / "World Cup 2026" / "Argentina_Vs_Egypt.json"


@pytest.mark.skipif(not _ARG_EGY.is_file(), reason="match JSON not in workspace")
def test_paredes_cb_topplayers_with_lineup_mid_stays_midfielder() -> None:
    """Paredes: FotMob topPlayers CB but lineup #5 DM (usualPlayingPositionId=2)."""
    data = json.loads(_ARG_EGY.read_text(encoding="utf-8"))
    content = data.get("content") or data
    pid = 237606
    pdata = content["playerStats"][str(pid)]
    assert resolve_outfield_position_id_for_scoring(content, pid, pdata) == 2
