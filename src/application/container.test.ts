import { describe, expect, it } from "vitest";
import { createContainer } from "./container.js";

describe("createContainer", () => {
  it("resolves every outbound adapter behind the ports", () => {
    const c = createContainer();
    expect(typeof c.rts).toBe("function");
    expect(typeof c.llm).toBe("function");
    expect(typeof c.slackActions).toBe("function");
    expect(typeof c.mcp).toBe("function");
    expect(typeof c.store).toBe("function");
  });

  it("resolves a Store with all six repositories in the default (file) posture", () => {
    const store = createContainer().store();
    for (const repo of ["tokens", "prefs", "commitments", "snoozes", "metrics", "surfaces"] as const) {
      expect(store[repo]).toBeTruthy();
    }
  });

  it("resolves the mock Slack-actions adapter in the default posture (all new methods present)", async () => {
    const slack = createContainer().slackActions({});
    expect(await slack.upsertCanvas({ title: "t", markdown: "x" })).toMatchObject({ ok: true });
    expect(await slack.syncListItems({ title: "t", items: [] })).toMatchObject({ ok: true, itemsWritten: 0 });
    expect(await slack.addReminder({ text: "t", time: 1 })).toMatchObject({ ok: true });
    expect(await slack.addBookmark({ channelId: "C", title: "t", link: "x" })).toMatchObject({ ok: true });
  });

  it("resolves the mock LLM (returns the oracle, never calls a live SDK)", async () => {
    const out = await createContainer().llm().text({ system: "s", prompt: "p", mock: () => "oracle" });
    expect(out).toBe("oracle");
  });
});
