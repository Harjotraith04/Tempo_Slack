import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFileStore } from "./file/index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-surfaces-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const surfaces = buildFileStore().surfaces;

describe("surface handle store", () => {
  it("stores canvas + list ids independently and merges patches", async () => {
    await surfaces.save("U1", { canvasId: "F1" });
    expect(await surfaces.getCanvasId("U1")).toBe("F1");
    expect(await surfaces.getListId("U1")).toBeUndefined();

    await surfaces.save("U1", { listId: "L1" });
    expect(await surfaces.getCanvasId("U1")).toBe("F1"); // preserved across the second patch
    expect(await surfaces.getListId("U1")).toBe("L1");
  });

  it("only ever stores ids + a timestamp (no RTS content)", async () => {
    await surfaces.save("U2", { canvasId: "F2", listId: "L2" });
    const h = (await surfaces.getHandles("U2"))!;
    expect(Object.keys(h).sort()).toEqual(["canvasId", "listId", "updatedAt", "userId"]);
  });

  it("returns undefined for an unknown user", async () => {
    expect(await surfaces.getHandles("nobody")).toBeUndefined();
  });
});
