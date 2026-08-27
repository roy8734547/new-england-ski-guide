# HANDOFF.md — everything that needs you, not me

Each item was declined under AUTORUN.md policy rule 3: anything touching accounts, money,
publishing, third-party services, or large binary installs is prepared here and left for you
to run.

**Items 1 and 5 are now done** — the site is live at
<https://new-england-ski-guide.netlify.app> and both were completed against that address.
Items 2 and 3 were evidently done by you (the `origin` remote exists and the site is
deployed); their instructions are left in place as a record. Item 4, Playwright, is still
open — the `sunday-river` adapter fails soft without it.

---

## 1. ~~Set the bot contact URL~~ — DONE

The contact URL is `https://new-england-ski-guide.netlify.app/about`. It is the value in
`.env.example`, and it is a literal default in the workflow's `env:` block, so a scheduled
run cannot advertise a host that does not exist. `tools/bot-identity.mjs` now loads `.env`
itself, so copying `.env.example` to `.env` is all a local run needs — the repository
variable below is only needed to point a deployment somewhere else.

<details><summary>Original item</summary>


Every request the snow fetcher makes to a resort's server carries a User-Agent naming this
project and pointing at a contact page. It currently points at `https://example.invalid/about`,
which is not a real host, and every tool prints a warning saying so.

`about.html` is written to be that page once the site is live.

**Locally:**
```powershell
Copy-Item .env.example .env
# then edit .env and set SKI_BOT_CONTACT_URL
```

**In GitHub Actions** — Settings > Secrets and variables > Actions > **Variables** (not a
secret; it is a public URL and masking it only makes debugging harder):
```
Name:  SKI_BOT_CONTACT_URL
Value: https://<your-domain>/about.html
```

Verify with:
```powershell
node tools/report-broken-adapters.mjs --human
```
The first line prints the exact User-Agent that will be sent.

</details>

---

## 2. Create the GitHub repo and push

Not done: AUTORUN.md forbids creating repos, adding remotes, pushing or deploying.
`gh` is not installed on this machine.

The local repository is committed and clean on branch `main`.

```powershell
# 1. Create an EMPTY repo at https://github.com/new
#    Name: new-england-ski-guide
#    Do NOT add a README, .gitignore or licence - this repo already has full history.

# 2. From D:\Ski resort website
git remote add origin https://github.com/YOUR-USERNAME/new-england-ski-guide.git
git push -u origin main
```

With `gh` instead (`winget install --id GitHub.cli`, then `gh auth login`):
```powershell
gh repo create new-england-ski-guide --public  --source=. --remote=origin --push
gh repo create new-england-ski-guide --private --source=. --remote=origin --push
```

---

## 3. Netlify

```
Add new site > Import an existing project > GitHub > new-england-ski-guide
  Branch to deploy:   main
  Build command:      node tools/build-seo.mjs --site $URL
  Publish directory:  .          <- repo root
```

**That build command is not a build step for the site** — every page works without
it, and nothing it produces is loaded by a browser. It writes exactly two files
crawlers ask for, `sitemap.xml` and `robots.txt`, both of which need the real
domain and neither of which is in the repo for that reason (they are gitignored).
Netlify sets `$URL` to the site's primary address at deploy time, so this is the
one place the correct host is known without anybody typing it.

If you would rather keep the build command empty, run it yourself before pushing
and un-ignore the two files:

```powershell
$env:SITE_URL = "https://your-domain"
npm run build:seo
# then remove /sitemap.xml and /robots.txt from .gitignore and commit them
```

Either way, **do not** commit them with a placeholder domain. A sitemap pointing
at a host you do not own gets deployed and submitted to a search engine before
anyone reads it, which is why `build-seo.mjs` exits rather than guessing.

Everything else is static files. `SKI_BOT_CONTACT_URL` does **nothing** on
Netlify — with no build command Netlify executes no code, and the fetcher runs in GitHub
Actions. Set it there, not here.

Note the scheduled workflow commits `data/snow-reports.json` to `main` every two hours in
season, so Netlify will redeploy on that cadence from November to April. That is intended.

---

## 4. Playwright, if you want the browser-tier adapter to work

Not installed: ~300MB, and AUTORUN.md policy rule 3 covers large binary installs. The
`sunday-river` adapter fails soft without it and the site falls back to the resort's own
report link.

```powershell
npm install --save-dev playwright
npx playwright install chromium
```

CI installs it automatically via `.github/workflows/snow.yml`; this is only needed for local
adapter development.

---

## 5. ~~Put a real contact address on about.html~~ — DONE

`about.html` now publishes an address in the Corrections section, alongside a paragraph
naming `NewEnglandSkiGuideBot`, stating that it honours `robots.txt` and contacts no host
more than once every two hours, and inviting anyone at a resort to write about that traffic.
The amber placeholder styling is gone; the box keeps the accent border because the bot's
User-Agent points every resort's server at that line.

<details><summary>Original item</summary>


`about.html` now exists and is the page `SKI_BOT_CONTACT_URL` should point at (item 1).
Its **Corrections** section deliberately ships with a placeholder rather than an address,
because choosing what address to publish is yours to make — a personal email address on a
public page is not a decision this run gets to take for you.

Find this block in `about.html` and replace the whole `<span>`:

```html
<span class="contact-placeholder" data-contact-placeholder>
  not yet set — this line must be replaced …
</span>
```

with whichever you prefer:

```html
<a href="mailto:you@your-domain">you@your-domain</a>
```
```html
<a href="https://github.com/YOUR-USERNAME/new-england-ski-guide/issues">
  the issue tracker on GitHub</a>
```

It renders in a bordered amber box until you do, so it is not something you can miss on a
live page. Nothing else on the site depends on it, but the fetcher's User-Agent points every
resort's server at this page, and a contact page with no contact on it defeats the point of
identifying the bot at all.

</details>
