# New England Ski Resort Guide — Build Strategy

**Status:** proposal for review · **Target folder:** `D:\Ski resort website`
**Stack decision (yours):** static site, HTML/CSS/vanilla JS + JSON data · public-facing · live weather + real snow reports pulled from resort sites

---

## 1. The one architectural decision that matters

Everything else follows from this: **the site is a renderer, the data is the product.**

Resort facts live in JSON. HTML/JS only reads and displays them. You (or Claude Code) can add a resort, fix a vertical drop, or rewrite an overview by editing a data file — never by touching layout code.

Concretely, three data layers with very different refresh rates:

| Layer | File | Changes | Who writes it |
|---|---|---|---|
| **Static facts + editorial** | `data/resorts/<slug>.json` | once a season | human / Claude Code |
| **Snow reports** | `data/snow-reports.json` | every 1–3 hours in winter | automated fetcher |
| **Weather** | *not stored* | live | browser, at page load |

### Why one JSON file *per resort*, not one big `resorts.json`

This is the recommendation I'd push hardest on. With ~40 resorts and the depth of content you want (overview, snow quality, crowds, difficulty, key trails, tidbits, reviews), a single file lands around 6,000–10,000 lines. That is bad for three specific reasons:

1. **Claude Code edits get risky.** Editing one resort in a 9,000-line file means Claude has to load and re-emit huge context. Per-resort files mean a surgical, verifiable diff every time.
2. **Git diffs stay readable.** You can see exactly what changed at Stowe without scrolling past Sugarloaf.
3. **Parallel work.** Multiple resorts can be researched and written in separate batches without merge conflicts.

A tiny build step (`npm run build:index`) or a generated `data/index.json` manifest stitches them together for the list page, so the browser makes one request for the index and one for the detail page it needs — not 40.

---

## 2. Resort roster (~40, "Pats Peak class and up")

Your cutoff — roughly **650 ft vertical and up** — actually produces about 45 areas, not 30. I'd rather show you the full honest list and let you cut, than silently drop mountains.

**Tier A — destination resorts (20).** Build these first, deepest content.

> Killington · Pico · Stowe · Sugarbush · Mad River Glen · Jay Peak · Smugglers' Notch · Okemo · Stratton · Mount Snow · Burke (VT) · Cannon · Loon · Bretton Woods · Waterville Valley · Wildcat · Attitash (NH) · Sunday River · Sugarloaf · Saddleback (ME)

**Tier B — strong regional / day-trip mountains (14).**

> Bolton Valley · Bromley · Magic Mountain (VT) · Mount Sunapee · Cranmore · Ragged · Gunstock · Crotched · Pats Peak (NH) · Pleasant Mountain (ME) · Wachusett · Berkshire East · Jiminy Peak · Catamount (MA)

**Tier C — smaller but above your cutoff (11).**

> Middlebury Snow Bowl · Saskadena Six (VT) · Black Mountain · Dartmouth Skiway (NH) · Mt. Abram · Black Mountain of Maine · Camden Snow Bowl · Big Rock (ME) · Butternut · Bousquet (MA) · Mohawk Mountain (CT)

Excluded as below the line: Blue Hills, Nashoba, Ski Ward, Lost Valley, King Pine, Ski Sundown, Whaleback, McIntyre.

**Decision: all 45.** Tiers stay meaningful anyway — they set the **research order** (Tier A
first, so the site looks finished early) and the **content depth** (Tier A gets long
editorial, Tier C gets a tighter writeup). Same schema throughout, so nothing is rework.

---

## 3. Pass landscape (verified for 2026-27 — this is a selling point)

Pass affiliation is the single most-searched fact about a Northeast mountain, and **it changed significantly this year**. Getting it right and dated is where this site beats a stale blog post.

