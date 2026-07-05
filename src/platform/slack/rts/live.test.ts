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

describe("LiveRtsClient field mapping (documented assistant.search.context shape)", () => {
  it("maps the flat documented message fields and infers channel type from the id prefix", async () => {
    apiCall.mockResolvedValue({
      ok: true,
      results: {
        messages: [
          {
            content: "Hey <@U_SAM>, can you review the deck?",
            message_ts: "1700.0001",
            author_user_id: "U_ALEX",
            author_name: "alex",
            channel_id: "D123",
            channel_name: "alex",
            thread_ts: "1699.0000",
            permalink: "https://x.slack.com/p1",
            is_author_bot: false,
          },
          {
            content: "shipped the report",
            message_ts: "1701.0002",
            author_user_id: "U_JAY",
            author_name: "jay",
            channel_id: "C_ENG",
            channel_name: "engineering",
            permalink: "https://x.slack.com/p2",
          },
        ],
        users: [
          {
            user_id: "U_ALEX",
            full_name: "Alex Rivera",
            title: "PM",
            email: "alex@x.com",
            timezone: "America/New_York",
          },
        ],
      },
    });

    const client = new LiveRtsClient({ userToken: "xoxp", subjectUserId: "U_SAM" });
    const res = await client.search({ query: "q", limit: 20 });

    expect(res.messages[0]).toMatchObject({
      text: "Hey <@U_SAM>, can you review the deck?",
      ts: "1700.0001",
      authorId: "U_ALEX",
      authorName: "alex",
      channelId: "D123",
      channelName: "alex",
      channelType: "im", // inferred from the "D" id prefix
      threadTs: "1699.0000",
      permalink: "https://x.slack.com/p1",
      mentionsMe: true,
    });
    expect(res.messages[1]).toMatchObject({ channelType: "public_channel", mentionsMe: false });
    expect(res.users[0]).toMatchObject({
      id: "U_ALEX",
      realName: "Alex Rivera",
      title: "PM",
      email: "alex@x.com",
      tz: "America/New_York",
    });
  });

  it("sends content_types/channel_types as arrays and caps the request limit at 20", async () => {
    apiCall.mockResolvedValue({ ok: true, results: { messages: [] } });
    const client = new LiveRtsClient({ userToken: "xoxp", subjectUserId: "U_SAM" });
    await client.search({ query: "q", limit: 50, channelTypes: ["im", "public_channel"] });

    const args = apiCall.mock.calls[0]![1] as Record<string, unknown>;
    expect(args.content_types).toEqual(["messages"]);
    expect(args.channel_types).toEqual(["im", "public_channel"]);
    expect(args.limit).toBe(20);
  });
});
