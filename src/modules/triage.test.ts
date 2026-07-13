import { describe, expect, it } from "vitest";
import { MockRtsClient } from "../platform/slack/rts/mock.js";
import { MockLlm } from "../platform/ai/mock.js";
import { SAM_LAST_ACTIVE } from "../platform/slack/rts/fixtures.js";
import { runTriage } from "./triage.js";

const rts = new MockRtsClient();
const llm = new MockLlm();
const afterTs = `${SAM_LAST_ACTIVE}.000000`;

describe("runTriage", () => {
  it("surfaces the implicit eng blocker, the VP ask, and the passive-aggressive reply", async () => {
    const r = await runTriage(rts, llm, { name: "Sam", afterTs });
    const texts = r.needsYou.map((i) => i.excerpt.toLowerCase());

    expect(texts.some((t) => t.includes("blocked on the atlas migration"))).toBe(true);
    expect(texts.some((t) => t.includes("board deck") || t.includes("checklist owner"))).toBe(true);
    expect(texts.some((t) => t.includes("no rush"))).toBe(true);
  });

  it("ranks a true ACT/BLOCKER above FYI and excludes NOISE", async () => {
    const r = await runTriage(rts, llm, { name: "Sam", afterTs });
    expect(r.needsYou.length).toBeGreaterThan(0);
    expect(r.needsYou.every((i) => i.category !== "NOISE")).toBe(true);
    expect(["ACT", "BLOCKER"]).toContain(r.needsYou[0]!.category);
    expect(r.needsYou[0]!.urgency).toBeGreaterThanOrEqual(80);
  });

  it("reports how much it handled quietly", async () => {
    const r = await runTriage(rts, llm, { name: "Sam", afterTs });
    expect(r.scanned).toBeGreaterThan(r.needsYou.length);
  });

  it("carries the sender's stable authorId onto every item", async () => {
    const r = await runTriage(rts, llm, { name: "Sam", afterTs });
    expect(r.needsYou.every((i) => typeof i.authorId === "string" && i.authorId.length > 0)).toBe(true);
  });

  it("a learned per-sender adjustment re-ranks the list without changing membership", async () => {
    const base = await runTriage(rts, llm, { name: "Sam", afterTs });
    // Heavily boost whoever is currently last; they should climb the order.
    const lastSender = base.needsYou[base.needsYou.length - 1]!.authorId;
    const boosted = await runTriage(rts, llm, { name: "Sam",
      afterTs,
      senderAdjust: (id) => (id === lastSender ? 1000 : 0),
    });
    // Same items, different order: the boosted sender is now at the top.
    expect(new Set(boosted.needsYou.map((i) => i.permalink))).toEqual(
      new Set(base.needsYou.map((i) => i.permalink)),
    );
    expect(boosted.needsYou[0]!.authorId).toBe(lastSender);
  });
});
