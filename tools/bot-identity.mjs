/**
 * bot-identity.mjs - the single definition of who this bot is.
 *
 * Every outbound request this project makes to a resort's server carries this
 * User-Agent. It is not decoration and it is not boilerplate: it is the whole
 * basis on which automated fetching against somebody else's server is
 * defensible. A resort's ops team that sees unfamiliar traffic needs a name to
 * search for and a page to read, and if they want it to stop they need a way to
 * tell us rather than silently blocking the IP.
 *
 * That is why the contact URL is required configuration rather than a constant
 * somebody can forget to change. Set it before this repository goes public:
 *
 *     SKI_BOT_CONTACT_URL=https://your-site.example/about
 *
 * Locally, put it in .env (gitignored; copy .env.example). In CI it is set in
 * the workflow's env block from a repository variable.
 */

export const BOT_NAME = 'NewEnglandSkiGuideBot';
export const BOT_VERSION = '0.1';
export const BOT_PURPOSE = 'static site, snow reports';

/** Used only when SKI_BOT_CONTACT_URL is unset. Deliberately not a real host. */
export const PLACEHOLDER_CONTACT_URL = 'https://example.invalid/about';

/** True when we are running on the placeholder rather than a real contact URL. */
export const contactUrlIsPlaceholder = !process.env.SKI_BOT_CONTACT_URL;

export const CONTACT_URL = process.env.SKI_BOT_CONTACT_URL || PLACEHOLDER_CONTACT_URL;

export const USER_AGENT =
  `${BOT_NAME}/${BOT_VERSION} (+${CONTACT_URL}; ${BOT_PURPOSE})`;

let warned = false;

/**
 * Warns once per process when the contact URL is still the placeholder.
 *
 * This is a warning rather than a hard failure on purpose: a contributor
 * debugging an adapter against one page should not be blocked by configuration,
 * and CI sets the variable. If you would rather it refuse to run unconfigured,
 * call `requireRealContactUrl()` instead.
 */
export function warnIfPlaceholderContact() {
  if (!contactUrlIsPlaceholder || warned) return;
  warned = true;
  console.warn(
    `WARN  SKI_BOT_CONTACT_URL is not set, so requests identify themselves as\n` +
    `      ${USER_AGENT}\n` +
    `      example.invalid is not a real host. Set a reachable contact URL before\n` +
    `      running this against resort servers on a schedule - see README.md.`
  );
}

/** Hard stop for contexts where an unreachable contact URL is not acceptable. */
export function requireRealContactUrl() {
  if (contactUrlIsPlaceholder) {
    throw new Error(
      'SKI_BOT_CONTACT_URL is not set. Automated fetching needs a reachable ' +
      'contact URL in the User-Agent. See README.md.'
    );
  }
  return CONTACT_URL;
}
