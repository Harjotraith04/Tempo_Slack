import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFileStore } from "./file/index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-metrics-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const metrics = buildFileStore().metrics;

describe("metrics store (counts only)", () => {
  it("accumulates counts across calls within a week", async () => {
    const t = 1_000_000;
    await metrics.record("M1", { messagesTriaged: 12 }, t);
    await metrics.record("M1", { messagesTriaged: 3, obligationsSurfaced: 2 }, t + 100);
    await metrics.record("M1", { focusMinutesProtected: 90, itemsRecovered: 1 }, t + 200);

    const m = (await metrics.get("M1", t + 300))!;
    expect(m.messagesTriaged).toBe(15);
    expect(m.obligationsSurfaced).toBe(2);
    expect(m.focusMinutesProtected).toBe(90);
    expect(m.itemsRecovered).toBe(1);
  });

  it("rolls over to a fresh week after 7 days", async () => {
    const t = 2_000_000;
    await metrics.record("M2", { messagesTriaged: 100 }, t);
    const later = t + 8 * 24 * 3600; // 8 days on
    const rolled = await metrics.record("M2", { messagesTriaged: 5 }, later);
    expect(rolled.messagesTriaged).toBe(5); // old week discarded, not 105
    expect((await metrics.get("M2", later))!.weekStartTs).toBe(later);
  });

  it("returns undefined for a user with no activity", async () => {
    expect(await metrics.get("M_UNKNOWN")).toBeUndefined();
  });
});
