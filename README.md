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

## Required before this repo goes public

**Set a real bot contact URL.** Every request the snow fetcher and the trail map
downloader make to a resort's server carries a User-Agent naming this project and
pointing at a contact page:

```
NewEnglandSkiGuideBot/0.1 (+https://your-site.example/about; static site, snow reports)
```

That URL is the entire basis on which automated fetching against somebody else's server is
defensible. It is how a resort's operations team identifies unfamiliar traffic, and how they
ask us to stop instead of silently blocking the IP. Out of the box it points at
`https://example.invalid/about`, which is **not a real host**, and every tool prints a warning
saying so.

1. **Locally** — copy `.env.example` to `.env` and set the value. `.env` is gitignored.

   ```powershell
   Copy-Item .env.example .env
   # then edit .env
   ```

   PowerShell does not read `.env` automatically, so for a one-off run:

   ```powershell
   $env:SKI_BOT_CONTACT_URL = "https://your-site.example/about"
   npm run fetch:snow
   ```

2. **In CI** — add a repository variable named `SKI_BOT_CONTACT_URL` under
   **Settings → Secrets and variables → Actions → Variables**. The workflow already reads it
   into the job environment. It is a variable rather than a secret: it is a public URL, and
   masking it in logs would make debugging harder for no benefit.

3. **Point it at a page that exists** and explains what the bot does. The site's `/about`
   page is the obvious target once it is built.

Check what the tools will send:

```powershell
node tools/report-broken-adapters.mjs --human
```

The first line is the exact User-Agent, with a warning underneath if it is still the
placeholder.

The single definition lives in `tools/bot-identity.mjs`; nothing else defines a User-Agent.

## Running it locally

### The short way: double-click `start-site.bat`

No terminal required. It starts the local server, waits until the port is genuinely accepting
connections, and opens <http://localhost:8137/> in your default browser.

**Leave the window it opens alone.** That window *is* the server — closing it stops the site.
The window says so itself, in a box, because it is the one thing about this that is not
obvious.

If Node is missing, or npm is missing, or the dependencies have never been installed, it says
which one and what to do about it instead of printing a stack trace.

To get it onto your Desktop, run `create-shortcut.bat` once. It creates a
**New England Ski Guide** shortcut pointing at `start-site.bat`, using the site's own favicon
as the icon. Running it again just overwrites the shortcut, so it is safe to repeat.

> `favicon.ico` is BMP-encoded rather than PNG-encoded specifically so Explorer will render it
> on that shortcut — Windows is unreliable about PNG-compressed 16x16 and 32x32 icon entries.
> See the note at the top of `tools/build-icons.mjs`.

### The terminal way

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

`tools/wait-for-server.mjs` is what `start-site.bat` uses to know when to open the browser. It
polls the port with a TCP connect rather than sleeping for a fixed few seconds, which is wrong
in both directions — too short on a cold start and the browser lands on a connection error, too
long on a warm one. It is usable on its own:

```powershell
node tools/wait-for-server.mjs http://localhost:8137/ --open --timeout 30
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
start-site.bat      double-click to run the site; no terminal needed
create-shortcut.bat run once to put start-site.bat on the Desktop
index.html          comparison table + card grid
resort.html         detail page, reads ?r=<slug>
conditions.html     every resort's forecast, ranked by 7-day snowfall
compare.html        side by side, 2-4 resorts
map.html            Leaflet map, pins coloured by pass
about.html          data sources, refresh cadence, attribution, contact
404.html            real not-found page; guesses at renamed resort slugs
favicon.ico         GENERATED from assets/favicon.svg
apple-touch-icon.png  GENERATED - iOS "Add to Home Screen"
site.webmanifest    name, theme colour, 192/512/maskable icons
assets/favicon.svg  the source of truth for every icon and the OG card
assets/css/site.css single stylesheet, CSS custom properties, light + dark
assets/js/          data.js, weather.js, util.js, seo.js, render-*.js
data/schema.md      the data contract
data/resorts/       one JSON file per resort, the source of truth
tools/              build-index, build-icons, build-seo, validate,
                    fetch-snow, adapters, serve, wait-for-server
```

`favicon.ico`, `apple-touch-icon.png`, `assets/icon-*.png` and `assets/og-card.png` are all
generated — never hand-edit them. `npm run build:icons` rewrites the set from
`assets/favicon.svg`; `node tools/build-icons.mjs --check` fails if any of them has drifted.

## Attribution

Weather data by [Open-Meteo.com](https://open-meteo.com/) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Note their free tier is
**non-commercial only** — adding advertising or subscriptions to this site would require a
paid plan.

Snow report figures are fetched from each resort's own official report, stored as numbers and
short condition labels only, and always displayed with an "as of" timestamp and a link back
to the source. No report prose is ever copied.
