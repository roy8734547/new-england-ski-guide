# Resort data contract

**Schema version:** `3` · **Last revised:** 2026-08-24

One file per resort at `data/resorts/<slug>.json`. That file is the **source of truth** for
everything the site knows about a mountain except live weather (fetched in the browser) and
snow reports (generated into `data/snow-reports.json`).

`data/index.json` is **generated** from these files by `tools/build-index.mjs`. Never edit it
by hand. After touching anything in `data/resorts/`, run:

```
node tools/build-index.mjs
node tools/validate.mjs
```

---

## 1. Structural decisions, and why

Six choices in this schema are not obvious. Each is justified here so a later change is a
deliberate reversal rather than drift.

### 1.1 Grouped objects, not a flat record

Fields are nested under `identity` / `size` / `terrain` / `passes` / `pricing` / `editorial` /
`reviews` / `links` / `meta` rather than living in one flat object.

**Why:** provenance attaches at the group level. A resort's stat block comes from one page on
one date; its pricing comes from a different page on a different date; its editorial comes
from a human and has no external source at all. Grouping lets `source` + `verifiedOn` sit
exactly once next to the facts they cover, instead of being repeated per field or — worse —
recorded once for the whole file, quietly implying that a 2019 acreage figure was verified on
the same day as this season's ticket price.

The grouping also makes the *factual/editorial boundary* structural rather than a convention.
`size`, `terrain`, `passes`, `pricing`, `links` are sourced facts. `editorial` is opinion, has
no `source`, and must never contain a number that isn't also in a factual group.

### 1.2 Group-level provenance, with a per-field escape hatch

Every factual group carries `source` (a URL string) and `verifiedOn` (an ISO `YYYY-MM-DD`
date). When one field inside a group came from somewhere else — say the resort publishes
vertical drop but only Ski Vermont publishes snowmaking percentage — record the exception in
that group's optional `fieldSources` map:

```json
"size": {
  "verticalDrop": 3050,
  "snowmakingPercent": 63,
  "source": "https://www.killington.com/the-mountain/mountain-stats",
  "verifiedOn": "2026-08-20",
  "fieldSources": {
    "snowmakingPercent": {
      "source": "https://skivermont.com/resorts/killington",
      "verifiedOn": "2026-08-18"
    }
  }
}
```

**Why not per-field provenance everywhere:** it triples the file size and the editing burden
for the ~90% case where a whole stat block was read off one page in one sitting. **Why not
file-level provenance only:** it lies, per above. The escape hatch gets both — cheap in the
common case, exact when it matters. `tools/validate.mjs` enforces that every key in
`fieldSources` is a real field of that group.

### 1.3 `passes` and `reviews` carry their own provenance per entry

