# HFW Self-Sufficiency — audit & backlog

**Objective:** a new commissioner can create and operate an HFW auction for their friends without
the site owner stepping in.

**Philosophy:** don't automate everything. An experienced commissioner can make judgement calls for
their own friend group — where sensible, move authority from the site owner to the commissioner
rather than building complex automated systems. The owner keeps **competition-level** work
(schedule, scoring, Best XI publishing); commissioners own **auction-level** work.

Last updated: 9 Oct 2026 (after the self-serve auction release, commit `686291a`).

**Severity:** BLOCKER — prevents independent auctions · HIGH — major friction or likely
intervention · MEDIUM — important improvement · LOW — polish.

**Solution type:** Automation · Commissioner tooling · UX/error prevention · Rules/onboarding ·
Documentation · Technical reliability · Product/design polish.

**Status:** ✅ done · 🟡 partly done · ⬜ open · 🔒 kept with the owner by design.

---

## What shipped in the self-serve release (Oct 2026)

| Area | What changed |
|---|---|
| Create auction | Dashboard → name (suggested "<Name>'s Auction N", unique forever) → "play and admin" or "admin only". Creator is automatically the sole admin; participant code generated. Max 3 auctions waiting in a lobby per person. |
| Lobby | Before Start Bidding, participants see a waiting room (members, code, rules link); the admin sees the code, joined managers and a live first-gameweek preview. Admin tools are locked. |
| Start Bidding | One irreversible, atomic step with a confirmation: seeds the competition's player pool, copies the first gameweek's deadlines, opens transfers. First gameweek = earliest recorded round ≥ 5 days (120 h) away; blocked unless ≥ 2 future gameweeks are recorded. |
| Schedule | Gameweek deadlines live in Supabase (`competition_rounds`), recorded by the owner from `schedule.json` (whole season in advance). |
| Gameweek pipeline | `gameweek.mjs` discovers auctions from Supabase from their first gameweek onwards; the +100m first-gameweek boost is automatic. UCL 10–13 count as starting at MW1 (no data written to them). |
| Time display | Deadline tiles and the dashboard deadline render in the viewer's own timezone (fix branch `fix/hydration-deadlines`). |

---

## 1. Founder intervention

Actions that need database access, code changes or owner-only scripts.

| # | Issue | Sev. | Solution | Status |
|---|---|---|---|---|
| F1 | Creating an auction needed scripts / SQL inserts | BLOCKER | Commissioner tooling | ✅ Create auction |
| F2 | Admin assigned by editing `Auctions.admin_user_id` | BLOCKER | Commissioner tooling | ✅ creator = admin |
| F3 | Player pool / lots seeded by owner scripts | BLOCKER | Automation | ✅ Start Bidding seeds from the competition pool |
| F4 | Gameweek steps act only on auctions hand-listed in `round.json` | BLOCKER | Automation | ✅ discovered from Supabase |
| F5 | Gameweek dates only in local files, so the site couldn't judge which gameweek a new auction starts at | BLOCKER | Automation | ✅ schedule in `competition_rounds` |
| F6 | Locking squads, scoring matches, Best XI and publishing run on the owner's machine (Python + service key) and Best XI overlays are committed to git | HIGH | Automation | 🔒 owner-run per **competition**, not per auction; new auctions are included automatically. Consider moving overlays out of git later |
| F7 | Elimination refunds (`apply-elimination-refunds.mjs`) take an explicit `--auction-ids` list, so self-created auctions could be missed | HIGH | Automation | ⬜ must discover auctions from Supabase before the UCL knockouts (Feb 2027) |
| F8 | Relegations use an ID list edited inside a script + a JSON fallback file | MEDIUM | Commissioner tooling | ⬜ admin "relegate manager" action |
| F9 | Transfer window can only be toggled by SQL / the `open` step | HIGH | Commissioner tooling | ⬜ toggle in the admin Transfer Monitor |
| F10 | Real-world transfer out of the competition (full refund) has no tool; needs remove-player + give-money as two steps | MEDIUM | Commissioner tooling | ⬜ "refund & remove" admin action |
| F11 | Ending a single auction means deleting it in the DB (archiving is per competition) | MEDIUM | Commissioner tooling | ⬜ "end / cancel auction" for lobby auctions; per-auction archive later |
| F12 | Auction History years / trophy awards are code constants (`AUCTION_HISTORY_YEARS`, `MANUAL_TROPHY_AWARDS`) | MEDIUM | Automation | ⬜ derive from DB when a competition is archived |
| F13 | Only one admin per auction; handing over or adding a co-admin needs a DB edit | MEDIUM | Commissioner tooling | ⬜ transfer admin / invite co-admin |
| F14 | Rule constants (350m budget, 18 squad, 1 GK, min bid 5, +5 at 50m, 24 h lot timer) are hard-coded in code and the bid RPC | MEDIUM | Product decision | ⬜ keep fixed for now; per-auction settings only if friend groups ask |
| F15 | Gameweek schedule must be recorded by the owner ahead of time | LOW | Documentation | 🔒 owner task — keep ≥ 2 future gameweeks recorded (MW6+ needed before **3 Nov 2026**) |

