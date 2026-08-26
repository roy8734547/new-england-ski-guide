# DECISIONS.md — judgement calls made during the unattended run

Every non-obvious call, one line each, with the reasoning. Policy is AUTORUN.md section 2:
(1) never guess data — null plus a fieldNotes entry; (2) CLAUDE.md wins; (3) nothing outside
the repo; (4) reversible and in-repo, just decide; (5) prefer momentum over marginal polish.

| Date | Decision | Rule | Reasoning |
|---|---|---|---|
| 2026-08-24 | Schema v3 review stop shows Okemo, not Mount Snow | 4 | Mount Snow is a Batch 2 resort and did not exist when Part A ran. Okemo is the strongest park mountain among the first 8. |
| 2026-08-24 | `parks.pipe` is a flat boolean with `pipeType`/`pipeSpecs` beside it | 4 | `parks.pipe` must be a legal `fieldNotes` path so a dropped pipe records as `absent`; `parseFieldPath()` resolves `group.field` only. |
| 2026-08-24 | Killington `parks.pipe` recorded `unpublished`, not `false` | 1 | Third-party listings cite an 18-ft modified halfpipe; the resort's own parks pages list none. Absence of mention is not a source for absence. |
| 2026-08-24 | Mad River Glen and Smugglers' Notch `parks.count` = null, not 0 | 1 | Neither publishes a terrain park page; several likely URLs 404. A guessed 0 would be fiction even though it is probably right for MRG. |
| 2026-08-24 | `terrain.percentExpert` uses `unpublished`, never `absent` | 1 | `absent` requires the scalar to become 0, and 0% expert terrain is false at a three-tier resort. The category is missing, not the terrain. |
| 2026-08-26 | Spot-check failures do not stop the run | 2 | AUTORUN.md §3b explicitly overrides the "stop and ask" instruction in BATCHES.md step 6. Log to PROGRESS.md, fix, continue. |
| 2026-08-24 | `parks[]` shorter than `parks.count` is a warning, not an error | 4 | A resort advertising five parks and describing four is incomplete, not contradictory. `parks[]` exceeding count stays an error. |
| 2026-08-24 | Stratton `parks.count` = null despite third-party summaries saying five | 1 | Stratton's own parks page is JS-rendered and unreadable by fetch tool or curl; a count I could not read directly is a guess. |
| 2026-08-24 | Pico `longestRun` = null | 1 | Resort says Pike is "more than a mile"; OnTheSnow says 4 mi. Irreconcilable, so neither is stored. |
| 2026-08-24 | Indy blackouts recorded structurally, not as dates | 1 | Indy does not publish exact 2026-27 dates until autumn 2026. The Base/Indy+ distinction is the citable, durable fact. |
| 2026-08-25 | Waterville Valley `nightSkiing` = true, overriding the pre-gathered research | 2 | CLAUDE.md rule 3 puts the resort's own site above Ski NH. Waterville has a dedicated night skiing page naming the lit trails and lifts; Ski NH's list simply omits it. |
| 2026-08-25 | Bretton Woods `nightSkiing` = false + `absent`, not the planned null | 2 | The resort's own alpine page says outright that it does not offer night skiing. That is a primary source asserting the negative, which is exactly what `absent` requires; the planned `unpublished` was the right call only while no primary source existed. |
| 2026-08-25 | Ski NH's night skiing list demoted from authority to hint | 4 | It got Waterville wrong. Recorded in PROGRESS.md so batches 5 and 6 verify per-resort rather than inheriting a list that has now been shown to be incomplete. |
| 2026-08-25 | `snowmakingPercent` = null at Cannon, Loon and Bretton Woods despite acreage being published | 1 | All three publish snowmaking acres and total acres but no percentage. Dividing them yields a figure the resort never claims, and the rest of the roster quotes percentage of *trails*, so a derived acreage percentage would silently not be comparable. |
| 2026-08-25 | Bretton Woods `trailCount` = 63, not the widely-quoted 100 | 2 | The resort counts trails and glades separately (63 + 36-40); OnTheSnow's 100 is the sum. CLAUDE.md prefers the resort. Recorded as a `dataDispute` and explained in `difficultyNotes`, because it makes Bretton Woods look smaller in the comparison table than guides that combine them. |
| 2026-08-25 | Waterville's single flat $145 rate goes in both window fields, advance null | 4 | Follows the Wachusett precedent for an undistinguished published rate. A flat price table genuinely means the price never varies, and the window rate is the ceiling. |
| 2026-08-25 | Waterville ticket price recorded even though it is a 2025-26 rate | 5 | Same as Wachusett: the page says 2026-27 is "coming soon", so last season's figure is the newest thing that exists. `pricing.notes` says so plainly. |
| 2026-08-25 | Loon `passes[0].blackouts` = null rather than a plausible day count | 1 | Loon's Ikon allocation is not published on Alterra's shop page, Alterra's destination page, Loon's own Ikon page or OnTheSnow's guide. The one citable fact — that Ikon holders must reserve in advance — went into `access` instead. |
| 2026-08-25 | Epic price kept on the OnTheSnow source rather than waiting for epicpass.com | 5 | epicpass.com returned a site-down error all day. The aggregator's current-cost line is citable and the note records both that and why the operator was not used. Re-check in Part C. |
| 2026-08-25 | Resort coordinates anchored to the summit, not the base area | 4 | All twelve existing files probe within ~200 ft of their published summit, so the convention already existed; OSM's base-area nodes for Loon, Bretton Woods and Waterville were discarded in favour of the peak nodes to stay consistent for weather and map pins. |
| 2026-08-25 | Saddleback `baseElevation` = null, keeping summit 4,120 and vertical 2,000 | 1 | The resort and OnTheSnow both publish all three, but 4,120 − 2,460 = 1,660, not 2,000. The summit is probe-corroborated and the vertical is what every source advertises, so the base is the one dropped. Storing all three would be a validator error and storing a set that does not add up would be worse. |
| 2026-08-25 | Saddleback difficulty percentages derived from published trail counts | 4 | 23/20/18/7 of 68 runs, converted and rounded to sum to 100. Same treatment Pico already had, and `difficultyNotes` says the conversion happened. |
| 2026-08-25 | Sunday River `parks.count` = null despite PeakRankings counting five | 1 | Follows the Stratton precedent exactly: the resort names no park and publishes no count, and a count read only from a third party is not a sourced count. |
| 2026-08-25 | Saddleback `parks.count` = 2 with `parks[]` empty, accepting a validator warning | 4 | The resort publishes a count and no names. That is precisely the case the warning was designed for — incomplete, not contradictory — so the count is kept rather than discarded. |
| 2026-08-25 | Attitash `nightSkiing` = null rather than false | 1 | No source either way. attitash.com is JS-rendered, OnTheSnow's operating schedule for Attitash is empty, and Ski NH cannot support a negative. Every other resort in Batches 3-4 had at least one usable source; this one has none. |
| 2026-08-25 | Sugarloaf `snowmakingPercent` = 95 despite the different denominator | 4 | The resort states 95% of *groomed trails*, not of skiable acres. Stored because it is a published percentage rather than a derived one, with `difficultyNotes` flagging that the Snowfields and glades sit outside that denominator entirely. |
| 2026-08-25 | Attitash written almost entirely from OnTheSnow, and said so in the file | 5 | Vail's whole web estate was erroring on the day. BATCHES.md permits the OnTheSnow fallback after a curl retry with the bot UA, which was made and also failed. Flagged in PROGRESS.md as the weakest file on the roster rather than quietly shipped. |
| 2026-08-25 | Cranmore keeps the published 2,000 ft summit, with a `dataDispute` against it | 2 | CLAUDE.md prefers the resort's own site, so its figure is stored — but an OSM peak tag of 510 m and a terrain probe returning 1,644 ft both say it is roughly 350 ft too high, and a reader deserves to see that beside the number rather than instead of it. |
| 2026-08-25 | An elevation-API URL used as a `dataDispute` independentSource | 4 | The schema requires a counter-source URL and the terrain probe is the actual evidence. It is reproducible and the note explains what it is; citing nothing would have meant dropping the finding. |
| 2026-08-25 | Cranmore `seasonPassAdult` = null despite five published pass prices | 1 | Every product is a from-price with no age bands anywhere on the page. A from-price of unknown age band is not an adult rate, and picking one would be a guess dressed as a figure. |
| 2026-08-25 | Ragged `advanceTypical` = 89 recorded despite the range warning | 4 | Ragged is one of the few resorts publishing window and online prices side by side, and online genuinely undercuts the window low. The validator assumes advance sits inside the window range; here that assumption is simply wrong, and the data is worth more than a clean warning count. |
| 2026-08-25 | Mount Sunapee and Crotched `parks.count` = null | 1 | Same as Stratton and Sunday River. Vail's estate was unreachable all day, and PeakRankings describes Sunapee's park without counting it. Crotched has no independent review at all. |
| 2026-08-25 | Crotched `nightSkiing` = true sourced to Ski NH | 2 | Ski NH was demoted for *negatives* only. Its positive claims are specific and checkable — nights, hours, Midnight Madness dates — and OnTheSnow independently records 100 acres of lit terrain against 100 skiable. Using it here is consistent with the demotion, not a reversal of it. |
| 2026-08-25 | Cranmore gets three `passes[]` entries including `type: "none"` | 4 | It is on no mega-pass but does sell two genuine multi-mountain products. The validator allows `none` to coexist with `other`, which is exactly this case. |
| 2026-08-25 | Browser render check replaced with a server + module-parse check | 5 | No browser is drivable in this environment. `resort.html`, both new JSON files and every JS module return 200 from the dev server, all modules parse, and the one genuinely new data shape — `moguls.namedRuns: []` at Bretton Woods — was confirmed by reading `namedRunList()`, which returns null and renders "No bump runs recorded". |