These two are arrays of independently-sourced records. A resort can be on Indy (verified from
Indy's own site) and also sell a local reciprocal deal (verified from the resort). One
group-level source cannot honestly cover both, so each `passes[]` entry carries its own
`source` + `verifiedOn`, and each `reviews[]` entry carries a `url`. Neither group has a
group-level `source`.

### 1.4 Explicit `null`, never a missing key

Every key defined below is **present in every file**. A fact we don't have is `null` — never
omitted, never `0`, never `"unknown"`, never carried over from a similar mountain.

**Why:** a missing key and an unknown value are indistinguishable at read time, which is
exactly how a guess gets laundered into the dataset. Present-and-null makes "we looked and
couldn't source it" a first-class, greppable state. `tools/validate.mjs` collects every null
in a *tracked* field into `data/UNVERIFIED.md`, so the gaps are a visible worklist rather than
an invisible absence. Renderers treat `null` as "show an em dash", and sorting on the index
page puts nulls last regardless of direction.

`0` means zero — a mountain with genuinely no snowmaking is `0`, not `null`.

### 1.5 Units live in the contract, not in the field names

Fields are named as specified (`verticalDrop`, not `verticalDropFt`). Units are fixed by this
document and are **not** stored per record: feet for elevation and vertical, acres for area,
inches for annual snowfall, miles for `longestRun`, percent as `0–100` integers, USD for
prices unless `pricing.currency` says otherwise.

**Why:** a units field that is always `"ft"` is noise, and a units field that *varies* means
every consumer has to convert. One fixed unit per field, documented here, enforced by range
checks in the validator.

### 1.6 `glades` is a boolean; how good it is is editorial

This is a factual presence flag — does the mountain maintain and market gladed terrain —
sourceable from the trail map or the terrain page. Whether the glades are any good is a
judgment, and it belongs in `terrain.difficultyNotes` and `editorial.difficulty`.

Bumps and parks used to work the same way and no longer do: both outgrew a boolean and now
have their own sections (§14, §15). Glades may well follow in a later version.

**Consequence for the UI:** `glades` is `true` for nearly every New England area above this
site's cutoff, so it is a near-useless filter facet and `index.html` should not offer it as
one. It is kept as data because "this mountain has no gladed terrain" is a genuinely useful
negative signal on a detail page.

---

## 2. Top level

```json
{
  "schemaVersion": 3,
  "identity": { },
  "size": { },
  "terrain": { },
  "passes": [ ],
  "pricing": { },
  "editorial": { },
  "reviews": [ ],
  "links": { },
  "meta": { },
  "fieldNotes": { },
  "dataDisputes": [ ],
  "moguls": { },
  "parks": { }
}
```

| key | type | null? | notes |
|---|---|---|---|
| `schemaVersion` | integer | no | Currently `3`. Bump only on a breaking change; the validator refuses versions it doesn't know. |
| `fieldNotes` | object | no (may be `{}`) | Why a field is empty. See §12. |
| `dataDisputes` | array | no (may be `[]`) | Where we think a resort's own figure is wrong. See §13. |
| `moguls` | object | no | Bump terrain. See §14. |
| `parks` | object | no | Terrain parks and pipe. See §15. |

Every other top-level key is required and must be an object or array — never `null`. An empty
array is the correct value for "no reviews yet".

**What changed in v2.** Both new keys exist to fix the same failure: a bare `null` cannot
say whether we looked. `fieldNotes` separates *unknown* from *checked and confirmed empty*;
`dataDisputes` turns "the resort's number looks wrong" from a sentence somebody happened to
write into structured, renderable data.

**What changed in v3.** `moguls` and `parks` were promoted from two thin scalars inside
`terrain` — a boolean and a count — to sections of their own. `terrainParks: 5` told a
reader nothing about whether the parks were any good, and `moguls: true` could not answer
the only bump question anybody actually asks, which is *which trail*. The old
`terrain.moguls` and `terrain.terrainParks` fields are **removed**; anything real in them
moved into the new sections.

---

## 3. `identity`

Who and where the mountain is. No provenance block: these are self-evident from the resort's
own site, and `meta.verifiedOn` covers the record as a whole.

| field | type | null? | notes |
|---|---|---|---|
| `slug` | string | **no** | Lowercase, hyphenated, ASCII: `/^[a-z0-9]+(-[a-z0-9]+)*$/`. **Must equal the filename** minus `.json`. Disambiguate collisions with the state: `black-mountain-nh`, `black-mountain-me`. Once published a slug is a permalink — renaming one breaks every `resort.html?r=…` link, so don't. |
| `name` | string | **no** | Display name as the resort writes it: `Mad River Glen`, `Smugglers' Notch`. |
| `aka` | string[] | no (may be `[]`) | Alternate and former names, search aliases: `["Sugarloaf/USA", "The Loaf"]`. Used for search matching, not display. |
| `state` | string | **no** | Two-letter, uppercase. One of `VT` `NH` `ME` `MA` `CT` `RI`. |
| `region` | string | **no** | Named sub-region, from the controlled list below. |
| `town` | string | **no** | Mailing town, no state suffix: `Warren`, not `Warren, VT`. |
| `lat` | number | **no** | Decimal degrees, 4+ places. **The summit**, not the base lodge or the parking lot — this drives the weather forecast, and 2,000 ft of elevation is the difference between rain and snow. |
| `lon` | number | **no** | Decimal degrees, negative (west). |
| `website` | string | **no** | Resort homepage, `https://`, no tracking parameters. |

**Controlled `region` values.** Adding one is fine; edit this list in the same commit so the
validator and this document stay in step.

`Southern Vermont` · `Central Vermont` · `Northern Vermont` · `Northeast Kingdom` ·
`White Mountains` · `Mount Washington Valley` · `Lakes Region` · `Southern New Hampshire` ·
`Dartmouth-Sunapee` · `Western Maine` · `Central Maine` · `Midcoast Maine` ·
`Northern Maine` · `Berkshires` · `Central Massachusetts` · `Northwest Connecticut`

---

## 4. `size`

The stat block. Carries `source` + `verifiedOn`, plus optional `fieldSources`.

| field | unit | type | null? | notes |
|---|---|---|---|---|
| `verticalDrop` | ft | integer | yes | Lift-served vertical. Not hike-to, not "if you count the access road". This is the site's inclusion cutoff (~650 ft); the validator warns below 600. |
| `skiableAcres` | acres | number | yes | As the resort publishes it. Many marketed figures include glades and sidecountry; that's fine, but if the resort publishes two numbers use the conservative one and say which in `terrain.difficultyNotes`. |
| `trailCount` | count | integer | yes | Named trails. |
| `liftCount` | count | integer | yes | All lifts including surface lifts and carpets, since that is how resorts publish it. |
| `longestRun` | miles | number | yes | Decimal miles (`2.5`) — not `"2.5 miles"`, not feet. |
| `summitElevation` | ft | integer | yes | Lift-served summit. |
| `baseElevation` | ft | integer | yes | Main base area. Where there are several, the lowest lift-served base. |
| `annualSnowfallAvg` | inches | integer | yes | Resort-claimed average. These are optimistic almost everywhere; the honest correction goes in `editorial.snowQuality`, never by adjusting the number here. |
| `snowmakingPercent` | percent | integer 0–100 | yes | Percent of skiable terrain covered. `0` is a real value. |
| `nightSkiing` | — | boolean | yes | Does the mountain run lift-served night skiing in a normal season. Which trails and which nights is editorial — this stays boolean because it is a filter facet. |
| `source` | — | string (URL) | **no** | |
| `verifiedOn` | — | string (`YYYY-MM-DD`) | **no** | |
| `fieldSources` | — | object | no (may be `{}`) | Per-field overrides; see §1.2. |

**Validator cross-check:** when `summitElevation`, `baseElevation` and `verticalDrop` are all
present, `summit − base` must equal `verticalDrop` within 50 ft. A mismatch is nearly always a
transcription error or two mixed sources, so it is an error, not a warning.

---

## 5. `terrain`

| field | unit | type | null? | notes |
|---|---|---|---|---|
| `percentBeginner` | percent | integer 0–100 | yes | |
| `percentIntermediate` | percent | integer 0–100 | yes | |
| `percentAdvanced` | percent | integer 0–100 | yes | |
| `percentExpert` | percent | integer 0–100 | yes | |
| `glades` | — | boolean | yes | Maintained/marketed gladed terrain. See §1.6. |
| `difficultyNotes` | — | string \| null | yes | Short factual caveats on how to read the numbers above: which rating scheme the resort uses, whether a fourth "expert" tier exists, whether acreage includes glades. **Factual, not opinion** — opinion goes in `editorial.difficulty`. |
| `source` | — | string (URL) | **no** | |
| `verifiedOn` | — | string (`YYYY-MM-DD`) | **no** | |
| `fieldSources` | — | object | no (may be `{}`) | |

**On the four percentages.** Many resorts publish three tiers, not four. When there is no
published fourth tier, set `percentExpert` to `null` — do **not** split the advanced number
yourself. Record the scheme in `difficultyNotes`.

**In a three-tier scheme the top tier always goes in `percentAdvanced`,** whatever the resort
calls it. Mad River Glen publishes "20% novice, 35% intermediate, 45% expert"; that 45 is
recorded as `percentAdvanced` with `percentExpert: null`, because it is the top of a
three-way split and not a fourth tier carved out of a larger advanced number. Mapping it to
`percentExpert` instead would make MRG look like it has *no* advanced terrain and would
compare falsely against a four-tier resort. Say so in `difficultyNotes` whenever the resort's
own label differs from the field it landed in.

**Validator cross-check:** if all four are present they must sum to 100 ± 2 (resorts round).
If exactly the first three are present and `percentExpert` is null, those three must sum to
100 ± 2. Any other partial combination is an error — a half-filled breakdown renders as a
misleading bar.

---

## 6. `passes` — array

One entry per multi-mountain pass or notable reciprocal program the mountain participates in,
most significant first. A mountain on no multi-resort pass gets an entry with `type: "none"`
describing its own season pass, so the UI never has to special-case an empty array. Each entry
is independently sourced (§1.3).

**`none` excludes the mega-passes, not reciprocals.** `type: "none"` may not appear alongside
`epic`, `ikon` or `indy` — that is a contradiction, and the validator rejects it. It *may*
appear alongside `other`. Mad River Glen is the case that forced this: it belongs to no
mega-pass and sells only its own pass, yet its passholders get a real, published discount at
Plattekill. That reciprocal is a `none` + `other` pair, not a contradiction, and squashing it
into the `none` entry's `access` string would hide a fact people actually search for.

| field | type | null? | notes |
|---|---|---|---|
| `name` | string | **no** | The pass as marketed: `Ikon Pass`, `Ikon Base Pass`, `Indy Pass`, `Epic Pass`, `Mad Card`. Base and full tiers with different access are **separate entries**. |
| `type` | string | **no** | One of `epic` · `ikon` · `indy` · `other` · `none`. `other` = a real multi-mountain product that isn't one of the big three. `none` = independent, own pass only. |
| `access` | string | **no** | Short and factual, no marketing: `"Unlimited"`, `"7 days"`, `"5 days, Base tier"`, `"2 days"`, `"Season pass only"`. |
| `blackouts` | string \| null | yes | Dates or a plain description: `"Dec 26 – Jan 1, Feb 14–16"`, or `"None"` when the pass explicitly has none. `null` means *we did not verify*, which is not the same as "none" — the UI renders the two differently. |
| `verifiedOn` | string (`YYYY-MM-DD`) | **no** | |
| `source` | string (URL) | **no** | Prefer the pass operator's own page over the resort's summary of it. |

Pass affiliation is the most-searched and most-frequently-stale fact about a Northeast
mountain. `verifiedOn` is shown in the UI next to the pass badge on purpose.

---

## 7. `pricing`

Prices move constantly and dynamic pricing makes any single number a half-truth. The schema
stores a **range plus a typical advance price**, and the UI always shows `verifiedOn`.

| field | unit | type | null? | notes |
|---|---|---|---|---|
| `windowTicketAdultHigh` | currency | number | yes | Walk-up adult single-day at peak (holiday Saturday). The scary number. |
| `windowTicketAdultLow` | currency | number | yes | Walk-up adult single-day at the cheapest normal operating time (early-season midweek). Not a promo, not a bring-a-friend rate. |
| `advanceTypical` | currency | number | yes | What a normal adult actually pays buying online ~2 weeks out for a regular winter Saturday. The most useful single number on the page and the one most likely to be an estimate — if it cannot be read off a real booking page, it is `null`. |
| `seasonPassAdult` | currency | number | yes | Unrestricted adult season pass at the standard (not early-bird) rate. If only an early-bird price is published, use it and say so in `notes`. |
| `currency` | — | string | **no** | ISO 4217. `"USD"` throughout this project. |
| `notes` | — | string \| null | yes | Which season, which tier, what is excluded: `"2026-27 rates; early-bird pricing through Sept 30. Ages 65+ ski at the youth rate."` |
| `verifiedOn` | — | string (`YYYY-MM-DD`) | **no** | |
| `source` | — | string (URL) | **no** | |
| `fieldSources` | — | object | no (may be `{}`) | Per-field overrides; see §1.2. Resorts routinely put day tickets and season passes on two different pages, so this group needs the escape hatch as much as `size` does. |

**`verifiedOn` dates the check, not the rate.** It says when we last confirmed what the
resort publishes — which may well be last season's price if that is all they have posted yet.
When the published rates are not for the current season, say so in `notes`; the staleness
warning cannot see it.

**Validator cross-checks:** `windowTicketAdultLow ≤ advanceTypical ≤ windowTicketAdultHigh`
when all three are present (warning — an unusual pricing structure can genuinely violate it,
but it is usually a swapped pair). Prices are range-checked to `1–3000` to catch a season pass
typed into a day-ticket field. And `verifiedOn` older than 180 days raises a warning, because
a confidently-displayed stale price is worse than no price.

---

## 8. `editorial`

**Original opinion, written for this site, in our own words.** No source fields — there is
nothing to cite because nothing here is borrowed. Never paste or closely paraphrase a sentence
from a resort's marketing copy or from a review site. If a passage would sit comfortably on
the resort's own homepage, it is a bug: rewrite it until it says something the marketing
department wouldn't.

Be specific and be willing to be negative. "Excellent terrain for all abilities" is worthless.
"The lower mountain is a wind-scoured icebox in January and the good snow is all above the
mid-station" is the point of this site.

| field | type | null? | notes |
|---|---|---|---|
| `overview` | string | **no** | 120–400 words. The lede: what this mountain actually is and who it is for. The only editorial field that may never be null. |
| `snowQuality` | string \| null | yes | 60–200 words. Natural vs. manmade, how it holds up in a thaw, aspect and elevation effects, whether the claimed snowfall average is believable. |
| `crowds` | string \| null | yes | 60–200 words. Weekend vs. midweek, which lifts bottleneck, parking and access, what the pass affiliation did to the lift lines. |
| `difficulty` | string \| null | yes | 60–200 words. How the trail ratings compare to the region and to the West. Where a self-described intermediate will actually get in trouble. |
| `keyTrails` | object[] | no (may be `[]`) | 3–8 entries of `{ "name": string, "note": string }` — one or two sentences each on why that trail matters. |
| `tidbits` | string[] | no (may be `[]`) | 2–6 short standalone facts or bits of history, one sentence each. Anything with a number in it needs a matching entry in `meta.sources`. |
| `bestFor` | string[] | no (may be `[]`) | 2–5 short phrases: `"Steep bump skiing"`, `"Learning to ski without a second mortgage"`. Rendered as chips, so keep them under ~40 characters. |
| `watchOutFor` | string[] | no (may be `[]`) | 2–5 short phrases, same length limit. The honest downsides. A resort with an empty `watchOutFor` almost certainly hasn't been thought about hard enough, so the validator warns on it. |

`keyTrails` is an array of objects rather than an array of names because a bare trail name is
useless to somebody who has never skied there — the whole value is in the note.

---

## 9. `reviews` — array

What *other* people say, summarized in our own words with a link out. **Never store the
source's sentences.** `gist` is our summary of their take — not a quotation, and not a
paraphrase close enough to be one.

| field | type | null? | notes |
|---|---|---|---|
| `source` | string | **no** | Publication or community: `Storm Skiing Journal`, `ZRankings`, `r/skiing`. |
| `url` | string (URL) | **no** | Direct link to the specific piece, not the site root. |
| `gist` | string | **no** | 1–3 sentences, our words, summarizing their take. |
| `rating` | number \| null | yes | Only where the source publishes a numeric rating. Never derive one. |
| `ratingScale` | number \| null | yes | The maximum of that scale (`5`, `10`, `100`). |

**Validator cross-check:** `rating` and `ratingScale` are both-or-neither, and
`0 ≤ rating ≤ ratingScale`. A rating without its scale is unrenderable.

---

## 10. `links`

Outbound URLs. All `https://`, all pointing at the resort or the named platform.

| field | type | null? | notes |
|---|---|---|---|
| `officialSnowReport` | string \| null | yes | The conditions page. This is the **fallback target** whenever a snow adapter fails or hasn't been written yet, so it matters more than it looks — the UI links here rather than showing nothing. |
| `trailMap` | string \| null | yes | The resort's own hosted trail map (PDF or image). |
| `webcams` | string \| null | yes | |
| `lodging` | string \| null | yes | The resort's own lodging page, not a booking aggregator. |
| `twitter` | string \| null | yes | Full profile URL. |
| `instagram` | string \| null | yes | Full profile URL. |

> **Hard rule.** No field anywhere in a resort file may reference `private/` or any local
> filesystem path. `private/trail-maps/` holds personal-use downloads and is gitignored,
> undeployed and unreferenced. `links.trailMap` always points at the resort's own URL.
> `tools/validate.mjs` fails on any occurrence of the string `private/` in a resort file, and
> on any `file://` or relative-path URL.

---

## 11. `meta`

| field | type | null? | notes |
|---|---|---|---|
| `sources` | object[] | no (may be `[]`) | Every source consulted, including ones backing a single `tidbit` or a claim in the editorial. `{ "label": string, "url": string, "accessedOn": "YYYY-MM-DD" }`. |
| `verifiedOn` | string (`YYYY-MM-DD`) | **no** | When the record as a whole was last checked end to end. Must be ≥ every group-level `verifiedOn` — if you re-verified a group, you had the file open. |
| `lastEditedBy` | string | **no** | `"claude-code"` or a person's name. A human-review flag for the editorial voice, not a byline shown on the site. |

`meta.sources` is an array of objects rather than bare URLs because six months later a naked
URL doesn't say what it was used for, and a dead link with a label is still recoverable.

---

## 12. `fieldNotes` — why a field is empty

A bare `null` says "we have no value". It cannot say whether anybody looked, and after eight
resorts it was `null` in the same eight places every time — `nightSkiing`, the dynamic ticket
prices, the glade acreage nobody publishes. Those are not the same kind of gap as a figure we
simply have not researched yet, and treating them alike turns `UNVERIFIED.md` into a worklist
full of rows that can never be closed.

`fieldNotes` is an optional map from a **dotted field path** to a record explaining the
emptiness:

```json
"fieldNotes": {
  "size.nightSkiing": {
    "status": "absent",
    "source": "https://www.vermontlifttickets.com/night-skiing/",
    "verifiedOn": "2026-08-24",
    "note": "Vermont's published night-skiing list does not include this resort"
  },
  "terrain.glades": {
    "status": "unpublished",
    "checkedOn": "2026-08-24",
    "note": "Glades exist but no acreage or count is published anywhere citable"
  },
  "pricing.advanceTypical": {
    "status": "unpublished",
    "checkedOn": "2026-08-24",
    "note": "Dynamic pricing; no window or advance rate published"
  }
}
```

### The three statuses

| status | meaning | scalar must be | requires |
|---|---|---|---|
| `absent` | Checked, and the resort genuinely does not have this. | `false` or `0` — **not** `null` | `source` **and** `verifiedOn` |
| `unpublished` | It exists, or may exist, but no citable source states it. | `null` | `checkedOn` (`source` optional) |
| `seasonal` | Cannot be known outside the ski season. | `null` | `checkedOn` |

**`absent` is the important one.** It is the only status that changes the data: the field
stops being `null` and becomes a real `false` or `0`, because we can now assert the negative.
"This mountain has no night skiing" is a fact a visitor wants, and it should render as a
sentence, not as a missing row. It therefore demands a source — the same standard as any
positive claim. An unsourced hunch that a resort lacks something is not `absent`, it is
`unpublished`.

**`unpublished` is a finished state, not a backlog item.** Once a resort's dynamic pricing has
been confirmed as unpublishable, no amount of further research fixes it. `UNVERIFIED.md`
separates these into their own table so the research worklist stays honest about what is
actually left to do.

### Rules

- The path must resolve to a real field: `group.field` for the object groups, `passes[0].field`
  or `reviews[0].field` for array entries, or a bare `reviews` / `passes` for an empty array.
- Do **not** write a `fieldNote` for something you did not actually check. A field you have not
  investigated belongs in the unknown table, and inventing a status to empty that table defeats
  the purpose of having it.
- `note` is optional but almost always worth writing. It is what stops the next person
  re-researching a dead end.

---

## 13. `dataDisputes` — where we think the resort is wrong

This site exists to be more honest than the marketing copy, so it will sometimes disagree with
a resort's own published figure. That disagreement used to live in whatever sentence the
editorial happened to contain. It is now structured and rendered.

```json
"dataDisputes": [
  {
    "field": "terrain.percentAdvanced",
    "resortClaim": 30,
    "independentClaim": 21,
    "independentSource": "https://www.onthesnow.com/vermont/okemo-mountain-resort/ski-resort",
    "note": "Okemo's own figure is generous; the independent breakdown is 33/38/21/9 and the ratings run soft by Vermont standards"
  }
]
```

| field | type | notes |
|---|---|---|
| `field` | string | Dotted path to the disputed field. Must resolve, same rules as `fieldNotes`. |
| `resortClaim` | number \| string | What the resort says. **Must equal the value actually stored at `field`** — the validator enforces this, so the dispute cannot drift out of step with the data. |
| `independentClaim` | number \| string | What the independent source says. |
| `independentSource` | string (URL) | Who says otherwise. Required — a dispute without a counter-source is just an opinion, and opinions belong in `editorial`. |
| `note` | string | Why we think the resort's figure is generous, and what a reader should take from it. |

**The resort's own figure stays in the data field.** We do not quietly substitute a number we
prefer; that would make the dataset unauditable and would be exactly the behaviour this site
criticises. The resort's claim is what it publishes, and the disagreement sits beside it where
a reader can weigh both. `resort.html` renders these as a labelled callout next to the relevant
figure, never buried in prose.

Use this sparingly. It is for figures where an independent source materially contradicts the
resort — not for every rounding difference.

---

## 14. `moguls`

Bumps used to be `terrain.moguls`, a boolean, which could not answer the only question
anybody actually asks about them: *which trail*. "Does Outer Limits still bump up" has a
real answer and the schema should carry it.

| field | type | null? | notes |
|---|---|---|---|
| `presence` | string | **no** | One of `signature` `common` `occasional` `rare` `none`. `signature` means bumps are a defining feature of the mountain, not merely present. `none` requires a `policy` explaining why, which in practice means a mountain that grooms everything nightly. |
| `policy` | string \| null | yes | What the mountain actually *does*: which pods or trails are left ungroomed as policy, whether bumps are seeded or purely skier-formed, whether anything gets groomed away midweek. |
| `namedRuns` | object[] | no (may be `[]`) | The specific trails that bump up. See below. This is the field people come for. |
| `quality` | string \| null | yes | Editorial on the bumps themselves - shape, spacing, line consistency, whether the troughs go to ice, how they survive a weekend. Be willing to say bumps are bad. |
| `bestTiming` | string \| null | yes | When they are actually good: spring corn, a few days after a storm, late season, weekends once skier traffic has built them. |
| `bumpCulture` | string \| null | yes | Is there a scene? Comps, a local crew that maintains a line. Killington's Bear Mountain Mogul Challenge is the obvious example; **most mountains have nothing and should say so.** |
| `source` | string (URL) | **no** | |
| `verifiedOn` | string (`YYYY-MM-DD`) | **no** | |
| `fieldSources` | object | no (may be `{}`) | Per-field overrides; see 1.2. |

Each `namedRuns` entry:

| field | type | notes |
|---|---|---|
| `name` | string | The trail as the mountain names it. |
| `difficulty` | string | `green` `blue` `black` `double-black` `triple-black`. |
| `reliability` | string | `reliable` - bumps up most of the season. `late-season` - only once the base is deep or spring arrives. `variable` - depends on grooming decisions and snow. |
| `note` | string | One line on character. Steep and troughed, wide and rhythmic, scraped by noon. |

**Researching this is not like researching the stat block.** Marketing pages do not tell
you where the bumps are. Three sources that do, in order:

1. **The daily grooming report.** A resort publishes which trails were groomed last night;
   the ungroomed ones are where bumps form. This is the single most objective source for
   `namedRuns` - and it is dormant all summer, so anything sourced outside the season is
   provisional and belongs in `SEASONAL.md` for re-verification in January.
2. **Trail descriptions** on the resort's own trail list. "Left natural", "ungroomed",
   "bump run" are citable phrases.
3. **Forum and skier consensus** - AlpineZone, r/skiing, r/icecoast. Attribute as skier
   consensus, never as resort fact, and never quote it directly. This is where the honest
   assessment of bump *quality* lives, and there is nowhere else to get it.

---

## 15. `parks`

| field | type | null? | notes |
|---|---|---|---|
| `count` | integer | yes | Number of distinct parks. `0` is a real value and needs a `fieldNotes` entry with status `absent` - a mountain that runs no park is information people want. `null` means nobody publishes a count. |
| `parks` | object[] | no (may be `[]`) | One entry per park. See below. |
| `pipe` | boolean | yes | Halfpipe or superpipe present. A mountain that **used to** have one and dropped it records `false` plus an `absent` fieldNote - that is a fact worth stating, not an omission. |
| `pipeType` | string \| null | yes | `halfpipe` or `superpipe`. |
| `pipeSpecs` | string \| null | yes | Dimensions as published: `"200 ft long, 18 ft walls"`. |
| `nightPark` | boolean | yes | Is any park lit. |
| `progression` | string \| null | yes | Is there a real beginner-to-advanced ladder, an airbag, a Woodward-branded facility, coaching. |
| `rebuildCadence` | string \| null | yes | How often features are reset. **The difference between a good park and a bad one is almost entirely maintenance**, so this matters more than the feature count. |
| `overview` | string \| null | yes | Editorial: who this park is actually for. |
| `reputation` | string \| null | yes | Where it sits regionally, honestly. Most New England parks are mediocre and a guide that says so is more useful than one that doesn't. |
| `source` | string (URL) | **no** | |
| `verifiedOn` | string (`YYYY-MM-DD`) | **no** | |
| `fieldSources` | object | no (may be `{}`) | |

Each `parks` entry:

| field | type | notes |
|---|---|---|
| `name` | string | |
| `size` | string | `progression` `small` `medium` `large`. |
| `level` | string | Intended ability, in the mountain's own terms. |
| `jibs` `jumps` `boxes` `rails` | integer \| null | Approximate counts where published. Null is normal - most resorts publish none. |
| `largestJumpFt` | integer \| null | |
| `note` | string | Character, and where it is on the hill. |

**Why `pipe` is a flat boolean** rather than a nested object: `parks.pipe` has to be a legal
`fieldNotes` path so the dropped-pipe case can be recorded as `absent` (12), and
`parseFieldPath()` resolves `group.field` only.

**Sources for parks are much better than for bumps** - parks get marketed hard. The
resort's own park page is usually good, Woodward pages cover the Vail properties, and
Newschoolers and Snowboarder cover the bigger operations. Use forum consensus for the one
thing the resort will not tell you: whether the published feature list matches what is
actually built on the hill this week.

---

## 16. Complete example

Values below are **illustrative placeholders**, not verified data. Do not copy them into a
real resort file.

```json
{
  "schemaVersion": 3,
  "identity": {
    "slug": "example-mountain",
    "name": "Example Mountain",
    "aka": ["The Example"],
    "state": "VT",
    "region": "Southern Vermont",
    "town": "Exampleville",
    "lat": 43.1234,
    "lon": -72.8765,
    "website": "https://www.example.com"
  },
  "size": {
    "verticalDrop": 1800,
    "skiableAcres": 400,
    "trailCount": 60,
    "liftCount": 8,
    "longestRun": 2.4,
    "summitElevation": 3200,
    "baseElevation": 1400,
    "annualSnowfallAvg": 180,
    "snowmakingPercent": 85,
    "nightSkiing": false,
    "source": "https://www.example.com/mountain-stats",
    "verifiedOn": "2026-08-20",
    "fieldSources": {}
  },
  "terrain": {
    "percentBeginner": 20,
    "percentIntermediate": 45,
    "percentAdvanced": 25,
    "percentExpert": 10,
    "glades": true,
    "difficultyNotes": "Resort publishes a four-tier breakdown; the acreage figure includes glades.",
    "source": "https://www.example.com/trails",
    "verifiedOn": "2026-08-20",
    "fieldSources": {}
  },
  "passes": [
    {
      "name": "Indy Pass",
      "type": "indy",
      "access": "2 days",
      "blackouts": "Dec 26 - Jan 1",
      "verifiedOn": "2026-08-20",
      "source": "https://www.indyskipass.com/resorts/example-mountain"
    }
  ],
  "pricing": {
    "windowTicketAdultHigh": 129,
    "windowTicketAdultLow": 69,
    "advanceTypical": 89,
    "seasonPassAdult": 749,
    "currency": "USD",
    "notes": "2026-27 rates; early-bird pricing through Sept 30.",
    "verifiedOn": "2026-08-20",
    "source": "https://www.example.com/tickets"
  },
  "editorial": {
    "overview": "...",
    "snowQuality": "...",
    "crowds": "...",
    "difficulty": "...",
    "keyTrails": [
      { "name": "The Example Chute", "note": "..." }
    ],
    "tidbits": ["..."],
    "bestFor": ["Steep bump skiing"],
    "watchOutFor": ["Wind holds on the summit quad"]
  },
  "reviews": [
    {
      "source": "Storm Skiing Journal",
      "url": "https://www.stormskiing.com/p/example",
      "gist": "...",
      "rating": null,
      "ratingScale": null
    }
  ],
  "links": {
    "officialSnowReport": "https://www.example.com/conditions",
    "trailMap": "https://www.example.com/trail-map.pdf",
    "webcams": "https://www.example.com/webcams",
    "lodging": "https://www.example.com/stay",
    "twitter": null,
    "instagram": "https://www.instagram.com/examplemountain"
  },
  "meta": {
    "sources": [
      {
        "label": "Example Mountain mountain stats",
        "url": "https://www.example.com/mountain-stats",
        "accessedOn": "2026-08-20"
      }
    ],
    "verifiedOn": "2026-08-20",
    "lastEditedBy": "claude-code"
  },
  "fieldNotes": {
    "size.nightSkiing": {
      "status": "absent",
      "source": "https://www.example.com/mountain-stats",
      "verifiedOn": "2026-08-20",
      "note": "No night operation listed"
    }
  },
  "dataDisputes": [],
  "moguls": {
    "presence": "common",
    "policy": "The Example Chute and the trails either side of it are left ungroomed as policy; everything else is groomed nightly.",
    "namedRuns": [
      {
        "name": "The Example Chute",
        "difficulty": "double-black",
        "reliability": "reliable",
        "note": "Steep, narrow and troughed by mid-morning on a weekend."
      }
    ],
    "quality": "...",
    "bestTiming": "...",
    "bumpCulture": "No comps and no organised scene.",
    "source": "https://www.example.com/trails",
    "verifiedOn": "2026-08-20",
    "fieldSources": {}
  },
  "parks": {
    "count": 1,
    "parks": [
      {
        "name": "Example Park",
        "size": "medium",
        "level": "Intermediate to advanced",
        "jibs": null,
        "jumps": 4,
        "largestJumpFt": 40,
        "boxes": 3,
        "rails": 6,
        "note": "Off the main quad, rebuilt weekly."
      }
    ],
    "pipe": false,
    "pipeType": null,
    "pipeSpecs": null,
    "nightPark": false,
    "progression": "...",
    "rebuildCadence": "...",
    "overview": "...",
    "reputation": "...",
    "source": "https://www.example.com/parks",
    "verifiedOn": "2026-08-20",
    "fieldSources": {}
  }
}
```

---

## 17. Generated files — do not hand-edit

### `data/index.json`

Written by `tools/build-index.mjs`. A manifest for the list pages: enough to render the
comparison table, the cards, the filters and the map without fetching 45 files, and nothing
more. Editorial prose is deliberately excluded — it is the bulk of a resort file and no list
page shows it.

```json
{
  "generatedAt": "2026-08-20T12:00:00.000Z",
  "schemaVersion": 3,
  "count": 1,
  "resorts": [
    {
      "slug": "example-mountain",
      "name": "Example Mountain",
      "aka": ["The Example"],
      "state": "VT",
      "region": "Southern Vermont",
      "town": "Exampleville",
      "lat": 43.1234,
      "lon": -72.8765,
      "website": "https://www.example.com",
      "verticalDrop": 1800,
      "skiableAcres": 400,
      "trailCount": 60,
      "liftCount": 8,
      "annualSnowfallAvg": 180,
      "snowmakingPercent": 85,
      "nightSkiing": false,
      "passTypes": ["indy"],
      "passes": [{ "name": "Indy Pass", "type": "indy", "access": "2 days" }],
      "advanceTypical": 89,
      "seasonPassAdult": 749,
      "mogulPresence": "common",
      "parkCount": 2,
      "hasPark": true,
      "hasPipe": false,
      "bestFor": ["Steep bump skiing"],
      "officialSnowReport": "https://www.example.com/conditions",
      "verifiedOn": "2026-08-20"
    }
  ]
}
```

`passTypes` is a flattened, de-duplicated list of `passes[].type`, precomputed so the index
page's pass filter is a set-membership test rather than a nested scan on every keystroke.
`mogulPresence`, `parkCount`, `hasPark` and `hasPipe` are flattened out of §14 and §15 for
the same reason: the Features filters run on every keystroke and should not walk a nested
object to do it. `hasPark` is `null` rather than `false` when `parks.count` is unsourced,
because "no park" and "we do not know" are different answers and the filter must not treat
them alike.

`aka` carries the former and alternate names from §6. It is in the manifest for one page:
`404.html` matches a dead URL against resort names, and two mountains on this roster were
renamed recently enough that the old names are still the ones on the wider web — Suicide Six
is now Saskadena Six, Shawnee Peak is now Pleasant Mountain. A stale link to either should
land somewhere useful.

Resorts are sorted by `name`, so adding one produces a small, stable diff.

### `data/snow-reports.json`

Written by `tools/fetch-snow.mjs`. Numbers and short condition labels only — never prose
copied from a resort's report. Shape is defined and documented by the fetcher.

### `data/UNVERIFIED.md`

Written by `tools/validate.mjs`. One row per tracked field that is currently `null`, plus every
warning the validator raised. It is the research worklist, and it is committed so the gaps are
visible in review.

---

## 18. Checklist for adding a resort

1. Copy the shape from §12. Every key present; unknowns `null`.
2. Fill `identity` from the resort's own site. Summit coordinates, not the base lodge.
3. Fill `size` and `terrain` from the resort's stats page. If a figure isn't there, try the
   Ski&lt;State&gt; association, then OnTheSnow/ZRankings, and record which you used. If none of
   them has it, `null` — do not interpolate from a similar mountain.
4. Fill `passes` from the **pass operator's** site.
5. Fill `pricing` from a real booking page. `advanceTypical` stays `null` unless you saw it.
6. Write `editorial` last, once you know the mountain. Opinions, specifics, and at least one
   thing the resort would rather you didn't say.
7. Run `node tools/build-index.mjs && node tools/validate.mjs`, then read `data/UNVERIFIED.md`.
