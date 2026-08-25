# PROGRESS.md — autorun state

The resume point. One line per completed unit, updated immediately on finishing each one,
never at the end. If context resets, this file is how the run picks up without redoing or
skipping a unit.

**Roster target:** 45 resorts. **Current:** 12.

---

## Completed units

| Unit | What | Commit | Unknown / confirmed-unpublished | Notes |
|---|---|---|---|---|
| Pre-A | Repo skeleton, schema v1, tooling | `6c2519f` | — | |
| Pre-A | Killington, Wachusett, Mad River Glen | `574c7d9` | 27 / — | |
| Pre-A | Site shell (index, resort, css, js) | `a25a2ab` | — | |
| Pre-A | Weather + conditions page | `c526437` | — | Open-Meteo, batched, 30-min sessionStorage cache |
| Pre-A | Snow fetcher + 3 adapters | `891ccf6` | — | killington=html, stowe=json, sunday-river=browser |
| Pre-A | Scheduled workflow + README | `339bd32` | — | |
| Pre-A | Bot identity factored to one module | `2258e6e` | — | `SKI_BOT_CONTACT_URL` |
| Pre-A | Stowe, Sugarbush, Jay Peak, Smugglers' Notch, Okemo | `c22c52e` | 73 / — | 8 resorts total |
| Pre-A | Schema v2: fieldNotes + dataDisputes | `f6dc065` | 28 / 51 | |
| **A** | Schema v3 doc: moguls + parks | `cf3115a` | — | |
| **A** | Schema v3 enforced + 8 resorts researched | `8aae3b2` | 43 / 60 | |
| **A** | Moguls/parks rendering on resort.html | `91ef7d1` | — | |
| **A** | Features filters + bump/park columns | `c794a56` | — | |
| **A** | SEASONAL.md | `60a9305` | — | |
| B | State files: PROGRESS, DECISIONS, HANDOFF | `211e247` | — | |
| B | Batch 2: stratton, mount-snow, burke, pico | `efb2fde` | 80 / 90 | Stratton + Burke sites unreadable; both fall back to OnTheSnow. Carinthia's 8 parks recorded in full. |

**Part A complete. Batch 2 complete.** Next unfinished unit: **Part B, Batch 3**.

---

## Batches

Roster of 37 remaining, from BATCHES.md:

- [x] Batch 2: stratton, mount-snow, burke, pico — `efb2fde` — 80 unknown / 90 confirmed
- [ ] Batch 3: cannon, loon, bretton-woods, waterville-valley, wildcat
- [ ] Batch 4: attitash, sunday-river, sugarloaf, saddleback
- [ ] Batch 5: mount-sunapee, cranmore, ragged, gunstock, crotched
- [ ] Batch 6: pats-peak, magic-mountain, bromley, bolton-valley
- [ ] Batch 7: pleasant-mountain, berkshire-east, jiminy-peak, catamount
- [ ] Batch 8: middlebury-snow-bowl, saskadena-six, black-mountain-nh, dartmouth-skiway
- [ ] Batch 9: mt-abram, black-mountain-maine, camden-snow-bowl, big-rock
- [ ] Batch 10: butternut, bousquet, mohawk-mountain

Then: Part C reviews (3 commits), Part D map + compare, Part E public site, Part F
SEASONAL.md (already written in Part A — verify and extend), Part G final report.

---

## Flagged (dormant / closed / skipped)

_None yet._

---

## INTEGRITY FAILURES

_None yet._

---

## Spot-check log

Each batch re-fetches one recorded source URL from an **earlier** batch and confirms the
number still matches.

| Batch | Checked | Result |
|---|---|---|
| 2 | Okemo `size.snowmakingPercent` = 98 against `okemo.com/.../mountain-info.aspx` | **PASS** — source still reads "Snowmaking Coverage 98%" |
