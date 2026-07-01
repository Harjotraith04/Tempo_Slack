/**
 * Accessibility certification (v3.8) — an automated audit that every Tempo
 * response must pass, so accessibility is a machine-checked gate, not a hope.
 * Pure: given a response + the user's a11y prefs, it returns the issues found
 * (empty = accessible). A test runs it across every response type.
 */

import type { A11yPrefs } from "./index.js";

export interface AuditIssue {
  rule: string;
  detail: string;
}

export function auditResponse(
  r: { text: string; speech: string; blocks: unknown[] },
  a11y: A11yPrefs,
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!r.text?.trim()) issues.push({ rule: "text", detail: "empty fallback text" });

  // Read-aloud must exist and be plain — a screen reader / TTS must never voice
  // "asterisk" or "greater-than".
  if (!r.speech?.trim()) issues.push({ rule: "speech", detail: "empty read-aloud script" });
  const md = r.speech?.match(/[*_>#`~]/);
  if (md) issues.push({ rule: "speech-plain", detail: `read-aloud script contains markdown "${md[0]}"` });

  // Every interactive button needs a screen-reader label.
  for (const b of (r.blocks ?? []) as any[]) {
    if (b?.type === "actions") {
      for (const e of b.elements ?? []) {
        if (e?.type === "button" && !(e.text?.text ?? "").trim()) {
          issues.push({ rule: "button-label", detail: "an actions button has no label" });
        }
      }
    }
  }

  // Plain reading level → one idea per sentence (no semicolon-joined runs).
  if (a11y.readingLevel === "plain" && /;/.test(r.text)) {
    issues.push({ rule: "reading-level", detail: "plain-level text still has semicolon joins" });
  }

  return issues;
}

/** Convenience: does this response pass the accessibility bar? */
export function isAccessible(
  r: { text: string; speech: string; blocks: unknown[] },
  a11y: A11yPrefs,
): boolean {
  return auditResponse(r, a11y).length === 0;
}