## 2. Commissioner / admin capabilities

**Today an admin can:** add a free agent to a squad at a set price (no budget change) · remove a
player (back to the pool, no budget change) · give / take budget (never below 0) · cancel a leading
bid · require approval for transfers and allow / disallow pending ones · share the code and start
bidding (self-serve auctions).

**Reasonable additional powers** (judgement calls stay with the commissioner):

| # | Power | Sev. | Solution | Status |
|---|---|---|---|---|
| C1 | Open / close the transfer window | HIGH | Commissioner tooling | ⬜ |
| C2 | Remove a member, rename a seat, close joining / set capacity | MEDIUM | Commissioner tooling | ⬜ |
| C3 | Cancel a bid **and restore the previous high bidder** (today the lot goes back to unbid) | HIGH | Commissioner tooling | ⬜ |
| C4 | Re-open a sold lot / reverse a release | MEDIUM | Commissioner tooling | ⬜ |
| C5 | See the auction's deadlines and activity from the admin area | MEDIUM | Product/design polish | ⬜ |
| C6 | Cancel / end an auction still in the lobby | MEDIUM | Commissioner tooling | ⬜ |
| C7 | Hand over admin / add a co-admin | MEDIUM | Commissioner tooling | ⬜ |

**Safeguards that should come with these powers:**
- **Audit log** of every admin action (who, what, before/after), visible to participants in
  Announcements — the main protection against a commissioner who also plays (see I1).
- Confirmation dialogs with the consequence spelled out (amount, player, manager).
- Database-enforced limits that already exist must stay: budgets never negative, squad ≤ 18,
  ≤ 1 GK, scoped to one auction.
- Each admin action atomic (one RPC), so a failure can't leave half a change (see T2).

## 3. User-error recovery

| # | Mistake | Today | Sev. | Solution | Status |
|---|---|---|---|---|---|
| U1 | Bidding 56 instead of 5 | Submits instantly; bids can't be retracted. Admin can cancel, but the previous high bidder loses their position | HIGH | UX/error prevention + Commissioner tooling | ⬜ confirm step when a bid is far above the minimum (e.g. ≥ 2× or ≥ +20m); C3 for recovery |
| U2 | Releasing the wrong player | Modal with paid / free choice; irreversible. Recovery = admin re-add + take money, and the paid-release flag isn't restored | MEDIUM | Commissioner tooling | ⬜ "undo release" admin action |
| U3 | Joining the wrong auction | No way to leave or be removed | MEDIUM | Commissioner tooling | ⬜ C2 |
| U4 | Admin starts bidding too early / at the wrong gameweek | Confirmation + live preview + server re-check of the cutoff | — | — | ✅ |
| U5 | Bad transfer agreed by mistake | Optional admin approval exists | LOW | Rules/onboarding | 🟡 |

