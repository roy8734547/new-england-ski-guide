# Seasonal backlog

Work that genuinely cannot be done well in the off-season. This file exists so that
"we did it in August with the lifts stopped" is recorded rather than forgotten.

Created 2026-08-24.

---

## In early December — re-verify the snow report adapters

All three existing adapters were written against **dormant summer pages**. Snow-report
markup routinely changes when a resort switches its site into winter mode, so treat all
three as unverified until they have run against a live report.

| Adapter | Tier | What to check |
|---|---|---|
| `killington` | html | The `.dor-bar-row` / `.dor-bar-label` / `.dor-bar-count` selectors. In summer these read "Open Bike Trails" and "Open Hiking Trails"; the adapter matches on the label so it should pick up "Open Trails" and "Open Lifts" automatically, but that path has never actually executed. Also check whether the `.dor-wx-pill` snow-depth pills appear at all in winter — they were absent in August, so `baseDepth` and the new-snow fields have never been parsed successfully. |
| `stowe` | json | The `window.digitalData` blob. Every field under `attributes.weather` was `null` in August. Confirm `precipitation.{total24hr,total48hr,total7d,seasonTotal,midMtnDepth}` and `terrain.{runsOpen,liftsOpen,acresOpen}` populate, and that Vail has not moved the blob. |
| `sunday-river` | browser | **Needs Playwright installed** — `npm i -D playwright && npx playwright install chromium`. It is not in `devDependencies` on purpose. Until it is installed the adapter fails soft and CI has been filing this as a three-run error streak. Also re-check whether Boyne has started publishing Sunday River to `mtnpowder.com`: the resort *is* listed there but with no `SnowReport` object. If that changes, this drops from tier 3 to a two-line tier-1 fetch of `https://mtnpowder.com/feed?resortId=<id>` and the Playwright dependency goes away. |

**The first real in-season fetch is the only true test of `isReportUsable()`.** Its three
branches — fresh-and-usable, stale beyond 24 hours, errored — have only ever been exercised
against synthetic data injected by hand. Watch the first live run and confirm the detail
page and conditions table both behave.

## In January — re-verify every `moguls.namedRuns` list

Added with schema v3 on 2026-08-24. **Every named bump run currently on the site is
provisional.**

The objective source for which trails bump up is the resort's **daily grooming report** — it
publishes what was groomed last night, and the ungroomed trails are where bumps form. Every
grooming report in New England is dormant in August, so `namedRuns` was sourced from trail
descriptions and skier consensus instead. That is the third-best source, and it tends to
record which trails were *famous* for bumps rather than which ones bump up *this season*.

For each resort, pull the grooming report on several days across January and February and:

- confirm the named runs are actually being left ungroomed;
- correct each `reliability` value — `reliable` versus `variable` is exactly the distinction
  a grooming report settles and skier folklore does not;
- add runs that show up consistently ungroomed and are missing from the list;
- remove runs the mountain now grooms.

Two specific things to check, both flagged during the v3 research:

- **Stowe's Liftline** is recorded as `variable` because it carries snowmaking and has been
  widened enough to groom. Whether it is a bump run in practice is a resort decision, and the
  grooming report is the only way to know.
- **Okemo** is recorded as `presence: "rare"` with two named runs, on skier consensus that it
  grooms everything nightly. If the grooming report shows more than Sel's Choice and Upper
  Nor'easter left natural, the presence value needs raising.

Update `verifiedOn` on the `moguls` group when this is done.

## In November — download the trail maps

`tools/fetch-trailmaps.mjs` is still a placeholder. Maps get revised before each season, so
running it now would archive last season's. Run it in November against the current maps.

Reminder of the boundary it has to keep: it writes **only** into `private/`, which is
gitignored and undeployed, and no resort JSON field may ever point at a file it produces.
The public site keeps linking to each resort's own `links.trailMap` URL.

## Also worth doing once the season opens

- **Expand the adapters to the Vail and Boyne groups** (`FINISH.md` Part 7). Both groups
  share a report backend, so one shared helper plus thin per-resort adapters covers Stowe,
  Okemo, Mount Snow, Attitash, Wildcat, Crotched and Mount Sunapee on the Vail side, and
  Sunday River, Sugarloaf, Loon and Pleasant Mountain on the Boyne side. Write these against
  live winter markup, not summer markup.
- **Re-check `parks` feature counts.** Parks are marketed in autumn and built in December;
  the counts recorded in August are what the resort *planned*. Forum consensus in January is
  the only way to know whether the published feature list matches what is on the hill.
- **`pricing.advanceTypical`** is null almost everywhere because Vail and Alterra publish no
  window rate out of season. Real advance prices become observable on the booking pages once
  the season is on sale.
