"""
Stat collection: extract selected per-player match stats from FotMob-style match JSON,
split by usual playing position (defenders / midfielders / forwards). Goalkeepers excluded.

Input: Match1.json (or pass path via STAT_COLLECTION_JSON env / first CLI arg).
Output: stat_collection_defenders.csv, stat_collection_midfielders.csv, stat_collection_forwards.csv
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pandas as pd

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

try:
    from scoring.defender_points import STATS_STILL_MISSING_OR_EXTERNAL
except ImportError:
    STATS_STILL_MISSING_OR_EXTERNAL = ()

# --- Config ---
TESTS_DIR = Path(__file__).resolve().parent
DEFAULT_JSON = TESTS_DIR / "Match1.json"

OUT_DEFENDERS = TESTS_DIR / "stat_collection_defenders.csv"
OUT_MIDFIELDERS = TESTS_DIR / "stat_collection_midfielders.csv"
OUT_FORWARDS = TESTS_DIR / "stat_collection_forwards.csv"

# FotMob stat keys inside playerStats sections (first occurrence wins if duplicated)
KEY_MINUTES = "minutes_played"
KEY_GOALS = "goals"
KEY_ASSISTS = "assists"
KEY_ACCURATE_PASSES = "accurate_passes"
KEY_CHANCES = "chances_created"
KEY_SOT = "ShotsOnTarget"
KEY_SOFF = "ShotsOffTarget"
KEY_DISPOSSESSED = "dispossessed"
KEY_TACKLES = "matchstats.headers.tackles"
KEY_LAST_MAN_TACKLE = "last_man_tackle"
KEY_CLEARANCE_OFF_THE_LINE = "clearance_off_the_line"
KEY_BLOCKS = "shot_blocks"
KEY_CLEARANCES = "clearances"
KEY_HEADED_CLEARANCE = "headed_clearance"
KEY_INTERCEPTIONS = "interceptions"
KEY_RECOVERIES = "recoveries"
KEY_DRIBBLED_PAST = "dribbled_past"
KEY_GROUND_DUELS_WON = "ground_duels_won"
KEY_AERIAL_WON = "aerials_won"
KEY_WAS_FOULED = "was_fouled"
KEY_FOULS = "fouls"
KEY_DUELS_WON = "duel_won"
KEY_ERRORS_LED_TO_GOAL = "errors_led_to_goal"
KEY_OFFSIDES = "Offsides"
KEY_OWN_GOALS = "own_goals"  # derived from event stream (not a playerStats key)
KEY_WOODWORK = "shots_woodwork"
KEY_ACCURATE_CROSSES = "accurate_crosses"
KEY_LONG_BALLS_ACCURATE = "long_balls_accurate"
KEY_MISSED_PENALTY = "missed_penalty"
KEY_DRIBBLES_SUCCEEDED = "dribbles_succeeded"

def own_goal_count_by_player(data: dict) -> dict[int, int]:
    """
    Own goals from the match timeline.

    We consider a goal an own goal when:
    - event type is `Goal`, and
    - either `shotmapEvent.isOwnGoal` is true, or `ownGoal` is set.
    """
    out: dict[int, int] = {}
    evs = (
        data.get("content", {})
        .get("matchFacts", {})
        .get("events", {})
        .get("events")
    )
    if not isinstance(evs, list):
        return out

    for e in evs:
        if not isinstance(e, dict):
            continue
        if e.get("type") != "Goal":
            continue

        shot = e.get("shotmapEvent") if isinstance(e.get("shotmapEvent"), dict) else {}
        is_own = shot.get("isOwnGoal") is True or e.get("ownGoal") not in (None, False)
        if not is_own:
            continue

        pid = e.get("playerId")
        if pid is None and isinstance(e.get("player"), dict):
            pid = e["player"].get("id")
        if pid is None:
            continue

        try:
            pid_i = int(pid)
        except (TypeError, ValueError):
            continue
        out[pid_i] = out.get(pid_i, 0) + 1

    return out


def _input_path() -> Path:
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    env = os.environ.get("STAT_COLLECTION_JSON")
    if env:
        return Path(env)
    return DEFAULT_JSON


def lineup_usual_position_by_player(content: dict) -> dict[int, int]:
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


def role_override_by_player(content: dict) -> dict[int, int]:
    """
    Optional position override from matchFacts.topPlayers.positionLabel.key:
    - rightwinger_short / leftwinger_short -> midfielder (2)
    - striker_short -> forward (3)
    """
    out: dict[int, int] = {}
    top = (content.get("matchFacts") or {}).get("topPlayers") or {}
    keys_to_mid = {"rightwinger_short", "leftwinger_short"}
    keys_to_fwd = {"striker_short"}
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
            if label_key in keys_to_mid:
                out[pid_i] = 2
            elif label_key in keys_to_fwd:
                out[pid_i] = 3
    return out


def red_card_count_by_player(data: dict) -> dict[int, int]:
    """
    Red cards from the main match timeline: content.matchFacts.events.events
    (type == Card, card == Red). Yellow cards are ignored.
    """
    out: dict[int, int] = {}
    evs = (
        data.get("content", {})
        .get("matchFacts", {})
        .get("events", {})
        .get("events")
    )
    if not isinstance(evs, list):
        return out
    for e in evs:
        if not isinstance(e, dict):
            continue
        if e.get("type") != "Card":
            continue
        if e.get("card") != "Red":
            continue
        pid = e.get("playerId")
        if pid is None and isinstance(e.get("player"), dict):
            pid = e["player"].get("id")
        if pid is None:
            continue
        try:
            pid_i = int(pid)
        except (TypeError, ValueError):
            continue
        out[pid_i] = out.get(pid_i, 0) + 1
    return out


def extract_stat_map(player_blob: dict) -> dict[str, dict]:
    """stat_key -> {value, total} from nested playerStats stats sections."""
    stats_by_key: dict[str, dict] = {}
    for sec in player_blob.get("stats") or []:
        if not isinstance(sec, dict):
            continue
        block = sec.get("stats")
        if not isinstance(block, dict):
            continue
        for _label, entry in block.items():
            if not isinstance(entry, dict):
                continue
            k = entry.get("key")
            if not k:
                continue
            if k in stats_by_key:
                continue
            st = entry.get("stat") or {}
            if not isinstance(st, dict):
                st = {}
            stats_by_key[k] = {
                "value": st.get("value"),
                "total": st.get("total"),
            }
    return stats_by_key


def _num(v) -> float | int | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    return None


def derived_inaccurate_passes(m: dict[str, dict]) -> int | float | None:
    ap = m.get(KEY_ACCURATE_PASSES) or {}
    val, tot = _num(ap.get("value")), _num(ap.get("total"))
    if val is None or tot is None:
        return None
    return tot - val


def derived_ground_duels_lost(m: dict[str, dict]) -> int | float | None:
    g = m.get(KEY_GROUND_DUELS_WON) or {}
    val, tot = _num(g.get("value")), _num(g.get("total"))
    if val is None or tot is None:
        return None
    return tot - val


def derived_aerial_duels_lost(m: dict[str, dict]) -> int | float | None:
    a = m.get(KEY_AERIAL_WON) or {}
    val, tot = _num(a.get("value")), _num(a.get("total"))
    if val is None or tot is None:
        return None
    return tot - val


def derived_dribbles_failed(m: dict[str, dict]) -> int | float:
    """Failed take-ons: attempts − successes from `dribbles_succeeded` (0 if stat absent)."""
    if KEY_DRIBBLES_SUCCEEDED not in m:
        return 0
    d = m.get(KEY_DRIBBLES_SUCCEEDED) or {}
    val, tot = _num(d.get("value")), _num(d.get("total"))
    if val is None or tot is None:
        return 0
    return tot - val


def gv(m: dict[str, dict], key: str):
    x = m.get(key) or {}
    return _num(x.get("value"))


def gv_total(m: dict[str, dict], key: str):
    x = m.get(key) or {}
    return _num(x.get("total"))


def gv_or_zero(m: dict[str, dict], key: str) -> int | float:
    """Completed count; 0 if the stat block is absent (no attempts recorded)."""
    if key not in m:
        return 0
    v = gv(m, key)
    return 0 if v is None else v


def gtotal_or_zero(m: dict[str, dict], key: str) -> int | float:
    """Attempt / total count; 0 if absent."""
    if key not in m:
        return 0
    v = gv_total(m, key)
    return 0 if v is None else v


def row_from_player(
    pid: int,
    pdata: dict,
    lineup_pos: dict[int, int],
    role_overrides: dict[int, int],
    red_card_counts: dict[int, int],
    own_goal_counts: dict[int, int],
) -> dict | None:
    if pdata.get("isGoalkeeper") is True:
        return None

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

    # Optional override for winger/striker labeling from topPlayers
    pos = role_overrides.get(pid, pos)

    m = extract_stat_map(pdata)
    gdl = derived_ground_duels_lost(m)
    clearances_total = gv_or_zero(m, KEY_CLEARANCES) + gv_or_zero(m, KEY_HEADED_CLEARANCE)

    return {
        "player_id": pid,
        "player_name": pdata.get("name"),
        "team_id": pdata.get("teamId"),
        "team_name": pdata.get("teamName"),
        "usual_playing_position_id": pos,
        "minutes_played": gv(m, KEY_MINUTES),
        "goals": gv(m, KEY_GOALS),
        "assists": gv(m, KEY_ASSISTS),
        "accurate_passes": gv(m, KEY_ACCURATE_PASSES),
        "inaccurate_passes": derived_inaccurate_passes(m),
        "chances_created": gv(m, KEY_CHANCES),
        "shots_on_target": gv(m, KEY_SOT),
        "shots_off_target": gv(m, KEY_SOFF),
        "dispossessed": gv(m, KEY_DISPOSSESSED),
        "tackles": gv(m, KEY_TACKLES),
        "last_man_tackle": gv_or_zero(m, KEY_LAST_MAN_TACKLE),
        "clearance_off_the_line": gv_or_zero(m, KEY_CLEARANCE_OFF_THE_LINE),
        "tackles_lost": gdl,
        "blocks": gv(m, KEY_BLOCKS),
        "clearances": gv(m, KEY_CLEARANCES),
        "headed_clearance": gv(m, KEY_HEADED_CLEARANCE),
        "clearances_total": clearances_total,
        "interceptions": gv(m, KEY_INTERCEPTIONS),
        "recoveries": gv(m, KEY_RECOVERIES),
        "dribbled_past": gv(m, KEY_DRIBBLED_PAST),
        "ground_duels_won": gv(m, KEY_GROUND_DUELS_WON),
        "ground_duels_lost": gdl,
        "aerial_duels_won": gv(m, KEY_AERIAL_WON),
        "aerial_duels_lost": derived_aerial_duels_lost(m),
        "was_fouled": gv(m, KEY_WAS_FOULED),
        "fouls_committed": gv(m, KEY_FOULS),
        "duels_won": gv(m, KEY_DUELS_WON),
        "errors_led_to_goal": gv_or_zero(m, KEY_ERRORS_LED_TO_GOAL),
        "caught_offside": gv_or_zero(m, KEY_OFFSIDES),
        "crosses_completed": gv_or_zero(m, KEY_ACCURATE_CROSSES),
        "crosses_attempted": gtotal_or_zero(m, KEY_ACCURATE_CROSSES),
        "long_balls_completed": gv_or_zero(m, KEY_LONG_BALLS_ACCURATE),
        "long_balls_attempted": gtotal_or_zero(m, KEY_LONG_BALLS_ACCURATE),
        "missed_penalty": int(gv_or_zero(m, KEY_MISSED_PENALTY)),
        "own_goals": int(own_goal_counts.get(pid, 0)),
        "woodwork": gv_or_zero(m, KEY_WOODWORK),
        "dribbles_successful": gv_or_zero(m, KEY_DRIBBLES_SUCCEEDED),
        "dribbles_attempted": gtotal_or_zero(m, KEY_DRIBBLES_SUCCEEDED),
        "dribbles_failed": derived_dribbles_failed(m),
        "red_cards": int(red_card_counts.get(pid, 0)),
    }


def stat_collection(data: dict) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    content = data.get("content") or {}
    player_stats = content.get("playerStats") or {}
    lineup_pos = lineup_usual_position_by_player(content)
    role_overrides = role_override_by_player(content)
    red_card_counts = red_card_count_by_player(data)
    own_goal_counts = own_goal_count_by_player(data)

    rows: list[dict] = []
    for pid_str, pdata in player_stats.items():
        if not isinstance(pdata, dict):
            continue
        try:
            pid = int(pdata.get("id", pid_str))
        except (TypeError, ValueError):
            continue
        r = row_from_player(pid, pdata, lineup_pos, role_overrides, red_card_counts, own_goal_counts)
        if r is None:
            continue
        rows.append(r)

    df = pd.DataFrame(rows)
    if df.empty:
        empty = pd.DataFrame()
        return empty, empty, empty

    d1 = df[df["usual_playing_position_id"] == 1].copy()
    d2 = df[df["usual_playing_position_id"] == 2].copy()
    d3 = df[df["usual_playing_position_id"] == 3].copy()
    return d1, d2, d3


def _write_df_csv(df: pd.DataFrame, path: Path) -> Path:
    """Write CSV; if the file is locked (e.g. open in Excel), write beside it under export_run/."""
    try:
        df.to_csv(path, index=False, encoding="utf-8")
        return path
    except PermissionError:
        alt = path.parent / "export_run" / path.name
        alt.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(alt, index=False, encoding="utf-8")
        print(f"Warning: could not write {path} (file in use?). Wrote {alt} instead.")
        return alt


def main() -> None:
    path = _input_path()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    defenders, midfielders, forwards = stat_collection(data)

    p1 = _write_df_csv(defenders, OUT_DEFENDERS)
    p2 = _write_df_csv(midfielders, OUT_MIDFIELDERS)
    p3 = _write_df_csv(forwards, OUT_FORWARDS)

    print(f"Input: {path}")
    print(f"Defenders (usual_playing_position_id=1): {len(defenders)} rows -> {p1}")
    print(f"Midfielders (2): {len(midfielders)} rows -> {p2}")
    print(f"Forwards (3): {len(forwards)} rows -> {p3}")
    if STATS_STILL_MISSING_OR_EXTERNAL:
        print("\nStats still missing or external (see scoring/defender_points.py):")
        for line in STATS_STILL_MISSING_OR_EXTERNAL:
            print(f"  - {line}")


if __name__ == "__main__":
    main()
