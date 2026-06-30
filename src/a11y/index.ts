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

export type Verbosity = "brief" | "standard";
export type ReadingLevel = "plain" | "standard";

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

/** Collapse multi-sentence prose to its first clause for "brief" mode. */
export function condense(text: string, verbosity: Verbosity): string {
  if (verbosity === "standard") return text;
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  return first.replace(/[—–-].*$/, "").trim();
}

export interface SpeechInput {
  intent: string;
  text: string;
}

/** A calm, linear spoken script — no markdown, no list noise. */
export function toSpeech(input: SpeechInput): string {
  const lead: Record<string, string> = {
    triage: "Here's what needs you.",
    commitments: "Here are your commitments.",
    catchup: "Here's what you missed, calmly.",
    focus: "Your focus time is protected.",
    decode: "Here's what that message really means.",
    help: "Here's how I can help.",
  };
  const opener = lead[input.intent] ?? "Here's what I found.";
  const body = input.text.replace(/\s*;\s*/g, ". ").replace(/\*/g, "");
  return `${opener} ${body} Take it one step at a time. I won't do anything without your okay.`;
}
