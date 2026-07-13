/**
 * The conversational fallback, and the hard gate in front of it.
 *
 * The single most important assertion in this file is that a crisis message
 * NEVER REACHES THE LLM. Not "the LLM is prompted carefully" — never reaches it.
 * A generative model can improvise, minimise, or invent a helpline that doesn't
 * exist, and the one moment you cannot afford any of that is the one moment this
 * guards. So the test spies on the port and fails if it is touched at all.
 */

import { describe, expect, it, vi } from "vitest";
import { converse } from "./service.js";
import { CRISIS_RESPONSE } from "./safety.js";
import { mockChat } from "./domain.js";
import type { LlmPort } from "./ports.js";

/** An LlmPort that fails the test if anything calls it. */
function forbiddenLlm(): LlmPort {
  return {
    structured: vi.fn(() => {
      throw new Error("the LLM must never be called on the crisis path");
    }),
    text: vi.fn(() => {
      throw new Error("the LLM must never be called on the crisis path");
    }),
  } as unknown as LlmPort;
}

/** A mock port that behaves like the real mock adapter: returns opts.mock(). */
function mockLlm(): LlmPort {
  return {
    structured: vi.fn(async (o: any) => o.mock()),
    text: vi.fn(async (o: any) => o.mock()),
  } as unknown as LlmPort;
}

describe("the crisis gate", () => {
  it("returns the fixed response WITHOUT calling the LLM", async () => {
    const llm = forbiddenLlm();
    const r = await converse("i want to kill myself", llm, { name: "Ada" });

    expect(r.crisis).toBe(true);
    expect(r.reply).toBe(CRISIS_RESPONSE);
    // The assertion this whole file exists for:
    expect(llm.structured).not.toHaveBeenCalled();
    expect(llm.text).not.toHaveBeenCalled();
  });

  it("offers no product buttons in a crisis", async () => {
    const r = await converse("I don't want to be here anymore", forbiddenLlm(), { name: "Ada" });
    // Nudging someone toward "want me to triage your inbox?" in that moment
    // would be grotesque.
    expect(r.suggest).toBe("none");
  });

  it("does NOT gate ordinary distress — that goes to the supportive path", async () => {
    // A false positive here would lecture a merely-exhausted person about
    // hotlines. That breaks trust and teaches them not to talk to Tempo honestly.
    const llm = mockLlm();
    const r = await converse("I'm completely overwhelmed this week", llm, { name: "Ada" });

    expect(r.crisis).toBe(false);
    expect(llm.structured).toHaveBeenCalled(); // it DID reach the model
    expect(r.supportive).toBe(true);
    expect(r.reply).not.toContain("findahelpline");
  });
});

describe("supportive replies are backed by an action, not a platitude", () => {
  it("offers something Tempo can actually do", async () => {
    const r = await converse("I'm so burnt out, I can't keep up", mockLlm(), { name: "Ada" });
    expect(r.supportive).toBe(true);
    // Reducing cognitive load IS the product — empathy has to cash out in an action.
    expect(r.suggest).not.toBe("none");
  });

  it("never diagnoses or promises it will be fine", async () => {
    const r = await converse("I'm drowning and anxious about everything", mockLlm(), { name: "Ada" });
    const t = r.reply.toLowerCase();
    for (const bad of ["you have", "depress", "diagnos", "it'll be fine", "it will be okay", "calm down"]) {
      expect(t).not.toContain(bad);
    }
  });
});

describe("ordinary conversation — no longer a dead-end menu", () => {
  it("greets", async () => {
    const r = await converse("hey", mockLlm(), { name: "Ada" });
    expect(r.crisis).toBe(false);
    expect(r.supportive).toBe(false);
    expect(r.suggest).toBe("triage");
  });

  it("explains what it is", async () => {
    const r = await converse("who are you?", mockLlm(), { name: "Ada" });
    expect(r.reply.toLowerCase()).toContain("executive-function");
  });

  it("answers the privacy question a judge will ask", async () => {
    const r = await converse("what do you store about me?", mockLlm(), { name: "Ada" });
    expect(r.reply.toLowerCase()).toContain("never store");
  });

  it("takes thanks gracefully without pushing a feature", async () => {
    const r = await converse("thanks!", mockLlm(), { name: "Ada" });
    expect(r.suggest).toBe("none");
  });

  it("is honest when something is outside its scope", async () => {
    const r = await mockChat("book me a flight to Berlin");
    expect(r.reply.toLowerCase()).toContain("co-pilot");
    expect(r.suggest).toBe("triage"); // ...but still opens a door
  });
});
