# PROGRESS.md — autorun state

The resume point. One line per completed unit, updated immediately on finishing each one,
never at the end. If context resets, this file is how the run picks up without redoing or
skipping a unit.

**Roster target:** 45 resorts. **Current:** 38.

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
| B | Batch 6 (part 1): pats-peak, magic-mountain, bromley + pico fix | `c42e0c8` | 196 / 205 | |
| B | Batch 6 (part 2): bolton-valley — batch closed | `f150308` | 205 / 214 | Snowfall conflict resolved as the notes specified: stored OnTheSnow's 202, explained the resort's 312 in prose. `keyTrails` left empty. |
| B | Validator: `advanceTypical` range check narrowed | `6874b1d` | — | Only flags advance rates ABOVE `windowTicketAdultHigh` now. Cleared 4 false-positive warnings. |
| B | **Vail repair**: attitash, mount-sunapee, crotched rebuilt from Vail's own pages | `869bfc0` | 197 / 210 | Standing probe passed. See "Vail repair" below. |
| B | Batch 7: pleasant-mountain, berkshire-east, jiminy-peak, catamount | `0fd6cf5` | 227 / 249 | No PeakRankings page for any of the four. See Batch 7 notes. |
| B | Batch 8: middlebury-snow-bowl, saskadena-six, black-mountain-nh, dartmouth-skiway | `41f82aa` | 265 / 281 | Two confirmed-zero park sections. See Batch 8 notes. |

**Part A complete. Batches 2 through 8 complete.**

**RESUME HERE.** The next unfinished unit is **Batch 9** — mt-abram, black-mountain-maine,
camden-snow-bowl, big-rock. Then Batch 10, then Parts C through G.

### STANDING CHECK AT THE START OF EVERY SESSION — Vail: DONE, no longer needed

~~Probe one Vail URL before anything else.~~ **Resolved 2026-08-25.** `attitash.com` returned
200, and Attitash, Mount Sunapee and Crotched were rebuilt from Vail's own pages in `869bfc0`.
This check can be dropped. What remains outstanding about Vail is narrower and is *not* worth
a session's retrying — see below.

#### Vail repair — what was fixed and what is still not obtainable

All three files previously took every figure from OnTheSnow and carried empty `parks` sections.
Rebuilt from `.../the-mountain/about-the-mountain/mountain-info.aspx` and, where one exists,
`.../terrain-parks.aspx`:

- **attitash** — trails 73 → **76**, snowfall 88 → **120**, terrain 22/49/29 → **29/44/27**,
  `nightSkiing` null → **false**, and three named parks (Arcade Park, Ptarmigans Pop Up Park,
  Family Cross). The night-skiing answer came from the hours-of-operation page, whose published
  winter lift hours never run past 4:00pm — that page is the reusable technique for a Vail
  property with no night page in its sitemap.
- **mount-sunapee** — acres 232 → **233**, `snowmakingPercent` null → **97**, `parks.count`
  null → **4**. Sunapee has **no terrain-parks page at all** (the sibling URL 404s and nothing
  in its content sitemap matches `park`), so the parks are counted and unnamed.
- **crotched** — trails 24 → **25**, terrain 29/33/38 → **28/40/32**, `nightSkiing` re-sourced
  from Ski NH to the resort's own page, both parks named and described (CM Park, NCC-1701).

**Still not obtainable, and stop trying:** every ticket and pass page across Vail's estate —
`epicpass.com` included — 302s to `waitingroom.snow.com`, which requires JavaScript. Content
pages are fine; commerce pages are not. Epic pass pricing therefore still comes from
OnTheSnow's buyer's guide and each of the six Epic files says so in `pricing.notes`. Do not
spend another session on this; it needs Playwright, which is a SEASONAL.md item.

#### Two findings from the repair worth carrying forward

