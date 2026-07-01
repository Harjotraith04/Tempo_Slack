import { describe, expect, it } from "vitest";
import type { SenderSignal } from "../../ports/store.js";
import { senderWeight, buildWeightMap, familiarity, MAX_ADJUST } from "./domain.js";

function sig(overrides: Partial<SenderSignal> = {}): SenderSignal {
  return { userId: "U1", authorId: "U_X", engaged: 0, deprioritized: 0, updatedAt: 0, ...overrides };
}

describe("senderWeight", () => {
  it("is zero with no net signal", () => {
    expect(senderWeight(sig())).toBe(0);
    expect(senderWeight(sig({ engaged: 4, deprioritized: 4 }))).toBe(0);
  });

  it("is positive when engaged, negative when deprioritized, and monotonic", () => {
    expect(senderWeight(sig({ engaged: 2 }))).toBeGreaterThan(0);
    expect(senderWeight(sig({ deprioritized: 2 }))).toBeLessThan(0);
    expect(senderWeight(sig({ engaged: 5 }))).toBeGreaterThan(senderWeight(sig({ engaged: 2 })));
  });

  it("is bounded by ±MAX_ADJUST even for extreme counts", () => {
    expect(senderWeight(sig({ engaged: 1000 }))).toBeLessThanOrEqual(MAX_ADJUST);
    expect(senderWeight(sig({ engaged: 1000 }))).toBeGreaterThan(MAX_ADJUST - 0.001);
    expect(senderWeight(sig({ deprioritized: 1000 }))).toBeGreaterThanOrEqual(-MAX_ADJUST);
  });
});

describe("buildWeightMap", () => {
  it("keys by authorId", () => {
    const m = buildWeightMap([sig({ authorId: "U_A", engaged: 3 }), sig({ authorId: "U_B", deprioritized: 3 })]);
    expect(m.get("U_A")!).toBeGreaterThan(0);
    expect(m.get("U_B")!).toBeLessThan(0);
    expect(m.get("U_UNKNOWN")).toBeUndefined();
  });
});

describe("familiarity", () => {
  it("sums total interactions; 0 for an unknown sender", () => {
    expect(familiarity(undefined)).toBe(0);
    expect(familiarity(sig({ engaged: 2, deprioritized: 1 }))).toBe(3);
  });
});
