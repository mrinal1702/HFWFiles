# Archived one-off scripts

Kept for reference and audit only. **Do not run these.** They were written for a
specific auction, gameweek or one-time setup that has already happened. Their
relative paths (`.env.local`, `./lib/`, sibling scripts) also assume the old
location `auction-app/scripts/`.

| Folder | Contents |
|--------|----------|
| `epl-2026-27/` | EPL 2026/27 (auction 9, archived): MW2–MW4 bidding openers; PL live auction 2 setup |
| `world-cup-2026/` | World Cup 2026 (auctions 5/6/7, archived): live-auction archiving, team-name seeding, drill/minimal live setups, trial auction 8 deletion |
| `uefa-cl-2026-27-setup/` | **Completed** one-time setup for the active UCL 2026/27 auctions 10–13 (live-auction creation, online import, auction 13 creation, first bidding openers, auction 11 lot seeding/diagnostic, keeper-position fix, admin lookup) and the GW2 opener + pre/post checks (`open-ucl-gw2-all`, `inspect-ucl-gw2-precheck`, `spotcheck-ucl-gw2` — superseded by `gameweek.mjs open` / `status`). The auctions themselves are live; only these steps are done. |
| `legacy-pre-isolation/` | Pre-competition-isolation tools: global "active GW" score publisher, legacy score-breakdown tables, random/test score seeders, full-wipe scripts that point at the removed `Player_List/` |

The reusable commissioner toolkit stays in `auction-app/scripts/` — see
`auction-app/docs/OPS_OTHER_MODULES.md` §8.