1. **Vail's own stat blocks contradict Vail's own prose.** Mount Sunapee's mountain statistics
   block reads "Terrain Parks 4" while a tile on the *same page* says it "boasts 2 terrain
   parks". Stored the 4 on the Burke precedent (the spec block has been the correct half every
   time this pattern has appeared), and said so in `parks.overview`. This is now the third
   self-contradicting source on the roster after the two pass buyer's guides and Burke.
2. **Resort-vs-aggregator terrain splits differ more than expected.** All three files carried
   OnTheSnow's percentages; two of the three disagreed with the resort's own by 6-7 points, in
   both cases making the mountain look harder than the operator claims. Sunapee's matched
   exactly. Prefer the resort's split whenever it is readable.

#### bolton-valley — research CONSUMED

The research block that lived here was written into `data/resorts/bolton-valley.json` in
`f150308` and is no longer needed; the file and its per-field `source` URLs are now the record.
Both judgement calls the notes asked for were made as specified: OnTheSnow's **202** inches is
stored with the resort's 312 explained in `editorial.snowQuality` rather than in `dataDisputes`
(the stored value is not the resort's claim, so a dispute record does not fit), and the Indy
directory's 2,100 ft base was rejected in favour of OnTheSnow's 1,446 ft, which reconciles
exactly with the summit and vertical. The "highest base elevation in Vermont" marketing line
was **not** repeated: Bolton's lift-served base is 1,446 ft, well below Pico's 2,000 ft, and the
2,100 ft figure refers to the base village rather than the bottom of the drop.

**One gap, deliberately left:** `bolton-valley.editorial.keyTrails` is empty and the validator
warns about it. The instruction for this unit was explicitly not to re-fetch, and no trail names
were in the gathered research; inventing them is the exact failure mode section 3 of AUTORUN.md
warns about. **Pick this up in Part C** — one fetch of boltonvalley.com's trail map page.

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

**Vail note:** superseded — the three Vail files were repaired in `869bfc0`. See the Vail
repair section above.

### Batch 8 notes

- **The Indy partner directory has a per-resort page, and it is much richer than the index
  table.** `indyskipass.com/our-resorts/<slug>` carries elevations, a difficulty split, an
  annual snowfall average and high, acreage, trail and lift counts, and the structured
  Terrain Parks / Night Skiing yes-no fields, plus a No Blackout Dates marker. Slugs are not
  predictable — Black Mountain NH is `black-mountain-ski-area` and Saskadena Six is
  `saskadena-six-ski-area`; **grep `/our-resorts/` on the index page to find them**.
- **Two confirmed-zero parks sections**, the first on the roster. Middlebury Snow Bowl and
  Black Mountain NH both have `parks.count: 0` with an `absent` fieldNote, supported by Indy's
  structured Terrain Parks field reading No *and* the resort's own site never mentioning a park
  across any page. That is the two-line-of-evidence bar this project should hold for a
  confirmed zero — one line alone is not enough.
- **But do not trust the Indy structured fields blindly.** Indy's page for **Dartmouth Skiway**
  gives a 1,680 ft summit and a 700 ft base, against the resort's own 1,943 ft summit and
  OnTheSnow's 974 ft base. Two of its three elevation figures are simply wrong. Its Middlebury,
  Saskadena and Black Mountain elevations, by contrast, reconciled exactly. Cross-check every
  Indy figure against something before using it.
- **Middlebury Snow Bowl publishes an inverted difficulty pyramid**: 6 Easiest, 8 More
  Difficult, 14 Most Difficult of 28 trails — half the network at the top grade — plus 11
  separately counted glades and 600+ acres of woods and backcountry outside the 110 acres of
  trail. Snowmaking reaches six trails. This is the most natural-snow-dependent file on the
  roster and its `moguls.presence` is set to `common` on that structural basis.
- **Black Mountain NH publishes three different trail counts and two acreages.** 45 (prose, on
  both its own site and its owner's Indy listing) / 61 (its own facts block) / 68 (OnTheSnow),
  and 140 acres against OnTheSnow's 600. **This is the first time this repo has NOT followed
  the stat-block-over-prose rule** — 45 is stored because the operator repeats it in a second
  venue while 61 appears once, and because the pattern of both gaps looks like glades being
  counted in or out. That reasoning is written into the file as a hypothesis, not a finding.
- **Black Mountain NH is becoming skier-owned.** Indy Pass bought it in 2024, rebuilt the
  snowmaking and lifts, and is converting it to a co-operative; the operating entity now signs
  as *Black Mountain Community Cooperation*. In **July 2026** it also bought the 12-acre base
  parcel including Whitney's Inn (guests since 1842), the Shovel Handle Pub and the snowmaking
  water supply. Season passes sell out and are allocated by waitlist. **This is the most
  time-sensitive file on the roster — re-check it before any publication.**
- **Dartmouth Skiway contradicts itself in a single sentence**: "the base elevation is 968 feet,
  and the summit elevation is 1,943 feet. The vertical drop is 968 feet." Used OnTheSnow's 974 ft
  base, which reconciles with both other figures.
- **A third cross-resort finding for Part C.** A Dartmouth Skiway season pass carries discounts
  at **Whaleback, Ragged, Saskadena Six, Middlebury Snowbowl and Pats Peak** (blackouts may
  apply). `ragged.json` and `pats-peak.json` do not mention it. Note Whaleback is not on this
  guide's roster. Also: **Uphill New England**, a non-profit multi-mountain uphill pass covering
  12+ resorts, is referenced by both Saskadena Six and Dartmouth Skiway and is not recorded
  anywhere in the data.
- **Coordinates** for all four came from the Overpass `aerialway` query rather than peak nodes,
  anchored to the summit lift top: Middlebury −122 ft against published, Saskadena Six +148 ft,
  Black Mountain NH −126 ft, Dartmouth (Holt's Ledge Double top) −102 ft. The lift geometry also
  independently confirmed every lift count in the batch.

### Batch 7 notes

- **A reusable technique: when a resort has no terrain-park page, grep its events calendar.**
  Pleasant Mountain publishes no park page at all, but its event pages named three parks —
  Playground Park (the Throwdown Showdown), Lower Grom Park and Lil Grommet Park (the free
  Progression Sessions). This is the third such technique now: sitemap-grep for `night|twilight`
  found Sunday River's and Bolton's night operations, the Overpass `aerialway` query finds a
  summit when no peak node exists, and now the events calendar finds parks.
- **Pleasant Mountain has no difficulty breakdown anywhere.** Not on the resort's site, not on
  OnTheSnow, not at Ski Maine. All four terrain percentages are null — the only file on the
  roster in that position. The renderer handles it (`terrainBreakdown` returns null and the
  page prints "No published difficulty split"), which was checked.
- **Berkshire East publishes no mountain statistics at all.** Its complete site was enumerated
  from its own Joomla sitemap — no stats page, no terrain page, no trail list, no park page.
  Every size figure comes from OnTheSnow. Its trail map is a PDF whose text is not extractable.
  Two figures had to be adjudicated between third parties: the Indy directory says 45 trails and
  6 lifts, OnTheSnow says 43 and 5, and OnTheSnow's lift count is internally consistent
  (3 quads + 1 double + 1 surface), so it wins.
- **Jiminy Peak publishes six difficulty grades**, splitting intermediate three ways: 17 Easy,
  6 Low Intermediate, 7 Intermediate, 6 High Intermediate, 6 Black, 3 Double Black. Those counts
  are collapsed to this schema's four grades and converted to 38/42/13/7; the arithmetic is
  spelled out in `difficultyNotes` and the raw counts are preserved there, because the counts
  are the more faithful record.
- **Two cross-resort findings that affect files already written:**
  1. **Berkshire East and Catamount sell one joint season pass** — AIM High, $699 adult until
     31 Aug 2026 then $799, unlimited at both with no blackouts, plus two days each at **Burke**
     and **Smugglers' Notch** and unlimited midweek at Burke in March. `burke.json` and
     `smugglers-notch.json` do not mention this. **Part C should add it to both.**
  2. **Jiminy Peak, Bromley and Cranmore are all Fairbank Group mountains.** A Jiminy Anytime or
     Zephyr pass carries two free tickets at each of the other two, and a $471 three-mountain
     college pass covers all three with no blackouts. `bromley.json` and `cranmore.json` mention
     neither the ownership nor the reciprocal tickets. **Part C should add it to both.**
- **Jiminy is an Ikon *Bonus* Mountain**, not a destination: 2 days, redeemed at the ticket
  window rather than direct-to-lift, not valid on Ikon Base or Session. Its blackout dates are
  published, so its `passes[].blackouts` is populated rather than null.
- **Catamount straddles the NY/MA state line** — base lodge in Hillsdale NY, summit in South
  Egremont MA. Recorded as `MA` (the validator's state enum is New England only) with the split
  explained in `difficultyNotes`. Its OnTheSnow slug is `catamount-ski-ride-area` under
  **new-york**, which is why the obvious URLs 404 — found by grepping OnTheSnow's New York index.
- **Both Berkshire East and Catamount price day tickets dynamically and say so**, including that
  days sell out entirely. All six ticket fields across the two files are null, correctly.
- **Coordinates.** Pleasant Mountain (North Peak, −14 ft against published) and Jiminy Peak
  (−34 ft) both probe cleanly against OSM peak nodes. Berkshire East and Catamount have no
  usable peak node and were anchored to lift tops via the Overpass `aerialway` query: Berkshire
  East to the Summit Quad / T-Bar Express top, which probes 1,450–1,509 ft against a published
  1,720 ft summit, and Catamount to the Ridge Quad top at 1,880 ft against 2,000 ft. **Those two
  gaps are DEM smoothing on narrow ridges, not bad coordinates** — the lift top is the ski summit
  by definition regardless of what a 90 m elevation grid says about it. Recorded here rather than
  as disputes.

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
- [x] Batch 6: pats-peak, magic-mountain, bromley, bolton-valley — `c42e0c8` + `f150308` — 205 unknown / 214 confirmed
- [x] Batch 7: pleasant-mountain, berkshire-east, jiminy-peak, catamount — `0fd6cf5` — 227 unknown / 249 confirmed
- [x] Batch 8: middlebury-snow-bowl, saskadena-six, black-mountain-nh, dartmouth-skiway — `41f82aa` — 265 unknown / 281 confirmed
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

### 2. Pico editorial claimed the wrong base-elevation ranking (found 2026-08-25)

**What was wrong.** `pico.json` said in `editorial.snowQuality` that Pico has "the highest
base elevation of any resort in this guide except Jay Peak", and carried a tidbit saying it
had "the second-highest base elevation of any resort in this guide, behind Jay Peak". Both
were false when written: Jay Peak's stored base is 1,750 ft and Pico's is 2,000 ft, so Pico
was already the highest on the roster and still is at 29 resorts.

**How it was found.** Bromley's about page claims the highest base elevation in Vermont at
1,950 ft. Checking that against the roster surfaced Pico at 2,000 ft — and, incidentally,
that Bromley's claim is also wrong. Sorting one column caught a mistake that had survived
since Batch 2.

**Fixed.** Both sentences in `pico.json` corrected to say Pico has the highest base elevation
in the guide. Bromley's file repeats the resort's southern-exposure claim, which is
checkable, but records its base as second-highest in Vermont rather than repeating the
resort's "highest" claim.

**Lesson.** This is a different failure mode from the pass-price one: not a bad source, but a
*comparative* claim in editorial that was never re-checked as the roster grew. Superlatives
like "highest", "longest", "only" and "steepest" are true relative to a roster that is still
changing. **Part C should sweep every editorial superlative against the finished 45-resort
roster** — there are more of them than this, and they are exactly the kind of error that
reads as authoritative.

---

### 3. Attitash editorial claimed the wrong snowfall ranking (found 2026-08-25)

**What was wrong.** `attitash.json` said in three places that its 88-inch average was "the
lowest average snowfall of any resort in this guide" and "the lowest total in this guide by a
wide margin". It was not, on the day it was written. Crotched was already stored at 63 inches,
Pats Peak at 69, Wachusett at 71 and Cranmore at 80 — four resorts below it, one of them by 25
inches. Attitash was tied for fifth with Ragged.

**How it was found.** Not by a spot-check. It surfaced while sorting the roster's snowfall
column to decide whether the resort's newly readable 120-inch figure or OnTheSnow's 88 should
be stored — which is to say, by the same manoeuvre that caught the Pico error: sorting one
column across the whole roster.

**Fixed.** All three sentences rewritten. The file now stores the resort's 120 with OnTheSnow's
88 in `dataDisputes`, and compares Attitash to named neighbours (Wildcat, twenty minutes away
and two thousand feet higher) rather than to a roster ranking. Its one surviving superlative —
that the 600 ft base is the lowest on the roster — was checked and is true.

**Lesson, and this is the second instance of it.** This is the identical failure mode to the
Pico base-elevation error: a *comparative* editorial claim, true-sounding, never re-checked, in
a file written before the roster was complete. Two instances in six batches means this is not
bad luck, it is systematic. **Part C's superlative sweep is now mandatory, not advisory** —
grep every resort file for "lowest", "highest", "only", "smallest", "largest", "steepest",
"longest", "most" and "in this guide", and check each hit against the finished 45-resort
roster. Note also that new files are still introducing them: Crotched's "smallest mountain on
this roster" is true at 30 resorts and will very likely be false at 45, once Camden Snow Bowl,
Big Rock, Middlebury and the Massachusetts hills are in.

## Spot-check log

Each batch re-fetches one recorded source URL from an **earlier** batch and confirms the
number still matches.

| Batch | Checked | Result |
|---|---|---|
| 2 | Okemo `size.snowmakingPercent` = 98 against `okemo.com/.../mountain-info.aspx` | **PASS** — source still reads "Snowmaking Coverage 98%" |
| 3 | Stratton `pricing.seasonPassAdult` = 1399 against `onthesnow.com/news/ikon-pass-buyers-guide/` | **FAIL** — see INTEGRITY FAILURES 1. Widened to Epic as well; five files corrected. |
| 4 | Burke `size.verticalDrop` = 2011, `skiableAcres` = 178, `trailCount` = 56 against `onthesnow.com/vermont/burke-mountain/ski-resort` | **PASS** — spec block still reads 2,011 ft / 178 ac / 56 runs. Note the same self-contradiction pattern as the pass guides: the page prose says "55 trails and 4 lifts" while its spec block says 56 and 5. The file uses the spec block, which is the correct half. |
| 5 | Waterville Valley `size.snowmakingPercent` = 100 and `skiableAcres` = 265 against `waterville.com/mountain-stats` | **PASS** — page still reads "SNOWMAKING 265 Aces 100% Coverage", plus Skiable Acres 265, Longest Run 1.9 mi and Summit 4,004 ft, all matching the file. |
| 6 | Sunday River `size.skiableAcres` = 884, `trailCount` = 139, `liftCount` = 19 against `sundayriver.com/the-mountain` | **PASS** — The Numbers block still reads 8 Peaks / 884 Skiable Acres / 139 Trails & Glades / 19 Lifts. |
| 7 | Mount Snow `parks.count` = 8 and all eight park names against `mountsnow.com/.../terrain-parks.aspx` | **PASS** — Grommet, Inferno, Junkyard, Fool's Gold, Nitro, The Gulch, Prospector and The Farm all still named and described. |
| 8 | Bromley elevations, snowfall and snowmaking-by-difficulty against `bromley.com/about` | **PASS** — base 1,950 / summit 3,284 / vertical 1,334 / snowfall 145" / 86% overall with 99-82-79 by grade / 47 trails on 178 of 300 acres, all unchanged. |
