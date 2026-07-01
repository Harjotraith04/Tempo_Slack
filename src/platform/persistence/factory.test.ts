import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isPostgresStore } from "../../config.js";
import { getStore } from "./index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-factory-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

describe("getStore factory (default posture)", () => {
  it("defaults to the file store when no DATABASE_URL / TEMPO_STORE is set", () => {
    // The zero-credential default — the Postgres driver is never even imported.
    expect(isPostgresStore()).toBe(false);
  });

  it("resolves a working file-backed Store that round-trips through the ports", async () => {
    const store = getStore();
    expect(await store.prefs.get("U_FACTORY")).toBeUndefined();
    await store.prefs.save("U_FACTORY", { maxItems: 2 });
    expect((await store.prefs.get("U_FACTORY"))?.maxItems).toBe(2);
  });

  it("returns a cached singleton", () => {
    expect(getStore()).toBe(getStore());
  });
});
