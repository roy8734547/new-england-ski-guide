# Claude Code prompts — run these in order

Open a terminal in `D:\Ski resort website` and run `claude`. `CLAUDE.md` is already in the
folder, so Claude Code picks up the project rules automatically.

**Do not paste all of these at once.** Each is a phase. Run one, review the output, then move
on. The batching is deliberate — it is what keeps the data accurate and the diffs reviewable.

---

## Prompt 0 — kickoff (paste this first)

```
Read CLAUDE.md and PLAN.md in this folder. They define the project.

Set up the repository skeleton only — no resort content yet:

1. git init, and a .gitignore for node_modules, .DS_Store, .env, and private/
   (private/ holds personal-use files that must never be committed or deployed)
2. package.json (type: module, private) with scripts: build:index, validate, fetch:snow
3. The full folder layout described in CLAUDE.md, with empty-but-valid placeholder files
4. data/schema.md — the complete data contract for a resort JSON file. Design the schema
   yourself from the field list below, but justify any structural choice you make. Fields
   the site must support:

   identity: slug, name, aka, state, region, town, lat, lon, website
   size: verticalDrop, skiableAcres, trailCount, liftCount, longestRun, summitElevation,
         baseElevation, annualSnowfallAvg, snowmakingPercent, nightSkiing
   terrain: percentBeginner/Intermediate/Advanced/Expert, glades, moguls, terrainParks,
            difficultyNotes
   passes: array of {name, type: epic|ikon|indy|other|none, access, blackouts, verifiedOn,
           source}
   pricing: {windowTicketAdultHigh, windowTicketAdultLow, advanceTypical, seasonPassAdult,
             currency, notes, verifiedOn, source}
   editorial: overview, snowQuality, crowds, difficulty, keyTrails[], tidbits[], bestFor[],
              watchOutFor[]
   reviews: array of {source, url, gist, rating, ratingScale}
   links: officialSnowReport, trailMap, webcams, lodging, twitter/instagram
   meta: sources[], verifiedOn, lastEditedBy

   Every factual group carries source + verifiedOn. Fields that cannot be sourced are null.

5. tools/validate.mjs — validates every data/resorts/*.json against the schema, checks
   slug/filename match, flags null required fields into data/UNVERIFIED.md
6. tools/build-index.mjs — generates data/index.json from data/resorts/*.json

Then show me data/schema.md and wait. Do not create any resort files yet.
```

---

## Prompt 1 — prove the design on three resorts

```
Create data files for exactly three resorts: killington, wachusett, mad-river-glen.

I picked these deliberately — a huge Ikon destination, a mid-size independent day-trip
mountain, and a quirky no-pass co-op. If the schema handles all three cleanly it handles
everything.

For each: research the real numbers from the resort's own site first, then Ski Vermont /
Ski Massachusetts, then OnTheSnow. Record the source URL and today's date for every
factual group. Anything you cannot source, set to null — do not estimate.

The editorial fields must be genuinely opinionated and specific. "Killington has terrain
for everyone" is useless. "Superstar holds snow into June because Killington points its
entire snowmaking arsenal at it, which is also why the mountain is a zoo in April" is the
target. Mention actual named trails, actual lift bottlenecks, actual weekend crowd
patterns, actual ice.

Then run validate and build:index and show me killington.json in full.
```

---

## Prompt 2 — the site shell

```
Build index.html and resort.html plus their CSS and JS, rendering from the three resort
files that exist.

index.html: a card grid AND a sortable/filterable comparison table, toggled. Filters for
state, pass, night skiing, and minimum vertical. Sort by vertical, acreage, snowfall,
price. All client-side from data/index.json.

resort.html: reads ?r=<slug>, renders every section of the schema. Sections with null data
are omitted entirely, never shown empty. Include placeholders (not yet wired) for the live
weather widget and the snow report card.

Design: this is a public site about mountains in winter — it should look sharp and
confident, not like a Bootstrap template. Dark mode via prefers-color-scheme. Mobile first.
Single stylesheet using CSS custom properties. No CDN dependencies.

Open index.html and resort.html in a browser to check they actually render before telling
me you're done.
```