## 2026-08-25 — session 2

- **Validator `advanceTypical` check narrowed to one-sided.** An online rate below the window
  rate is the normal commercial case, not an anomaly; four of five live warnings were correct
  data. Only an advance rate above `windowTicketAdultHigh` warns now. (User instruction.)
- **Bolton Valley snowfall: stored OnTheSnow's 202, not the resort's 312.** The 312 comes from
  the Indy partner directory (partner-supplied) and boltonvalley.com's own "over 300 inches" is
  season-to-date, not an average. No `dataDisputes` entry, because the stored value is not the
  resort's claim and the record has no shape for the reverse case; the gap is described in
  `editorial.snowQuality` instead.
- **Bolton Valley base elevation: 1,446 ft, rejecting Indy's 2,100 ft.** Indy's own page pairs
  2,100 with a 3,150 summit and a 1,704 vertical, which cannot all be true. 3,150 − 1,446 =
  1,704 exactly.
- **Bolton Valley `keyTrails` left empty.** The unit's instruction was explicitly not to
  re-fetch and no trail names were in the gathered research. One validator warning is the
  correct price for not inventing four trail names. Flagged for Part C.
- **Mount Sunapee `parks.count` = 4, not 2.** The resort's own page states both. Followed the
  Burke precedent — the statistics block over the prose — and documented the contradiction in
  `parks.overview` so the reader sees it.
