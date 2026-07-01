import { describe, expect, it } from "vitest";
import type { SenderSignal, UserMetrics } from "../../ports/store.js";
import { analyzeLoad } from "./load.js";

function metrics(overrides: Partial<UserMetrics> = {}): UserMetrics {
  return {
    userId: "U1",
    messagesTriaged: 0,
    obligationsSurfaced: 0,
    focusMinutesProtected: 0,
    itemsRecovered: 0,
    weekStartTs: 0,
    updatedAt: 0,
    ...overrides,
  };
}
const sig = (deprioritized: number): SenderSignal => ({
  userId: "U1",
  authorId: "U_X",
  engaged: 0,
  deprioritized,
  updatedAt: 0,
});

describe("analyzeLoad", () => {
  it("reads calm when there's little going on", () => {
    const a = analyzeLoad(metrics({ messagesTriaged: 10, obligationsSurfaced: 1 }), []);
    expect(a.level).toBe("calm");
    expect(a.suggestion).toBeUndefined();
  });

  it("reads heavy when obligations pile up with no focus protected, and suggests focus", () => {
    const a = analyzeLoad(metrics({ obligationsSurfaced: 9, messagesTriaged: 80, focusMinutesProtected: 0 }), [sig(4)]);
    expect(a.level).toBe("heavy");
    expect(a.drivers.length).toBeGreaterThan(0);
    expect(a.drivers.some((d) => /obligations/.test(d))).toBe(true);
    expect(a.suggestion).toMatch(/focus/i);
  });

  it("protecting focus time relieves load", () => {
    const busy = analyzeLoad(metrics({ obligationsSurfaced: 6, messagesTriaged: 40 }), []);
    const relieved = analyzeLoad(metrics({ obligationsSurfaced: 6, messagesTriaged: 40, focusMinutesProtected: 180 }), []);
    expect(relieved.score).toBeLessThan(busy.score);
  });

  it("suggests batching (not focus) when the user already protects time", () => {
    const a = analyzeLoad(metrics({ obligationsSurfaced: 8, focusMinutesProtected: 120 }), [sig(6)]);
    expect(a.level).not.toBe("calm");
    expect(a.suggestion).toMatch(/batch/i);
  });

  it("handles a brand-new user with no metrics", () => {
    expect(analyzeLoad(undefined, []).level).toBe("calm");
  });
});
