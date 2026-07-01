import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFileStore } from "../../platform/persistence/index.js";
import { teamLoad } from "./team.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-team-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const store = buildFileStore();

describe("teamLoad use-case", () => {
  it("aggregates the opt-in roster's counts (no identity in the result)", async () => {
    await store.metrics.record("U_A", { obligationsSurfaced: 2, focusMinutesProtected: 60 });
    await store.metrics.record("U_B", { obligationsSurfaced: 4, focusMinutesProtected: 30 });
    await store.metrics.record("U_C", { obligationsSurfaced: 6, focusMinutesProtected: 0 });

    const r = await teamLoad(store, ["U_A", "U_B", "U_C"], 3);
    expect(r.redacted).toBe(false);
    if (!r.redacted) {
      expect(r.memberCount).toBe(3);
      expect(r.totalObligations).toBe(12);
    }
    expect(JSON.stringify(r)).not.toContain("U_A");
  });

  it("redacts when fewer than the k floor have opted in", async () => {
    const r = await teamLoad(store, ["U_A", "U_B"], 3);
    expect(r.redacted).toBe(true);
  });
});
