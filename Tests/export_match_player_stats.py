"""
Export content["stats"] (team) and content["playerStats"] to CSV for inspection.
"""
import json
from pathlib import Path

import pandas as pd

FILE_PATH = Path(__file__).resolve().parent / "Match1.json"
OUT_DIR = Path(__file__).resolve().parent


def flatten_team_stats(stats_root: dict) -> list[dict]:
    """Flatten FotMob team match stats under content['stats']."""
    rows: list[dict] = []
    periods = stats_root.get("Periods") or {}
    for period_name, period_data in periods.items():
        if not isinstance(period_data, dict):
            continue
        groups = period_data.get("stats") or []
        for group in groups:
            if not isinstance(group, dict):
                continue
            group_title = group.get("title")
            group_key = group.get("key")
            for item in group.get("stats") or []:
                if not isinstance(item, dict):
                    continue
                pair = item.get("stats")
                if not isinstance(pair, list) or len(pair) < 2:
                    continue
                home_v, away_v = pair[0], pair[1]
                rows.append(
                    {
                        "period": period_name,
                        "group_title": group_title,
                        "group_key": group_key,
                        "stat_title": item.get("title"),
                        "stat_key": item.get("key"),
                        "home": home_v,
                        "away": away_v,
                        "format": item.get("format"),
                        "type": item.get("type"),
                        "highlighted": item.get("highlighted"),
                    }
                )
    return rows


def flatten_player_stats(player_stats: dict) -> list[dict]:
    """Flatten nested player stat blocks to one row per metric."""
    rows: list[dict] = []
    for pid, pdata in player_stats.items():
        if not isinstance(pdata, dict):
            continue
        base = {
            "player_id": pdata.get("id"),
            "player_name": pdata.get("name"),
            "team_id": pdata.get("teamId"),
            "team_name": pdata.get("teamName"),
            "is_goalkeeper": pdata.get("isGoalkeeper"),
            "shirt_number": pdata.get("shirtNumber"),
        }
        sections = pdata.get("stats") or []
        if not sections:
            rows.append({**base, "section_title": None, "section_key": None, "stat_label": None, "stat_key": None, "value": None, "total": None, "stat_type": None})
            continue
        for sec in sections:
            if not isinstance(sec, dict):
                continue
            sec_title = sec.get("title")
            sec_key = sec.get("key")
            stats_block = sec.get("stats")
            if not isinstance(stats_block, dict):
                continue
            for label, entry in stats_block.items():
                if not isinstance(entry, dict):
                    continue
                st = entry.get("stat") or {}
                if not isinstance(st, dict):
                    st = {}
                rows.append(
                    {
                        **base,
                        "section_title": sec_title,
                        "section_key": sec_key,
                        "stat_label": label,
                        "stat_key": entry.get("key"),
                        "value": st.get("value"),
                        "total": st.get("total"),
                        "stat_type": st.get("type"),
                    }
                )
    return rows


def main() -> None:
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    content = data.get("content") or {}
    team_stats = content.get("stats") or {}
    player_stats = content.get("playerStats") or {}

    team_rows = flatten_team_stats(team_stats)
    player_rows = flatten_player_stats(player_stats)

    df_team = pd.DataFrame(team_rows)
    df_player = pd.DataFrame(player_rows)

    team_csv = OUT_DIR / "match_team_stats.csv"
    player_csv = OUT_DIR / "match_player_stats.csv"
    keys_csv = OUT_DIR / "player_stat_keys_this_match.csv"

    df_team.to_csv(team_csv, index=False, encoding="utf-8")
    df_player.to_csv(player_csv, index=False, encoding="utf-8")

    # Unique stat keys / labels in this match (player side)
    if len(df_player):
        key_cols = ["stat_key", "stat_label", "section_key", "section_title"]
        has_metric = (
            df_player["section_key"].notna()
            | df_player["stat_key"].notna()
            | df_player["stat_label"].notna()
        )
        keys_df = (
            df_player.loc[has_metric, key_cols]
            .drop_duplicates()
            .sort_values(["section_key", "stat_key"])
        )
    else:
        keys_df = pd.DataFrame(columns=["stat_key", "stat_label", "section_key", "section_title"])
    keys_df.to_csv(keys_csv, index=False, encoding="utf-8")

    print(f"Wrote {len(df_team)} team stat rows -> {team_csv}")
    print(f"Wrote {len(df_player)} player stat rows -> {player_csv}")
    print(f"Wrote {len(keys_df)} unique player stat keys -> {keys_csv}")


if __name__ == "__main__":
    main()
