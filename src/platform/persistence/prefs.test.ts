import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-prefs-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("prefs store", () => {
  it("round-trips a saved preference", async () => {
    const { getPrefs, savePrefs } = await import("./prefs.js");
    expect(getPrefs("U1")).toBeUndefined();
    savePrefs("U1", { verbosity: "brief", focusDefaultMins: 45 });
    const p = getPrefs("U1");
    expect(p?.verbosity).toBe("brief");
    expect(p?.focusDefaultMins).toBe(45);
  });

  it("patches without clobbering other fields", async () => {
    const { getPrefs, savePrefs } = await import("./prefs.js");
    savePrefs("U2", { verbosity: "standard", dndDefaultMins: 90 });
    savePrefs("U2", { verbosity: "brief" });
    const p = getPrefs("U2");
    expect(p?.verbosity).toBe("brief");
    expect(p?.dndDefaultMins).toBe(90);
  });
});