- **Epic (8 NE):** Stowe, Okemo, Mount Snow, Attitash, Wildcat, Crotched, Mount Sunapee (+ Hunter, NY)
- **Ikon (7 East):** Stratton & Sugarbush *unlimited*; Killington-Pico, Sunday River, Sugarloaf, Loon, Windham *7 days* (5 on Base). Bonus mountains: Cranmore, Butternut
- **Indy (~26 NE):** now includes **Cannon, Waterville Valley, Pats Peak, Ragged, Dartmouth Skiway, Black Mountain NH** (NH); Bolton Valley, Burke, Jay Peak, Magic, Middlebury, Saskadena Six (VT); Saddleback, Mt. Abram, Big Rock, Black Mtn of Maine, Camden (ME); Berkshire East, Bousquet (MA); Mohawk (CT). Indy Base $349 / Indy+ $399
- **Independent / own pass only:** Mad River Glen, Bromley, Gunstock, Bretton Woods, Wachusett, Jiminy Peak, Pleasant Mountain, Smugglers' Notch, Catamount

Every pass field in the data carries a `verifiedOn` date and a source URL. **No unsourced stat goes in the file.**

---

## 4. The hard part: real snow reports on a static site

You asked for actual reports pulled from resort websites, not links. Here is the honest engineering picture.

**The browser cannot do it.** A page served from your domain cannot `fetch()` killington.com — CORS blocks it, and resorts run bot protection. Any "just fetch it client-side" approach fails in production. So the fetch has to happen *somewhere else*, ahead of time.

**The design:** a Node script (`tools/fetch-snow.mjs`) with a small **adapter per resort** — each adapter knows how to get that mountain's numbers and returns one normalized object:

```
{ slug, newSnow24h, newSnow48h, newSnow7d, baseDepth, trailsOpen, trailsTotal,
  liftsOpen, liftsTotal, surface, lastUpdated, sourceUrl, fetchedAt, status }
```

Three source tiers, tried in order:

1. **JSON endpoints.** Several resorts (Vail/Alterra/Boyne properties especially) serve their own report page from a JSON API. Cleanest and most stable — always prefer this.
2. **Static HTML parse.** Cheerio + CSS selectors against the public snow-report page.
3. **Headless render.** Playwright for JS-only pages. Slowest; use sparingly.

**How it runs:** a GitHub Action on a cron (every 2h, Nov–Apr) executes the script and commits the updated `data/snow-reports.json`. The site just reads a static file — infinitely cacheable, zero server, zero cost, and it still works if the fetcher breaks.

**Failure is designed in, not an afterthought.** Adapters break every time a resort redesigns. So: per-resort `status` field, stale data shown greyed with "last updated 14h ago", automatic fallback to a prominent link to the official report, and the Action opens an issue when an adapter returns null 3 runs in a row.

**Legal posture for a public site.** Snow depths and trail counts are facts, not creative expression — reporting them with attribution and a link back is normal industry practice (OnTheSnow, SnoCountry, Storm Skiing all do it). The rules I'd hard-code into the project: identify the bot in the User-Agent with a contact URL, respect `robots.txt`, never hit a resort more than once every 2 hours, cache aggressively, never republish prose from the report, and always display "Source: [Resort] official report" as a link.

**Scope suggestion:** build 8–10 adapters first (the Vail and Alterra/Boyne properties share patterns, so those come nearly free), prove the pipeline end to end, then expand. Everything without an adapter degrades gracefully to a link.

---

## 5. Weather — the easy win

**Open-Meteo.** Free, no API key, no signup, CORS-enabled, commercial use allowed under attribution. Fetched live in the browser from the resort's summit lat/lon.

Gives you current temp, wind, and — the actually useful part — **hourly and 7-day snowfall forecast in inches**. A "who's getting the most snow this week" ranking across all 40 resorts, computed live in the browser, is a genuinely original feature no other New England site has. That, plus the pass data, is what would make this site worth visiting rather than bookmarking.

Backup if Open-Meteo ever rate-limits: NWS `api.weather.gov` (also free, no key, US-only).

---

## 6. Pages

