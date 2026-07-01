import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFileStore } from "./index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-signals-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const signals = buildFileStore().signals;

describe("sender signals store", () => {
  it("accumulates engaged/deprioritized counts per (user, sender)", async () => {
    await signals.record("U1", "U_A", "engaged");
    await signals.record("U1", "U_A", "engaged");
    await signals.record("U1", "U_A", "deprioritized");
    const all = await signals.forUser("U1");
    const a = all.find((s) => s.authorId === "U_A")!;
    expect(a.engaged).toBe(2);
    expect(a.deprioritized).toBe(1);
  });

  it("forUser is scoped to the user and carries no message content", async () => {
    await signals.record("U2", "U_B", "engaged");
    await signals.record("U3", "U_C", "engaged"); // different user
    const mine = await signals.forUser("U2");
    expect(mine).toHaveLength(1);
    expect(Object.keys(mine[0]!).sort()).toEqual(["authorId", "deprioritized", "engaged", "updatedAt", "userId"]);
  });

  it("deleteForUser erases only that user's signals", async () => {
    await signals.record("U4", "U_D", "engaged");
    await signals.record("U5", "U_E", "engaged");
    await signals.deleteForUser("U4");
    expect(await signals.forUser("U4")).toEqual([]);
    expect(await signals.forUser("U5")).toHaveLength(1);
  });
});
