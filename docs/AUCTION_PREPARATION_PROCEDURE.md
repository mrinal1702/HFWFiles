# Auction preparation procedure

This is the **end-to-end procedure** for building the fantasy **player pool** used by the auction app and downstream scripts: canonical names, mapped positions, and a single master CSV ready for import or seeding.

It is separate from **weekly scoring** (match JSON → scores CSV → Supabase). For that, see [`SCORING_OPERATIONS_RUNBOOK.md`](./SCORING_OPERATIONS_RUNBOOK.md).

---

## What you get at the end

| Output | Purpose |
|--------|---------|
| `Player_List/Raw_Files/<Team>_Squad.json` | One JSON per club: raw FotMob position codes + profile-enriched `player_name`. |
| `Player_List/master_player_list.csv` | **One row per player**: mapped fantasy role in `position`, normalized display names, UTF-8 with BOM for Excel. |

---

## Prerequisites

- Python 3 with dependencies used elsewhere in this repo (including `beautifulsoup4` for the squad scrape).
- Network access to `fotmob.com`.
- Patience: the scrape hits **every player profile** with rate limits (roughly **0.5s between players**, **1–2s between clubs**).

---

## Step 1 — Configure which clubs are in the pool

Teams are **not** passed as ad-hoc JSON links on the command line. You edit the **`TEAMS`** list inside:

`C:\Users\trive\HFWFiles\Tests\fetch_fotmob_squads.py`

Each entry has:

- **`team_name`** — Label stored in outputs (e.g. `Real Madrid`).
- **`team_id`** — Numeric FotMob team id (from the URL).
- **`slug`** — URL segment for that team’s squad page (from the URL).

FotMob squad URLs look like:

`https://www.fotmob.com/en-GB/teams/<team_id>/squad/<slug>`

Example: open a club’s squad page in the browser, copy `team_id` and `slug` from the address bar, and add a `TEAMS` row.

Save the file before running the scrape.

---

## Step 2 — Scrape squad pages and every player profile

**Script:** `C:\Users\trive\HFWFiles\Tests\fetch_fotmob_squads.py`

```bash
python "C:\Users\trive\HFWFiles\Tests\fetch_fotmob_squads.py"
```

**What it does**

1. For each configured team, requests the **squad HTML** and parses the table of players (links to `/players/<id>/...`).
2. For **each player**, requests that player’s **profile** page and reads embedded `__NEXT_DATA__` JSON:
   - **`data.name`** — canonical display name (same source as the website).
   - **Primary position** — short code from `positionDescription` when available (e.g. `AM`, `CB`, `LW`).
3. Applies **`finalize_player_display_name`** (see Step 3) so names are cleaned, Unicode-normalized, and common mojibake repaired when present.
4. Writes `Player_List/Raw_Files/<Team>_Squad.json` (pretty-printed UTF-8 JSON, `ensure_ascii=False` for real accents).

**Raw JSON `position`** stays as **FotMob codes** (not fantasy roles). Coaches may appear with position `Coach`.

---

## Step 3 — Build the master player list CSV

**Script:** `C:\Users\trive\HFWFiles\Tests\build_master_player_csv.py`

```bash
python "C:\Users\trive\HFWFiles\Tests\build_master_player_csv.py"
```

**What it does**

1. Loads every `*_Squad.json` under `Player_List/Raw_Files`.
2. **Deduplicates** by `player_id` (one row per player; best row wins for metadata).
3. **Position → fantasy role** — Before writing the CSV, maps the `position` column using the fixed map in the script (`POSITION_ROLE_MAP` in `build_master_player_csv.py`):
   - Examples: `CB`/`LB`/`RB` → `Defender`; `CM`/`DM`/… → `Midfielder`; **`LW`/`RW`/`ST` → `Forward`**; `GK` → `Goalkeeper`.
   - Rows with **empty** position, **`Coach`**, or an **unknown** code are **dropped** from the CSV (they do not appear in the master list).
4. **Names** — Runs **`finalize_player_display_name`** again on the merged `player_name` so the export stays consistent with the scrape (cleanup, NFC, mojibake repair).
5. Writes **`Player_List/master_player_list.csv`** as **UTF-8 with BOM** so Excel on Windows usually opens accented names correctly.

**Shared name logic** lives in `Tests/fotmob_player_profile.py` (`finalize_player_display_name`, injury-text stripping, etc.).

---

## Step 4 — Sanity checks

- Script stdout reports: number of squad files, raw rows, unique players before mapping, **skipped** counts (empty / Coach / unmapped), and **rows written**.
- Open `master_player_list.csv` in Excel via **Data → Get Data → From Text/CSV** with **UTF-8** if double-click shows wrong accents.
- Spot-check a few known players (accents, dual-nationality spellings).

---

## File reference (quick)

| File | Role |
|------|------|
| `Tests/fetch_fotmob_squads.py` | Config `TEAMS`, squad + profile scrape → `Raw_Files/*.json`. |
| `Tests/fotmob_player_profile.py` | HTTP fetch, `__NEXT_DATA__` parse, display name + position helpers, `finalize_player_display_name`. |
| `Tests/build_master_player_csv.py` | Merge JSONs, role map, CSV output. |

---

## After the player pool is ready

- Seed or sync **Supabase** `players` (and related tables) using your chosen script (e.g. auction app seed scripts that read `master_player_list.csv`).
- Auction scoring and uploads follow **`SCORING_OPERATIONS_RUNBOOK.md`**, not this document.

---

## Changing the fantasy role map

Edit **`POSITION_ROLE_MAP`** (and related logic if you add new codes) in:

`Tests/build_master_player_csv.py`

Re-run **only** Step 3 if squad JSON is already up to date and you only changed the map.
