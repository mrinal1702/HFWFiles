"""Regression: granular 103/107 always score as forward."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_TESTS = Path(__file__).resolve().parent
_ROOT = _TESTS.parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from position_roles import (  # noqa: E402
    GRANULAR_POSITION_IDS_ALWAYS_FORWARD,
    resolve_outfield_position_id_for_scoring,
)

_GERMANY_IVORY = _ROOT / "Matches_Raw" / "World Cup 2026" / "Germany_Vs_IvoryCoast.json"


def test_granular_103_107_defined() -> None:
    assert GRANULAR_POSITION_IDS_ALWAYS_FORWARD == frozenset({103, 107})


@pytest.mark.skipif(not _GERMANY_IVORY.is_file(), reason="match JSON not in workspace")
def test_amad_diallo_granular_103_scores_as_forward() -> None:
    data = json.loads(_GERMANY_IVORY.read_text(encoding="utf-8"))
    content = data.get("content") or data
    pid = 1070052
    pdata = content["playerStats"][str(pid)]
    assert resolve_outfield_position_id_for_scoring(content, pid, pdata) == 3


@pytest.mark.skipif(not _GERMANY_IVORY.is_file(), reason="match JSON not in workspace")
def test_yan_diomande_granular_107_scores_as_forward() -> None:
    data = json.loads(_GERMANY_IVORY.read_text(encoding="utf-8"))
    content = data.get("content") or data
    pid = 1735453
    pdata = content["playerStats"][str(pid)]
    assert resolve_outfield_position_id_for_scoring(content, pid, pdata) == 3
