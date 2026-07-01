import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFileStore } from "./file/index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-prefs-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const prefs = buildFileStore().prefs;

describe("prefs store", () => {
  it("round-trips a saved preference", async () => {
    expect(await prefs.get("U1")).toBeUndefined();
    await prefs.save("U1", { verbosity: "brief", focusDefaultMins: 45 });
    const p = await prefs.get("U1");
    expect(p?.verbosity).toBe("brief");
    expect(p?.focusDefaultMins).toBe(45);
  });

  it("patches without clobbering other fields", async () => {
    await prefs.save("U2", { verbosity: "standard", dndDefaultMins: 90 });
    await prefs.save("U2", { verbosity: "brief" });
    const p = await prefs.get("U2");
    expect(p?.verbosity).toBe("brief");
    expect(p?.dndDefaultMins).toBe(90);
  });
});
