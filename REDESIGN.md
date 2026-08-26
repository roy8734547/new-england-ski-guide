# REDESIGN.md — Notion-style app shell

Reference: `design-reference/notion-clean.html` (in this repo).

## The prompt

```
Redesign the site's UI to the design language in design-reference/notion-clean.html. Read
that file first — the actual CSS, not just the screenshot impression. It's a Notion-style
app shell: fixed-height grid, left sidebar, breadcrumb top bar, toolbar with inline search
and filter chips, a dense bordered data table with a sticky header, and a status footer.

This is a visual and interaction redesign. Do NOT change data/, tools/, or the schema.
Same information, different shell.

═══════════════════════════════════════════════════════════════════
1. WHAT MAPS ONTO WHAT
═══════════════════════════════════════════════════════════════════

SIDEBAR (240px)
  Workspace   → All Resorts (45), Conditions, Map, Compare
  States      → Vermont, New Hampshire, Maine, Massachusetts, Connecticut, each with a
                count badge like the reference's "8"
  Passes      → Epic, Ikon, Indy, Independent, with counts
  Saved views → Biggest Vertical, Bump Mountains (moguls presence signature/common),
                Park Mountains (parks.count > 0), Night Skiing, Has Halfpipe
  Bottom      → About, and the data "last updated" stamp
  Clicking any sidebar item filters the table. These are real filters over
  data/index.json, not decoration.

TOP BAR      breadcrumbs (Guide / All Resorts, or Guide / Vermont), then actions:
             "Compare selected", "Export CSV", and a primary button.

TOOLBAR      inline search over resort name and town, filter chips (All / Epic / Ikon /
             Indy / Independent), and the sort label on the right.

TABLE        This is the payoff. The index comparison table becomes the primary view,
             styled exactly like the reference: 13px rows, 9px 12px cells, 1px
             --border-light column separators, sticky thead, tabular-nums on every
             numeric column, row hover and selected states.

             Columns: checkbox · Resort (with a mark like .tick-icon, using the state
             abbreviation) · Town/State · Vertical · Acres · Trails · Lifts · Snowfall ·
             Pass · 7-Day Snow.

CHECKBOXES   The reference's checkbox column is not decorative here — check 2-4 rows and
             "Compare selected" opens compare.html?r=a,b,c. That's the best interaction
             in the reference and it maps perfectly.

SPARKLINE    The reference's 7-day price sparkline becomes the 7-day SNOWFALL FORECAST,
             from the existing Open-Meteo data. This is the single strongest translation
             in the whole design — bars sized by inches, and it belongs on both
             index.html and conditions.html.

PILLS        The reference uses green/red gain/loss pills. Green/red is wrong for pass
             affiliation but right for snow: use the pill treatment for new snow and
             forecast totals (green, scaled by amount; neutral at zero). Give passes a
             separate flat tag style with one distinct hue each — Epic, Ikon, Indy,
             Independent — never green/red.

FOOTER       Status bar: resort count, average vertical, "most snow this week: <resort>
             <n>in", and the live indicator dot with the weather fetch timestamp. Same
             layout as the reference's P&L bar.

═══════════════════════════════════════════════════════════════════
2. FIVE THINGS THE REFERENCE GETS WRONG FOR THIS SITE
═══════════════════════════════════════════════════════════════════

Do not copy these verbatim. Each needs a deliberate decision.

a) THE APP SHELL IS WRONG FOR DETAIL PAGES.
   The reference is height:100vh with overflow:hidden — a fixed, non-scrolling shell.
   That's right for index.html, conditions.html, map.html and compare.html, which are
   data views. It is wrong for resort.html and about.html, which are long-form reading.
   Apply the shell to the four data views. Give resort.html the same sidebar and top bar
   but let the content column scroll as a document, with generous measure for the
   editorial prose. Do not force 45 resorts of overview, moguls, parks and reviews into
   a viewport-height pane.

b) IT IS LIGHT-MODE ONLY.
   This site supports dark via prefers-color-scheme and that stays. Derive a dark
   palette from the same token names — do not bolt on an unrelated dark theme, and do
   not drop dark mode. Every color must be defined on bare :root first, with the dark
   block only redefining tokens.

c) THE PALETTE FAILS ACCESSIBILITY IN PLACES.
   --text-tertiary #9B9B97 on white is roughly 2.8:1 — it fails AA for body text. The
   reference uses it for volume figures, footer text and column headers. You did a full
   accessibility pass in Part E; do not regress it. Darken the tertiary token until body
   text clears 4.5:1 and any 11px text clears it comfortably. Keep the visual hierarchy,
   fix the contrast. Re-run the contrast checks when done.

d) THERE IS NO MOBILE STORY.
   A fixed 240px sidebar and viewport-height grid do not survive a phone, and
   conditions.html on a phone in January is the actual use case. Below ~900px: collapse
   the sidebar to an off-canvas drawer behind a button, stack the toolbar, and let the
   table scroll horizontally inside its own container — the page body must never scroll
   sideways. Test at 375px, not just at desktop.

e) IT LOADS INTER FROM GOOGLE FONTS.
   CLAUDE.md forbids CDN dependencies apart from Leaflet, and Lighthouse performance is
   at 99 after real work. Do not add the Google Fonts link. Self-host a woff2 subset of
   Inter in assets/fonts/ with font-display:swap and a system-stack fallback, or use the
   system stack alone if the subset would cost more than it gains. State which you chose
   and why.

═══════════════════════════════════════════════════════════════════
3. NON-NEGOTIABLES
═══════════════════════════════════════════════════════════════════

- No framework, no build step, vanilla ES modules. Unchanged.
- Do not touch data/, tools/, or the schema. If a rendering need seems to require a data
  change, stop and tell me instead of changing the schema.
- Keep every existing feature: filters, sort, the data-dispute callouts, confirmed-absence
  rendering, weather, snow reports, fieldNotes display. This is a reskin plus the new
  sidebar and selection model, not a rewrite of behavior.
- Preserve the Part E work: JSON-LD, meta tags, sitemap, 404, focus states, reduced
  motion, heading order.
- Re-run Lighthouse on index and one detail page afterwards. Performance must stay ≥95
  and CLS ≤0.1 — that CLS number took real effort to get from 0.36 to 0.05. Report
  before/after.

═══════════════════════════════════════════════════════════════════
4. ORDER OF WORK
═══════════════════════════════════════════════════════════════════

1. Extract the design tokens into assets/css/site.css as custom properties, with the
   accessibility corrections from 2c and a matching dark set. Commit.
2. Build the shell — sidebar, top bar, toolbar, footer — as a shared partial, injected by
   a small JS module so it isn't duplicated across seven pages. Commit.
3. Restyle index.html's table to the reference, add the checkbox selection model and the
   snowfall sparkline. Commit.
4. Apply to conditions.html, map.html, compare.html. Commit each.
5. resort.html and about.html per 2a — shell plus scrolling document. Commit.
6. Responsive pass per 2d, then the accessibility and Lighthouse re-check. Commit.

Take a before screenshot of index.html and resort.html first so the diff is visible.
Work through all six steps without stopping to ask; log any judgement calls to
DECISIONS.md as usual.
```
