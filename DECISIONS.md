# DECISIONS.md — judgement calls made during the unattended run

Every non-obvious call, one line each, with the reasoning. Policy is AUTORUN.md section 2:
(1) never guess data — null plus a fieldNotes entry; (2) CLAUDE.md wins; (3) nothing outside
the repo; (4) reversible and in-repo, just decide; (5) prefer momentum over marginal polish.

| Date | Decision | Rule | Reasoning |
|---|---|---|---|
| 2026-08-24 | Schema v3 review stop shows Okemo, not Mount Snow | 4 | Mount Snow is a Batch 2 resort and did not exist when Part A ran. Okemo is the strongest park mountain among the first 8. |
| 2026-08-24 | `parks.pipe` is a flat boolean with `pipeType`/`pipeSpecs` beside it | 4 | `parks.pipe` must be a legal `fieldNotes` path so a dropped pipe records as `absent`; `parseFieldPath()` resolves `group.field` only. |
| 2026-08-24 | Killington `parks.pipe` recorded `unpublished`, not `false` | 1 | Third-party listings cite an 18-ft modified halfpipe; the resort's own parks pages list none. Absence of mention is not a source for absence. |
| 2026-08-24 | Mad River Glen and Smugglers' Notch `parks.count` = null, not 0 | 1 | Neither publishes a terrain park page; several likely URLs 404. A guessed 0 would be fiction even though it is probably right for MRG. |
| 2026-08-24 | `terrain.percentExpert` uses `unpublished`, never `absent` | 1 | `absent` requires the scalar to become 0, and 0% expert terrain is false at a three-tier resort. The category is missing, not the terrain. |
| 2026-08-26 | Spot-check failures do not stop the run | 2 | AUTORUN.md §3b explicitly overrides the "stop and ask" instruction in BATCHES.md step 6. Log to PROGRESS.md, fix, continue. |
