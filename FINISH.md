# FINISH.md — the run-to-completion prompt

Where the project stands as of the last check, and one long prompt that takes it to done.

## Status

**Done:** 9 commits · schema + tooling · 8 of 45 resorts (killington, mad-river-glen,
wachusett, stowe, sugarbush, jay-peak, smugglers-notch, okemo) · site shell · weather ·
snow fetcher + 3 adapters · GitHub workflow · bot identity properly factored

**Remaining:** 37 resorts · reviews pass · schema tri-state fix · map + compare (stubs) ·
SEO/about/sitemap · GitHub remote + Netlify · seasonal work (trail maps, adapter expansion)

---

## The master prompt

Paste the whole thing into Claude Code. It answers the two open design questions, then runs
the remaining work in order with commit checkpoints.

```
Read PLAN.md, CLAUDE.md, data/schema.md and data/UNVERIFIED.md before starting. This is a
run-to-completion plan for the rest of the project. Work through it in order. Commit after
each numbered unit. Do not skip ahead, and do not batch multiple units into one commit.

Two rules that override everything below: never guess a number to clear an UNVERIFIED row,
and never copy prose from a resort site or a review site. If a unit would require breaking
either rule, stop and tell me instead.

═══════════════════════════════════════════════════════════════════
PART 0 — ANSWERS TO THE TWO QUESTIONS YOU RAISED
═══════════════════════════════════════════════════════════════════

You flagged two things after the Stowe batch. Here are the decisions; implement them in
Part 1 before adding any more resorts.

QUESTION 1: booleans can't distinguish "verified absent" from "unknown".
You're right, and it's now 8 for 8 on nightSkiing, so fix it before it's 45 for 45.

Decision: do NOT restructure every scalar into an object. Add one new optional top-level
key to the resort schema instead:

  "fieldNotes": {
    "size.nightSkiing":  { "status": "absent",      "source": "<url>", "verifiedOn": "<date>" },
    "terrain.glades":    { "status": "unpublished", "checkedOn": "<date>",
                           "note": "Glades exist but no acreage is published anywhere citable" },
    "pricing.windowTicketAdultHigh": { "status": "unpublished", "checkedOn": "<date>",
                           "note": "Dynamic pricing; no window rate published" }
  }

Three statuses, and the distinction is the whole point:
  - "absent"      — checked, and the resort genuinely does not have this. Requires a source.
                    The scalar field itself becomes false / 0, not null.
  - "unpublished" — the thing exists or may exist, but no citable source states it.
                    Scalar stays null. Requires checkedOn, source optional.
  - "seasonal"    — cannot be known outside the ski season. Scalar stays null.

Update tools/validate.mjs so a null (or false) field WITH a matching fieldNotes entry is
resolved, not unverified. Split UNVERIFIED.md into two tables: "Unknown — still needs
research" and "Confirmed unpublished — no further work possible". The second table is a
finished state, not a backlog.

Then backfill fieldNotes across the 8 existing resorts. nightSkiing is "absent" for all
eight with a source; the pricing nulls are "unpublished" with your dynamic-pricing note;
terrain.glades on Stowe/Okemo/Smuggs is "unpublished". Do not invent statuses for fields
you did not actually check — leave those genuinely unverified.

QUESTION 2: should editorial ever contradict a sourced number?
Yes. That is the premise of the site, not a violation of it. But formalize it so it's
structured data rather than a sentence you happened to write, and make it visible.

Add an optional top-level key:

  "dataDisputes": [
    { "field": "terrain.percentAdvanced",
      "resortClaim": 30,
      "independentClaim": 21,
      "independentSource": "<url>",
      "note": "Okemo's own figure is generous; independent breakdown is 33/38/21/9 and the
               ratings run soft by Vermont standards" }
  ]

The resort's own figure stays in the data field. The dispute is recorded alongside it.
Render these on resort.html as a small labelled callout near the terrain breakdown —
"the resort says X, independent sources say Y" — not buried in prose. Migrate the Okemo
note you already wrote into this structure.

═══════════════════════════════════════════════════════════════════
PART 1 — SCHEMA v2
═══════════════════════════════════════════════════════════════════

1. Update data/schema.md for fieldNotes and dataDisputes. Bump schemaVersion to 2.
2. Update validate.mjs: new resolution logic, the split UNVERIFIED.md, and a check that
   every "absent" entry has a source and every "unpublished" entry has a checkedOn.
3. Migrate the 8 existing resort files to schemaVersion 2 and backfill fieldNotes and the
   Okemo dataDispute.
4. Render dataDisputes on resort.html. fieldNotes with status "absent" should render as a
   definite statement ("No night skiing") rather than the field being omitted — that's the
   entire reason we're doing this.
5. Run validate + build:index. Report the before/after unverified count and how it splits
   between genuinely-unknown and confirmed-unpublished.

Commit. Then STOP and show me the new UNVERIFIED.md split before continuing.

═══════════════════════════════════════════════════════════════════
PART 2 — THE REMAINING 37 RESORTS
═══════════════════════════════════════════════════════════════════

Nine batches. One commit per batch. Run validate + build:index at the end of every batch
and open one detail page in the browser to confirm it renders before committing.

  Batch 2:  stratton, mount-snow, burke, pico
  Batch 3:  cannon, loon, bretton-woods, waterville-valley, wildcat
  Batch 4:  attitash, sunday-river, sugarloaf, saddleback
  Batch 5:  mount-sunapee, cranmore, ragged, gunstock, crotched
  Batch 6:  pats-peak, magic-mountain, bromley, bolton-valley
  Batch 7:  pleasant-mountain, berkshire-east, jiminy-peak, catamount
  Batch 8:  middlebury-snow-bowl, saskadena-six, black-mountain-nh, dartmouth-skiway
  Batch 9:  mt-abram, black-mountain-maine, camden-snow-bowl, big-rock
  Batch 10: butternut, bousquet, mohawk-mountain

Same standard as the first two batches: sourced numbers, nulls where unsourceable,
fieldNotes where you checked and found nothing, opinionated editorial naming real trails
and real lift bottlenecks, honest about ice and crowds.

Three things specific to what's coming:

PASS DATA IS THE HIGH-VALUE FIELD IN BATCHES 3, 5 AND 6. Cannon, Waterville Valley, Pats
Peak and Ragged moved to Indy for 2026-27 and most published guides are still wrong about
it. Verify each against the Indy Pass site itself, not a blog, and set verifiedOn.

BATCHES 8-10 ARE TIER C. Keep editorial to 2-3 tight paragraphs, but hold the identical
sourcing standard on every number. Short is fine; sloppy is not.

WATCH FOR DEAD OR DORMANT AREAS. Tenney Mountain and Big Moose have had uncertain
operating status. If you find an area in the batch list that isn't reliably operating for
2026-27, do not write it up as if it were — flag it to me and move on.

After each batch, report in two or three sentences: what the resorts' own sites did and
didn't publish, anything that surprised you, and anything that landed in the unknown table.
Do not write me an essay per batch.

STOP after Batch 4 and show me the index page with 21 resorts on it, so I can react to the
list view before you're 45 deep.

═══════════════════════════════════════════════════════════════════
PART 3 — THE REVIEWS PASS
═══════════════════════════════════════════════════════════════════

reviews[] is empty on every resort because you correctly refused to summarize reviews you
hadn't read. Do it now as its own unit, in three commits (Tier A, Tier B, Tier C).

For each resort, read 2-4 substantive sources and write an original one-to-three sentence
gist per source in your own words. Never paste their sentences. Record source name, URL,
and a rating with its scale where the source publishes one.

Prefer, in this order: Storm Skiing Journal, SKI Magazine and Powder resort writeups,
ZRankings, OnTheSnow user aggregate, NELSAP for history, AlpineZone and r/skiing threads
for the unvarnished local view. That last category is where the honest opinions about ice,
liftlines and grooming actually live — use it, but attribute it as forum consensus rather
than treating one comment as fact.

If a resort has no substantive coverage anywhere — likely for several Tier C areas —
leave reviews empty and add a fieldNotes entry with status "unpublished". Do not pad.

═══════════════════════════════════════════════════════════════════
PART 4 — THE TWO STUB PAGES
═══════════════════════════════════════════════════════════════════

compare.html and map.html are 14- and 15-line placeholders. Build them properly.

map.html: Leaflet with OpenStreetMap tiles, pins colored by pass affiliation, popup with
name, vertical, pass and a link to the detail page. Cluster or scale sensibly at 45 pins.
Leaflet from CDN is the one exception to the no-CDN rule; pin it to an exact version with
SRI. Attribute OSM properly.

compare.html: 2-4 resorts side by side, chosen from a picker, deep-linkable via
?r=stowe,jay-peak. Highlight the winning value in each row. Include the editorial fields,
not just the numbers — a comparison that only shows vertical drop is a spreadsheet.

Commit each page separately.

═══════════════════════════════════════════════════════════════════
PART 5 — MAKING IT A PUBLIC SITE
═══════════════════════════════════════════════════════════════════

1. about.html — what this site is, where the data comes from, how often snow reports
   refresh, that figures are fetched from official resort reports with attribution, and a
   contact address. This page is what SKI_BOT_CONTACT_URL should point at.
2. SEO: per-page title and meta description, Open Graph tags, JSON-LD SkiResort structured
   data on detail pages, sitemap.xml generated from data/index.json, robots.txt.
3. A real 404 page.
4. Accessibility pass: keyboard-navigable filters, visible focus states, AA contrast in
   both themes, the comparison table scrolling inside its own container on mobile.
5. Lighthouse or equivalent on index and one detail page. Report the numbers.

Commit each as its own unit.

═══════════════════════════════════════════════════════════════════
PART 6 — SHIP
═══════════════════════════════════════════════════════════════════

Check whether gh is installed and authenticated. If it is, ask me to confirm repo name and
visibility before creating anything. If it isn't, print the exact commands for me to run,
plus Netlify settings (no build command, publish directory = repo root) and where to set
SKI_BOT_CONTACT_URL as a repo secret so the scheduled workflow stops warning.

Do not push anything without asking me first.

═══════════════════════════════════════════════════════════════════
PART 7 — THE SEASONAL BACKLOG (write it down, do NOT do it now)
═══════════════════════════════════════════════════════════════════

It is August. Two units genuinely cannot be done well until the season opens. Write
SEASONAL.md capturing them, then stop:

  - Trail map downloader (tools/fetch-trailmaps.mjs is a placeholder). Maps get revised
    before each season, so run it in November against current maps.
  - Adapter expansion to the Vail and Boyne groups. Snow-report pages change markup when
    they go live; the three existing adapters were written against dormant summer pages and
    all three should be re-verified in early December, not just extended.

Include in SEASONAL.md: what to check on each existing adapter, the reminder that
sunday-river needs Playwright installed, and a note that the first real in-season fetch is
the only true test of the isReportUsable() branches.

═══════════════════════════════════════════════════════════════════

Start with Part 0 and Part 1. Stop where the plan tells you to stop.
```
