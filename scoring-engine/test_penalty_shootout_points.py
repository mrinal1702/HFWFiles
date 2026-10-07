"""Tests for post-ET penalty shootout scoring."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

_TESTS = Path(__file__).resolve().parent
if str(_TESTS) not in sys.path:
    sys.path.insert(0, str(_TESTS))

from penalty_shootout_points import (  # noqa: E402
    SHOOTOUT_POINTS_MISSED,
    SHOOTOUT_POINTS_SAVE,
    SHOOTOUT_POINTS_SCORED,
    compute_penalty_shootout_points,
)


class PenaltyShootoutPointsTest(unittest.TestCase):
    def test_germany_paraguay_shootout(self) -> None:
        json_path = _TESTS.parent / "Matches_Raw/World Cup 2026/Germany_Vs_Paraguay.json"
        if not json_path.exists():
            self.skipTest("Germany vs Paraguay JSON not present")

        data = json.loads(json_path.read_text(encoding="utf-8"))
        outfield, keeper = compute_penalty_shootout_points(data)

        self.assertEqual(outfield[749736], SHOOTOUT_POINTS_MISSED)  # Havertz miss
        self.assertEqual(outfield[460632], SHOOTOUT_POINTS_SCORED)  # Kimmich
        self.assertEqual(outfield[860890], SHOOTOUT_POINTS_SCORED)  # Canale winner
        self.assertEqual(keeper[8570], SHOOTOUT_POINTS_SAVE)  # Neuer 1 save
        self.assertEqual(keeper[6724], 2 * SHOOTOUT_POINTS_SAVE)  # Gill 2 saves

    def test_no_shootout_returns_empty(self) -> None:
        outfield, keeper = compute_penalty_shootout_points({"content": {"matchFacts": {}}})
        self.assertEqual(outfield, {})
        self.assertEqual(keeper, {})


if __name__ == "__main__":
    unittest.main()