---

## Prompt 3 — weather

```
Add assets/js/weather.js using the Open-Meteo forecast API (no key required) against each
resort's lat/lon.

Show on resort.html: current temp, wind, conditions, and a 7-day forecast strip with daily
high/low and expected snowfall in inches.

Then build conditions.html: every resort in one table, sorted by forecast snowfall over the
next 7 days, so you can see at a glance who is about to get hit. Fetch in parallel with
Promise.allSettled, cache in sessionStorage for 30 minutes, and degrade gracefully to a
"weather unavailable" row if a request fails. Never let one failed resort break the page.

Attribute Open-Meteo in the footer per their license.
```

---

## Prompt 4 — the snow report pipeline

```
Build the snow report fetcher described in PLAN.md section 4.

tools/fetch-snow.mjs + tools/adapters/<slug>.mjs, writing data/snow-reports.json in the
normalized shape from the plan.

Start with adapters for exactly these three: killington, stowe, sunday-river. For each,
first investigate whether the resort's snow report page is backed by a JSON endpoint —
check the network requests — and use that if it exists. Only fall back to HTML parsing.
Tell me which tier each one ended up using.

Follow the fetcher rules in CLAUDE.md exactly: identifying User-Agent with contact URL,
robots.txt respected, 2-hour minimum between hits to a host, numbers only (never copy
report prose), fail soft with a status field.

Then wire the snow report card into resort.html and conditions.html: show the numbers with
a relative "as of" timestamp and a link to the official report. If a report is missing,
stale beyond 24h, or errored, show the link to the official report instead of stale
numbers.

Run the fetcher and show me the output before wiring the UI.
```

---

## Prompt 5 — automate it

```
Add .github/workflows/snow.yml: runs tools/fetch-snow.mjs on a cron every 2 hours from
November 1 through April 30, commits data/snow-reports.json only if it changed, and opens a
GitHub issue if any adapter returns an error status 3 consecutive runs.

Also add a manual workflow_dispatch trigger and a README section explaining how to run the
fetcher locally on Windows.
```

---

## Prompt 5.5 — housekeeping before the batches

Run this before any more feature work. It clears the three things flagged in the status
review: no git history, a placeholder bot User-Agent, and no GitHub remote.

```
Before any more feature work, three housekeeping items. Do them in order, and stop and tell
me if any of them can't be completed.

1. GIT HISTORY
Nothing in this repo has ever been committed — `git log` is empty and everything is
untracked. First confirm .gitignore is doing its job: run `git status --short` and verify
that nothing under private/ or node_modules/ appears. Then commit the existing work as a
short series of logical commits, NOT one giant "initial commit":
  - project docs, data schema, validator and index builder
  - the three resort data files
  - site shell (html + css + js)
  - weather module
  - snow fetcher and adapters
  - GitHub workflow and README
Show me `git log --oneline` afterwards and confirm `git status` is clean.

2. BOT USER-AGENT
tools/fetch-snow.mjs still identifies itself as
  NewEnglandSkiGuideBot/0.1 (+https://example.invalid/about; ...)
That placeholder is the single thing that makes automated fetching against real resort
servers defensible, so it needs to be real before this goes public.
  - Move the UA string to one exported constant in a single module; fetch-snow.mjs and
    report-broken-adapters.mjs both import it rather than each defining their own.
  - Read the contact URL from env var SKI_BOT_CONTACT_URL, falling back to the current
    example.invalid value with a console warning when unset.
  - Add it to .env.example, to the workflow env block, and to the README as a required
    step before the repo goes public.

3. GITHUB REMOTE
Check whether `gh` is installed and authenticated.
  - If yes: ask me to confirm repo name and public/private BEFORE creating anything.
  - If no: don't try to install it. Print the exact commands for me to run myself to
    create the repo and push, plus the Netlify setup (no build command, publish directory
    = repo root, and where to put SKI_BOT_CONTACT_URL as an env var).

Do not start the resort batches in this session.
```

