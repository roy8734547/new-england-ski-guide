# New England Ski Resort Guide

A static, public guide to New England ski areas from roughly 650 feet of vertical up.
Static facts and original editorial per resort, live weather in the browser, and snow
reports fetched from each resort's official report on a schedule.

**The data is the product.** Resort facts live in `data/resorts/<slug>.json`; the HTML and JS
only read and display them. Presentation code never hardcodes a resort fact. The contract
those files follow is `data/schema.md`.

---

## Requirements

- **Node 20 or newer** — used only for tooling. Nothing in `tools/` runs for visitors.
- No build step for the site itself. Vanilla HTML, CSS and ES modules.

```powershell
node --version    # must be >= 20
npm ci            # installs cheerio, needed by the HTML-parsing snow adapters
```

## Running the site locally (Windows)

```powershell
npm run dev
```

Then open <http://localhost:8137/>.

**Why a server and not just double-clicking `index.html`?** Browsers block both
`<script type="module">` and `fetch()` of local files under the `file://` protocol, so any
data-driven page fails when opened directly from disk. That is a browser rule, not a project
choice — the deployed site is still nothing but static files on a CDN. `tools/serve.mjs` is
about a hundred lines of Node standard library with no dependencies, and it refuses to serve
`private/` so local development matches production exactly.

To use a different port:

```powershell
node tools/serve.mjs 3000
```

## Working with resort data

After editing anything in `data/resorts/`:

```powershell
npm run check      # build:index then validate, in that order
```

Or individually:

```powershell
npm run build:index   # regenerates data/index.json from data/resorts/*.json
npm run validate      # schema + sanity checks; writes data/UNVERIFIED.md
```

`validate` exits non-zero on any error. Warnings do not fail it. Every field that is `null`
because it could not be sourced is listed in `data/UNVERIFIED.md` — that file is generated,
committed, and is the research worklist. **Never guess a number to clear a row.**

## Running the snow fetcher locally (Windows)

The fetcher is what produces `data/snow-reports.json`. In production it runs in GitHub
Actions; locally it is the only way to develop or debug an adapter.

```powershell
npm run fetch:snow                                  # every adapter, honouring the throttle
node tools/fetch-snow.mjs --list                    # adapters and the tier each uses
node tools/fetch-snow.mjs --slug killington         # one resort
node tools/fetch-snow.mjs --slug killington --force # ignore the 2-hour throttle
node tools/fetch-snow.mjs --dry-run                 # fetch and print, write nothing
```

Use PowerShell or Git Bash; both work. There are no shell-specific steps.

### The throttle will stop you, and that is deliberate

The project rule is **at most one request per host every two hours**. The fetcher enforces it
by reading the previous run's `fetchedAt` out of `data/snow-reports.json` — there is no
separate state file, which is why it also works in a fresh CI checkout. A second run inside
the window prints:

```
SKIP  killington       killington.com fetched recently; 116 min until next allowed
```

While developing an adapter, pass `--force`, and pair it with `--slug` so you are only
hitting the one host you are working on:

```powershell
node tools/fetch-snow.mjs --slug stowe --force --dry-run
```

Please do not sit in a `--force` loop against a live resort. The whole reason this project
identifies itself in the User-Agent is so somebody can complain to us rather than block us.

### The browser tier needs Playwright, which is optional

Adapters come in three tiers, tried in order: an official JSON endpoint, a static HTML parse
with cheerio, then a headless browser. Only the last needs Playwright, and it is **not** in
`devDependencies` — it is a ~300MB install for a small number of resorts. Without it those
adapters fail soft with a clear reason and the site falls back to linking the resort's own
report.

To work on a browser-tier adapter:

```powershell
npm install --save-dev playwright
npx playwright install chromium
```

CI installs it automatically, so leave it out of the lockfile unless you need it.

### Checking whether an adapter has gone stale

```powershell
node tools/report-broken-adapters.mjs --human
```

Adapters break whenever a resort redesigns their report page. `fetch-snow.mjs` keeps a
`consecutiveErrors` count per adapter inside `data/snow-reports.json`; a run that returns any
non-error status resets it. Once an adapter has failed three runs in a row, the scheduled
workflow opens a GitHub issue.

Note that an out-of-season `closed` is **not** an error and does not extend the streak. In
August a New England snow report legitimately has no numbers in it.

## The automated fetch

`.github/workflows/snow.yml` runs every two hours from November through April — the cron's
month field is `11,12,1,2,3,4`, so the workflow simply does not fire in summer. It:

1. installs dependencies and Chromium,
2. runs the fetcher,
3. commits `data/snow-reports.json` **only if it changed**,
4. opens or comments on a GitHub issue if any adapter has errored three runs running.

It can also be triggered by hand from the Actions tab (**Run workflow**), which accepts a
`force` checkbox and an optional single `slug`.

## Trail maps and the `private/` boundary

`private/` holds personal-use trail map downloads. It is gitignored, never committed, never
deployed, and never referenced from anything under `data/` or `assets/`. The public site
links out to each resort's own trail map URL via `links.trailMap`.

`tools/validate.mjs` fails the build if the string `private/` appears anywhere in a resort
file, and `tools/serve.mjs` returns 404 for any request under `/private/`.

## Layout

```
index.html          comparison table + card grid
resort.html         detail page, reads ?r=<slug>
conditions.html     every resort's forecast, ranked by 7-day snowfall
compare.html        side by side, 2-4 resorts
map.html            Leaflet map, pins coloured by pass
assets/css/site.css single stylesheet, CSS custom properties, light + dark
assets/js/          data.js, weather.js, util.js, render-*.js
data/schema.md      the data contract
data/resorts/       one JSON file per resort, the source of truth
tools/              build-index, validate, fetch-snow, adapters, serve
```

## Attribution

Weather data by [Open-Meteo.com](https://open-meteo.com/) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Note their free tier is
**non-commercial only** — adding advertising or subscriptions to this site would require a
paid plan.

Snow report figures are fetched from each resort's own official report, stored as numbers and
short condition labels only, and always displayed with an "as of" timestamp and a link back
to the source. No report prose is ever copied.
