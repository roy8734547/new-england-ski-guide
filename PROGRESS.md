# PROGRESS.md — autorun state

The resume point. One line per completed unit, updated immediately on finishing each one,
never at the end. If context resets, this file is how the run picks up without redoing or
skipping a unit.

**Roster target:** 45 resorts. **Current:** 17.

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
| B | Epic/Ikon season pass price correction (5 earlier files) | `ef1167e` | — | Spot-check failure, see INTEGRITY FAILURES. |
| B | Batch 3: cannon, loon, bretton-woods, waterville-valley, wildcat | `PENDING` | 111 / 126 | Two recorded research findings were wrong and were corrected against primary sources — see below. Also added `.claude/` to `.gitignore` at the user's request. |

**Part A complete. Batches 2 and 3 complete.** Next unfinished unit: **Part B, Batch 4** —
attitash, sunday-river, sugarloaf, saddleback. No research gathered yet; start from scratch.

### Batch 3 corrections to the pre-gathered research

The research block preserved in `470c39c` was mostly accurate but contained two errors that
would have shipped as confident fiction if written up unchecked. Both were caught by going
to the resort's own site as CLAUDE.md rule 3 requires.

1. **Waterville Valley night skiing.** The research said `false` + `absent`, sourced to Ski
   NH's night-skiing list. Waterville's own site has a dedicated night skiing page
   describing lift-served alpine night skiing on Exhibition, Lower White Caps and the Lower
   Pasture, served by the Exhibition T-Bar and Lower Pasture Carpet. Recorded as `true`.
2. **Bretton Woods night skiing.** The research said record `null` + `unpublished` because
   Ski NH and a third-party guide contradicted each other. Bretton Woods' own alpine page
   states flatly that it does **not** offer night skiing or riding, which settles it:
   `false` + `absent` sourced to the resort.

**Reusable finding, revised.** Ski NH's night-skiing list is *not* authoritative for
absence. It was right about Cannon, Loon and Wildcat (each confirmed independently: none of
the three has a night-skiing page in its own sitemap, and Loon's "Friday Night Extended" is
a 5:40pm last chair on four spring dates, not lit night skiing) and wrong about Waterville
Valley. **Batches 5 and 6 must check each resort's own site rather than inheriting this.**
The `true` half of the finding stands — Cranmore, Crotched, Gunstock and Pats Peak are on
the list and get `true`, but confirm from each resort's own page anyway.

**Also newly established in Batch 3:** the **White Mountains SuperPass** — unlimited at
Bretton Woods, Cannon, Cranmore and Waterville Valley, no published blackouts, $1,589 adult
through 31 Oct 2026. Recorded as a `type: "other"` pass on all three Batch 3 members.
**Cranmore needs the same entry in Batch 5.** Source: `waterville.com/wmsp-perks`.

**Coordinates.** All five were taken from OSM peak nodes and validated by probing
Open-Meteo's elevation API against the published summit; every one lands within 150 ft, in
line with the twelve existing files, which are summit-anchored. Note for later: Wildcat's
OSM node named "Wildcat Mountain" is Wildcat A (4,354 ft probe), not the ski area summit —
the correct node is "Wildcat D" at 44.2494,-71.2236. **Stowe is an outlier worth revisiting
in Part C:** its coordinate probes at 4,285 ft against a stored `summitElevation` of 3,625,
i.e. it points at Mount Mansfield's true summit rather than the lift-served top.

---

## Batches

Roster of 37 remaining, from BATCHES.md:

- [x] Batch 2: stratton, mount-snow, burke, pico — `efb2fde` — 80 unknown / 90 confirmed
- [x] Batch 3: cannon, loon, bretton-woods, waterville-valley, wildcat — 111 unknown / 126 confirmed
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

## Batch 3 research — CONSUMED

The pre-gathered research block that lived here was written into the five resort files and
is no longer needed; the files and their per-field `source` URLs are now the record. Two of
its findings were wrong and were corrected against primary sources before writing — see
"Batch 3 corrections to the pre-gathered research" above, which is the part worth keeping.

---

## Flagged (dormant / closed / skipped)

_None yet._

---

## INTEGRITY FAILURES

### 1. Stale Epic and Ikon season pass prices in five Batch 2 / Pre-A files (found 2026-08-25)

**What was wrong.** `stratton` and `sugarbush` carried `seasonPassAdult: 1399`; `okemo`,
`stowe` and `mount-snow` carried `1089`. Both figures were labelled "2026-27 season" with a
`verifiedOn` of 2026-08-24, implying current prices. Both were out of date on the day they
were written.

**Why it happened, and it is worth understanding.** Both numbers were read from OnTheSnow's
pass buyer's guides, and **both of those pages contradict themselves.** The Ikon guide's
prose says the full pass "starts at $1,399" while its own spec box a few hundred words later
says "Ikon Pass —starts at $1,449". The Epic guide's prose says the pass "went on sale in
March for $1,089" while its "Cost:" line reads "The Epic Pass for 31+ is $1,119". Whoever
wrote the Batch 2 files read the prose. The prose is the historical on-sale price; the spec
line is the current one. Nothing was fabricated — the recorded number really is on the page
— but the wrong half of a self-contradicting page was used, and no check caught it because
re-reading the same sentence reproduces the same error.

**Fixed.** Ikon corrected to **$1,449** against `ikonpass.com/en/shop-passes` — the operator's
own shop page, which is what BATCHES.md step 3 asked for in the first place. Epic corrected
to **$1,119**; `epicpass.com` was returning a site-down error all day, so the same OnTheSnow
guide is still the source, but the current-cost line is used rather than the prose. Every
one of the five files now carries a note in `pricing.notes` saying what it previously held
and why it changed, so the correction is visible in the data and not just here.

**Lesson for the remaining batches.** Prefer the pass operator's own shop page over any
aggregator's buyer's guide for pass prices. Where an aggregator must be used, grep the raw
page for every price-shaped string rather than trusting a single sentence — a page that
quotes two different prices for the same product will happily hand you either one.

**Still worth a look:** `killington` holds its own $1,529 Killington pass price and `pico`
holds null, so neither was affected. No other file carries a mega-pass price.

---

## Spot-check log

Each batch re-fetches one recorded source URL from an **earlier** batch and confirms the
number still matches.

| Batch | Checked | Result |
|---|---|---|
| 2 | Okemo `size.snowmakingPercent` = 98 against `okemo.com/.../mountain-info.aspx` | **PASS** — source still reads "Snowmaking Coverage 98%" |
| 3 | Stratton `pricing.seasonPassAdult` = 1399 against `onthesnow.com/news/ikon-pass-buyers-guide/` | **FAIL** — see INTEGRITY FAILURES 1. Widened to Epic as well; five files corrected. |