| Page | What it is |
|---|---|
| `index.html` | Sortable/filterable comparison table + card grid. Filter by state, pass, vertical, acreage, night skiing. This is the workhorse. |
| `resort.html?r=<slug>` | Full detail: stats, overview, snow quality, crowds, difficulty breakdown, key trails, tidbits, live weather, snow report, reviews, links. |
| `conditions.html` | **All resorts' current conditions on one screen**, sortable by new snow. The page people bookmark and open every morning in January. |
| `compare.html` | Side-by-side, 2–4 resorts. |
| `map.html` | Leaflet + OpenStreetMap tiles, pins colored by pass. (Free, attribution required.) |

---

## 7. Reviews, done safely for a public site

Do **not** scrape or reprint TripAdvisor / Yelp / OnTheSnow review text — that is copyrighted expression and against their terms.

Instead, per resort:
- An **original editorial take** written for this site (that's the `overview`, `snowQuality`, `crowds`, `difficulty` fields — real opinions, in our own words)
- A **"what the reviewers say"** section: 2–4 sentences summarizing consensus *in our own words*, each with an outbound link to the source (Storm Skiing Journal, Ski Magazine, NELSAP, ZRankings, AlpineZone threads, Reddit r/skiing)
- Aggregate star ratings only where the source publishes them for reuse, always attributed with a link

---

## 7b. Trail maps — private local copies

You want the official trail maps for your own planning, not for publication. Those are two
different things and the project keeps them strictly separate:

- **The public site** links out to each resort's official trail map URL. Nothing is hosted,
  nothing is copied. That's `links.trailMap` in the schema.
- **A separate tool**, `tools/fetch-trailmaps.mjs`, downloads each resort's official trail
  map PDF/image into `private/trail-maps/<slug>.pdf` on your machine.

`private/` is in `.gitignore` from day one, so those files never reach GitHub, never reach
Netlify, and never get served to anyone. They're personal-use copies sitting on your D:
drive, which is exactly the same as saving the PDF from the resort's site by hand — just 45
times, automatically, and re-runnable each fall when the maps get updated.

The script also writes `private/trail-maps/manifest.json` recording the source URL and
download date for each, so you can tell when a map is from an old season. If you ever want
them viewable, a local-only `private/maps.html` gallery page is trivial to add — also
gitignored.

**Guardrail for Claude Code:** the trail map fetcher must never write into `data/` or
`assets/`, and no resort JSON field may ever point at a local trail map path. That
separation is what keeps the public site clean.

---

## 8. Phases

1. **Foundation** — repo skeleton, JSON schema, 3 sample resorts hand-built end to end, index + detail page rendering. *Proves the whole design on a small surface.*
2. **Site shell** — index + detail pages rendering from real data, so every later batch is immediately visible.
3. **Weather** — Open-Meteo module, detail page widget, snowfall-forecast ranking, `conditions.html`.
4. **Snow reports** — fetcher framework + ~10 adapters, GitHub Action on a cron.
5. **Data fill** — all 45 resorts in batches of 4–5, Tier A → B → C.
6. **Trail maps** — private downloader into gitignored `private/`.
7. **Polish & ship** — map, compare, SEO/sitemap, about page, Netlify deploy.

Phases 3–4 come before the bulk data fill on purpose: it means every resort you add lights
up with live weather and conditions immediately, and you find schema problems at 3 resorts
instead of 45.

---

## 9. Decisions locked

| | |
|---|---|
| **Roster** | All 45, researched Tier A → B → C |
| **Hosting** | GitHub + Netlify, GitHub Actions cron for the fetcher |
| **Snow reports** | ~10 adapters first (Killington, Stowe, Sunday River, then the Vail and Boyne groups), expand after |
| **Trail maps** | Downloaded to gitignored `private/` for personal use; public site links out only |
| **Photos** | None hosted — typographic, data-dense design |

Still open, but not blocking: whether you want a custom domain or `<name>.netlify.app` is
fine to start.