## 4. Rules and onboarding burden

| # | Issue | Sev. | Solution | Status |
|---|---|---|---|---|
| R1 | No guide for a new commissioner (what each admin tool does, when to use FFP / approvals, what the owner still does) | HIGH | Documentation | ⬜ short Commissioner Handbook page, linked from the admin lobby |
| R2 | `/rules` is one global page with fixed numbers that can contradict an auction (e.g. 12 h nation-rolling timers) | MEDIUM | Rules/onboarding | ⬜ |
| R3 | Initiation / raise / hard deadline phases | MEDIUM | Rules/onboarding | ✅ info icons on the deadline tiles |
| R4 | Remaining vs Disposable budget; squad limit counts bids held | MEDIUM | Rules/onboarding | ✅ info icons |
| R5 | Joiners land in an empty-looking auction before bidding starts | HIGH | Rules/onboarding | ✅ lobby with waiting card + rules link |
| R6 | First-gameweek timing for a new auction | HIGH | Rules/onboarding | ✅ preview, cutoff and info icon |
| R7 | FFP / "admin decisions" are rules without supporting tools | MEDIUM | Commissioner tooling | 🟡 transfer approval exists; audit log would complete it |

## 5. Auction integrity / dispute handling

| # | Risk | Existing mechanism | Sev. | Solution | Status |
|---|---|---|---|---|---|
| I1 | Admin edits (budgets, players added at any price without budget deduction) are invisible to participants | None | HIGH | Commissioner tooling + Technical | ⬜ audit log + Announcements entries |
| I2 | Commissioner is also a player (conflict of interest) | None | MEDIUM | Commissioner tooling | ⬜ addressed by I1 transparency, not automation |
| I3 | Collusive or lopsided transfers | Admin approval toggle; cash-only deals always need approval | LOW | — | 🟡 judgement call — keep with the commissioner |
| I4 | Acting-as cookie: without a login, the bid action falls back to the first manager | Middleware forces login on auction pages | LOW | Technical reliability | ⬜ remove the fallback |
| I5 | Scoring / data errors | Owner re-runs scoring; dry-run diffs against published standings | LOW | — | 🔒 owner |

**Leave subjective:** FFP, disputes about deadlines or refunds, real-world transfer edge cases — the
commissioner decides; the product's job is to make those decisions easy and visible.

## 6. Operational workflows

| Lifecycle event | Who / how today |
|---|---|
| Create auction, share code | ✅ Commissioner (self-serve) |
| Participants join | ✅ Participants (code; full 350m budget, late joiners just lose time) |
| Start bidding (first gameweek, seeding, deadlines, transfers open) | ✅ Commissioner (one button) |
| Lot settles after its timer / hard-deadline close | Automatic, but **only when someone loads a page** (T3) |
| Record the season schedule | 🔒 Owner (`schedule.json` → recorder) |
| Lock squads, score matches, Best XI, publish standings | 🔒 Owner (`gameweek.mjs` + Python), all auctions at once |
| Open next window (deadlines, +100m first-gameweek boost, paid-release reset, unsold reopened) | 🔒 Owner (`gameweek.mjs open`), all auctions at once |
| Transfer window open / close | Opened by `open` / Start Bidding; auto-closed at the hard deadline; manual toggle = SQL (F9) |
| Club knocked out → half refunds | 🔒 Owner script (F7) |
| Cut managers (relegation) | Owner script (F8) |
| Admin interventions (budgets, squads, bids, transfer approvals) | ✅ Commissioner (admin UI) |
| End of competition → archive | 🔒 Owner (per competition) |

## 7. UI / UX friction

