import { afterEach, describe, expect, it, vi } from "vitest";

const { dndSetSnooze, usersProfileSet, conversationsOpen, chatScheduleMessage, apiCall } = vi.hoisted(() => ({
  dndSetSnooze: vi.fn(),
  usersProfileSet: vi.fn(),
  conversationsOpen: vi.fn(),
  chatScheduleMessage: vi.fn(),
  apiCall: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    dnd: { setSnooze: dndSetSnooze },
    users: { profile: { set: usersProfileSet } },
    conversations: { open: conversationsOpen },
    chat: { scheduleMessage: chatScheduleMessage },
    apiCall,
  })),
}));

const { LiveSlackActions } = await import("./live.js");
const { MockSlackActions } = await import("./mock.js");

afterEach(() => {
  dndSetSnooze.mockReset();
  usersProfileSet.mockReset();
  conversationsOpen.mockReset();
  chatScheduleMessage.mockReset();
  apiCall.mockReset();
});

describe("LiveSlackActions", () => {
  it("setFocusDnd calls dnd.setSnooze with num_minutes", async () => {
    dndSetSnooze.mockResolvedValue({ ok: true, snooze_endtime: 12345 });
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.setFocusDnd({ minutes: 90 });
    expect(dndSetSnooze).toHaveBeenCalledWith({ num_minutes: 90 });
    expect(res).toEqual({ ok: true, nextDndEndTs: 12345 });
  });

  it("setFocusStatus calls users.profile.set with status_text/status_emoji/status_expiration", async () => {
    usersProfileSet.mockResolvedValue({ ok: true });
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.setFocusStatus({ statusText: "Focusing — back at 3:30", expirationTs: 999 });
    expect(usersProfileSet).toHaveBeenCalledWith({
      profile: { status_text: "Focusing — back at 3:30", status_emoji: "🎯", status_expiration: 999 },
    });
    expect(res).toEqual({ ok: true });
  });

  it("scheduleDigest opens a DM then schedules a message in it", async () => {
    conversationsOpen.mockResolvedValue({ ok: true, channel: { id: "D123" } });
    chatScheduleMessage.mockResolvedValue({ ok: true, scheduled_message_id: "Q1" });
    const client = new LiveSlackActions({ userToken: "xoxp-test", botToken: "xoxb-test" });
    const res = await client.scheduleDigest({ userId: "U1", postAtTs: 5000, text: "hello" });
    expect(conversationsOpen).toHaveBeenCalledWith({ users: "U1" });
    expect(chatScheduleMessage).toHaveBeenCalledWith({ channel: "D123", post_at: 5000, text: "hello" });
    expect(res).toEqual({ ok: true, scheduledMessageId: "Q1" });
  });

  it("scheduleDigest is a no-op without a bot token", async () => {
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.scheduleDigest({ userId: "U1", postAtTs: 5000, text: "hello" });
    expect(res).toEqual({ ok: false });
    expect(conversationsOpen).not.toHaveBeenCalled();
  });

  it("a thrown Web API error surfaces as ok:false, never throws into the caller", async () => {
    dndSetSnooze.mockRejectedValue(new Error("rate_limited"));
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    await expect(client.setFocusDnd({ minutes: 30 })).resolves.toEqual({ ok: false });
  });

  // ── v2.0 native surfaces (apiCall escape hatch) ────────────────────────────

  it("upsertCanvas creates a new canvas when no canvasId is given", async () => {
    apiCall.mockResolvedValue({ ok: true, canvas_id: "F_NEW" });
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.upsertCanvas({ title: "Tempo — Sam", markdown: "# hi" });
    expect(apiCall).toHaveBeenCalledWith("canvases.create", {
      title: "Tempo — Sam",
      document_content: { type: "markdown", markdown: "# hi" },
    });
    expect(res).toEqual({ ok: true, canvasId: "F_NEW" });
  });

  it("upsertCanvas edits in place when a canvasId is given", async () => {
    apiCall.mockResolvedValue({ ok: true });
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.upsertCanvas({ canvasId: "F_OLD", title: "t", markdown: "# hi2" });
    expect(apiCall).toHaveBeenCalledWith("canvases.edit", {
      canvas_id: "F_OLD",
      changes: [{ operation: "replace", document_content: { type: "markdown", markdown: "# hi2" } }],
    });
    expect(res).toEqual({ ok: true, canvasId: "F_OLD" });
  });

  it("syncListItems creates a list then writes one row per item", async () => {
    apiCall
      .mockResolvedValueOnce({ ok: true, list_id: "L1" }) // slackLists.create
      .mockResolvedValue({ ok: true }); // each slackLists.items.create
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.syncListItems({
      title: "Sam's commitments",
      items: [
        { what: "spec", counterparty: "Priya", direction: "i_owe", status: "overdue", permalink: "p1" },
        { what: "pricing", counterparty: "Jordan", direction: "owed_to_me", status: "open", permalink: "p2" },
      ],
    });
    expect(apiCall).toHaveBeenNthCalledWith(1, "slackLists.create", { title: "Sam's commitments" });
    expect(apiCall).toHaveBeenCalledWith("slackLists.items.create", expect.objectContaining({ list_id: "L1" }));
    expect(res).toEqual({ ok: true, listId: "L1", itemsWritten: 2 });
  });

  it("addReminder calls reminders.add with text + time", async () => {
    apiCall.mockResolvedValue({ ok: true, reminder: { id: "Rm1" } });
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    const res = await client.addReminder({ text: "follow up", time: 123 });
    expect(apiCall).toHaveBeenCalledWith("reminders.add", { text: "follow up", time: 123 });
    expect(res).toEqual({ ok: true, reminderId: "Rm1" });
  });

  it("addBookmark uses the bot token and bookmarks.add", async () => {
    apiCall.mockResolvedValue({ ok: true, bookmark: { id: "Bk1" } });
    const client = new LiveSlackActions({ userToken: "xoxp-test", botToken: "xoxb-test" });
    const res = await client.addBookmark({ channelId: "C1", title: "Canvas", link: "https://x" });
    expect(apiCall).toHaveBeenCalledWith("bookmarks.add", {
      channel_id: "C1",
      title: "Canvas",
      type: "link",
      link: "https://x",
    });
    expect(res).toEqual({ ok: true, bookmarkId: "Bk1" });
  });

  it("a thrown canvas call surfaces as ok:false", async () => {
    apiCall.mockRejectedValue(new Error("boom"));
    const client = new LiveSlackActions({ userToken: "xoxp-test" });
    await expect(client.upsertCanvas({ title: "t", markdown: "x" })).resolves.toEqual({ ok: false });
  });
});

describe("MockSlackActions", () => {
  it("returns deterministic ids and echoes an existing canvasId on edit", async () => {
    const m = new MockSlackActions();
    expect(await m.upsertCanvas({ title: "t", markdown: "x" })).toEqual({ ok: true, canvasId: "canvas_mock_1" });
    expect(await m.upsertCanvas({ canvasId: "F_KEEP", title: "t", markdown: "x" })).toEqual({ ok: true, canvasId: "F_KEEP" });
  });

  it("reports itemsWritten from the input length", async () => {
    const m = new MockSlackActions();
    const res = await m.syncListItems({
      title: "t",
      items: [
        { what: "a", counterparty: "b", direction: "i_owe", status: "open", permalink: "p" },
      ],
    });
    expect(res).toEqual({ ok: true, listId: "list_mock_1", itemsWritten: 1 });
  });
});
