import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildFileStore } from "../../platform/persistence/index.js";
import { exportUserData, deleteUserData } from "./user-data.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-governance-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

/**
 * The DSR (data-subject-request) guarantee, enforced by a test rather than
 * vigilance: whatever repos the `Store` grows, the export must READ every one
 * and the erasure must DELETE every one. Adding a repo to `buildFileStore`
 * without wiring it into exportUserData/deleteUserData fails this test.
 */
describe("data-governance completeness", () => {
  it("exportUserData reads from every repo; deleteUserData erases every repo", async () => {
    const store = buildFileStore();

    // Spy on every method of every repo (spies call through to the real impl).
    const spies = new Map<string, Record<string, ReturnType<typeof vi.spyOn>>>();
    for (const [name, repo] of Object.entries(store) as [string, any][]) {
      const methods: Record<string, ReturnType<typeof vi.spyOn>> = {};
      for (const m of Object.keys(repo)) methods[m] = vi.spyOn(repo, m as never);
      spies.set(name, methods);
    }

    await exportUserData(store, "U_GOV");
    for (const [name, methods] of spies) {
      const touched = Object.values(methods).some((s) => s.mock.calls.length > 0);
      expect(touched, `export never read the "${name}" repo`).toBe(true);
    }
    // The export must never DECRYPT the token — only read install metadata.
    expect(spies.get("tokens")!.get!.mock.calls.length).toBe(0);

    for (const methods of spies.values()) for (const s of Object.values(methods)) s.mockClear();

    await deleteUserData(store, "U_GOV");
    for (const [name, methods] of spies) {
      expect(methods.deleteForUser, `the "${name}" repo has no deleteForUser`).toBeDefined();
      expect(
        methods.deleteForUser!.mock.calls.length,
        `deleteUserData never erased the "${name}" repo`,
      ).toBeGreaterThan(0);
    }
  });
});
