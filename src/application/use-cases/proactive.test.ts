import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-proactive-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { buildContext } = await import("../context.js");
const { buildProactiveBlocks } = await import("./proactive.js");

function text(blocks: any[]): string {
  return blocks
    .map((b) =>
      b.type === "section" ? b.text.text : b.type === "context" ? b.elements.map((e: any) => e.text).join(" ") : "",
    )
    .join("\n");
}

describe("buildProactiveBlocks", () => {
  it("surfaces an opt-in overload heads-up when the week is heavy, plus batched FYIs (derived facts only)", async () => {
    const ctx = buildContext({ subjectUserId: "U_LOADED", subjectName: "Sam" });
    await ctx.store.metrics.record("U_LOADED", { obligationsSurfaced: 9, messagesTriaged: 80 });
    for (let i = 0; i < 4; i++) await ctx.store.signals.record("U_LOADED", "U_MARCO", "deprioritized");

    const blocks = await buildProactiveBlocks(ctx);
    const t = text(blocks);
    expect(t).toContain("gentle heads-up");
    expect(t.toLowerCase()).toContain("heavy");
    expect(t).toContain("obligations");
    // The suggestion is opt-in and never an action.
    expect(t.toLowerCase()).toContain("without your tap");
    // Batched FYIs present — but no raw message excerpt ever appears.
    expect(t).toContain("batched");
    expect(t).not.toContain("blocked on the Atlas migration");
  });

  it("no overload heads-up for a calm user", async () => {
    const ctx = buildContext({ subjectUserId: "U_CALM", subjectName: "Sam" });
    expect(text(await buildProactiveBlocks(ctx))).not.toContain("gentle heads-up");
  });
});
