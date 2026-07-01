# The Tempo Accessibility SDK (`@tempo/accessibility`)

The calm-UX primitives that make Tempo *assistive technology, not a bot* — extracted as a small, pure,
dependency-free surface so anyone can build **calm, neurodivergent-friendly agent UIs** on the same foundation.
Everything here is framework-agnostic (no Slack, no React, no I/O) and lives in
[`src/accessibility/`](../src/accessibility/); the public surface is its barrel (`src/accessibility/index.ts`).

## Why
Most agent UIs dump a wall of text and hope. The ~15–20% of users who are neurodivergent, plus non-native
speakers and anyone overloaded, need the opposite: ranked, plain-language, one-idea-per-line, read-aloud-able,
in their own language — and an honest confidence + caveat. These primitives encode that discipline so you
don't have to re-derive it.

## What it offers

| Primitive | Signature | What it does |
|---|---|---|
| **Preferences** | `resolveA11yPrefs(stored?) → A11yPrefs` | Merge a user's stored a11y prefs over gentle defaults (`DEFAULT_PREFS`). |
| **Verbosity** | `condense(text, "brief"\|"standard") → string` | Collapse prose to one clause for users who want less. |
| **Plain language** | `plainify(text) → string` · `applyReadingLevel(text, level)` | Turn dense punctuation (em-dash asides, `;`-lists) into short sentences — losing **no** word, number, or parenthetical. |
| **Read-aloud** | `toSpeech({intent, text}, locale) → string` | A calm, linear, **markdown-free** spoken script (for TTS / screen readers). |
| **i18n** | `t(key, locale, params?)` · `resolveLocale(prefs)` · `SUPPORTED_LOCALES` | A tiny message catalog + lookup with English fallback and `{param}` interpolation. |
| **Certification** | `auditResponse(response, a11y) → AuditIssue[]` · `isAccessible(...)` | Machine-check a response: non-empty markdown-free speech, labeled buttons, true plain language. Make accessibility a build gate. |

## Example

```ts
import {
  resolveA11yPrefs, applyReadingLevel, toSpeech, resolveLocale, auditResponse,
} from "@tempo/accessibility"; // = src/accessibility/index.js in this repo

function renderForUser(rawText: string, prefs: { readingLevel?: "plain" | "standard"; locale?: string }) {
  const a11y = resolveA11yPrefs(prefs);
  const text = applyReadingLevel(rawText, a11y.readingLevel);           // plain-language
  const speech = toSpeech({ intent: "help", text }, resolveLocale(prefs)); // localized read-aloud
  const response = { text, speech, blocks: [] };

  const issues = auditResponse(response, a11y);                          // certify before shipping
  if (issues.length) throw new Error(`inaccessible: ${issues.map((i) => i.rule).join(", ")}`);
  return response;
}
```

## Principles baked in
- **Never lose information** to simplification (plainify preserves every number/unit/parenthetical).
- **Honest** — confidence + caveat on interpretive output; never overclaim.
- **Localizable** — English is the fallback; add a locale by adding one catalog object.
- **Certifiable** — `auditResponse` is the evidence base for an accessibility conformance claim.

## Roadmap
Publish as a standalone package; add more locales and catalog coverage for visible labels; add contrast/motion
tokens for visual UIs. Contributions welcome — the goal is an ecosystem of calm agent UIs.
