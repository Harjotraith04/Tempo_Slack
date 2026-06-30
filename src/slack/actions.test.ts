import { afterEach, describe, expect, it, vi } from "vitest";

const { dndSetSnooze, usersProfileSet, conversationsOpen, chatScheduleMessage } = vi.hoisted(() => ({
  dndSetSnooze: vi.fn(),
  usersProfileSet: vi.fn(),
  conversationsOpen: vi.fn(),
  chatScheduleMessage: vi.fn(),
}));

vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    dnd: { setSnooze: dndSetSnooze },
    users: { profile: { set: usersProfileSet } },
    conversations: { open: conversationsOpen },
    chat: { scheduleMessage: chatScheduleMessage },
  })),
}));

const { LiveSlackActions } = await import("./live.js");

afterEach(() => {
  dndSetSnooze.mockReset();
  usersProfileSet.mockReset();
  conversationsOpen.mockReset();
  chatScheduleMessage.mockReset();
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
});