---

## Prompt 6 — fill the roster

Run this **once per batch**, swapping the resort list each time. Batches of 4–5 keep the
research accurate; a batch of 20 produces confident-sounding fiction.

```
Add these resorts, following the exact process from the killington/wachusett/mad-river-glen
batch: <stowe, sugarbush, jay-peak, smugglers-notch, okemo>

Same rules: real sourced numbers, null where unsourceable, opinionated specific editorial,
named trails, honest about crowds and ice. Run validate and build:index at the end and
report anything that landed in UNVERIFIED.md.
```

Batch order — all 45 resorts, Tier A first so the site looks finished early:

**Tier A (deep editorial)**

1. stowe, sugarbush, jay-peak, smugglers-notch, okemo
2. stratton, mount-snow, burke, pico
3. cannon, loon, bretton-woods, waterville-valley, wildcat
4. attitash, sunday-river, sugarloaf, saddleback

**Tier B (full editorial, slightly tighter)**

5. mount-sunapee, cranmore, ragged, gunstock, crotched
6. pats-peak, magic-mountain, bromley, bolton-valley
7. pleasant-mountain, berkshire-east, jiminy-peak, catamount
   *(wachusett and mad-river-glen were already built in Prompt 1)*

**Tier C (concise writeups, same schema)**

8. middlebury-snow-bowl, saskadena-six, black-mountain-nh, dartmouth-skiway
9. mt-abram, black-mountain-maine, camden-snow-bowl, big-rock
10. butternut, bousquet, mohawk-mountain

For Tier C, add to the prompt: *"These are smaller areas — keep editorial to 2-3 tight
paragraphs each, but hold the same sourcing standard on every number."*

---

## Prompt 6b — trail maps (personal use, gitignored)

```
Build tools/fetch-trailmaps.mjs.

For each resort in data/resorts/, find the official trail map PDF or image on the resort's
own website and download it to private/trail-maps/<slug>.pdf (or the correct extension).
These are personal-use copies for my own trip planning — private/ is gitignored and must
never be committed, deployed, or linked from any public page.

Hard rules:
- Write ONLY into private/. Never touch data/ or assets/.
- No resort JSON field may point at a local file. The public site keeps linking to the
  resort's official trail map URL via links.trailMap.
- Also write private/trail-maps/manifest.json recording slug, source URL, file size, and
  download date, so I can tell when a map is from an old season.
- Rate limit: one request per host at a time, 2 second delay between downloads.
- Skip files already downloaded unless --force is passed.
- Report which resorts you could not find a map for.

Also add a local-only private/maps.html gallery that lists and opens the downloaded maps.
```

---

> **Seasonal note (added Aug 2026).** Prompts 7 and 6b are better done in **November or
> early December**, not now. Resort snow-report pages change markup when the season opens,
> so adapters written in August have to be tested twice; and trail maps get revised before
> each season. The resort data fill (Prompt 6) doesn't care what month it is — do that now.

---

## Prompt 7 — adapter expansion

```
Add snow report adapters for the Vail properties (stowe, okemo, mount-snow, attitash,
wildcat, crotched, mount-sunapee) — they share a common report backend, so build one shared
helper and thin per-resort adapters over it. Same for the Boyne properties (sunday-river,
sugarloaf, loon, pleasant-mountain).

Report which resorts still have no adapter and why.
```

---

## Prompt 8 — ship it

```
Final polish pass:

- map.html with Leaflet + OpenStreetMap tiles, pins colored by pass affiliation, popup with
  name/vertical/pass and a link to the detail page
- compare.html, 2-4 resorts side by side
- SEO: per-page <title>/<meta description>, Open Graph tags, JSON-LD SkiResort schema on
  detail pages, sitemap.xml, robots.txt
- An /about page stating the data sources, the update cadence, and that snow figures are
  fetched from official resort reports with attribution
- README with local dev instructions and Netlify deploy steps
- Run a full validate, list every remaining unverified field, and give me an honest
  assessment of what's weak or incomplete
```
