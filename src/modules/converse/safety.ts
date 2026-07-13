/**
 * The crisis path — the one place in Tempo where the LLM is deliberately cut out.
 *
 * Tempo is built for people under cognitive strain: neurodivergent workers,
 * people burning out, people drowning in a firehose. Given that audience, someone
 * will eventually type something that isn't about Slack at all. When that happens,
 * a generative model is precisely the wrong thing to have in the loop — it can
 * improvise, minimise, moralise, or hallucinate a resource that doesn't exist.
 *
 * So this check runs BEFORE any model call and, on a match, returns fixed,
 * hand-written words. No generation. No temperature. No surprises.
 *
 * What this is NOT:
 *  - not a diagnosis, not a screening tool, not a clinical instrument
 *  - not a counsellor — Tempo says plainly that it isn't one
 *  - not a filter that refuses to talk: it stays warm, and points to real humans
 *
 * Two failure modes, both real:
 *  1. MISS a genuine crisis → the worst outcome. So the matcher is intentionally
 *     broad on unambiguous phrasings.
 *  2. FALSE-POSITIVE on ordinary work stress ("this deadline is killing me",
 *     "I'm dying to go home") → lecturing a merely-tired person about hotlines is
 *     patronising, breaks trust, and teaches them not to talk to Tempo honestly.
 *     So the patterns require genuinely unambiguous language, and the common
 *     hyperbolic idioms are explicitly excluded below.
 *
 * The tests in safety.test.ts pin BOTH directions.
 */

/**
 * Everyday workplace hyperbole. These read as distress to a naive keyword match
 * and are not. Checked first — an idiom match short-circuits to "not a crisis".
 */
const IDIOMS: RegExp[] = [
  /\b(deadline|meeting|commute|backlog|sprint|inbox|standup|this week|my boss|that email)\b[^.!?]{0,30}\b(killing|kills|murder(ing)?|death of)\b/i,
  /\bdying to\b/i, // "dying to go home", "dying to see it"
  /\b(dead|died|dying)\s+(tired|inside from|of boredom|of laughter)\b/i,
  /\bkill(ing)?\s+(it|time|the build|this|two birds)\b/i,
  /\b(i could|i'?d)\s+(just\s+)?die\b/i, // "I could just die of embarrassment"
  /\bshoot me\b/i, // "just shoot me" — exasperation
];

/**
 * Unambiguous crisis language. Deliberately conservative: each pattern should be
 * hard to produce accidentally in a work conversation.
 */
const CRISIS: RegExp[] = [
  /\b(kill|killing|hurt|harm)\s+(my ?self|myself)\b/i,
  /\bend(ing)?\s+(my|it all|my own)\s*(life)?\b/i,
  /\b(commit|committing)\s+suicide\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanting|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live|wake up)\b/i,
  /\b(no|nothing)\s+(reason|point)\s+(to|in)\s+(living|going on|being here)\b/i,
  /\bbetter\s+off\s+(without me|dead)\b/i,
  // Note the suffix group: a bare `\bself-harm\b` MISSES "self-harming", which is
  // how people actually write it. A miss here is the worst failure this file has.
  /\bself[-\s]?harm(ing|ed|s)?\b/i,
  /\b(cutting|hurting)\s+my ?self\b/i,
  /\bi\s+can'?t\s+(go on|do this any ?more|keep going)\b.*\b(live|life|alive|exist)/i,
];

/** True when the message contains unambiguous crisis language. */
export function isCrisis(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // An everyday idiom is never a crisis, even if it contains a scary word.
  if (IDIOMS.some((re) => re.test(t))) return false;
  return CRISIS.some((re) => re.test(t));
}

/**
 * The fixed response. Written once, by a human, and never generated.
 *
 * Deliberate choices:
 *  - findahelpline.com, not a US-only number: Tempo's users are worldwide, and a
 *    US hotline is useless (and alienating) to most of them.
 *  - It names what it is — a work tool, not a counsellor. Pretending otherwise
 *    would be its own kind of harm.
 *  - It does not ask probing questions. It is not equipped to handle the answers.
 *  - It does not tell the person how they feel, or that things will be fine.
 */
export const CRISIS_RESPONSE = [
  "I'm really glad you told me, and I don't want to just hand you a Slack summary right now.",
  "",
  "I'm a work tool — I'm not a counsellor, and I'm not equipped to help with this the way you deserve. But people are, and they're reachable right now:",
  "",
  "• *Find a helpline anywhere in the world:* <https://findahelpline.com|findahelpline.com>",
  "• If you're in immediate danger, please call your local emergency number.",
  "• If there's someone you trust — a friend, family, your GP — reaching out to them counts too.",
  "",
  "You don't have to sort out your inbox today. It'll keep. I'll be here when you want it.",
].join("\n");

/** Plain-text version for read-aloud (TTS) — no Slack mrkdwn link syntax. */
export const CRISIS_SPEECH = [
  "I'm really glad you told me, and I don't want to just hand you a Slack summary right now.",
  "I'm a work tool, not a counsellor, and I'm not equipped to help with this the way you deserve. But people are.",
  "You can find a helpline anywhere in the world at findahelpline.com.",
  "If you're in immediate danger, please call your local emergency number.",
  "And if there's someone you trust, reaching out to them counts too.",
  "You don't have to sort out your inbox today. It'll keep.",
].join(" ");
