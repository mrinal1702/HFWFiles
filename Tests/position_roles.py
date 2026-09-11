"""
FotMob match position resolution shared by stat scoring, endowed points, and best-XI.

usualPlayingPositionId: 0=GK, 1=DEF, 2=MID, 3=FWD.

Resolution order (see resolve_outfield_position_id_for_scoring):
SLOT-FIRST POLICY (2026-09): the FotMob granular lineup positionId (the in-game
formation slot) always decides the scoring role / simulator. Listed pool position
and usualPlayingPositionId are never used to pick the simulator when a slot exists.
  1. granular lineup positionId band → DEF (31-39) / MID (62-88) / FWD (103+)
  2. only if no granular slot: fall back to usualPlayingPositionId
     (or playerStats.usualPosition), plus legacy topPlayers overrides.

GW policy (2026-06): GW1 group-stage scores in Supabase are FROZEN under the map
that was live at tag points/gw1-rescore-position-map. Do not batch-rescore GW1.
This file includes topPlayers v2 keys (CB/LB/RB/CM/CAM/CDM) for GW2+ new matches.
See docs/POSITION_MAP_POLICY.md and Scores/gw1_topplayers_position_map.json.
"""

from __future__ import annotations

from typing import Any


# Granular FotMob `content.lineup.*.positionId` where LW/RW in topPlayers → MID (winger rule).
# Example: Yamal RW = 83, Raphinha LW = 87 → MID when topPlayers winger label applies.
WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS: frozenset[int] = frozenset({83, 87})

# Granular slots that always count as midfielder (e.g. #10 AM — Salah, Bellingham in WC data).
GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD: frozenset[int] = frozenset({85})

# Granular wide-forward slots (FotMob 4-3-3 wings). Always FWD even if usualPlayingPositionId is 2.
# Example: Amad Diallo granular 103 with usual 2 → forward (Germany vs Ivory Coast GW2).
GRANULAR_POSITION_IDS_ALWAYS_FORWARD: frozenset[int] = frozenset({103, 107})

# --- Slot-band role mapping (2026-09 policy) --------------------------------
# FotMob granular `content.lineup.*.positionId` encodes a pitch zone. The in-game
# slot — not usualPlayingPositionId or the listed pool position — decides which
# simulator (DEF / MID / FWD) a player is scored in.
#   GK slot 11 is handled separately via isGoalkeeper.
#   Defenders:   31-39  → DEF (back line: full-backs 32/38, centre-backs 33-37)
#   Midfielders: 62-88  → MID (incl. wingers 83/87 and slot 82, which FotMob may
#                              otherwise tag as forward)
#   Forwards:    103+   → FWD
GRANULAR_SLOT_DEFENDER_RANGE: range = range(31, 40)     # 31..39 inclusive
GRANULAR_SLOT_MIDFIELDER_RANGE: range = range(62, 89)   # 62..88 inclusive
GRANULAR_SLOT_FORWARD_MIN: int = 103


def role_from_granular_slot(slot: int | None) -> int | None:
    """Map a FotMob granular lineup positionId to 1=DEF / 2=MID / 3=FWD.

    Slot-first policy: the in-game formation slot determines the scoring role.
    Returns None when the slot is missing or falls in an unmapped band, so the
    caller can fall back to usualPlayingPositionId.
    """
    if slot is None:
        return None
    if slot in GRANULAR_SLOT_DEFENDER_RANGE:
        return 1
    if slot in GRANULAR_SLOT_MIDFIELDER_RANGE:
        return 2
    if slot >= GRANULAR_SLOT_FORWARD_MIN:
        return 3
    return None

# --- topPlayers positionLabel.key → counting role (1 DEF / 2 MID / 3 FWD) ---

_TOPPLAYER_STRIKER_KEYS = frozenset({"striker_short"})

_TOPPLAYER_WINGER_KEYS = frozenset({"rightwinger_short", "leftwinger_short"})

_TOPPLAYER_WIDE_MIDFIELDER_KEYS = frozenset({"leftmidfielder_short", "rightmidfielder_short"})

_TOPPLAYER_CENTRAL_MIDFIELDER_KEYS = frozenset({
    "centermidfielder_short",
    "centerdefensivemidfielder_short",
    "centerattackingmidfielder_short",
})

# Full-back / centre-back labels from topPlayers (GW1 audit 2026-06).
_TOPPLAYER_DEFENDER_KEYS = frozenset({
    "centerback_short",
    "leftback_short",
    "rightback_short",
})

# Wing-backs: only → DEF when lineup usual is already defender (Perisic/Nakamura stay FWD).
_TOPPLAYER_WING_BACK_KEYS = frozenset({
    "left_wing_back_short",
    "right_wing_back_short",
})

# Back-compat alias used in older scripts.
_TOPPLAYER_MIDFIELDER_KEYS = _TOPPLAYER_WIDE_MIDFIELDER_KEYS

ALL_HANDLED_TOPPLAYER_KEYS: frozenset[str] = frozenset(
    _TOPPLAYER_STRIKER_KEYS
    | _TOPPLAYER_WINGER_KEYS
    | _TOPPLAYER_WIDE_MIDFIELDER_KEYS
    | _TOPPLAYER_CENTRAL_MIDFIELDER_KEYS
    | _TOPPLAYER_DEFENDER_KEYS
    | _TOPPLAYER_WING_BACK_KEYS
)


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

    Defenders (conditional): centerback_short, leftback_short, rightback_short → 1
      only if lineup usualPlayingPositionId is 1 (avoids mis-tagged DMs labeled CB in topPlayers)
    Wing-backs: left/right_wing_back_short → 1 only if lineup usualPlayingPositionId is 1
    Midfielders: LM/RM, CM, CDM, CAM keys → 2
    Striker: striker_short → 3
    Wingers: left/rightwinger_short → 2 only if granular positionId is 83 or 87
    """
    out: dict[int, int] = {}
    lineup_usual = lineup_usual_position_by_player(content)
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
            if not label_key:
                continue
            if label_key in _TOPPLAYER_DEFENDER_KEYS:
                if lineup_usual.get(pid_i) == 1:
                    out[pid_i] = 1
            elif label_key in _TOPPLAYER_WING_BACK_KEYS:
                if lineup_usual.get(pid_i) == 1:
                    out[pid_i] = 1
            elif label_key in _TOPPLAYER_WIDE_MIDFIELDER_KEYS | _TOPPLAYER_CENTRAL_MIDFIELDER_KEYS:
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

    Slot-first (2026-09): the granular in-game positionId band decides the role.
    usualPlayingPositionId / listed position are only a fallback when no slot exists.
    """
    if pdata.get("isGoalkeeper") is True:
        return None

    granular = lineup_granular_position_id_by_player(content)
    g = granular.get(pid)

    # 1) Slot-first: the in-game granular positionId decides the simulator.
    slot_role = role_from_granular_slot(g)
    if slot_role is not None:
        return slot_role

    # 2) Fallback only when no granular slot: usualPlayingPositionId + legacy overrides.
    lineup_pos = lineup_usual_position_by_player(content)
    role_overrides = role_override_by_player(content)
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
    if g is not None and g in GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD:
        pos = 2
    if g is not None and g in GRANULAR_POSITION_IDS_ALWAYS_FORWARD:
        pos = 3
    return pos

