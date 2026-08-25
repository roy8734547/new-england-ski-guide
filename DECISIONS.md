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
