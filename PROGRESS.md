# PROGRESS.md — autorun state

The resume point. One line per completed unit, updated immediately on finishing each one,
never at the end. If context resets, this file is how the run picks up without redoing or
skipping a unit.

**Roster target:** 45 resorts. **Current:** 26.

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
| B | Batch 3: cannon, loon, bretton-woods, waterville-valley, wildcat | `2f8af90` | 111 / 126 | Two recorded research findings were wrong and were corrected against primary sources — see below. Also added `.claude/` to `.gitignore` at the user's request. |
| B | Night-skiing negatives re-sourced off Ski NH | `72b5924` | — | Ski NH's list is a curated feature, not a registry. |
| B | Batch 4: attitash, sunday-river, sugarloaf, saddleback | `12e9972` | 143 / 157 | 1 warning (Saddleback publishes a park count but no park names). |
| B | Batch 5: mount-sunapee, cranmore, ragged, gunstock, crotched | `3b41bea` | 180 / 189 | 2 warnings, both correct data. Vail still down, so Sunapee and Crotched lean on OnTheSnow. |

**Part A complete. Batches 2 through 5 complete.** Next unfinished unit: **Part B, Batch 6** —
pats-peak, magic-mountain, bromley, bolton-valley. No research gathered yet.

### Carry into Batch 6 — the Indy directory is the shortcut

`https://www.indyskipass.com/our-resorts` renders one structured block per partner resort:
**Vertical / Trails / Lifts / Night (yes-no) / T-Parks (yes-no)**. It is the single cleanest
source found so far, and crucially its `Night` field is an affirmative published datum, so it
can support an `absent` fieldNote where Ski NH's curated list cannot. Values already pulled
from it on 2026-08-25, for use in batches 6 through 10 — **still confirm each against the
resort's own site before writing, and re-fetch rather than trusting this table blindly:**

| Resort | Vertical | Trails | Lifts | Night | T-Parks |
|---|---|---|---|---|---|
| Pats Peak | 770 ft | 28 | 11 | **Yes** | Yes |
| Magic Mountain | 1,500 ft | 50 | 5 | No | Yes |
| Bolton Valley | 1,704 ft | 71 | 6 | **Yes** | Yes |
| Berkshire East | 1,180 ft | 45 | 6 | **Yes** | Yes |
| Catamount | 1,000 ft | 44 | 8 | **Yes** | Yes |
| Middlebury Snowbowl | 1,020 ft | 17 | 4 | **Yes** | No |
| Black Mountain (NH) | 1,100 ft | 45 | 5 | No | No |
| Black Mountain of Maine | 1,380 ft | 31 | 2 | No | No |
| Mt. Abram | 1,050 ft | 43 | 4 | No | No |
| Camden Snow Bowl | 1,070 ft | 15 | 3 | **Yes** | Yes |
| Big Rock Mountain | 920 ft | 29 | 4 | **Yes** | Yes |
| Bousquet Mountain | 750 ft | 22 | 4 | **Yes** | Yes |

Bromley is **not** in the Indy directory, so it will need its own sourcing.

Note that Bousquet (750 ft) and Pats Peak (770 ft) both sit above the ~650 ft cutoff but not
by much, and Camden Snow Bowl (1,070 ft on only 15 trails) and Big Rock (920 ft) are the
marginal Tier C cases — expect very high null rates, which BATCHES.md says is the correct
outcome, not a sign to try harder.

**Also still outstanding:** Vail's web estate was down for the whole of 2026-08-25. Attitash,
Mount Sunapee and Crotched all lean entirely on OnTheSnow as a result, and all three have
empty `parks` sections. **Re-do those three in Part C once epicpass.com and the resort sites
are readable again.**

### Batch 5 notes

- **Cranmore's summit elevation is probably wrong and is recorded as disputed.** Cranmore and
  OnTheSnow both publish a 2,000 ft summit, but the OpenStreetMap peak node for Cranmore
  Mountain is tagged 510 m and a terrain probe of that point returns 1,644 ft. A 1,200 ft
  vertical from a 1,650 ft summit puts the base near 450 ft, which matches North Conway's
  valley floor; the published pairing does not. Stored the resort's figure with a
  `dataDispute` against it.
- **Cranmore and OnTheSnow also disagree on acreage** — 170 vs 200 — with the resort claiming
  *less*, which is unusual enough to be mildly reassuring about its other numbers.
- **No adult season pass price exists for Cranmore.** Every 2026-27 product is listed as a
  from-price with no age bands published anywhere on the page; confirmed by a second read
  aimed specifically at the age breakdown. Note Cranmore lists the White Mountains SuperPass
  from $825 while Waterville and Cannon both publish $1,589 adult, so Cranmore's figure must
  cover a different age band — do not try to reconcile them.
