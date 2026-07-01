import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFileStore } from "./file/index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-snoozes-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const snoozes = buildFileStore().snoozes;
const PL = "https://northwind.slack.com/archives/C1/p1";

describe("snoozes store", () => {
  it("isSuppressed is false until something is snoozed/done", async () => {
    expect(await snoozes.isSuppressed("U1", PL, 1000)).toBe(false);
  });

  it("a snooze suppresses until it expires", async () => {
    await snoozes.snooze("U2", PL, 2000);
    expect(await snoozes.isSuppressed("U2", PL, 1500)).toBe(true);
    expect(await snoozes.isSuppressed("U2", PL, 2500)).toBe(false);
  });

  it("mark done suppresses indefinitely", async () => {
    await snoozes.markDone("U3", PL);
    expect(await snoozes.isSuppressed("U3", PL, 1)).toBe(true);
    expect(await snoozes.isSuppressed("U3", PL, 999_999_999)).toBe(true);
  });

  it("active only returns this user's still-active records", async () => {
    await snoozes.snooze("U4", "https://a/1", 7000); // active at nowTs=6000
    await snoozes.snooze("U4", "https://a/2", 100); // already expired by nowTs=6000
    await snoozes.markDone("U4", "https://a/3"); // always active
    await snoozes.snooze("U5", "https://a/4", 7000); // different user, excluded

    const active = await snoozes.active("U4", 6000);
    const permalinks = active.map((s) => s.permalink).sort();
    expect(permalinks).toEqual(["https://a/1", "https://a/3"]);
  });

  it("listForUser returns all suppressions (even expired); deleteForUser erases them", async () => {
    await snoozes.snooze("U6", "https://b/1", 100); // expired by any later now
    await snoozes.markDone("U6", "https://b/2");
    expect(await snoozes.listForUser("U6")).toHaveLength(2);

    await snoozes.deleteForUser("U6");
    expect(await snoozes.listForUser("U6")).toEqual([]);
  });
});
