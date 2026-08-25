/**
 * suggest.js — "did you mean" matching for dead URLs.
 *
 * Shared by 404.html and by resort.html's unknown-slug path, which are the same
 * problem arriving through two different doors: a static host serves 404.html for
 * a path it cannot match, but `resort.html?r=nonsense` is a page that exists, so
 * the host serves it happily and the renderer has to handle the miss itself.
 *
 * The matching is token overlap, not edit distance. Edit distance over whole
 * strings ranks a short slug like "pico" above the mountain somebody actually
 * typed, because it is close to almost everything.
 *
 * The important part is GENERIC. Half the ski areas in New England are called
 * Something Mountain and a quarter are Something Peak, so matching on those words
 * returns the whole roster and is worse than returning nothing — a wrong
 * suggestion costs more than a missing one, because the visitor has to read it
 * before discarding it.
 */

const GENERIC = new Set([
  'mountain', 'mountains', 'mt', 'peak', 'peaks', 'ski', 'skiing',
  'area', 'resort', 'resorts', 'the', 'of', 'and', 'at', 'a', 'an',
  'bowl', 'valley', 'ridge', 'hill', 'hills', 'park', 'center', 'centre',
  'club', 'usa', 'www', 'com', 'net', 'org', 'html', 'htm', 'index',
  'vt', 'nh', 'me', 'ma', 'ct', 'ri', 'new', 'england',
]);

// 'mount' and 'snow' are deliberately NOT in that list. Mount Snow's name is
// made of nothing else, and striking both would make the single most-linked
// mountain on the roster unmatchable while every other stale link still worked.
// 'mt' stays generic, so "mt-abram" still reduces to {abram}.

/** Distinctive words only. Everything else is noise on this roster. */
export function tokens(value) {
  return new Set(
    String(value ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1 && !GENERIC.has(t))
  );
}

/** Everything in a URL that could plausibly be a resort name. */
export function urlTokens(loc = location) {
  const wanted = new URLSearchParams(loc.search).get('r') ?? '';
  return tokens(`${decodeURIComponent(loc.pathname)} ${wanted}`);
}

function score(resort, wanted) {
  if (!wanted.size) return 0;
  let best = 0;
  for (const name of [resort.name, resort.slug, resort.town, ...(resort.aka ?? [])]) {
    const have = tokens(name);
    if (!have.size) continue;
    let hits = 0;
    for (const t of wanted) if (have.has(t)) hits += 1;
    // Harmonic mean of precision and recall. Dividing by the shorter side looks
    // right and is not: it scores a one-word alias like "Snow Bowl" a perfect 1
    // against the query "mount snow", which put Camden Snow Bowl above Mount
    // Snow for the URL /mount-snow. Penalising both unmatched query words and
    // unmatched name words is what keeps a short alias from winning.
    best = Math.max(best, (2 * hits) / (have.size + wanted.size));
  }
  return best;
}

/**
 * Up to `limit` resorts, best first. Returns [] rather than a weak guess: on a
 * roster where every third name contains "Mountain", a low threshold turns the
 * 404 page into a directory listing that pretends to be helpful.
 */
export function suggestResorts(resorts, wanted, { limit = 5, threshold = 0.7 } = {}) {
  if (!wanted?.size) return [];
  return resorts
    .map((r) => ({ r, s: score(r, wanted) }))
    .filter((x) => x.s >= threshold)
    .sort((a, b) => b.s - a.s || a.r.name.localeCompare(b.r.name, 'en'))
    .slice(0, limit)
    .map((x) => x.r);
}
