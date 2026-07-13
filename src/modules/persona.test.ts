/**
 * Guards the invariant that Tempo has no persona of its own.
 *
 * Every module's system prompt is written for a *named* person — "classify each
 * message for the user X", "draft on behalf of X". For a long time that name was
 * hardcoded to the demo persona (Sam Rivera), which meant a real user's Slack was
 * triaged as if they were someone else and their drafts were signed in a stranger's
 * name. It ran green the whole time, because the demo fixtures ARE Sam.
 *
 * So: the prompts must be functions of the subject's name, and no prompt may
 * mention a fixture identity. This test fails the moment a persona is baked back in.
 */

import { describe, expect, it } from "vitest";
import { system as triageSystem } from "./triage/domain.js";
import { system as ledgerSystem } from "./ledger/domain.js";
import { system as reentrySystem } from "./reentry/domain.js";
import { system as draftSystem, nudgeSystem, renegotiateSystem } from "./draft/domain.js";
import { DECODE_SYSTEM, DRAFT_SYSTEM } from "./decoder/domain.js";

/** Every prompt that is written for a named subject. */
const SUBJECT_PROMPTS = {
  triage: triageSystem,
  ledger: ledgerSystem,
  reentry: reentrySystem,
  draft: draftSystem,
  nudge: nudgeSystem,
  renegotiate: renegotiateSystem,
};

/** Names from the seeded demo narrative. None may appear in a prompt. */
const FIXTURE_NAMES = ["Sam Rivera", "Sam", "Rivera", "Priya", "Marco", "Dana"];

describe("no hardcoded persona in prompts", () => {
  for (const [name, prompt] of Object.entries(SUBJECT_PROMPTS)) {
    it(`${name}: addresses the subject by the name it is given`, () => {
      const out = prompt("Ada Lovelace");
      expect(out).toContain("Ada Lovelace");
    });

    it(`${name}: leaks no fixture identity`, () => {
      const out = prompt("Ada Lovelace");
      for (const fixture of FIXTURE_NAMES) {
        expect(out).not.toMatch(new RegExp(`\\b${fixture}\\b`));
      }
    });

    it(`${name}: carries no gendered pronoun for the subject`, () => {
      // The old re-entry prompt said "the Slack activity *he* missed".
      const out = prompt("Ada Lovelace");
      expect(out).not.toMatch(/\b(he|him|his|she|her|hers)\b/i);
    });
  }

  // The decoder is deliberately persona-free — it reasons about a message, not a
  // person — so it takes no name. Assert it stays that way rather than silently
  // acquiring one.
  it("decoder prompts stay persona-free", () => {
    for (const p of [DECODE_SYSTEM, DRAFT_SYSTEM]) {
      for (const fixture of FIXTURE_NAMES) {
        expect(p).not.toMatch(new RegExp(`\\b${fixture}\\b`));
      }
    }
  });
});
