import { describe, expect, it, vi } from "vitest";
import { safely } from "./app.js";

describe("safely — handler error guard", () => {
  it("runs the work and no recovery on success", async () => {
    const recover = vi.fn();
    const work = vi.fn().mockResolvedValue(undefined);
    await safely("ok", work, recover);
    expect(work).toHaveBeenCalledTimes(1);
    expect(recover).not.toHaveBeenCalled();
  });

  it("swallows a thrown error and runs recovery instead of crashing", async () => {
    const recover = vi.fn().mockResolvedValue(undefined);
    await expect(
      safely("boom", async () => {
        throw new Error("kaboom");
      }, recover),
    ).resolves.toBeUndefined();
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("never rejects even if recovery itself throws", async () => {
    await expect(
      safely(
        "double",
        async () => {
          throw new Error("work failed");
        },
        async () => {
          throw new Error("recovery failed too");
        },
      ),
    ).resolves.toBeUndefined();
  });
});
