# Snow report adapters

One file per resort: `tools/adapters/<slug>.mjs`, matching the resort's slug exactly.

Each module default-exports an async function that returns the normalized report shape
defined in `tools/fetch-snow.mjs` (`REPORT_SHAPE`). Rules:

- **Fail soft.** Return `{ ...REPORT_SHAPE, slug, status: 'error', reason }`. Never throw;
  one broken resort must not take down the run.
- **Tiers in order**, stop at the first that works, and record which in `tier`:
  1. `json` - the resort's own JSON endpoint. Always prefer it; it survives redesigns.
  2. `html` - cheerio against the public snow-report page.
  3. `browser` - Playwright, for JS-only pages. Slow; use sparingly.
- **Numbers and short labels only.** Never copy a sentence out of a resort's report.
- Set `sourceUrl` to the public report page a human can open. The UI links there.

Vail properties share a pattern, as do the Alterra and Boyne ones - write one, and the
rest of the group is nearly free.
