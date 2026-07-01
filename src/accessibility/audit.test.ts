import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditResponse, DEFAULT_PREFS } from "./index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-a11y-audit-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { buildContext } = await import("../application/context.js");
const { respond } = await import("../application/orchestrator.js");

const PROMPTS: [string, string][] = [
  ["triage", "what needs me today?"],
  ["commitments", "show my commitments"],
  ["catchup", "catch me up on what I missed"],
  ["focus", "block 90 minutes of focus time"],
  ["decode", 'decode: "No rush 🙂 whenever you get a chance."'],
  ["help", "what can you do?"],
  ["team", "show the team workload"],
  ["handoff", "file my expense report"],
];

describe("accessibility certification — every response passes the audit", () => {
  for (const [name, prompt] of PROMPTS) {
    it(`${name} response is accessible (speech present, markdown-free, labeled, plain)`, async () => {
      const ctx = buildContext({ subjectUserId: `U_A11Y_${name}`, subjectName: "Sam" });
      const res = await respond(ctx, prompt);
      const issues = auditResponse(res, DEFAULT_PREFS);
      expect(issues, JSON.stringify(issues)).toEqual([]);
    });
  }

  it("a Spanish user's read-aloud is localized AND still markdown-free (passes)", async () => {
    const ctx = buildContext({ subjectUserId: "U_A11Y_ES", subjectName: "Sam" });
    await ctx.store.prefs.save("U_A11Y_ES", { locale: "es" });
    const res = await respond(ctx, "what needs me today?");
    expect(res.speech).toContain("paso a paso"); // Spanish outro
    expect(auditResponse(res, DEFAULT_PREFS)).toEqual([]);
  });

  it("catches an inaccessible response (guard against false-green)", () => {
    const bad = auditResponse(
      { text: "a; b; c", speech: "read *this* aloud", blocks: [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "" } }] }] },
      DEFAULT_PREFS,
    );
    expect(bad.map((i) => i.rule).sort()).toEqual(["button-label", "reading-level", "speech-plain"]);
  });
});
