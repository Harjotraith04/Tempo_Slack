import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockLlm } from "./mock.js";
import { getLlm } from "./index.js";

describe("MockLlm", () => {
  it("structured returns the per-call mock oracle verbatim", async () => {
    const llm = new MockLlm();
    const out = await llm.structured({
      system: "s",
      prompt: "p",
      schema: z.object({ n: z.number() }),
      mock: () => ({ n: 42 }),
    });
    expect(out).toEqual({ n: 42 });
  });

  it("text returns the per-call mock oracle verbatim", async () => {
    const llm = new MockLlm();
    expect(await llm.text({ system: "s", prompt: "p", mock: () => "hi" })).toBe("hi");
  });
});

describe("getLlm", () => {
  it("resolves the mock adapter in the default (no-credential) posture", async () => {
    const llm = getLlm();
    // In mock posture the oracle is returned, proving no live SDK call is made.
    const out = await llm.text({ system: "s", prompt: "p", mock: () => "oracle" });
    expect(out).toBe("oracle");
  });
});
