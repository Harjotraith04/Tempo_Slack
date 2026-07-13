import { describe, expect, it } from "vitest";
import type { RtsClient, RtsSearchResult } from "../../ports/rts.js";
import { MultiSourceRtsClient } from "./multi.js";
import { MockEmailSource, MockCalendarSource } from "./mock.js";
import { MockRtsClient } from "../slack/rts/mock.js";
import { MockLlm } from "../ai/mock.js";
import { runTriage } from "../../modules/triage.js";
import { SAM_LAST_ACTIVE } from "../slack/rts/fixtures.js";

function stubSlack(): RtsClient {
  return {
    subjectUserId: "U_SAM",
    async search(p): Promise<RtsSearchResult> {
      return {
        messages: [
          { permalink: "s1", channelId: "C1", channelName: "eng", channelType: "public_channel", authorId: "U_P", text: "slack msg", ts: "1.0" },
        ],
        users: [],
        meta: { source: "mock", query: p.query, returned: 1 },
      };
    },
  };
}

describe("MultiSourceRtsClient", () => {
  it("merges Slack + extra sources and tags each result with its origin", async () => {
    const multi = new MultiSourceRtsClient(stubSlack(), [
      { name: "email", client: new MockEmailSource() },
      { name: "calendar", client: new MockCalendarSource() },
    ]);
    const r = await multi.search({ query: "what needs me" });
    expect(new Set(r.messages.map((m) => m.source))).toEqual(new Set(["slack", "email", "calendar"]));
    expect(r.messages).toHaveLength(3);
  });

  it("keeps the primary's subjectUserId and mode", async () => {
    const multi = new MultiSourceRtsClient(stubSlack(), []);
    expect(multi.subjectUserId).toBe("U_SAM");
    expect((await multi.search({ query: "x" })).meta.source).toBe("mock");
  });

  it("dedupes by source + permalink", async () => {
    const dup: RtsClient = {
      subjectUserId: "U_SAM",
      async search(p): Promise<RtsSearchResult> {
        return {
          messages: [{ source: "email", permalink: "mailto:thread/atlas-legal", channelId: "E", channelType: "im", authorId: "x", text: "dup", ts: "1" }],
          users: [],
          meta: { source: "mock", query: p.query, returned: 1 },
        };
      },
    };
    const multi = new MultiSourceRtsClient(stubSlack(), [
      { name: "email", client: new MockEmailSource() },
      { name: "email2", client: dup },
    ]);
    const r = await multi.search({ query: "x" });
    expect(r.messages.filter((m) => m.permalink === "mailto:thread/atlas-legal")).toHaveLength(1);
  });

  it("triage grounds across sources — an email item surfaces alongside Slack", async () => {
    const multi = new MultiSourceRtsClient(new MockRtsClient(), [{ name: "email", client: new MockEmailSource() }]);
    const r = await runTriage(multi, new MockLlm(), { name: "Sam", afterTs: `${SAM_LAST_ACTIVE}.000000` });
    expect(r.needsYou.some((i) => i.source === "email")).toBe(true);
    expect(r.needsYou.some((i) => (i.source ?? "slack") === "slack")).toBe(true);
  });
});

describe("getExtraSources — flag-gated (Slack is the sole source by default)", () => {
  it("returns no extra sources unless Attention OS is enabled", async () => {
    const { getExtraSources } = await import("./index.js");
    expect(getExtraSources()).toEqual([]);
  });
});
