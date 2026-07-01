/**
 * Internationalization (v3.8) — the message catalog + lookup that makes Tempo
 * multilingual, the "non-native speaker" promise at scale. A tiny, dependency-
 * free `t()` over a per-locale catalog: the user's `locale` preference selects
 * the table, English is the fallback for any missing key, and `{param}`
 * placeholders interpolate.
 *
 * This localizes the framing Tempo controls (the read-aloud speech script, key
 * labels). Dynamic content the AI generates (item reasons, drafts) localizes on
 * the live path by prompting Claude in the user's locale; the catalog seam here
 * is what the rest of the surfaces extend into.
 */

export type Locale = "en" | "es";
export const SUPPORTED_LOCALES: Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";

type Catalog = Record<string, string>;

const EN: Catalog = {
  "speech.lead.triage": "Here's what needs you.",
  "speech.lead.commitments": "Here are your commitments.",
  "speech.lead.catchup": "Here's what you missed, calmly.",
  "speech.lead.focus": "Your focus time is protected.",
  "speech.lead.decode": "Here's what that message really means.",
  "speech.lead.team": "Here's the team, anonymized.",
  "speech.lead.help": "Here's how I can help.",
  "speech.lead.fallback": "Here's what I found.",
  "speech.outro": "Take it one step at a time. I won't do anything without your okay.",
};

const ES: Catalog = {
  "speech.lead.triage": "Esto es lo que necesita tu atención.",
  "speech.lead.commitments": "Aquí están tus compromisos.",
  "speech.lead.catchup": "Esto es lo que te perdiste, con calma.",
  "speech.lead.focus": "Tu tiempo de concentración está protegido.",
  "speech.lead.decode": "Esto es lo que ese mensaje realmente significa.",
  "speech.lead.team": "Aquí está el equipo, de forma anónima.",
  "speech.lead.help": "Así es como puedo ayudarte.",
  "speech.lead.fallback": "Esto es lo que encontré.",
  "speech.outro": "Ve paso a paso. No haré nada sin tu permiso.",
};

const CATALOG: Record<Locale, Catalog> = { en: EN, es: ES };

/** Look up a localized string, falling back to English then the key itself. */
export function t(key: string, locale: Locale = DEFAULT_LOCALE, params?: Record<string, string | number>): string {
  const raw = CATALOG[locale]?.[key] ?? CATALOG.en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? `{${name}}`));
}

/** Normalize a stored locale ("es-MX" → "es") to a supported one, else English. */
export function resolveLocale(stored?: { locale?: string }): Locale {
  const base = (stored?.locale ?? "").slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as string[]).includes(base) ? (base as Locale) : DEFAULT_LOCALE;
}
