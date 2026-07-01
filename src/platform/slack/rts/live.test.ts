import { afterEach, describe, expect, it, vi } from "vitest";

const { apiCall } = vi.hoisted(() => ({ apiCall: vi.fn() }));

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({ apiCall })),
}));

const { LiveRtsClient } = await import("./live.js");

afterEach(() => apiCall.mockReset());

function page(messages: { text: string }[], nextCursor?: string) {
  return {
    ok: true,
    results: { messages: messages.map((m, i) => ({ text: m.text, ts: `100${i}.0001`, permalink: `p${i}` })) },
    ...(nextCursor ? { response_metadata: { next_cursor: nextCursor } } : {}),
  };
}

describe("LiveRtsClient pagination", () => {
  it("follows next_cursor across pages until the limit is met", async () => {
    apiCall
      .mockResolvedValueOnce(page([{ text: "a" }, { text: "b" }], "CUR1"))
      .mockResolvedValueOnce(page([{ text: "c" }, { text: "d" }])); // no cursor → last page

    const client = new LiveRtsClient({ userToken: "xoxp", subjectUserId: "U_SAM" });
    const res = await client.search({ query: "q", limit: 4 });

    expect(apiCall).toHaveBeenCalledTimes(2);
    // Second call carries the cursor from the first page.
    expect(apiCall.mock.calls[1]![1]).toMatchObject({ cursor: "CUR1" });
    expect(res.messages.map((m) => m.text)).toEqual(["a", "b", "c", "d"]);
    expect(res.meta.returned).toBe(4);
  });

  it("stops paging (and caps results) once the limit is satisfied", async () => {
    apiCall.mockResolvedValue(page([{ text: "a" }, { text: "b" }], "MORE"));

    const client = new LiveRtsClient({ userToken: "xoxp", subjectUserId: "U_SAM" });
    const res = await client.search({ query: "q", limit: 2 });

    // Enough after one page → no second call even though a cursor was returned.
    expect(apiCall).toHaveBeenCalledTimes(1);
    expect(res.messages).toHaveLength(2);
  });

  it("makes a single call when there is no cursor", async () => {
    apiCall.mockResolvedValue(page([{ text: "only" }]));
    const client = new LiveRtsClient({ userToken: "xoxp", subjectUserId: "U_SAM" });
    await client.search({ query: "q", limit: 20 });
    expect(apiCall).toHaveBeenCalledTimes(1);
  });
});
