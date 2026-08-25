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

**Part A complete. Batch 2 complete.** Next unfinished unit: **Part B, Batch 3** —
research is DONE and recorded below; only the file-writing remains. Do not re-fetch.

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

## Batch 3 research — ALREADY GATHERED, do not re-fetch

Paused before writing the files. Everything below is verified; resume by writing the five
resort JSONs from it, then `npm run check`, render check, spot-check, commit.

**Reusable finding — NH night skiing.** Ski NH publishes the authoritative list at
`https://www.skinh.com/activities/night-skiing`. Areas listed: Cranmore, Crotched, Granite
Gorge, Gunstock, King Pine, McIntyre, Pats Peak. **Not** listed, so `nightSkiing: false` +
`absent` sourced to that URL: Cannon, Loon, Waterville Valley, Wildcat, Attitash, Mount
Sunapee, Ragged. This also settles batches 5 and 6 — Cranmore, Gunstock, Crotched and Pats
Peak are night-skiing resorts and get `true`.

**Cannon** (`cannonmt.com/mountain-stats`, JS-injects summit/vertical so those come from
OnTheSnow): summit 4,080 / base 1,900 / vertical 2,180 (longest in NH); 287 skiable acres
(OnTheSnow says 285); 98 trails and glades incl. Mittersill; 15/52/33 three-tier; 9 lifts
(1 detachable quad, 2 fixed quad, 3 triple, 1 double, T-bar, handle tow); longest run 2.3 mi;
snowfall 160" (resort) vs 143" (OnTheSnow); snowmaking 192 acres of 287 — no % published.
Exposure north/northeast. State-owned, in Franconia Notch State Park. **Indy Pass, 2 days,
no blackouts, Winter 26/27** — confirmed via `cannonmt.com/indy-pass` and indyskipass.com.

**Loon** (OnTheSnow; `loonmtn.com/mountain-info` 404s): vertical 2,100 / base 950 / summit
3,050; 403 acres; 73 trails; 14 lifts; longest 2.5 mi; snowfall 132"; snowmaking 322 ac;
26/47/26/1. Boyne property, **Ikon**. Parks (`loonmtn.com/parks`): five named — Progression
Parks (Little Sister trail), Little Sister Park, Springboard Park, Loon Mountain Park
(advanced, ~1,000 vertical ft), Lil' Stash (Burton-developed, family). Third-party sources
claim six parks and two halfpipes; the resort's own page names five and no pipe — use the
resort, record the pipe as `unpublished`. Moguls: Flume (one side kept ungroomed, under the
chair), Angel Street (black, marked with moguls on the trail map, by East Basin), Walking
Boss (long/wide off North Peak Express).

**Bretton Woods** (OnTheSnow only; every brettonwoods.com stats URL 404s): vertical 1,500 /
base 1,600 / summit 3,100; 470 acres; 100 trails; 9 lifts (1 gondola, 4 HS quads, 1 quad,
3 surface); longest 2 mi; snowfall 156"; snowmaking 344 ac; 25/40/25/10. Independent (Omni
Mount Washington Resort), own pass only. 35 glades. 3 terrain parks, one modest, beginner-
to-intermediate, boxes/rails/jumps/XS rollers. **CONFLICT to resolve: night skiing.** Ski NH
does not list Bretton Woods, but a third-party guide says 5 trails and 2 lifts open on
specific evenings. Record `nightSkiing: null` + `unpublished` noting the contradiction —
do NOT mark it `absent`.

**Waterville Valley** (`waterville.com/mountain-stats`, full primary block): Mount Tecumseh;
total acres 500, skiable 265; longest 1.9 mi; summit 4,004; vertical 2,020 (base = 1,984);
62 trails, 15/59/23/3; glades 5 named (Old T Trees, True Grit Trees, Sugar Shack Glades,
Psycho Glades, Furgal's Forest, Psyched Out); lifts 10 (1 HS 6-pack bubble, 1 HS quad,
2 triples, 2 doubles, 4 surface); snowmaking 265 acres / **100% coverage**. Parks: six —
Exhibition (Large), Boarder Cross Course (Large), High Country (Medium), Stillness (Medium),
Fun Run (Small), Pasture Mini (Small). **Indy Pass, 2 days, no blackouts.**

**Wildcat** (`skiwildcat.com/.../mountain-info.aspx`, full primary block): highest 4,062 /
base 1,950 / vertical 2,112; 225 acres; 5 lifts; 48 trails; snowfall "200+ inches";
20/47/33 three-tier. Vail property, **Epic**. Polecat is 2.75 mi, the longest novice trail
in NH. Wildcat Trail cut 1933, one of the first US ski racing trails. Gondola ran 1958-1999,
dismantled 2013. Faces Mount Washington and the Presidentials.

**Coordinates still to validate** (probe against published summits before writing):
Cannon ~44.1567,-71.6989 (4,080) · Loon ~44.0367,-71.6217 (3,050) · Bretton Woods
~44.2589,-71.4694 (3,100) · Waterville ~43.9739,-71.5461 (4,004) · Wildcat ~44.2622,-71.2050
(4,062).

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
