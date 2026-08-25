# AUTORUN.md — the no-intervention run

One prompt. Runs schema v3, all 37 remaining resorts, the reviews pass, the two stub pages,
and the public-site polish, without stopping to ask anything.

## Before you paste it

1. **Turn plan mode off.** Press `shift+tab` until the footer reads `auto mode on`. Plan
   mode will stop and present a plan at every unit, which is exactly what you're trying to
   avoid.
2. Expect this to run for hours across several sessions. If it runs out of context, paste:
   `Read PROGRESS.md and continue the autorun from where it stopped.`

## The prompt

```
This is a standing, unattended run. Work the entire plan below to completion without asking
me anything. I will not be watching. Every decision below is already made; anything not
covered, you decide using the policy in section 2 and log it.

Read PLAN.md, CLAUDE.md, SCHEMA-V3.md, BATCHES.md, FINISH.md and data/schema.md first.
Where those files disagree with this message, this message wins.

═══════════════════════════════════════════════════════════════════
1. DECISIONS ALREADY MADE — DO NOT ASK ABOUT THESE
═══════════════════════════════════════════════════════════════════

- The schema-v3 review stop: show Okemo as the park example, not Mount Snow. Do not stop
  to show me anything; write it, verify it renders, commit, continue.
- All "STOP and show me" instructions in SCHEMA-V3.md, FINISH.md and BATCHES.md are
  cancelled. There are no review stops in this run.
- Roster is all 45 resorts. No photos anywhere. Leaflet from CDN pinned to an exact version
  with SRI is the one permitted external dependency.
- Do NOT create a GitHub repo, do NOT add a remote, do NOT push, do NOT deploy. Prepare
  everything and write the exact commands into HANDOFF.md for me to run myself.
- Do not run the trail map downloader or expand snow adapters. Those are seasonal; they go
  into SEASONAL.md as written instructions only.
- Commit after every unit. Never leave the tree dirty between units.

═══════════════════════════════════════════════════════════════════
2. DECISION POLICY FOR ANYTHING NOT COVERED
═══════════════════════════════════════════════════════════════════

Apply in order. Log every non-obvious call to DECISIONS.md with one line of reasoning.

  1. If it would require guessing at data — choose the null plus a fieldNotes entry.
     Always. This rule outranks everything else.
  2. If it contradicts a rule in CLAUDE.md — follow CLAUDE.md.
  3. If it touches anything outside this repo (accounts, money, publishing, third-party
     services, installing large binaries) — don't. Write it to HANDOFF.md and continue.
  4. If it's reversible and confined to the repo — decide it yourself and keep moving.
  5. When two defensible options exist, prefer the one that keeps the run moving over the
     one that yields a marginally better artifact. A finished site with a few plain
     sections beats a half-finished elegant one.

═══════════════════════════════════════════════════════════════════
3. THE ONE FAILURE MODE THAT MATTERS
═══════════════════════════════════════════════════════════════════

Over a run this long the danger is not crashing — it's drift. By the thirtieth resort you
will have an extremely strong prior about what a resort file looks like, and producing one
that reads right without doing the research will feel like finishing the job. It isn't.
Confident fiction is worse than a null and far harder to detect afterwards, because it is
indistinguishable from the good work.

Three concrete defenses, all mandatory:

  a. Nulls are a correct outcome. A Camden Snow Bowl file that is 60% populated with honest
     gaps is worth more than a 100% one where a third is inferred from a similar mountain.
  b. After every batch, spot-check: take one number from a resort in an EARLIER batch,
     re-fetch its recorded source URL, confirm it still matches. Log the result to
     PROGRESS.md. If it fails, write it to PROGRESS.md under "INTEGRITY FAILURE", fix the
     file, and continue — do not stop the run, but do surface it in the final report.
  c. Never write a fieldNotes "unpublished" status for a field you did not actually check.
     An unchecked field stays plain unverified. Gaming the status system to empty the
     unknown table is the precise failure the status system exists to prevent.

═══════════════════════════════════════════════════════════════════
4. STATE FILES — KEEP THESE CURRENT, NOT AT THE END
═══════════════════════════════════════════════════════════════════

  PROGRESS.md   one line per completed unit: what, commit hash, unverified count,
                spot-check result, anything notable. This is how you resume after a
                context reset. Update it immediately on finishing each unit.
  DECISIONS.md  every judgement call from the policy in section 2, one line each.
  HANDOFF.md    everything requiring me: the GitHub and Netlify commands, the
                SKI_BOT_CONTACT_URL secret, anything you declined under policy rule 3.
  SEASONAL.md   work that genuinely cannot be done in August.

═══════════════════════════════════════════════════════════════════
5. THE WORK, IN ORDER
═══════════════════════════════════════════════════════════════════

PART A — SCHEMA v3
Execute SCHEMA-V3.md in full: dedicated moguls and parks sections, validator rules,
rendering on resort.html, new index filters (has park, has pipe, mogul presence), and
migration of the 8 existing resorts. Use Okemo as the park exemplar. Commit, continue.

PART B — THE 37 REMAINING RESORTS
Execute BATCHES.md, batches 2 through 10, back to back. Per-batch loop as written there:
research, write, close the passes[].blackouts debt, populate moguls and parks, npm run
check, render check, spot-check, commit, update PROGRESS.md.

Handle without asking:
  - A dormant or closed area (Tenney, Big Moose and possibly others): log it to
    PROGRESS.md under "flagged", skip it, keep going. Do not write it up as operating.
  - Two Black Mountains (NH and ME) — keep slugs distinct.
  - Pleasant Mountain was Shawnee Peak; Saskadena Six was Suicide Six. Old names go in
    `aka`; older sources will use them.
  - A resort site that blocks the fetch tool: retry once with curl and the project bot UA,
    as you already did for Okemo. If that fails too, fall back to the state association
    and OnTheSnow and record the source honestly.
  - Tier C resorts will have far higher null rates. Correct, not a problem.

PART C — REVIEWS
Every resort's reviews[] is empty. Three commits: Tier A, Tier B, Tier C. Read 2-4
substantive sources per resort, write an original one-to-three-sentence gist per source in
your own words, never pasting theirs. Record source, URL, rating and scale where published.
Storm Skiing Journal, SKI, ZRankings, OnTheSnow aggregate, NELSAP for history, AlpineZone
and r/icecoast for the unvarnished local view — attribute that last category as skier
consensus, never as fact. Where a resort has no substantive coverage, leave it empty with
an "unpublished" fieldNotes entry rather than padding.

PART D — THE TWO STUB PAGES
map.html: Leaflet, OSM tiles, pins colored by pass, popup with name/vertical/pass and a
link through. Handle 45 pins sensibly. compare.html: 2-4 resorts, deep-linkable via
?r=a,b,c, winning value highlighted per row, and include editorial fields — a comparison
that only shows numbers is a spreadsheet. Commit separately.

PART E — PUBLIC SITE
about.html (what this is, data sources, refresh cadence, attribution, contact — this is
what SKI_BOT_CONTACT_URL points at), SEO (titles, meta descriptions, Open Graph, JSON-LD
SkiResort on detail pages, sitemap.xml generated from data/index.json, robots.txt), a real
404, and an accessibility pass (keyboard-navigable filters, visible focus, AA contrast both
themes, table scrolling in its own container on mobile). Run Lighthouse on index and one
detail page and record the numbers in PROGRESS.md. Commit each as its own unit.

PART F — SEASONAL.md
Write it. Trail map downloader in November against current maps. Adapter re-verification in
early December — the three existing adapters were written against dormant summer pages and
need re-checking, not just extending; sunday-river needs Playwright installed; the first
real in-season fetch is the only true test of the isReportUsable() branches. Add the moguls
namedRuns re-verification against live grooming reports in January, since that is the one
truly objective source for which trails bump up and it is dormant right now.

PART G — FINAL REPORT
npm run check one last time, then write FINAL-REPORT.md and print it:
  - final resort count, unverified split (unknown vs confirmed unpublished)
  - which fields remain most commonly unknown roster-wide, and whether any deserve a
    dedicated pass
  - every resort file you consider weak, named, with why
  - every integrity failure from the spot-checks
  - what you would fix first given one more hour
  - anything in DECISIONS.md you think I might overrule

Be blunt in that report. A run this long will have soft spots, and a report that says it
all went well is less useful than one that names the three files I should re-check myself.

═══════════════════════════════════════════════════════════════════
6. RUNNING OUT OF CONTEXT
═══════════════════════════════════════════════════════════════════

If you're running low, do not try to squeeze in one more unit. Finish the current unit,
commit it, bring PROGRESS.md fully up to date, and print exactly:

  AUTORUN PAUSED — resume with: Read PROGRESS.md and continue the autorun.

Start with Part A now. Do not reply to this message with a plan; start working.
```
