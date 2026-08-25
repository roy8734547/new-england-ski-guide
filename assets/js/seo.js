/**
 * seo.js — the head tags that cannot be written into a static file.
 *
 * This site has no domain baked into it anywhere. That is deliberate: a
 * canonical URL or an og:url hardcoded to the wrong host is worse than none at
 * all, and this repo has been built to be deployable to any static host without
 * a find-and-replace pass. So the two tags that need an absolute URL —
 * `<link rel="canonical">` and `og:url` — are written at runtime from
 * `location`, which is the one place the real host is guaranteed to be correct.
 *
 * `sitemap.xml` is the exception; it genuinely cannot be built without knowing
 * the host, so tools/build-seo.mjs takes it as an argument.
 *
 * The rest of the Open Graph block is static in each page's <head>. Only
 * resort.html has a per-record title and description, and it sets those here.
 */

/**
 * Query parameters that identify the content rather than the view. Only
 * resort.html has one: `?r=` there names the mountain the page is about.
 *
 * compare.html also uses `?r=`, and deliberately passes `[]` instead — its
 * parameterised form is disallowed in robots.txt (45 mountains taken two to four
 * at a time is about 160,000 URLs assembled from pages already indexed
 * separately), so its canonical has to be the bare page or the two would
 * contradict each other.
 */
const DEFAULT_CANONICAL_PARAMS = ['r'];

function upsert(selector, create) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = create();
    document.head.append(node);
  }
  return node;
}

const setMeta = (property, content) => {
  if (!content) return;
  const attr = property.startsWith('og:') ? 'property' : 'name';
  const node = upsert(`meta[${attr}="${property}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute(attr, property);
    return m;
  });
  node.setAttribute('content', content);
};

/**
 * The address this page should be indexed under. Filter state (`?state=VT`,
 * `?sort=acres`, `?view=table`) is stripped — those are the same page with the
 * furniture moved, and letting each of them be its own indexable URL is how one
 * page becomes several thousand duplicates. `?r=` is kept, because on
 * resort.html and compare.html it is the content.
 */
export function canonicalUrl(loc = location, params = DEFAULT_CANONICAL_PARAMS) {
  const url = new URL(loc.href);
  const keep = new URLSearchParams();
  for (const name of params) {
    const value = url.searchParams.get(name);
    if (value) keep.set(name, value);
  }
  url.search = keep.toString();
  url.hash = '';
  return url.href;
}

/**
 * Called by every page. Safe to call again after the title changes. `params` is
 * the list of query parameters that belong in the canonical URL; pass `[]` for a
 * page whose querystring is view state rather than content.
 */
export function applyCanonical(params = DEFAULT_CANONICAL_PARAMS) {
  const href = canonicalUrl(location, params);
  upsert('link[rel="canonical"]', () => {
    const link = document.createElement('link');
    link.rel = 'canonical';
    return link;
  }).setAttribute('href', href);
  setMeta('og:url', href);
}

/**
 * Marks this page as not worth indexing. Used for the two states of resort.html
 * that are real URLs but not real content — no `?r=` at all, and a `?r=` that
 * names no mountain. robots.txt cannot express those without the `$` anchor,
 * which only some crawlers understand, and a crawler that read the anchor as a
 * literal would drop all 45 detail pages.
 */
export function setNoIndex() {
  setMeta('robots', 'noindex, follow');
}

/** Keeps og:title / og:description in step with a title set at runtime. */
export function applyPageMeta({ title, description, canonicalParams } = {}) {
  if (title) {
    document.title = title;
    setMeta('og:title', title);
    setMeta('twitter:title', title);
  }
  if (description) {
    setMeta('description', description);
    setMeta('og:description', description);
    setMeta('twitter:description', description);
  }
  applyCanonical(canonicalParams ?? DEFAULT_CANONICAL_PARAMS);
}

/**
 * schema.org SkiResort for one detail page.
 *
 * Only fields the record actually holds are emitted. A structured-data block
 * that asserts a coordinate we do not have, or an address we guessed at, is the
 * same failure as a made-up number in the table — it is just less visible,
 * which makes it worse. `null` fields are dropped, not zeroed.
 */
export function skiResortJsonLd(r, { url = canonicalUrl(), description } = {}) {
  const id = r.identity ?? {};
  const size = r.size ?? {};

  const social = [id.website, r.links?.twitter, r.links?.instagram, r.links?.facebook]
    .filter(Boolean);

  const data = {
    '@context': 'https://schema.org',
    '@type': 'SkiResort',
    name: id.name,
    url,
  };

  if (id.aka?.length) data.alternateName = id.aka.filter((n) => n && n !== id.name);
  // The trimmed description, not the whole overview. A structured-data block is
  // a summary for a machine, not a second copy of the page.
  const summary = description ?? r.editorial?.overview;
  if (summary) data.description = summary;
  if (social.length) data.sameAs = [...new Set(social)];

  if (id.town || id.state) {
    data.address = {
      '@type': 'PostalAddress',
      addressLocality: id.town ?? undefined,
      addressRegion: id.state ?? undefined,
      addressCountry: 'US',
    };
  }

  if (Number.isFinite(id.lat) && Number.isFinite(id.lon)) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: id.lat,
      longitude: id.lon,
      // Documented on the about page: every coordinate on this site is the
      // lift-served summit, not the base lodge.
      elevation: Number.isFinite(size.summitElevation)
        ? `${Math.round(size.summitElevation * 0.3048)} m`
        : undefined,
    };
  }

  if (Number.isFinite(size.trailCount) || Number.isFinite(size.liftCount)) {
    data.amenityFeature = [
      Number.isFinite(size.trailCount)
        ? { '@type': 'LocationFeatureSpecification', name: 'Trails', value: size.trailCount }
        : null,
      Number.isFinite(size.liftCount)
        ? { '@type': 'LocationFeatureSpecification', name: 'Lifts', value: size.liftCount }
        : null,
      typeof size.nightSkiing === 'boolean'
        ? { '@type': 'LocationFeatureSpecification', name: 'Night skiing', value: size.nightSkiing }
        : null,
    ].filter(Boolean);
  }

  return data;
}

/** Replaces this page's JSON-LD block, creating it on first call. */
export function applyJsonLd(data) {
  const node = upsert('script[type="application/ld+json"][data-generated]', () => {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.dataset.generated = '';
    return s;
  });
  // JSON.stringify drops `undefined` values, which is why the builder above uses
  // undefined rather than null for a field it cannot fill.
  node.textContent = JSON.stringify(data);
}