- **Attitash `nightSkiing` = false**, sourced to the hours-of-operation page, whose published
  winter lift hours never run past 4:00pm. Previously null. An `absent` fieldNote needs a
  positive published statement; a schedule that ends at 4pm across the whole season is one.
- **Mount Sunapee `nightSkiing` stays null.** No night page in its sitemap, but its hours page
  currently shows summer hours only, so there is no published winter schedule to read a
  negative off. Absence from a sitemap is suggestive and is not a source.
- **Crotched `parks.nightPark` stays null.** OnTheSnow's 100 lit acres against 100 skiable
  acres would leave no room for an unlit park, but that is arithmetic on two aggregate figures,
  and AUTORUN.md section 2 rule 1 outranks the temptation.
- **Attitash snowfall: stored the resort's 120 over OnTheSnow's 88**, per CLAUDE.md rule 3,
  with the 88 in `dataDisputes`.

### Batch 7

- **Pleasant Mountain trail count 44, not OnTheSnow's 43.** The resort's own homepage counts
  "44 Trails and Glades" as one figure; OnTheSnow counts 43 runs. The resort is including its
  glades and the aggregator is not, so 44 is stored with the reason in `difficultyNotes`.
- **Pleasant Mountain terrain percentages all null.** No source publishes a difficulty split
  for this resort in any form. Rule 1 applies with no ambiguity.
- **Pleasant Mountain `parks.count` = 3 despite no published count.** The validator errors when
  `parks[]` is populated and `count` is null, so the count records the number of parks this guide
  could name from the resort's event pages. `parks.overview` says explicitly that this is the
  number found rather than a figure the resort publishes and that there may be more.
- **Berkshire East `liftCount` = 5, following OnTheSnow over the Indy directory's 6.** OnTheSnow's
  figure is internally consistent with its own lift-type breakdown; Indy's is a bare number.
