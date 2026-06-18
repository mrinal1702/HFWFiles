"""
FotMob match position resolution shared by stat scoring, endowed points, and best-XI.

usualPlayingPositionId: 0=GK, 1=DEF, 2=MID, 3=FWD.

Resolution order (see resolve_outfield_position_id_for_scoring):
1. lineup usualPlayingPositionId (or playerStats.usualPosition fallback)
2. matchFacts.topPlayers positionLabel.key overrides
3. granular lineup positionId always-mid slots (e.g. 85 = #10 AM)
"""

from __future__ import annotations

from typing import Any


# Granular FotMob `content.lineup.*.positionId` where LW/RW in topPlayers → MID (winger rule).
# Example: Yamal RW = 83, Raphinha LW = 87. Barnes (107), Elanga (103) remain forward.
WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS: frozenset[int] = frozenset({83, 87})

# Granular slots that always count as midfielder (e.g. #10 AM — Salah, Bellingham in WC data).
GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD: frozenset[int] = frozenset({85})

_TOPPLAYER_WINGER_KEYS = frozenset({"rightwinger_short", "leftwinger_short"})
_TOPPLAYER_STRIKER_KEYS = frozenset({"striker_short"})
_TOPPLAYER_MIDFIELDER_KEYS = frozenset({"leftmidfielder_short", "rightmidfielder_short"})


def lineup_usual_position_by_player(content: dict[str, Any]) -> dict[int, int]:
    """Map player id -> usualPlayingPositionId (0–3) from lineup starters/subs."""
    out: dict[int, int] = {}
    lineup = content.get("lineup") or {}
    for side in ("homeTeam", "awayTeam"):
        team = lineup.get(side) or {}
        for bucket in ("starters", "subs"):
            for p in team.get(bucket) or []:
                if not isinstance(p, dict):
                    continue
                pid = p.get("id")
                up = p.get("usualPlayingPositionId")
                if pid is None or up is None:
                    continue
                out[int(pid)] = int(up)
    return out


def lineup_granular_position_id_by_player(content: dict[str, Any]) -> dict[int, int]:
    """Map player id -> FotMob granular positionId from lineup (e.g. 83=RW, 85=#10 AM)."""
    out: dict[int, int] = {}
    lineup = content.get("lineup") or {}
    for side in ("homeTeam", "awayTeam"):
        team = lineup.get(side) or {}
        for bucket in ("starters", "subs"):
            for p in team.get(bucket) or []:
                if not isinstance(p, dict):
                    continue
                pid = p.get("id")
                pos_id = p.get("positionId")
                if pid is None or pos_id is None:
                    continue
                try:
                    out[int(pid)] = int(pos_id)
                except (TypeError, ValueError):
                    continue
    return out


def role_override_by_player(content: dict[str, Any]) -> dict[int, int]:
    """
    Overrides from matchFacts.topPlayers.positionLabel.key:

    - leftmidfielder_short / rightmidfielder_short -> midfielder (2)
    - striker_short -> forward (3)
    - leftwinger_short / rightwinger_short -> midfielder (2) only if granular positionId
      is in WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS; otherwise no override.
    """
    out: dict[int, int] = {}
    granular = lineup_granular_position_id_by_player(content)
    top = (content.get("matchFacts") or {}).get("topPlayers") or {}
    for bucket in ("homeTopPlayers", "awayTopPlayers"):
        for p in top.get(bucket) or []:
            if not isinstance(p, dict):
                continue
            pid = p.get("playerId")
            if pid is None:
                continue
            try:
                pid_i = int(pid)
            except (TypeError, ValueError):
                continue
            label_key = ((p.get("positionLabel") or {}).get("key") or "").strip().lower()
            if label_key in _TOPPLAYER_MIDFIELDER_KEYS:
                out[pid_i] = 2
            elif label_key in _TOPPLAYER_STRIKER_KEYS:
                out[pid_i] = 3
            elif label_key in _TOPPLAYER_WINGER_KEYS:
                g = granular.get(pid_i)
                if g is not None and g in WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS:
                    out[pid_i] = 2
    return out


def resolve_outfield_position_id_for_scoring(
    content: dict[str, Any],
    pid: int,
    pdata: dict[str, Any],
) -> int | None:
    """
    Same role resolution as stat_collection.row_from_player (for formation / eligibility).

    Returns 1=DEF, 2=MID, 3=FWD, or None if goalkeeper or no usable outfield line.
    """
    if pdata.get("isGoalkeeper") is True:
        return None
    lineup_pos = lineup_usual_position_by_player(content)
    role_overrides = role_override_by_player(content)
    granular = lineup_granular_position_id_by_player(content)
    pos = lineup_pos.get(pid)
    if pos is None:
        up = pdata.get("usualPosition")
        if up is not None:
            pos = int(up)
    if pos is None:
        return None
    if pos == 0:
        return None
    if pos not in (1, 2, 3):
        return None
    pos = role_overrides.get(pid, pos)
    g = granular.get(pid)
    if g is not None and g in GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD:
        pos = 2
    return pos
