import { describe, expect, it } from "vitest";
import { detectHandoff, TEMPO_CAPABILITIES } from "./domain.js";

describe("handoff routing", () => {
  it("detects out-of-scope requests and names the right agent", () => {
    expect(detectHandoff("can you file my PTO request?")?.category).toBe("time-off / HR");
    expect(detectHandoff("submit this expense receipt")?.category).toBe("expenses");
    expect(detectHandoff("roll back the deploy, we have an incident")?.category).toBe("ops / on-call");
    expect(detectHandoff("open a bug in Jira for this")?.category).toBe("issue tracking");
    expect(detectHandoff("run a query on the database")?.category).toBe("data / analytics");
    expect(detectHandoff("schedule a meeting with the team")?.category).toBe("scheduling");
  });

  it("does NOT hijack Tempo's own capabilities or legit re-entry", () => {
    expect(detectHandoff("what needs me today?")).toBeUndefined();
    expect(detectHandoff("show my commitments")).toBeUndefined();
    expect(detectHandoff("block 90 min of focus time")).toBeUndefined();
    expect(detectHandoff("catch me up")).toBeUndefined();
    // "I had PTO, catch me up" is re-entry, not an HR request.
    expect(detectHandoff("I had PTO last week, catch me up")).toBeUndefined();
  });

  it("always reorients to Tempo's capabilities", () => {
    expect(detectHandoff("file a ticket")!.capabilities).toEqual(TEMPO_CAPABILITIES);
  });
});