- **Berkshire East `snowmakingPercent` = 100 from the resort over OnTheSnow's implied 92%.**
  CLAUDE.md rule 3 prefers the resort, the resort's claim is newer (a 2021 upgrade), and the two
  are not strictly comparable — one counts trails, the other acres. Not recorded as a dispute
  for that last reason.
- **Berkshire East `terrain.glades` = null.** The resort publishes no terrain information at all,
  so there is no statement either way. Same for Jiminy Peak, whose six-tier breakdown counts
  trails by difficulty and never mentions trees.
- **Jiminy Peak terrain percentages derived from published trail counts.** 17/6/7/6/6/3 of 45
  collapsed to 38/42/13/7. This is a faithful transformation of the resort's own numbers into the
  schema's grades, not an estimate, and the raw counts are preserved in `difficultyNotes` so the
  conversion is auditable. Distinguished from the Bolton snowmaking case, where dividing 90 acres
  by 300 would have combined two separately-reported figures.
- **Jiminy Peak `baseElevation` = null.** The resort gives a 2,380 ft summit and a 1,150 ft
  vertical rise and no base. Subtracting is arithmetic. Same treatment as Saddleback in reverse.
- **Jiminy Peak `seasonPassAdult` = 1356, the third rung of a four-step deadline ladder.** That is
  the price an adult buying on the verified date pays. The whole ladder is in `pricing.notes` so
  the number can be re-derived at any later date.
- **Catamount recorded as `MA`.** It straddles the NY/MA line; the validator's state enum is New
  England only, and the summit and part of the terrain are in South Egremont, Massachusetts. The
  split is stated plainly in `difficultyNotes` rather than hidden.
- **Catamount `parks.count` = 4 from four named park-carrying trails.** The resort enumerates
  Bobcat, Panther, Sunrise and Turnpike, so this is a published list rather than an estimate —
  but `parks.overview` notes it counts locations, which may not equal distinct designed parks.
- **Berkshire East and Catamount ticket fields all null.** Both run demand-based flexible pricing
  and publish no window rate at all. Estimating one would be fabrication.

### Batch 8

