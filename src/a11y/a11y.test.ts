import { describe, expect, it } from "vitest";
import { condense, toSpeech } from "./index.js";
import { buildContext } from "../agent/context.js";
import { respond } from "../agent/orchestrator.js";

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
