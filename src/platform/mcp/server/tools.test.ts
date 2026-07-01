import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-mcp-server-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { buildContext } = await import("../../../application/context.js");
const { TEMPO_TOOLS } = await import("./tools.js");

const tool = (name: string) => TEMPO_TOOLS.find((t) => t.name === name)!;

describe("Tempo inbound MCP tools", () => {
  it("exposes exactly the four Tempo capabilities, each documented", () => {
    expect(TEMPO_TOOLS.map((t) => t.name).sort()).toEqual([
      "tempo_commitments",
      "tempo_decode",
      "tempo_focus",
      "tempo_triage",
    ]);
    for (const t of TEMPO_TOOLS) {
      expect(t.description.trim().length, t.name).toBeGreaterThan(0);
      expect(typeof t.run).toBe("function");
    }
  });

  it("tempo_triage returns ranked derived facts and NEVER a raw excerpt (Invariant 1)", async () => {
    const ctx = buildContext({ subjectName: "Sam" });
    const r = await tool("tempo_triage").run({ limit: 3 }, ctx);
    expect(r.summary.length).toBeGreaterThan(0);
    const items = r.data.needsYou as any[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    for (const i of items) {
      expect(i).toHaveProperty("category");
      expect(i).toHaveProperty("permalink");
      expect(i).not.toHaveProperty("excerpt"); // raw message content never crosses
    }
    expect(JSON.stringify(r.data)).not.toContain("blocked on the Atlas migration");
  });

  it("tempo_commitments returns derived facts only — never sourceText", async () => {
    const ctx = buildContext({ subjectName: "Sam" });
    const r = await tool("tempo_commitments").run({}, ctx);
    const cs = r.data.commitments as any[];
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(c).toHaveProperty("counterparty");
      expect(c).not.toHaveProperty("sourceText");
    }
    expect(JSON.stringify(r.data)).not.toContain("I'll send the spec by Friday");
  });

  it("tempo_decode decodes a caller-supplied message with confidence + caveat", async () => {
    const ctx = buildContext({ subjectName: "Sam" });
    const r = await tool("tempo_decode").run({ text: "No rush 🙂 whenever you get a chance.", from: "Marco" }, ctx);
    expect(r.data.impliedMeaning).toBeTruthy();
    expect(typeof r.data.confidence).toBe("number");
    expect(r.data.caveat).toBeTruthy();
  });

  it("tempo_focus plans a protected block", async () => {
    const ctx = buildContext({ subjectName: "Sam" });
    const r = await tool("tempo_focus").run({ minutes: 60 }, ctx);
    expect(r.summary.length).toBeGreaterThan(0);
    expect(Object.keys(r.data).length).toBeGreaterThan(0);
  });

  it("the inbound server is disabled by default (zero-credential path never serves)", async () => {
    const { isMcpServerEnabled } = await import("../../../config.js");
    expect(isMcpServerEnabled()).toBe(false);
  });
});
