import { describe, expect, it } from "vitest";
import { MockRtsClient } from "./mock.js";
import { SAM_LAST_ACTIVE } from "./fixtures.js";

const client = new MockRtsClient();

describe("MockRtsClient", () => {
  it("finds the implicit eng blocker even without an @mention", async () => {
    const r = await client.search({ query: "blocked waiting on me my spec", limit: 10 });
    const hit = r.messages.find((m) => m.text.toLowerCase().includes("blocked on the atlas migration"));
    expect(hit).toBeTruthy();
    expect(hit?.channelName).toBe("eng");
  });

  it("surfaces the promise Sam made to Priya", async () => {
    const r = await client.search({ query: "i'll send promise by friday spec", limit: 10 });
    const hit = r.messages.find((m) => m.text.includes("finalized Atlas API spec by Friday"));
    expect(hit).toBeTruthy();
    expect(hit?.channelType).toBe("im");
  });

  it("respects the after filter (since last active)", async () => {
    const r = await client.search({
      query: "decision atlas ga",
      after: `${SAM_LAST_ACTIVE}.000000`,
      limit: 20,
    });
    // The leadership decision happened ~2 days ago, after last-active.
    const decision = r.messages.find((m) => m.text.includes("Aug 1"));
    expect(decision).toBeTruthy();
    // The 8-day-old promise predates last-active and must be excluded.
    const oldPromise = r.messages.find((m) => m.text.includes("finalized Atlas API spec"));
    expect(oldPromise).toBeUndefined();
  });

  it("falls back to recency when nothing scores", async () => {
    const r = await client.search({ query: "qwerty zzxx nomatch", limit: 5 });
    expect(r.messages.length).toBeGreaterThan(0);
    // Newest first.
    const ts = r.messages.map((m) => Number(m.ts.split(".")[0]));
    const sorted = [...ts].sort((a, b) => b - a);
    expect(ts).toEqual(sorted);
  });
});
