import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-metrics-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("metrics store (counts only)", () => {
  it("accumulates counts across calls within a week", async () => {
    const { recordMetrics, getMetrics } = await import("./metrics.js");
    const t = 1_000_000;
    recordMetrics("M1", { messagesTriaged: 12 }, t);
    recordMetrics("M1", { messagesTriaged: 3, obligationsSurfaced: 2 }, t + 100);
    recordMetrics("M1", { focusMinutesProtected: 90, itemsRecovered: 1 }, t + 200);

    const m = getMetrics("M1", t + 300)!;
    expect(m.messagesTriaged).toBe(15);
    expect(m.obligationsSurfaced).toBe(2);
    expect(m.focusMinutesProtected).toBe(90);
    expect(m.itemsRecovered).toBe(1);
  });

  it("rolls over to a fresh week after 7 days", async () => {
    const { recordMetrics, getMetrics } = await import("./metrics.js");
    const t = 2_000_000;
    recordMetrics("M2", { messagesTriaged: 100 }, t);
    const later = t + 8 * 24 * 3600; // 8 days on
    const rolled = recordMetrics("M2", { messagesTriaged: 5 }, later);
    expect(rolled.messagesTriaged).toBe(5); // old week discarded, not 105
    expect(getMetrics("M2", later)!.weekStartTs).toBe(later);
  });

  it("returns undefined for a user with no activity", async () => {
    const { getMetrics } = await import("./metrics.js");
    expect(getMetrics("M_UNKNOWN")).toBeUndefined();
  });
});
