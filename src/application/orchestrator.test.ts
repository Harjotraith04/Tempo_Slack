import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-orchestrator-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { buildContext } = await import("./context.js");
const { respond, triageAll } = await import("./orchestrator.js");

function actionsBlocks(blocks: any[]): any[] {
  return blocks.filter((b) => b.type === "actions");
}

describe("orchestrator + per-user prefs", () => {
  it("triage respects a saved maxItems instead of the hardcoded default of 3", async () => {
    const ctx = buildContext({ subjectUserId: "U_MAXITEMS", subjectName: "Sam" });
    await ctx.store.prefs.save(ctx.subjectUserId, { maxItems: 1 });

    const res = await respond(ctx, "what needs me today?");
    // One item row + (since there's more than 1 candidate in the fixtures) a "show the rest" row.
    expect(actionsBlocks(res.blocks).length).toBeLessThanOrEqual(2);
  });

  it("focus uses the saved focusDefaultMins when the input doesn't specify a duration", async () => {
    const ctx = buildContext({ subjectUserId: "U_FOCUSMINS", subjectName: "Sam" });
    await ctx.store.prefs.save(ctx.subjectUserId, { focusDefaultMins: 45 });

    const res = await respond(ctx, "block my focus time");
    expect(res.text).toContain("45 min");
  });

  it("an explicit duration in the input still wins over the saved default", async () => {
    const ctx = buildContext({ subjectUserId: "U_FOCUSMINS2", subjectName: "Sam" });
    await ctx.store.prefs.save(ctx.subjectUserId, { focusDefaultMins: 45 });

    const res = await respond(ctx, "block 20 min of focus time");
    expect(res.text).toContain("20 min");
  });

  it("triageAll ignores maxItems and returns the full live list", async () => {
    const ctx = buildContext({ subjectUserId: "U_SHOWALL", subjectName: "Sam" });
    await ctx.store.prefs.save(ctx.subjectUserId, { maxItems: 1 });

    const capped = await respond(ctx, "what needs me today?");
    const all = await triageAll(ctx);

    const cappedRows = actionsBlocks(capped.blocks).filter((b) => b.elements.some((e: any) => e.action_id !== "show_rest"));
    const allRows = actionsBlocks(all.blocks).filter((b) => b.elements.some((e: any) => e.action_id !== "show_rest"));
    expect(allRows.length).toBeGreaterThan(cappedRows.length);
    expect(actionsBlocks(all.blocks).some((b) => b.elements.some((e: any) => e.action_id === "show_rest"))).toBe(false);
  });

  it("hands off an out-of-scope request instead of guessing", async () => {
    const ctx = buildContext({ subjectUserId: "U_HANDOFF", subjectName: "Sam" });
    // "roll back the deploy" grazes the catch-up keyword "back" — must hand off.
    const res = await respond(ctx, "hey Tempo, roll back the deploy");
    expect(res.intent).toBe("help");
    expect(res.text.toLowerCase()).toContain("ops / on-call");
    const headers = res.blocks.filter((b: any) => b.type === "header").map((b: any) => b.text.text);
    expect(headers.some((h: string) => /hand it off/i.test(h))).toBe(true);
  });

  it("still handles a real catch-up request (handoff never intercepts it)", async () => {
    const ctx = buildContext({ subjectUserId: "U_CATCHUP", subjectName: "Sam" });
    const res = await respond(ctx, "I had PTO last week, catch me up");
    expect(res.intent).toBe("catchup");
  });

  it("team mode is off by default — a personal agent on personal data", async () => {
    const ctx = buildContext({ subjectUserId: "U_TEAM", subjectName: "Sam" });
    const res = await respond(ctx, "show me the team workload");
    expect(res.text.toLowerCase()).toContain("team mode is off");
  });

  it("brief verbosity condenses the fallback text", async () => {
    const ctxStandard = buildContext({ subjectUserId: "U_VERBOSE_STD", subjectName: "Sam" });
    const ctxBrief = buildContext({ subjectUserId: "U_VERBOSE_BRIEF", subjectName: "Sam" });
    await ctxBrief.store.prefs.save(ctxBrief.subjectUserId, { verbosity: "brief" });

    const standard = await respond(ctxStandard, "catch me up on what I missed");
    const brief = await respond(ctxBrief, "catch me up on what I missed");
    expect(brief.text.length).toBeLessThanOrEqual(standard.text.length);
  });
});
