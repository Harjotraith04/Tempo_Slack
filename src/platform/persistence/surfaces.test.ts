import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-surfaces-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { saveSurfaceHandles, getCanvasId, getListId, getSurfaceHandles } = await import("./surfaces.js");

describe("surface handle store", () => {
  it("stores canvas + list ids independently and merges patches", () => {
    saveSurfaceHandles("U1", { canvasId: "F1" });
    expect(getCanvasId("U1")).toBe("F1");
    expect(getListId("U1")).toBeUndefined();

    saveSurfaceHandles("U1", { listId: "L1" });
    expect(getCanvasId("U1")).toBe("F1"); // preserved across the second patch
    expect(getListId("U1")).toBe("L1");
  });

  it("only ever stores ids + a timestamp (no RTS content)", () => {
    saveSurfaceHandles("U2", { canvasId: "F2", listId: "L2" });
    const h = getSurfaceHandles("U2")!;
    expect(Object.keys(h).sort()).toEqual(["canvasId", "listId", "updatedAt", "userId"]);
  });

  it("returns undefined for an unknown user", () => {
    expect(getSurfaceHandles("nobody")).toBeUndefined();
  });
});
