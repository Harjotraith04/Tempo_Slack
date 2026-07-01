/**
 * Accessibility utilities — the part that makes Tempo assistive tech, not a bot.
 *
 *  - Verbosity: some users want one line, others want context. `condense`
 *    collapses Tempo's prose to the chosen reading load.
 *  - Read-aloud: `toSpeech` turns a Tempo response into a calm, linear spoken
 *    script for screen-reader / TTS users and anyone who processes audio better
 *    than a wall of Block Kit.
 *
 * Per-user preferences live alongside tokens (db/prefs in production); defaults
 * below are deliberately gentle.
 */

import { t, resolveLocale, type Locale } from "./i18n/index.js";
export { t, resolveLocale, SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "./i18n/index.js";
export { auditResponse, isAccessible, type AuditIssue } from "./audit.js";

export type Verbosity = "brief" | "standard";
export type ReadingLevel = "plain" | "standard";

const KNOWN_INTENTS = new Set(["triage", "commitments", "catchup", "focus", "decode", "team", "help"]);

export interface A11yPrefs {
  verbosity: Verbosity;
  readingLevel: ReadingLevel;
  readAloud: boolean;
  maxItems: number;
}

export const DEFAULT_PREFS: A11yPrefs = {
  verbosity: "standard",
  readingLevel: "plain",
  readAloud: false,
  maxItems: 3,
};

/** Merges a user's stored prefs (db/prefs.ts) over the defaults — any field
 * the user hasn't set yet falls back gently rather than erroring. */
export function resolveA11yPrefs(stored?: {
  verbosity?: Verbosity;
  readingLevel?: ReadingLevel;
  readAloud?: boolean;
  maxItems?: number;
}): A11yPrefs {
  return {
    verbosity: stored?.verbosity ?? DEFAULT_PREFS.verbosity,
    readingLevel: stored?.readingLevel ?? DEFAULT_PREFS.readingLevel,
    readAloud: stored?.readAloud ?? DEFAULT_PREFS.readAloud,
    maxItems: stored?.maxItems ?? DEFAULT_PREFS.maxItems,
  };
}

/** Collapse multi-sentence prose to its first clause for "brief" mode. */
export function condense(text: string, verbosity: Verbosity): string {
  if (verbosity === "standard") return text;
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return first.replace(/[—–-].*$/, "").trim();
}

/**
 * "Plain language" reading level: shorter, simpler sentences without losing any
 * information. We only turn dense punctuation (em/en-dash asides, semicolon
 * lists) into separate short sentences — every word, number, and parenthetical
 * is preserved, so "45 min" and "(why this matters)" survive untouched.
 */
export function plainify(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ". ") // asides → their own short sentence
    .replace(/\s*;\s*/g, ". ") // list joins → short sentences
    .replace(/\.\s*\.\s*/g, ". ") // collapse any doubled periods
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Applies the user's reading level to a piece of prose. */
export function applyReadingLevel(text: string, level: ReadingLevel): string {
  return level === "plain" ? plainify(text) : text;
}

export interface SpeechInput {
  intent: string;
  text: string;
}

/** A calm, linear spoken script — localized, no markdown, no list noise. */
export function toSpeech(input: SpeechInput, locale: Locale = "en"): string {
  const leadKey = KNOWN_INTENTS.has(input.intent) ? `speech.lead.${input.intent}` : "speech.lead.fallback";
  const opener = t(leadKey, locale);
  // Read-aloud must be plain: turn list joins into sentences and strip ALL
  // markdown so a screen reader / TTS never speaks "asterisk" or "greater-than".
  const body = input.text.replace(/\s*;\s*/g, ". ").replace(/[*_>#`~]/g, "");
  return `${opener} ${body} ${t("speech.outro", locale)}`;
}
