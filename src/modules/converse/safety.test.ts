/**
 * The crisis matcher has two failure modes, and both are real harm:
 *
 *  1. MISSING a genuine crisis — the worst outcome, full stop.
 *  2. FALSE-POSITIVE on ordinary work stress — lecturing a merely-exhausted
 *     person about suicide hotlines is patronising, it breaks trust, and it
 *     teaches them not to talk to Tempo honestly. In an app whose entire pitch
 *     is "safe for people who are struggling", that is not a small bug.
 *
 * Both directions are pinned here. The false-positive suite is as important as
 * the true-positive one — that's the point.
 */

import { describe, expect, it } from "vitest";
import { isCrisis, CRISIS_RESPONSE, CRISIS_SPEECH } from "./safety.js";

describe("catches unambiguous crisis language", () => {
  const CRISIS = [
    "i want to kill myself",
    "I've been thinking about hurting myself",
    "I think I want to die",
    "I'm suicidal",
    "thinking about suicide",
    "I don't want to be here anymore",
    "everyone would be better off without me",
    "there's no point in living",
    "I've been self-harming again",
    "I don't want to wake up tomorrow",
  ];
  for (const t of CRISIS) {
    it(`flags: "${t}"`, () => expect(isCrisis(t)).toBe(true));
  }
});

describe("does NOT flag ordinary workplace hyperbole", () => {
  // Every one of these is something a stressed but safe person says at work.
  // Answering any of them with a hotline card would be a failure.
  const NOT_CRISIS = [
    "this deadline is killing me",
    "that meeting killed me",
    "my commute is murder",
    "I'm dying to go home",
    "I'm dead tired",
    "just shoot me, another standup",
    "this backlog is killing me slowly",
    "I could just die of embarrassment",
    "we're killing it this quarter",
    "I'm dying of laughter",
    "my inbox is killing me",
  ];
  for (const t of NOT_CRISIS) {
    it(`ignores: "${t}"`, () => expect(isCrisis(t)).toBe(false));
  }
});

describe("does NOT flag genuine-but-non-crisis distress", () => {
  // These SHOULD get the warm, supportive path — not the crisis card.
  // Tempo can actually help with these: protect focus, cut the firehose.
  const SUPPORT_NOT_CRISIS = [
    "I'm completely overwhelmed",
    "this week is crushing me",
    "I'm so burnt out",
    "I can't keep up with any of this",
    "I'm drowning in messages",
    "I'm really anxious about the launch",
    "I feel like I'm failing at everything",
    "my ADHD is wrecking me today",
  ];
  for (const t of SUPPORT_NOT_CRISIS) {
    it(`routes to support, not crisis: "${t}"`, () => expect(isCrisis(t)).toBe(false));
  }
});

describe("ordinary chat is never a crisis", () => {
  for (const t of ["hi", "what can you do?", "thanks!", "what needs me today?", ""]) {
    it(`ignores: "${t}"`, () => expect(isCrisis(t)).toBe(false));
  }
});

describe("REGRESSION: 'end my ___' must not fire a hotline card", () => {
  // The pattern was `end(ing)?\s+(my|it all|my own)\s*(life)?` — `(life)?` optional
  // and `\s*` matching zero, so it collapsed to "end my ANYTHING". In an
  // executive-function tool, "end my day" is one of the most ordinary things a
  // person can type, and it was answered with a suicide hotline. The single worst
  // false positive this product could produce, and no fixture caught it.
  const ORDINARY = [
    "end my day",
    "end my week",
    "I want to end my day early",
    "let's end my meeting early",
    "ending my subscription",
    "help me end my workday at 5",
  ];
  for (const t of ORDINARY) {
    it(`ignores: "${t}"`, () => expect(isCrisis(t)).toBe(false));
  }

  it("still catches the real phrasing it was meant to catch", () => {
    expect(isCrisis("I want to end my life")).toBe(true);
    expect(isCrisis("I want to end my own life")).toBe(true);
    expect(isCrisis("I want to end it all")).toBe(true);
  });
});

describe("REGRESSION: an idiom must not launder a real crisis beside it", () => {
  // The idiom check used to veto the WHOLE STRING: one bit of workplace hyperbole
  // anywhere disabled every crisis pattern in the message. Real distress is rarely
  // a clean one-liner — it arrives hedged, mid-message, wrapped in deflecting
  // humour, which is exactly the shape that defeated it. Missing a genuine crisis
  // is the worst outcome this file has, and this is how it happened.
  const COMPOUND = [
    "this deadline is killing me. honestly I want to die.",
    "I'm dying to go home but honestly I want to kill myself",
    "just shoot me, I want to end my life",
    "lol this sprint is killing me, but seriously I've been thinking about suicide",
    "I'm dead tired and I don't want to be here anymore",
  ];
  for (const t of COMPOUND) {
    it(`catches: "${t}"`, () => expect(isCrisis(t)).toBe(true));
  }

  it("still ignores the idiom when it stands alone", () => {
    // The false-positive protection must survive the fix.
    expect(isCrisis("this deadline is killing me")).toBe(false);
    expect(isCrisis("I'm dying to go home")).toBe(false);
    expect(isCrisis("just shoot me, another standup")).toBe(false);
  });

  it("scrubbing cannot fuse words into a phrase that was never written", () => {
    // Idioms are replaced with a space, not "" — otherwise removing a match
    // between "kill" and "myself" could manufacture "killmyself".
    expect(isCrisis("we're killing it, myself included")).toBe(false);
  });
});

describe("the fixed response says the right things", () => {
  it("points to an INTERNATIONAL resource, not a US-only number", () => {
    // Tempo's users are worldwide; a US hotline is useless to most of them.
    expect(CRISIS_RESPONSE).toContain("findahelpline.com");
  });

  it("is honest that Tempo is not a counsellor", () => {
    expect(CRISIS_RESPONSE.toLowerCase()).toContain("not a counsellor");
  });

  it("does not diagnose, promise, or minimise", () => {
    const t = CRISIS_RESPONSE.toLowerCase();
    for (const bad of ["you have", "you're depressed", "it'll be fine", "it will be okay", "cheer up", "calm down"]) {
      expect(t).not.toContain(bad);
    }
  });

  it("gives the user permission to drop the work", () => {
    expect(CRISIS_RESPONSE).toContain("It'll keep");
  });

  it("has a speech version with no Slack link markup (read-aloud users)", () => {
    expect(CRISIS_SPEECH).not.toContain("<");
    expect(CRISIS_SPEECH).not.toContain("|");
    expect(CRISIS_SPEECH).toContain("findahelpline.com");
  });
});
