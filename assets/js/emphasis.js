/**
 * emphasis.js — the editorial mini-syntax.
 *
 * Editorial fields are plain strings and always will be. Emphasis needs markup,
 * and there are three ways to get it into a JSON string field:
 *
 *   Raw HTML in the data — puts markup in the data layer, opens an injection
 *     hole, and means the validator can never say what a field contains.
 *   A highlights[] array of phrases matched at render — silently breaks the
 *     first time anybody edits the prose, and duplicates the content.
 *   A constrained inline syntax — this. Exactly two tokens, nothing else.
 *
 *   **text**   the verdict: the load-bearing judgement of a passage
 *   ==text==   a named thing: a trail, lift, glade, park, peak, or a number that
 *              carries the argument
 *
 * On safety. The brief asked for escape-then-transform into an HTML string.
 * This does something stricter: it never builds an HTML string at all. The
 * parser returns a list of {type, text} pieces and the renderer turns each into
 * a DOM text node inside a `strong` or a `mark` — so resort prose is only ever
 * assigned through textContent, and there is no concatenation step in which an
 * escape could be forgotten or applied in the wrong order. `document.createElement`
 * plus `textContent` cannot produce markup no matter what the string contains,
 * which is the same guarantee escape-first was reaching for, obtained by
 * construction rather than by discipline.
 *
 * `parseEmphasis` and `stripEmphasis` are pure and are imported by
 * tools/validate.mjs and tools/check-emphasis-drift.mjs, so the browser and the
 * validator agree about what the syntax means by sharing one implementation.
 */

import { el } from './util.js';

/** The two tokens, and nothing else is ever recognised. */
export const TOKENS = [
  { open: '**', close: '**', type: 'strong' },
  { open: '==', close: '==', type: 'mark' },
];

/** Fields allowed to carry emphasis. Anywhere else a token is a mistake. */
export const EMPHASIS_FIELDS = [
  'editorial.overview',
  'editorial.snowQuality',
  'editorial.crowds',
  'editorial.difficulty',
  'editorial.keyTrails[].note',
  'moguls.policy',
  'moguls.quality',
];

/**
 * Splits a string into pieces.
 *
 * @returns {{pieces: Array<{type:'text'|'strong'|'mark', text:string, at:number}>,
 *            errors: string[]}}
 *
 * Never throws and never loses characters: on a malformed token the opener is
 * emitted as literal text and the scan continues, so a bad field still renders
 * its prose. The validator is what refuses to let a bad field exist; the
 * renderer's job is to not make a rendering problem into a blank page.
 */
export function parseEmphasis(input) {
  const text = String(input ?? '');
  const pieces = [];
  const errors = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      pieces.push({ type: 'text', text: buffer, at: i - buffer.length });
      buffer = '';
    }
  };

  while (i < text.length) {
    const token = TOKENS.find((t) => text.startsWith(t.open, i));
    if (!token) {
      buffer += text[i];
      i += 1;
      continue;
    }

    const contentStart = i + token.open.length;
    const closeAt = text.indexOf(token.close, contentStart);

    if (closeAt === -1) {
      errors.push(`unclosed "${token.open}" at character ${i}`);
      buffer += token.open;
      i = contentStart;
      continue;
    }

    const content = text.slice(contentStart, closeAt);

    if (content.length === 0) {
      errors.push(`empty "${token.open}${token.close}" at character ${i}`);
      buffer += token.open + token.close;
      i = closeAt + token.close.length;
      continue;
    }
    // No nesting, in either direction. A token inside a token is always a
    // mistake, and allowing it would mean deciding what bold-inside-mark means.
    if (TOKENS.some((t) => content.includes(t.open))) {
      errors.push(`nested token inside "${token.open}…${token.close}" at character ${i}`);
      buffer += token.open;
      i = contentStart;
      continue;
    }

    flush();
    pieces.push({ type: token.type, text: content, at: i });
    i = closeAt + token.close.length;
  }

  flush();
  return { pieces, errors };
}

/** The prose with every token removed. The form every non-prose exit must use. */
export function stripEmphasis(input) {
  return parseEmphasis(input).pieces.map((p) => p.text).join('');
}

/** True when a string carries at least one token. */
export const hasEmphasis = (input) =>
  TOKENS.some((t) => String(input ?? '').includes(t.open));

/**
 * DOM nodes for one editorial string. The only renderer; nothing else on the
 * site is allowed to turn a token into markup.
 */
export function renderEmphasis(input) {
  const { pieces } = parseEmphasis(input);
  return pieces.map((p) => {
    if (p.type === 'strong') return el('strong', {}, p.text);
    if (p.type === 'mark') return el('mark', { class: 'ne-mark' }, p.text);
    return document.createTextNode(p.text);
  });
}

/** `el('p', {}, ...)`-friendly: one paragraph of emphasised prose. */
export function emphasised(tag, props, input) {
  return el(tag, props, ...renderEmphasis(input));
}

// --- the discipline rules, shared with the validator -------------------------

const WORDS = (s) => String(s).trim().split(/\s+/).filter(Boolean);

/** Sentence boundary: terminal punctuation followed by a space. */
const SENTENCE_BREAK = /[.!?]["')\]]?\s/;

/**
 * Everything the validator needs to judge one field, computed once.
 *
 * `perWindow` is how "no more than 2 marks per paragraph" is enforced on prose
 * that has no paragraphs. Every editorial field in this repo is a single string
 * with no newlines, so a literal reading would cap a 220-word overview at two
 * marks — far stricter than the sample the rule was written against, which has
 * five in one overview. A sliding 100-word window is the same intent applied to
 * run-together prose: it stops marks clustering into a highlighter accident
 * without punishing a long field for being long.
 */
export function analyseEmphasis(input) {
  const { pieces, errors } = parseEmphasis(input);
  const marks = pieces.filter((p) => p.type !== 'text');
  const plain = pieces.map((p) => p.text).join('');
  const totalWords = WORDS(plain).length;
  const markedWords = marks.reduce((n, m) => n + WORDS(m.text).length, 0);

  // Word index of each mark, for the density window.
  const positions = [];
  let seen = 0;
  for (const p of pieces) {
    const n = WORDS(p.text).length;
    if (p.type !== 'text') positions.push(seen);
    seen += n;
  }

  let worstWindow = 0;
  for (let i = 0; i < positions.length; i += 1) {
    const inWindow = positions.filter((v) => v >= positions[i] && v < positions[i] + 100).length;
    if (inWindow > worstWindow) worstWindow = inWindow;
  }

  return {
    errors,
    marks,
    totalWords,
    markedWords,
    markedPercent: totalWords ? (markedWords / totalWords) * 100 : 0,
    worstWindow,
    /** Marks that swallow a whole sentence, which is never a phrase. */
    wholeSentence: marks.filter((m) => {
      const t = m.text.trim();
      return /[.!?]$/.test(t) && WORDS(t).length > 6;
    }),
    /** Marks that run across a sentence boundary. */
    spansSentence: marks.filter((m) => SENTENCE_BREAK.test(m.text)),
  };
}
