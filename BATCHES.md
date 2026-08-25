# The unattended batch run

One prompt that takes the roster from 8 resorts to all 45 without stopping for approval
between batches.

> **Run `SCHEMA-V3.md` first.** It adds the dedicated moguls and terrain park sections. If
> the batches run before it, all 45 resorts need a second research pass to backfill them.

## Before you start it

Turn on auto-accept edits in Claude Code (**shift+tab**), or you'll be approving file writes
for the next few hours. This run is long — nine batches, ~35 web fetches each.

## The prompt

```
Work through Part 2 of FINISH.md in full — every remaining batch, back to back, without
stopping to ask me between them. Ignore the "stop after Batch 4" instruction in that file;
I'm explicitly lifting it. Only stop for the three conditions listed at the bottom of this
message.

  Batch 2:  stratton, mount-snow, burke, pico
  Batch 3:  cannon, loon, bretton-woods, waterville-valley, wildcat
  Batch 4:  attitash, sunday-river, sugarloaf, saddleback
  Batch 5:  mount-sunapee, cranmore, ragged, gunstock, crotched
  Batch 6:  pats-peak, magic-mountain, bromley, bolton-valley
  Batch 7:  pleasant-mountain, berkshire-east, jiminy-peak, catamount
  Batch 8:  middlebury-snow-bowl, saskadena-six, black-mountain-nh, dartmouth-skiway
  Batch 9:  mt-abram, black-mountain-maine, camden-snow-bowl, big-rock
  Batch 10: butternut, bousquet, mohawk-mountain

── THE ONE THING THAT MATTERS OVER A LONG RUN ──

The failure mode of a run this long is not crashing. It's drift: by Batch 8 the temptation
is to produce something that reads like the earlier batches without doing the same research,
because you have a strong sense of what a resort file is supposed to look like. Confident
fiction is worse than a null, and it is much harder to detect later because it looks exactly
like the good work.

So: the sourcing standard does not relax as you get tired of the task. If a resort's site is
down, or the number isn't published anywhere citable, that's a null with a fieldNotes entry.
Nulls are not failures. A 60%-complete Camden Snow Bowl file with honest gaps is worth more
than a 100%-complete one where a third of it is inferred from Ragged Mountain.

── PER-BATCH LOOP ──

For each batch, in order:

1. Research each resort from its own site first, then the state ski association, then
   OnTheSnow/ZRankings. Record which source gave you each group.
2. Write the file. Editorial must name real trails, real lift bottlenecks, real crowd
   patterns, real ice. Tier C resorts (Batches 8-10) get 2-3 tight paragraphs, same
   sourcing standard.
3. Close the passes[].blackouts debt for these resorts while you're there — check the
   actual pass operator's page (Epic, Ikon, Indy), not the resort's summary of it. This is
   the field people comparing passes actually need, and it's currently null on almost
   everything.
3b. Populate the schema v3 moguls and parks sections in the same pass. Use the grooming
   report / trail description / forum-consensus method from SCHEMA-V3.md for moguls, and
   the resort's own park page plus forum reality-check for parks. A mountain with no park
   gets a sourced "none", not a null. Bump quality and park reputation are the two places
   in this whole project where honest commentary is worth the most — a guide that says a
   park is mediocre is more useful than one that doesn't.
4. Run `npm run check`. Fix anything it flags.
5. Load one detail page from the batch in the browser and confirm it renders with no
   console errors.
6. SPOT-CHECK: pick one number from a resort in an EARLIER batch, re-fetch its recorded
   source URL, and confirm the number still matches what's in the file. If it doesn't,
   stop and tell me — that means either a source moved or something got written that the
   source never said.
7. Commit the batch with a message naming the resorts.
8. Append a line to PROGRESS.md: batch number, resorts, commit hash, unverified count,
   and anything notable.
9. Report to me in three sentences or fewer, then immediately start the next batch.

── PROGRESS.md ──

Create it at the start. This run may outlive the context window, and if I have to /clear
mid-run, PROGRESS.md is how you pick up where you left off without re-doing a batch or
skipping one. Keep it current after every batch, not at the end.

── SPECIFIC THINGS TO WATCH FOR ──

PASS AFFILIATIONS ARE THE HIGH-VALUE DATA IN BATCHES 3, 5 AND 6. Cannon, Waterville
Valley, Pats Peak and Ragged moved to Indy for 2026-27 and most published guides are still
wrong. Verify against the Indy Pass site itself. Set verifiedOn.

DORMANT OR CLOSED AREAS. Some areas on this list have had uncertain operating status
(Tenney, Big Moose, and others may surprise you). If an area isn't reliably operating for
2026-27, do NOT write it up as though it were. Log it to PROGRESS.md under "flagged", skip
it, and keep going — don't stop the run for this.

NAMING COLLISIONS. There are two Black Mountains (NH and ME) and the slugs must stay
distinct. Pleasant Mountain was Shawnee Peak; Saskadena Six was Suicide Six; both renamed
recently, so older sources use the old names. Record the old name in `aka`.

SMALL AREAS PUBLISH LESS. Batches 8-10 will have far higher null rates than Batch 2, and
that is the correct outcome, not a sign you should try harder. A community hill genuinely
does not publish snowmaking percentage.

── STOP CONDITIONS ──

Stop and ask me only if:
  1. The spot-check in step 6 fails.
  2. `npm run check` reports errors you can't resolve without guessing at data.
  3. You're running low on context — tell me where you are so I can /clear and resume you
     from PROGRESS.md.

Anything else — a dead site, a missing stat, a renamed resort, a dormant area — you handle
per the rules above and keep going.

── WHEN ALL NINE BATCHES ARE DONE ──

Run `npm run check` one final time and give me:
  - the final resort count and total unverified split (unknown vs confirmed unpublished)
  - which fields are still most commonly unknown across the whole roster, and whether any
    of them are worth a dedicated pass
  - any resort whose file you consider weak, and why
  - what you'd fix first if you had one more hour

Be honest in that last section. A run this long will have soft spots and I'd rather know
which they are than be told it all went well.
```

## If it runs out of context mid-run

```
Read PROGRESS.md and continue the batch run from where it left off, same rules as before.
```