| # | Issue | Sev. | Solution | Status |
|---|---|---|---|---|
| X1 | Dashboard deadline shown in server UTC / US format | HIGH | Product/design polish | ✅ fix branch (viewer's timezone) |
| X2 | React hydration error on every auction page (deadline tiles) | MEDIUM | Technical reliability | ✅ fix branch |
| X3 | Admin area has no overview (deadlines, activity, who's joined late) | MEDIUM | Product/design polish | ⬜ |
| X4 | Admin "Add player" buy price: meaning (refund value, no budget change) isn't explained | MEDIUM | Rules/onboarding | ⬜ info icon |
| X5 | Live-auction creation still needs Supabase Table Editor | LOW | Commissioner tooling | ⬜ out of scope for online auctions |

## 8. Reliability risks

| # | Risk | Sev. | Solution | Status |
|---|---|---|---|---|
| T1 | `/auction-lab` isn't behind login and can bid as any manager of the lab auction | HIGH | Technical reliability | ⬜ gate it to the owner or remove it |
| T2 | Admin actions are several separate writes (e.g. cancel bid updates the lot, then the budget) — a failure mid-way leaves inconsistent data; no row locks against live bids | HIGH | Technical reliability | ⬜ move each into one RPC (like `start_auction_bidding`) |
| T3 | Lot settlement / hard-deadline finalise run lazily on page load; locking refuses until someone has visited | MEDIUM | Automation | ⬜ scheduled finalise (cron) |
| T4 | Lock step flips the global `Game_Weeks.Is_Active` across competitions | MEDIUM | Technical reliability | ⬜ |
| T5 | Release button calls React hooks after an early return | MEDIUM | Technical reliability | ⬜ |
| T6 | 16 existing lint errors in untouched files | LOW | Technical reliability | ⬜ |
| T7 | Bid action assumes one seat per user per auction (`maybeSingle`) | LOW | Technical reliability | ⬜ |
| T8 | Auction id sequence was behind hand-set ids (next create would have failed) | HIGH | Technical reliability | ✅ re-synced |
| T9 | Double-clicks / stale pages on irreversible actions | HIGH | Technical reliability | ✅ for Create / Start Bidding (idempotent, server re-checks); ⬜ for admin actions (T2) |

---

## Prioritised backlog

**P0 — soon**
1. **T1** Lock down `/auction-lab` (security).
2. **F7** Elimination refunds discover auctions from Supabase (before UCL knockouts, Feb 2027); same for relegations (F8).
3. **U1** Confirm unusually large bids.
4. **I1** Admin audit log, shown in Announcements.
5. **R1** Commissioner Handbook page, linked from the admin area.
6. **F15** Record MW6+ in `schedule.json` before 3 Nov 2026 (owner).

**P1 — next**
7. **C1 / F9** Transfer-window toggle in the admin Transfer Monitor.
8. **T2** Make every admin action a single atomic RPC.
9. **C3** Cancel bid restores the previous high bidder.
10. **C2 / U3** Member management: remove, rename, close joining.
11. **C6 / F11** End / cancel an auction in the lobby.
12. **X3 / X4** Admin overview page; explain the "buy price".

**P2 — later**
13. **T3** Scheduled lot / deadline finalisation.
14. **R2** Per-auction rules page (numbers from the auction's actual settings).
15. **F12** Auction History / trophies from the DB.
16. **C7 / F13** Admin handover / co-admin.
17. **F10, U2, C4** Refund-and-remove, undo release, re-open sold lot.
18. **T4–T7** Global gameweek flag, Release hooks, lint clean-up, multi-seat bids.

## Decisions log
- Creator is the sole admin; "play and admin" or "admin only" at creation (Oct 2026).
- Names unique forever, case/space-insensitive, archived and live-auction names included.
- First gameweek: earliest recorded round ≥ 120 h to its initiation deadline, decided at Start
  Bidding; 12 h lot timers not used (kept as a possible lever).
- Budgets: 350m start, +100m when the auction's first gameweek starts; late joiners get 350m.
- Transfer window opens at Start Bidding.
- Only UEFA CL 2026/27 is offered for now.
- Pre-self-serve auctions (UCL 10–13) count as starting at MW1; nothing written to them.
