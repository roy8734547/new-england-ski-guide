# Schema v3 — dedicated moguls and terrain park sections

Run this **before** the batch run in `BATCHES.md`. If the batches go first, all 45 resorts
need a second research pass to backfill these sections; doing it now means the 37 remaining
resorts get them natively, in the same fetch.

`terrain.moguls` and `terrain.terrainParks` currently exist as thin scalars and are null on
almost every resort anyway, so there is very little to throw away.

## The prompt

```
Two new dedicated sections in the resort schema: moguls and terrain parks. Do this before
any more resort batches, so the remaining 37 get them in the same research pass instead of
needing a backfill later.

Bump schemaVersion to 3. The existing thin terrain.moguls and terrain.terrainParks scalars
are replaced by these — migrate anything real out of them, then remove them from the schema.

═══════════════════════════════════════════════════════════════════
THE MOGULS SECTION
═══════════════════════════════════════════════════════════════════

Top-level "moguls" object. Design the exact shape yourself, but it must carry:

  presence      one of: signature | common | occasional | rare | none
                "signature" means bumps are a defining feature of the mountain
                (Killington, Sunday River, Sugarloaf, Mad River Glen). "none" needs a
                reason — usually a mountain that grooms everything nightly.

  policy        what the mountain actually does: which pods or trails are left ungroomed
                as policy, whether bumps are seeded or purely skier-formed, whether
                anything is groomed away midweek.

  namedRuns[]   the specific trails that bump up, each with: trail name, difficulty,
                whether bumps are there reliably or only late season, and a one-line note
                on their character. This is the field people actually come for — "does
                Outer Limits still bump up" is a real question with a real answer.

  quality       editorial on the bumps themselves: shape, spacing, line consistency,
                whether the troughs go to ice, how they hold up through a weekend.
                Be specific and be willing to say bumps are bad.

  bestTiming    when they're actually good — spring corn, a few days after a storm,
                late-season, weekends after skier traffic builds them.

  bumpCulture   commentary: is there a bump scene, are there comps, is there a local crew
                that maintains a line. Killington's Bear Mountain Mogul Challenge and
                Sugarloaf's Narrow Gauge comps are the obvious examples; most mountains
                have nothing and should say so.

  source, verifiedOn, and a fieldNotes entry when a sub-field can't be sourced.

RESEARCH TECHNIQUE FOR MOGULS — this is the important part.

Marketing pages do not tell you where the bumps are. Three sources that actually do:

1. THE DAILY GROOMING REPORT. A resort publishes which trails were groomed last night;
   the ungroomed ones are where bumps form. This is the single most objective source for
   namedRuns. Right now it is August and every grooming report is dormant — so source
   namedRuns from trail descriptions and skier knowledge for now, mark the section
   verifiedOn today, and add it to SEASONAL.md as something to re-verify against live
   grooming reports in January.
2. TRAIL DESCRIPTIONS on the resort's own trail list. Phrases like "left natural",
   "ungroomed", "bump run" are citable.
3. FORUM AND SKIER CONSENSUS — AlpineZone bump threads, r/skiing, r/icecoast. Attribute as
   skier consensus, never as resort fact, and never quote it directly. This is where the
   honest assessment of bump quality lives.

Some ground truth so you can sanity-check what you find: Killington's Outer Limits is the
canonical Eastern bump run; Stowe's Front Four (Goat, Starr, National, Liftline) bump up
hard; Mad River Glen's Paradise and the Chute are natural-snow bumps by design; Sugarloaf's
Narrow Gauge has hosted comps; Sunday River's White Heat and Shockwave. If your research
contradicts any of that, trust your sources over this list and tell me — it means something
changed. If your research simply fails to find these, that's a sign the research was too
shallow.

═══════════════════════════════════════════════════════════════════
THE TERRAIN PARKS SECTION
═══════════════════════════════════════════════════════════════════

Top-level "parks" object. Must carry:

  count         number of distinct parks
  parks[]       one entry each: name, size (progression | small | medium | large), the
                intended level, a feature summary (approximate counts of jibs, jumps and
                the largest jump size, boxes, rails), and a note on character.
  pipe          halfpipe / superpipe presence and dimensions where published; explicit
                false where the mountain used to have one and dropped it — that's an
                "absent" fieldNotes entry, and it's information people want.
  nightPark     whether any park is lit
  progression   whether there's a real beginner-to-advanced ladder, an airbag, a
                Woodward-branded facility, or coaching
  rebuildCadence how often features are reset — the difference between a good park and a
                bad one is almost entirely maintenance
  overview      editorial: who this park is actually for
  reputation    commentary: where it sits regionally, and honestly. Most New England parks
                are mediocre and a guide that says so is more useful than one that doesn't.
  source, verifiedOn, fieldNotes as needed.

SOURCES FOR PARKS: the resort's own park page (usually good — parks are marketed hard,
unlike bumps), Woodward pages for the Vail properties, Newschoolers and Snowboarder park
coverage, and forum consensus for whether the published feature list matches reality.

Ground truth to sanity-check against: Mount Snow's Carinthia is an entire mountain face
given over to parks and is the biggest park operation in the East; Killington, Stratton,
Sunday River and Loon all run substantial park programs; Woodward is Vail's park brand and
appears at several of their mountains. Many small areas run one modest progression park,
and several Tier C areas run none at all — record "none" with a source rather than leaving
it null.

═══════════════════════════════════════════════════════════════════
IMPLEMENTATION ORDER
═══════════════════════════════════════════════════════════════════

1. Update data/schema.md for both sections; bump to schemaVersion 3.
2. Update validate.mjs — including a check that a "signature" mogul presence has at least
   one namedRun, and that parks.count matches parks[].length.
3. Render both on resort.html as their own sections, not crammed into the terrain
   breakdown. namedRuns should read as a real list of trails. Suppress a section entirely
   when there's genuinely nothing (a mountain with no park), but say "No terrain park"
   rather than silently omitting it when that's a sourced fact.
4. Add both to the comparison table filters on index.html: "has terrain park", "has
   halfpipe", and a mogul presence filter. These are real trip-planning filters.
5. Migrate the 8 existing resorts. Research them properly — do not infer the sections from
   the editorial text already in those files.
6. npm run check, render check, commit.

Then STOP and show me the Killington and Mount Snow files so I can see both sections
populated on a bump mountain and a park mountain before you take this into the batches.
```

## Then amend the batch run

`BATCHES.md` has been updated: the per-batch loop now includes both sections, so once
schema v3 is in, the batch prompt needs no further change.
