import { describe, expect, it, vi } from "vitest";
import { CachingRtsClient } from "./caching.js";
import type { RtsClient, RtsSearchResult } from "../../../ports/rts.js";

function fakeInner(): RtsClient & { calls: number } {
  const impl = {
    subjectUserId: "U_SAM",
    calls: 0,
    async search(): Promise<RtsSearchResult> {
      impl.calls++;
      return { messages: [], users: [], meta: { source: "mock", query: "q", returned: 0 } };
    },
  };
  return impl;
}

describe("CachingRtsClient", () => {
  it("hits the underlying client once for repeated identical searches", async () => {
    const inner = fakeInner();
    const cached = new CachingRtsClient(inner);

    await cached.search({ query: "what needs me", limit: 20 });
    await cached.search({ query: "what needs me", limit: 20 });
    await cached.search({ query: "what needs me", limit: 20 });

    expect(inner.calls).toBe(1);
  });

  it("treats different params as distinct cache keys", async () => {
    const inner = fakeInner();
    const cached = new CachingRtsClient(inner);

    await cached.search({ query: "a" });
    await cached.search({ query: "b" });

    expect(inner.calls).toBe(2);
  });

  it("preserves the subjectUserId of the wrapped client", () => {
    const inner = fakeInner();
    expect(new CachingRtsClient(inner).subjectUserId).toBe("U_SAM");
  });

  it("shares one in-flight promise for concurrent identical searches", async () => {
    const inner = fakeInner();
    const spy = vi.spyOn(inner, "search");
    const cached = new CachingRtsClient(inner);

    await Promise.all([cached.search({ query: "x" }), cached.search({ query: "x" })]);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