- **Ragged publishes window and online prices side by side**, which almost nobody else does,
  so it is the only file on the roster with all four pricing fields populated. Its $559
  unlimited adult season pass is the cheapest on the roster by several hundred dollars. The
  validator warns that its `advanceTypical` sits below the window range; that is correct data
  and the warning is the validator being conservative.
- **Ragged's old domain is dead.** `ragged-mt.com` now redirects to an unrelated German site;
  the live site is `raggedmountainresort.com`. Any older citation is broken.
- **Ragged has no mountain statistics page at all**, which is odd for a resort of its size, so
  every size figure comes from OnTheSnow. It also has no PeakRankings review, which makes its
  `moguls` section the one place on the roster with no third-party input whatsoever. The file
  says so and flags itself for re-checking against the live grooming report in season.
- **Gunstock is county-owned** — Belknap County, run by the Gunstock Area Commission — which
  makes it one of very few publicly-owned ski areas in the United States, and `type: "none"`
  on passes.
- Coordinates again from OSM peaks, elevation-probed: Sunapee −63 ft, Crotched −15 ft, Ragged
  −42 ft, Gunstock −79 ft against published summits. Cranmore is the outlier at −356 ft,
  which is the dispute above rather than a bad coordinate.

### Batch 4 notes

- **Sunday River runs lit night skiing** and it was nearly missed. Ski NH does not cover
  Maine, Ski Maine has no night-skiing page, and the resort's own navigation does not
  surface it; the only trace was `/winter-activities/twilight-skiing` in its sitemap.
  Fridays, Saturdays and select holidays, 3-6pm, Chondola and South Ridge Express, lit,
  under the 2026/27 season. **That is the second night-skiing finding in two batches that
  came from grepping a resort's sitemap for `night|twilight` — do that every time.**
- **Attitash `nightSkiing` is null, deliberately.** attitash.com is JavaScript-rendered and
  unreadable, OnTheSnow publishes an *empty* operating schedule for it so the `isNight`
  check that settled the other four is unavailable, and Ski NH cannot support a negative.
  No source either way, so no value. Revisit when Vail's site is back up.
- **Saddleback's published stats do not reconcile.** The resort and OnTheSnow both give a
  4,120 ft summit, a 2,460 ft base and a 2,000 ft vertical; 4,120 − 2,460 = 1,660. Stored
  the summit and the vertical, nulled the base. The validator's summit/base/vertical cross
  check would have errored on all three.
- **Sugarloaf and Saddleback both have very large snowfall disputes** (200 vs 140, and 225
  vs 141). Both are recorded in `dataDisputes`. These are the two biggest gaps on the roster
  and both are central to how the resorts sell themselves.
- **Attitash is the weakest file on the roster** — every figure from OnTheSnow, no park data,
  no mogul data, no night-skiing answer. Named in the Part G report as one to redo.
- Coordinates again from OSM peaks, elevation-probed. Sunday River's is Oz (3,136 ft probe
  vs 3,150 published); Attitash's is the top station of The Mountaineer, found via an
  Overpass `aerialway` query because no OSM peak node corresponds to the ski summit —
  **that Overpass lift-top technique is the fallback to use when a peak node is missing.**

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
- [x] Batch 3: cannon, loon, bretton-woods, waterville-valley, wildcat — `2f8af90` — 111 unknown / 126 confirmed
- [x] Batch 4: attitash, sunday-river, sugarloaf, saddleback — `12e9972` — 143 unknown / 157 confirmed
- [x] Batch 5: mount-sunapee, cranmore, ragged, gunstock, crotched — `3b41bea` — 180 unknown / 189 confirmed
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
| 4 | Burke `size.verticalDrop` = 2011, `skiableAcres` = 178, `trailCount` = 56 against `onthesnow.com/vermont/burke-mountain/ski-resort` | **PASS** — spec block still reads 2,011 ft / 178 ac / 56 runs. Note the same self-contradiction pattern as the pass guides: the page prose says "55 trails and 4 lifts" while its spec block says 56 and 5. The file uses the spec block, which is the correct half. |
| 5 | Waterville Valley `size.snowmakingPercent` = 100 and `skiableAcres` = 265 against `waterville.com/mountain-stats` | **PASS** — page still reads "SNOWMAKING 265 Aces 100% Coverage", plus Skiable Acres 265, Longest Run 1.9 mi and Summit 4,004 ft, all matching the file. |
