import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-surfaces-uc-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { buildContext } = await import("../context.js");
const { updateCanvas, syncCommitmentsToList, commitmentsToListItems } = await import("./surfaces.js");
const { MockRtsClient } = await import("../../platform/slack/rts/mock.js");
const { MockLlm } = await import("../../platform/ai/mock.js");
const { getMcpClients } = await import("../../platform/mcp/index.js");
const { getSlackActions } = await import("../../platform/slack/webapi/index.js");

/** A container whose Slack write-actions is a spy wrapping the real mock, so we
 * can assert exactly what the use-case sends to the port. */
function spyContainer() {
  const slack = getSlackActions({});
  const upsertCanvas = vi.spyOn(slack, "upsertCanvas");
  const syncListItems = vi.spyOn(slack, "syncListItems");
  const container = {
    rts: () => new MockRtsClient(),
    llm: () => new MockLlm(),
    slackActions: () => slack,
    mcp: () => getMcpClients(),
  };
  return { container, upsertCanvas, syncListItems };
}

describe("updateCanvas", () => {
  it("composes live triage + commitments into Markdown and upserts it (create first run)", async () => {
    const { container, upsertCanvas } = spyContainer();
    const ctx = buildContext({ subjectName: "Sam", subjectUserId: "U_canvas", container });
    const res = await updateCanvas(ctx);
    expect(res.ok).toBe(true);
    expect(res.created).toBe(true); // no stored id yet
    expect(upsertCanvas).toHaveBeenCalledOnce();
    const arg = upsertCanvas.mock.calls[0]![0];
    expect(arg.markdown).toContain("## Commitments");
    // Derived facts, never the raw message text RTS returned.
    expect(arg.markdown).not.toContain("finalized Atlas API spec by Friday");
  });

  it("edits the same canvas in place on the second run (persisted id)", async () => {
    const { container } = spyContainer();
    const ctx = buildContext({ subjectName: "Sam", subjectUserId: "U_canvas2", container });
    const first = await updateCanvas(ctx);
    expect(first.created).toBe(true);
    const second = await updateCanvas(ctx);
    expect(second.created).toBe(false);
    expect(second.canvasId).toBe(first.canvasId);
  });
});

describe("syncCommitmentsToList", () => {
  it("maps commitments to list rows carrying ONLY derived facts (no sourceText)", async () => {
    const { container, syncListItems } = spyContainer();
    const ctx = buildContext({ subjectName: "Sam", subjectUserId: "U_list", container });
    const res = await syncCommitmentsToList(ctx);
    expect(res.ok).toBe(true);
    expect(res.count).toBeGreaterThan(0);
    const items = syncListItems.mock.calls[0]![0].items;
    for (const it of items) {
      expect(it).not.toHaveProperty("sourceText");
      expect(Object.keys(it).sort()).toEqual(["counterparty", "direction", "dueText", "permalink", "status", "what"]);
    }
  });
});

describe("commitmentsToListItems", () => {
  it("drops done commitments and strips sourceText structurally", () => {
    const items = commitmentsToListItems([
      { id: "1", direction: "i_owe", counterparty: "P", what: "a", status: "open", permalink: "p1", sourceText: "RAW" },
      { id: "2", direction: "i_owe", counterparty: "P", what: "b", status: "done", permalink: "p2", sourceText: "RAW" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).not.toHaveProperty("sourceText");
    expect(items[0]!.what).toBe("a");
  });
});
