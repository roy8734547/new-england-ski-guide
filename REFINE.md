# REFINE.md — two layout fixes and the editorial emphasis pass

## The prompt

```
Three pieces of work. Do them in the order given and commit each separately. Parts 1 and 2
are quick layout fixes; Part 3 is the large one.

═══════════════════════════════════════════════════════════════
PART 1 — MAP.HTML: SPLIT LEFT/RIGHT INSTEAD OF STACKED
═══════════════════════════════════════════════════════════════

map.html currently stacks a short, wide map pane above the "Every mountain on the map" link
list. That is the wrong aspect ratio for the subject. New England is tall and narrow —
roughly 300 miles wide by 450+ tall counting northern Maine — so fitting 45 pins into a
~1900x400 pane forces a zoom level where Chicago and Newfoundland are on screen and the
resorts are an unreadable cluster in the middle. Load the page and you can see it happening.

Restructure into two columns:

  >=1100px: map on the LEFT at about 62% of the content area, the mountain list on the
  RIGHT. Both fill the full height of the content pane. The map does not scroll; the list
  scrolls independently. The portrait pane matches the geography and fitBounds should now
  settle around z7 instead of z5 — verify that and report the before/after zoom level.

  <1100px: keep the current stacked layout, map on top at a sensible fixed height.

The right column IS the existing "Every mountain on the map" block. Do not build a second
list. Keep it grouped by state, keep every entry a real <a href>, keep it fully keyboard-
and screen-reader usable. That fallback carries real weight now that the sidebar is
JS-injected — it must not degrade into decoration.

Now that the list sits beside the map, add: hovering a name highlights its pin; clicking
"Show on map" pans and zooms to it without navigating. Keep the href as the fallback for
no-JS and middle-click.

Also: the map's pass legend shows "Reciprocal (33)", a category absent from the sidebar's
PASSES section (Epic 7, Ikon 8, Indy 21, Independent 7). Determine whether that is a real
fifth category or a legend bug, make the two agree, and tell me which it was.

═══════════════════════════════════════════════════════════════
PART 2 — CONDITIONS.HTML: THE TOWN COLUMN IS CLIPPED
═══════════════════════════════════════════════════════════════

Town cells are cut off on their LEFT edge — rows read "ttt, New Hampshire" instead of
"Bartlett, New Hampshire", "eld, Massachusetts" instead of "Sheffield, Massachusetts".
Every row.

Clipping specifically on the left points at the sticky Resort column painting over the
start of the Town cells — either the table is horizontally offset, or the sticky column's
declared width doesn't match its rendered width. Diagnose it rather than assuming, but
that's the lead.

Second problem in the same view: a wide dead gap between Town and "7-day snow", roughly two
columns' worth, while Conditions, Reported 24h and Base are squeezed. Something is claiming
width it isn't using — likely the sparkline column rendering empty because there is no
forecast snow in August. Note that this is an August-only symptom: a column that collapses
when empty will look correct in January and broken now. Fix the empty case specifically,
don't just make it look right once real data arrives.

Then audit the whole row width budget. At 1440px every column must be readable without
truncation; below that the table scrolls horizontally inside its own container and never
the page body. Test at 1440, 1280 and 375. Confirm the sticky header and sticky first
column still behave when scrolled in both directions.

═══════════════════════════════════════════════════════════════
PART 3 — EDITORIAL EMPHASIS ACROSS ALL 45 RESORTS
═══════════════════════════════════════════════════════════════

The resort pages are walls of undifferentiated prose. The writing is good but nothing
guides the eye, so a reader skimming six resorts on a Thursday night gets nothing from any
of them. Add typographic emphasis to the editorial fields so the load-bearing claims stand
out — then apply it to all 45.

── 3a. THE DATA MODEL ──

Editorial fields are plain strings. Emphasis needs markup, and there are three ways to do
it; use the third.

  Raw HTML in the JSON — no. Puts markup in the data layer, invites XSS, and means the
  validator can never be sure what a field contains.
  A separate highlights[] array of phrases matched at render — no. String matching is
  fragile, silently breaks whenever prose is edited, and duplicates content.
  A constrained inline mini-syntax — yes.

Define exactly two tokens, and only two:

  **text**   → the verdict: the load-bearing judgement of a paragraph
  ==text==   → a named thing: a trail, lift, glade, park, peak, or a hard number that
               carries the argument

Write a renderer in assets/js that HTML-escapes the entire string FIRST, then converts only
those two tokens, emitting only <strong> and <mark class="ne-mark">. Nothing else. No
nesting, no other tags. That ordering is the whole safety story — escape, then transform.

Bump schemaVersion to 4. Document the syntax in data/schema.md. Extend validate.mjs to
reject: unclosed tokens, nested tokens, a token spanning a sentence boundary, and any field
where marked words exceed 12% of the total — see the discipline rule below.

── 3b. THE GUARD THAT MAKES THIS SAFE ── (do this before touching any resort file)

Marking up 45 files is exactly the situation where prose quietly gets "improved" along the
way — a tightened clause here, a rephrased sentence there — and you end up with 45 files of
drift that nobody can audit. This pass adds markup ONLY. Not one word of prose changes.

So build the check first: a script that strips ** and == from every editorial field and
diffs the result against the same field at the pre-markup commit. It must match byte for
byte. Run it after every batch. If it reports a difference, you edited prose you were not
asked to edit — revert that field and re-mark it.

Do not skip this. It is what makes the whole pass reviewable.

── 3c. WHAT TO MARK — the editorial judgement ──

I marked up the Jay Peak page by hand as a sample; the pattern in what I picked:

  "Jay Peak gets more snow than anywhere else in the eastern United States"
  "347 inches"
  "The Jay Cloud"
  "the glades"
  "Beaver Pond, Timbuktu, Valhalla, Everglade"
  "where the snowfall claim is not marketing"
  "Remoteness is Jay's crowd control and it works"
  "skis harder than its numbers"

Four categories, and they generalise:

  THE VERDICT (**bold**). The clause that is the actual judgement — the thing a reader
  would quote back. "Remoteness is Jay's crowd control and it works." "Skis harder than
  its numbers." At most ONE per paragraph, often zero. This is the highest-value mark and
  the easiest to overuse.

  NAMED FEATURES (==mark==). Real trails, glades, lifts, peaks, parks. "Outer Limits",
  "the Front Four", "Beaver Pond, Timbuktu, Valhalla, Everglade", "Carinthia". These are
  what a reader is actually hunting for and they are trivially scannable when marked.

  LOAD-BEARING NUMBERS (==mark==). A figure only when it carries the argument —
  "347 inches", "a 1,750-foot base". Not every number in the sentence.

  THE HONEST CAVEAT (**bold**). The trade-off or weakness. This site's whole premise is
  saying the unflattering thing out loud; when a paragraph does, that clause should be the
  one that catches the eye. "The weakness is wind and visibility rather than surface."

── 3d. THE DISCIPLINE RULE ──

Emphasis is a budget, not a decoration. If everything is marked, nothing is. Hard limits:

  - No more than 2 marks per paragraph, across both token types.
  - No more than 12% of a field's words carry a mark. The validator enforces this.
  - Never mark a whole sentence. A mark is a clause or a phrase.
  - Never mark generic filler — "great terrain", "something for everyone". If a phrase
    could appear on any of the 45 pages, it is not a verdict.
  - A paragraph with nothing genuinely load-bearing gets zero marks. That is a valid and
    common outcome.

If you find yourself hunting for something to mark in a paragraph, that paragraph gets
nothing. Restraint here is the difference between a page that reads well and a page that
looks like a highlighter accident.

── 3e. THE VISUAL TREATMENT ──

Two channels, and never colour alone — the accessibility pass in Part E stands.

  <strong> — weight 600 against the body's 400, inheriting text colour. Works in both
  themes with no contrast risk. This carries the verdicts.

  <mark class="ne-mark"> — do NOT use the browser default yellow highlight; it is wrong for
  this design and unreadable in dark mode. Use a restrained tint drawn from the existing
  token palette plus a subtle underline or left-edge cue, so the emphasis survives
  greyscale and colour-blindness. Slightly raised weight too, so weight and colour agree.

Define both in the light palette on bare :root and redefine the tokens for dark. Verify
both themes at AA. Marks must be visible in print styles as weight, not as a background
that vanishes.

── 3f. STRIP MARKUP AT EVERY NON-PROSE EXIT ──

This is the part that will bite if missed. Any place the editorial text leaves the page
must get the plain version, or "==" characters leak into Google results:

  - <meta name="description"> and og:description
  - JSON-LD structured data
  - the CSV export
  - the <title> tag if any editorial text feeds it
  - compare.html's editorial cells — these should render marks, but check the renderer is
    actually applied there and not just on resort.html
  - any hover/tooltip text

Write one strip() helper and use it everywhere. Grep for every consumer of an editorial
field and confirm each one either renders markup or strips it — no third option.

── 3g. ORDER OF WORK ──

  1. Renderer, strip() helper, schema v4, validator rules, the drift check from 3b, and
     the CSS treatment. Commit.
  2. Mark up Jay Peak alone. Load the page in both themes. Commit.
  3. Tier A resorts in batches of 8. Run the drift check and the validator after each
     batch. Commit per batch.
  4. Tier B, then Tier C, same rhythm. Tier C files are shorter and will often take only
     one or two marks total — that is correct, do not inflate them.
  5. Final pass: run the drift check across all 45, confirm every exit in 3f strips or
     renders, re-run Lighthouse on index and one detail page, and report the marks-per-
     field distribution so I can see whether the budget held.

Report at the end: the three resorts you think are best marked, the three you found
hardest, and any field where you wanted to change the prose but didn't.
```
