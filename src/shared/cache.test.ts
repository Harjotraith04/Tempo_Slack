import { describe, expect, it, vi } from "vitest";
import { Memo } from "./cache.js";

describe("Memo", () => {
  it("computes a value once per key and reuses it", () => {
    const memo = new Memo<number>();
    const factory = vi.fn(() => 42);
    expect(memo.getOrCreate("a", factory)).toBe(42);
    expect(memo.getOrCreate("a", factory)).toBe(42);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(memo.size).toBe(1);
  });

  it("keeps distinct keys separate and clears on demand", () => {
    const memo = new Memo<string>();
    memo.getOrCreate("a", () => "x");
    memo.getOrCreate("b", () => "y");
    expect(memo.size).toBe(2);
    memo.clear();
    expect(memo.size).toBe(0);
  });
});