- **Black Mountain NH `trailCount` = 45, NOT the 61 in its own facts block.** This departs from
  the stat-block-over-prose rule that has held at Burke and Mount Sunapee. The reasons: the
  operator publishes 45 in two venues (its own prose and its owner's Indy listing) while 61
  appears once, and both this gap and the 140-vs-600 acreage gap look like glades being counted
  in or out. The file states all three counts and offers the glades explanation as a hypothesis.
- **Black Mountain NH terrain split from the Indy listing (33/34/33) over OnTheSnow's
  four-tier 29/32/24/15.** Indy Pass owns the mountain, so its listing is the operator speaking,
  and CLAUDE.md rule 3 prefers the operator.
- **Black Mountain NH `nightSkiing` = false (absent).** The resort publishes 9am-4pm hours seven
  days a week and Indy's structured field says No. The lit beginner area and the 1959-60 night
  lights on Whitney's hill are named in the note so a later reader does not mistake them for a
  night operation.
- **Two `parks.count: 0` entries with `absent` notes** — Middlebury Snow Bowl and Black Mountain
  NH. Bar applied: Indy's structured Terrain Parks field reading No, *plus* the resort's own site
  never mentioning a park anywhere. One line of evidence alone would have left it null.
- **Dartmouth Skiway `baseElevation` = 974 from OnTheSnow, rejecting the resort's 968.** The
  resort's own sentence gives 968 for both the base and the vertical against a 1,943 ft summit,
  which is arithmetically impossible; OnTheSnow's 974 reconciles to within a foot.
- **Dartmouth Skiway `advanceTypical` = 35**, the non-peak online adult rate. At a mountain whose
  main constituency is a college, the weekday rate is the typical one. All four rates are in
  `pricing.notes` so the choice is auditable.
- **Dartmouth Skiway's third tier stored in `percentAdvanced` though the resort calls it
  expert.** The schema fills grades in order and cannot record a third tier as a fourth. The
  resort's own wording is preserved in `difficultyNotes` and the fieldNote.
- **Saskadena Six `liftCount` = 3, not the resort's 2.** OnTheSnow and Indy both say 3 and
  OnTheSnow's breakdown (quad, double, surface) is internally consistent; the resort is counting
  chairlifts only.
- **Saskadena Six `seasonPassAdult` = 726.1, tax-inclusive.** The resort states that its pass
  prices include 6% Vermont state tax. Stored as published and flagged in `pricing.notes`,
  because every other season pass figure on this roster is pre-tax and a naive comparison
  overstates Saskadena Six by about 6%.
- **Middlebury `moguls.presence` = common** on structural grounds: snowmaking reaches six of 28
  trails, so most of the mountain cannot be groomed to a manufactured standard.
- **Middlebury snowfall 150 (resort) over Indy's 200**, recorded as a dispute. Unusual direction
  — the resort claims less — which is why it is worth a dispute record rather than a note.

### Batch 9

- **No OnTheSnow figure used for `black-mountain-maine`.** Its OnTheSnow record carries Black
  Mountain NH's elevation triple verbatim. See INTEGRITY FAILURE 4 in PROGRESS.md.
- **`black-mountain-maine.nightSkiing` = true, against Indy's structured No.** The resort's own
  about page says "top to bottom night skiing" and its hours page schedules selected Wednesdays
  5-9pm. A resort's own statement outranks a partner directory's checkbox.
- **`mt-abram` stores the resort's 1,150 ft vertical AND Indy's 2,000 ft summit, base null.**
  The three published triples are mutually inconsistent; a terrain probe of the summit lift top
  (~1,975 ft) supports Indy's summit over OnTheSnow's 2,250 ft. Nulling the base avoids storing
  an arithmetic contradiction while keeping two sourced values instead of one.
- **`camden-snow-bowl` stores no elevations at all.** Three verticals and two irreconcilable
  summit-base pairs; the terrain probe falls between them and settles nothing. Both null.
- **`camden-snow-bowl.seasonPassAdult` = 531**, the 2026-27 general-public early-bird rate. As
  at Middlebury, that is a published forward price - the sale opens 1 September - and the whole
  ladder including the Camden-resident rates is in `pricing.notes`.
- **`big-rock` trail count 25 and lift count 4 from the resort's live trail report**, over
  Indy's 29 and its blurb's 26. An enumerated list beats an aggregate number.
- **`big-rock` window ticket high and low both 60.** The store lists exactly one adult day
  product. A February-break notice implies a cheaper midweek rate exists but none is published,
  and `pricing.notes` says the low figure is provisional rather than inventing one.
- **`big-rock.snowmakingPercent` = null despite Indy's "80 snowmaking".** The figure carries no
  unit; on 90 skiable acres, 80% and 80 acres are very different claims.
- **`mt-abram` and `black-mountain-maine` `parks.count` = 0 (absent)**, same two-line bar as
  Batch 8. `big-rock` and `camden-snow-bowl` keep parks that exist but are undescribed.

### Batch 10

- **`butternut.liftCount` = 10, which includes a tubing carpet.** That is the resort's own list
  (5 quads, 4 learning carpets, 1 tubing carpet) and OnTheSnow agrees on the total. Noted in
  `difficultyNotes` so the composition is visible rather than implied.
- **`butternut` window ticket fields null, `advanceTypical` = 90.** Butternut publishes online
  rates only and states the window costs $5 more without listing those prices. Ninety is the
  non-holiday weekend online adult rate - the common case for a weekend-driven day area.
- **`bousquet` stores OnTheSnow's four-tier 9/26/22/43 over Indy's three-tier 17/26/57**, the
  same call made at Saskadena Six. Both are implausible for a 750-ft family hill and
  `difficultyNotes` says so outright rather than presenting either as a description of the
  mountain.
- **`mohawk-mountain.snowmakingPercent` = null.** The mountain that invented snowmaking
  publishes no coverage figure, and OnTheSnow's 100-of-107-acres would be derived arithmetic.
- **`mohawk-mountain.seasonPassAdult` = 750**, the middle rung of a three-step ladder and the
  price live on the verified date. Whole ladder in `pricing.notes`.

### Part C — superlative sweep

- **Corrected 31 false roster-relative claims rather than deleting them.** Each was rewritten to
  a statement that is true against the finished 45 - usually by narrowing the comparison set
  ("cheapest in New Hampshire", "second-largest by acreage") rather than by dropping the point,
  because the comparisons are genuinely useful to a reader and only the absolutes were wrong.
- **Kept six superlatives that check out**: Burke's 8% beginner share, Pico's 2,000 ft base,
  Bousquet's 21-inch snowfall, Butternut's $399 pass, Dartmouth's $35 ticket, Pats Peak's 50%
  beginner share.

### Part E — public site

- **No domain is hardcoded anywhere in the repo.** `<link rel="canonical">` and `og:url` are
  written in the browser from `location` (`assets/js/seo.js`), which is the one place the
  real host is guaranteed correct. Only `sitemap.xml` and `robots.txt` genuinely require an
  absolute URL, so `tools/build-seo.mjs` takes it as `SITE_URL`/`--site` and **exits rather
  than guessing**. Both files are gitignored; a sitemap committed with a placeholder domain
  would be deployed and submitted before anyone read it.
- **Netlify gets a one-line build command** (`node tools/build-seo.mjs --site $URL`) despite
  CLAUDE.md's no-build-step rule. The rule is about the site: every page still works with
  neither file present, nothing a browser loads is generated, and Netlify's `$URL` is the only
  place the correct host exists without a human typing it. Recorded here because it is the one
  deliberate brush against that constraint in the whole run.
- **`resort.html` with no or an unknown `?r=` is `noindex` via a meta tag, not robots.txt.**
  Expressing it in robots.txt needs the `$` anchor, which only some crawlers implement, and a
  crawler reading `/resort.html$` as a plain prefix would drop all 45 detail pages.
- **`compare.html?r=…` is disallowed in robots.txt.** It is deep-linkable by design, which is
  ~160,000 URLs of 2-to-4 combinations assembled from pages already indexed individually. The
  bare page stays crawlable because robots.txt prefix matching leaves it alone.
- ~~**No `og:image`.**~~ **Reversed 2026-08-25.** The original reasoning was that a card would be
  the only raster asset in the repo. Completing the favicon set made that false — there are now
  six generated PNGs — so the objection evaporated and the card was added. It still carries no
  photography: it is the site mark and two lines of type, generated from `assets/favicon.svg`
  by the same tool as the icons. `twitter:card` moved from `summary` to `summary_large_image`.
- **`og:image` ships as a relative path and is absolutised at runtime.** Facebook and Twitter
  both resolve a relative `og:image` against the page URL, so the static tag works for the two
  that matter; `seo.js` rewrites it to an absolute URL as well, for the smaller scrapers that
  enforce the specification. Neither approach requires a domain in the repo.
- **Sitemap `priority` is uniform at 0.8 across all 45 resorts.** Varying it by size or
  popularity would be a ranking claim dressed up as metadata, and this guide does not make one.
- **The contact line on `about.html` ships as a visible placeholder.** Publishing an email
  address is the owner's call (policy rule 3); logged as HANDOFF item 5.

### Redesign — Notion-style app shell

- **System font stack, not a self-hosted Inter subset.** REDESIGN.md 2e offered either. The
  reference's Inter comes from Google Fonts, which CLAUDE.md forbids, and a self-hosted woff2
  subset costs a request plus a FOUT on a site whose Lighthouse performance is 99 and whose CLS
  took real work to reach 0.05. There is also no subsetting tool on this machine, so the
  alternative was committing a full-weight face. On Windows the stack resolves to Segoe UI and
  on macOS to SF Pro, both in the same grotesque family as Inter. The density, the hairline
  rules and the tabular figures carry this design; the typeface is not what makes it read as
  Notion.
- **The whole ink ramp was shifted darker, not just `--text-tertiary`.** The reference's
  tertiary is 2.79:1 on white. Darkening it alone to clear 4.5:1 lands it on top of the
  reference's `--text-secondary` (#6B6B68) and collapses the three-step hierarchy, so secondary
  moved with it. Measured worst cases are now secondary 6.95:1 and tertiary 4.54:1, both on
  `--bg-selected`, the darkest surface either sits on.
- **`--text-placeholder` was darkened too** (1.99:1 to 4.77:1). WCAG does not exempt placeholder
  text, and a placeholder is text somebody has to read to know what a field does.
- **The reference's red is 4.27:1 on its own tint** — just under AA. Darkened to #b3302e (5.31).
  Its green passes at 5.05 and was kept, then darkened slightly anyway for headroom at 11px.
- **The brand blue stays `--accent`, replacing the reference's `--blue`.** #0e5b9e is in the
  favicon, the manifest `theme_color`, the `<meta name="theme-color">` and the OG card. Adopting
  the reference's #2E6FD0 would have desynchronised all of those to match a reference file.
- **Legacy token names are kept as aliases** (`--text` → `--text-primary`, `--text-muted` →
  `--text-secondary`, `--text-faint` → `--text-tertiary`) rather than renamed across 1,600 lines
  of CSS in the first commit. They resolve through `var()`, so the dark block redefining the new
  names flows through to the old ones automatically. This is one palette with two sets of names,
  not two palettes.
