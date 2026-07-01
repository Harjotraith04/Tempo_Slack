import { describe, expect, it } from "vitest";
import { condense, toSpeech, plainify, applyReadingLevel } from "./index.js";
import { buildContext } from "../agent/context.js";
import { respond } from "../agent/orchestrator.js";

describe("plainify (reading level: plain)", () => {
  it("breaks dense punctuation into short sentences without losing content", () => {
    const dense = "Send the spec to Priya — she's blocked; then ping Dana";
    const plain = plainify(dense);
    expect(plain).not.toContain(";");
    expect(plain).not.toContain("—");
    // Every meaningful token survives.
    for (const word of ["Send", "spec", "Priya", "blocked", "ping", "Dana"]) {
      expect(plain).toContain(word);
    }
  });

  it("preserves numbers, units, hyphenated words, and parentheticals", () => {
    const text = "Block 45 min of deep-work time (protected by Tempo)";
    const plain = plainify(text);
    expect(plain).toContain("45 min");
    expect(plain).toContain("deep-work");
    expect(plain).toContain("(protected by Tempo)");
  });

  it("applyReadingLevel only transforms for the 'plain' level", () => {
    const t = "A — B; C";
    expect(applyReadingLevel(t, "standard")).toBe(t);
    expect(applyReadingLevel(t, "plain")).toBe(plainify(t));
  });
});

describe("a11y", () => {
  it("condenses prose for brief mode", () => {
    const full = "Send the spec to Priya — she's blocked. Also ping Dana.";
    expect(condense(full, "brief").length).toBeLessThan(full.length);
    expect(condense(full, "standard")).toBe(full);
  });

  it("produces a clean spoken script with no markdown", () => {
    const s = toSpeech({ intent: "triage", text: "3 things need you: *reply to Dana*; unblock eng" });
    expect(s).not.toContain("*");
    expect(s.toLowerCase()).toContain("needs you");
    expect(s).toContain("one step at a time");
  });

  it("orchestrator attaches a read-aloud script to every response", async () => {
    const ctx = buildContext();
    const r = await respond(ctx, "what needs me today?");
    expect(r.speech.length).toBeGreaterThan(20);
  });
});
