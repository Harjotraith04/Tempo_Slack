/**
 * Handoff routing (v3.2) — Tempo knowing its own boundaries. When Tempo is
 * @-mentioned (or asked) to do something outside its four capabilities, it hands
 * the work back gracefully and points to the right agent, rather than guessing.
 * This is "route work between agents in-conversation" at the level the app can
 * honestly support: a polite, honest boundary. Pure + deterministic.
 */

export interface HandoffSuggestion {
  /** The out-of-scope domain the request looks like. */
  category: string;
  /** Who to try instead. */
  suggestion: string;
  /** What Tempo *does* do, to reorient the user. */
  capabilities: string[];
}

export const TEMPO_CAPABILITIES = [
  "triage what actually needs you",
  "track the promises you made and are owed",
  "decode a message's tone and real urgency",
  "protect your focus time",
  "catch you up after time away",
];

const OUT_OF_SCOPE: { re: RegExp; category: string; suggestion: string }[] = [
  // Require request/file/book context so legit re-entry ("I had PTO, catch me
  // up") isn't mistaken for an HR request.
  { re: /\b((pto|vacation|leave|time[-\s]?off) request|request (pto|vacation|leave|time[-\s]?off)|file (my )?(pto|vacation|leave)|book (pto|vacation|leave|time off))\b/, category: "time-off / HR", suggestion: "your HR assistant (e.g. Workday)" },
  { re: /\b(expense|reimburse\w*|receipt|mileage)\b/, category: "expenses", suggestion: "your finance / expense agent" },
  { re: /\b(deploy|roll ?back|incident|pagerduty|on[-\s]?call|sev[0-3])\b/, category: "ops / on-call", suggestion: "your ops or on-call agent" },
  { re: /\b(jira|file a ticket|create a ticket|open a bug|create a bug)\b/, category: "issue tracking", suggestion: "your Jira / Linear agent" },
  { re: /\b(sql|run a query|query the (db|database)|pull a report|analytics dashboard)\b/, category: "data / analytics", suggestion: "your analytics agent" },
  { re: /\b(book a (room|meeting)|schedule a meeting|set up a meeting)\b/, category: "scheduling", suggestion: "your calendar / scheduling agent" },
];

/**
 * If a request is clearly outside Tempo's capabilities, return a graceful handoff
 * suggestion; otherwise `undefined` (Tempo should try to handle it itself).
 */
export function detectHandoff(text: string): HandoffSuggestion | undefined {
  const t = text.toLowerCase();
  for (const o of OUT_OF_SCOPE) {
    if (o.re.test(t)) return { category: o.category, suggestion: o.suggestion, capabilities: TEMPO_CAPABILITIES };
  }
  return undefined;
}
