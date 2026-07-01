import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-snoozes-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const PL = "https://northwind.slack.com/archives/C1/p1";

describe("snoozes store", () => {
  it("isSuppressed is false until something is snoozed/done", async () => {
    const { isSuppressed } = await import("./snoozes.js");
    expect(isSuppressed("U1", PL, 1000)).toBe(false);
  });

  it("a snooze suppresses until it expires", async () => {
    const { snoozeItem, isSuppressed } = await import("./snoozes.js");
    snoozeItem("U2", PL, 2000);
    expect(isSuppressed("U2", PL, 1500)).toBe(true);
    expect(isSuppressed("U2", PL, 2500)).toBe(false);
  });

  it("mark done suppresses indefinitely", async () => {
    const { markItemDone, isSuppressed } = await import("./snoozes.js");
    markItemDone("U3", PL);
    expect(isSuppressed("U3", PL, 1)).toBe(true);
    expect(isSuppressed("U3", PL, 999_999_999)).toBe(true);
  });

  it("activeSuppressions only returns this user's still-active records", async () => {
    const { snoozeItem, markItemDone, activeSuppressions } = await import("./snoozes.js");
    snoozeItem("U4", "https://a/1", 7000); // active at nowTs=6000
    snoozeItem("U4", "https://a/2", 100); // already expired by nowTs=6000
    markItemDone("U4", "https://a/3"); // always active
    snoozeItem("U5", "https://a/4", 7000); // different user, excluded

    const active = activeSuppressions("U4", 6000);
    const permalinks = active.map((s) => s.permalink).sort();
    expect(permalinks).toEqual(["https://a/1", "https://a/3"]);
  });
});
