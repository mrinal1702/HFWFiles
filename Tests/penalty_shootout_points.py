"""
Post–extra-time penalty shootout scoring from FotMob match JSON.

Rules (knockout shootout only, not in-play penalties):
  +4  scored
  -4  missed
  +6  goalkeeper save (per save)

Takers are keyed by FotMob player id from penaltyShootoutEvents.
Keeper saves use saved_penalties_in_shootout from playerStats when present,
with event-level keeperId on saved shots as a fallback.
"""

from __future__ import annotations

from typing import Any

SHOOTOUT_POINTS_SCORED = 4.0
SHOOTOUT_POINTS_MISSED = -4.0
SHOOTOUT_POINTS_SAVE = 6.0

KEY_SAVED_PENALTIES_IN_SHOOTOUT = "saved_penalties_in_shootout"


def _safe_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _player_id_from_event(event: dict[str, Any]) -> int | None:
    pid = _safe_int(event.get("playerId"))
    if pid is not None:
        return pid
    player = event.get("player")
    if isinstance(player, dict):
        return _safe_int(player.get("id"))
    return None


def _extract_stat_map(player_blob: dict[str, Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for sec in player_blob.get("stats") or []:
        if not isinstance(sec, dict):
            continue
        blk = sec.get("stats")
        if not isinstance(blk, dict):
            continue
        for ent in blk.values():
            if not isinstance(ent, dict):
                continue
            key = ent.get("key")
            if not key or key in out:
                continue
            stat = ent.get("stat") or {}
            if not isinstance(stat, dict):
                stat = {}
            out[key] = stat
    return out


def _saved_penalties_in_shootout_from_stats(match_data: dict[str, Any]) -> dict[int, int]:
    """team_id -> save count from FotMob playerStats."""
    content = match_data.get("content") or {}
    player_stats = content.get("playerStats") or {}
    by_team: dict[int, int] = {}

    for blob in player_stats.values():
        if not isinstance(blob, dict) or blob.get("isGoalkeeper") is not True:
            continue
        team_id = _safe_int(blob.get("teamId"))
        if team_id is None:
            continue
        stat = _extract_stat_map(blob).get(KEY_SAVED_PENALTIES_IN_SHOOTOUT) or {}
        saves = _safe_int(stat.get("value")) or 0
        if saves:
            by_team[team_id] = by_team.get(team_id, 0) + saves
    return by_team


def _keeper_id_from_event(event: dict[str, Any]) -> int | None:
    shotmap = event.get("shotmapEvent")
    if isinstance(shotmap, dict):
        kid = _safe_int(shotmap.get("keeperId"))
        if kid is not None:
            return kid
    return _safe_int(event.get("keeperId"))


def extract_penalty_shootout_events(match_data: dict[str, Any]) -> list[dict[str, Any]]:
    content = match_data.get("content") or {}
    match_facts = content.get("matchFacts") or {}
    events_block = match_facts.get("events") or {}
    raw = events_block.get("penaltyShootoutEvents")
    if not isinstance(raw, list):
        return []
    return [e for e in raw if isinstance(e, dict)]


def compute_penalty_shootout_points(
    match_data: dict[str, Any],
) -> tuple[dict[int, float], dict[int, float]]:
    """
    Returns:
      outfield_points_by_player_id — taker bonuses/penalties
      keeper_save_points_by_team_id — added to keeper unit stats (team_id key)
    """
    events = extract_penalty_shootout_events(match_data)
    if not events:
        return {}, {}

    outfield: dict[int, float] = {}
    saves_by_keeper_id: dict[int, int] = {}

    for event in events:
        if event.get("isPenaltyShootoutEvent") is False:
            continue

        etype = str(event.get("type") or "")
        pid = _player_id_from_event(event)

        if etype == "Goal" and pid is not None:
            outfield[pid] = outfield.get(pid, 0.0) + SHOOTOUT_POINTS_SCORED
            continue

        if etype == "MissedPenalty" and pid is not None:
            outfield[pid] = outfield.get(pid, 0.0) + SHOOTOUT_POINTS_MISSED
            shotmap = event.get("shotmapEvent")
            if isinstance(shotmap, dict) and str(shotmap.get("eventType") or "") == "Save":
                keeper_id = _keeper_id_from_event(event)
                if keeper_id is not None:
                    saves_by_keeper_id[keeper_id] = saves_by_keeper_id.get(keeper_id, 0) + 1
            continue

        if etype in ("Save", "SavedPenalty"):
            keeper_id = _keeper_id_from_event(event)
            if keeper_id is not None:
                saves_by_keeper_id[keeper_id] = saves_by_keeper_id.get(keeper_id, 0) + 1

    # Map keeper player ids -> team ids for save credits on keeper units.
    content = match_data.get("content") or {}
    player_stats = content.get("playerStats") or {}
    keeper_team_by_player: dict[int, int] = {}
    for key, blob in player_stats.items():
        if not isinstance(blob, dict) or blob.get("isGoalkeeper") is not True:
            continue
        kid = _safe_int(blob.get("id")) or _safe_int(key)
        tid = _safe_int(blob.get("teamId"))
        if kid is not None and tid is not None:
            keeper_team_by_player[kid] = tid

    saves_by_team = _saved_penalties_in_shootout_from_stats(match_data)
    if not saves_by_team and saves_by_keeper_id:
        for keeper_id, count in saves_by_keeper_id.items():
            team_id = keeper_team_by_player.get(keeper_id)
            if team_id is not None:
                saves_by_team[team_id] = saves_by_team.get(team_id, 0) + count

    keeper_points = {
        team_id: count * SHOOTOUT_POINTS_SAVE for team_id, count in saves_by_team.items()
    }
    return outfield, keeper_points
