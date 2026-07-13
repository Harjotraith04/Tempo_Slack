import { describe, expect, it } from "vitest";
import { parseFocusMinutes, routeIntent } from "./orchestrator.js";

/**
 * Regression: the demo script says "block 2 hours", and the original
 * minutes-only pattern silently ignored hours and fell back to the 90-minute
 * default — you asked for two hours and got ninety minutes, with nothing to
 * tell you it had been misread. Caught only by driving the real deployed app.
 */
describe("parseFocusMinutes", () => {
  it("understands hours — the phrasing the demo actually uses", () => {
    expect(parseFocusMinutes("block 2 hours", 90)).toBe(120);
    expect(parseFocusMinutes("block 2h of deep work", 90)).toBe(120);
    expect(parseFocusMinutes("protect 1 hour please", 90)).toBe(60);
    expect(parseFocusMinutes("give me 1.5 hrs", 90)).toBe(90);
  });

  it("still understands minutes", () => {
    expect(parseFocusMinutes("block 45 min", 90)).toBe(45);
    expect(parseFocusMinutes("block 120 minutes", 90)).toBe(120);
    expect(parseFocusMinutes("focus 25m", 90)).toBe(25);
  });

  it("falls back to the user's default when no duration is given", () => {
    expect(parseFocusMinutes("block some focus time", 90)).toBe(90);
    expect(parseFocusMinutes("protect my attention", 45)).toBe(45);
  });

  it("clamps to Slack's 5–480 bounds", () => {
    expect(parseFocusMinutes("block 900 hours", 90)).toBe(480);
    expect(parseFocusMinutes("block 1 min", 90)).toBe(5);
  });
});

/**
 * Regression: "block 2 hours" routed to HELP, not focus. The old pattern
 * required the literal phrase "block time", so the bare phrasing a user
 * actually says on camera fell through to the help menu.
 */
describe("routeIntent — focus phrasings", () => {
  it("routes the phrasings people really use", () => {
    for (const s of [
      "block 2 hours",
      "block 90 min",
      "block my calendar",
      "block time",
      "focus",
      "deep work please",
      "protect my afternoon",
      "turn on dnd",
    ]) {
      expect(routeIntent(s), s).toBe("focus");
    }
  });

  it("does NOT hijack 'blocked on', which is triage input", () => {
    expect(routeIntent("we're blocked on the Atlas spec")).not.toBe("focus");
  });
});

/** The two directions of the decoder share vocabulary; only the ownership of the
 * words differs. Their words → decode. My words → draft check. */
describe("routeIntent — decode vs draft", () => {
  it("routes their words to decode", () => {
    for (const s of ['decode: "no rush 🙂"', "what does this really mean?", "what's the tone here"]) {
      expect(routeIntent(s), s).toBe("decode");
    }
  });

  it("routes my words to the draft check", () => {
    for (const s of ['draft: "No."', "how will this land?", "is this too blunt", "rewrite this for me"]) {
      expect(routeIntent(s), s).toBe("draft");
    }
  });
});
