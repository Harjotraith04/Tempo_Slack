/**
 * Consent scoping. The load-bearing test here is the FIRST one: an empty scope
 * must return byte-identical results to no scope at all.
 *
 * This is an allowlist that defaults to *open*. Get that backwards and every
 * existing user — who has never opened the settings modal and so has no
 * `watchedChannels` — silently gets an empty triage and concludes Tempo is
 * broken. The feature would look fine in a demo and be catastrophic in the wild.
 */

import { describe, expect, it } from "vitest";
import { ScopedRtsClient, isUnscoped } from "./scoped.js";
import type { RtsClient, RtsMessage, RtsSearchResult } from "../../../ports/rts.js";

const msg = (channelId: string, authorId: string, text: string): RtsMessage => ({
  permalink: `https://slack/${channelId}/${text}`,
  channelId,
  channelName: channelId,
  channelType: "public_channel",
  authorId,
  text,
  ts: "1.0",
});

const ALL: RtsMessage[] = [
  msg("C_ENG", "U_PRIYA", "blocked on the API spec"),
  msg("C_ENG", "U_NOISY", "lunch?"),
  msg("C_RANDOM", "U_NOISY", "memes"),
  msg("C_LEAD", "U_DANA", "board deck Tuesday"),
];

const inner: RtsClient = {
  subjectUserId: "U_SAM",
  search: async (): Promise<RtsSearchResult> => ({
    messages: ALL,
    users: [],
    meta: { source: "mock", query: "", returned: ALL.length },
  }),
};

const search = (scope: ConstructorParameters<typeof ScopedRtsClient>[1]) =>
  new ScopedRtsClient(inner, scope).search({ query: "" });

describe("default-open: an empty scope must change nothing", () => {
  it("returns every message when watchedChannels is absent", async () => {
    const r = await search({});
    expect(r.messages).toEqual(ALL);
    expect(r.meta.returned).toBe(4);
  });

  it("returns every message when watchedChannels is an EMPTY array", async () => {
    // The dangerous case: an empty allowlist must mean "everywhere", not "nowhere".
    const r = await search({ watchedChannels: [], mutedUsers: [] });
    expect(r.messages).toEqual(ALL);
  });

  it("isUnscoped() lets the caller skip the wrapper entirely", () => {
    expect(isUnscoped(undefined)).toBe(true);
    expect(isUnscoped({})).toBe(true);
    expect(isUnscoped({ watchedChannels: [], mutedUsers: [] })).toBe(true);
    expect(isUnscoped({ watchedChannels: ["C_ENG"] })).toBe(false);
    expect(isUnscoped({ mutedUsers: ["U_NOISY"] })).toBe(false);
  });
});

describe("channel allowlist", () => {
  it("keeps only the chosen channels", async () => {
    const r = await search({ watchedChannels: ["C_ENG"] });
    expect(r.messages.map((m) => m.channelId)).toEqual(["C_ENG", "C_ENG"]);
  });

  it("supports several channels", async () => {
    const r = await search({ watchedChannels: ["C_ENG", "C_LEAD"] });
    expect(r.messages).toHaveLength(3);
    expect(r.messages.every((m) => m.channelId !== "C_RANDOM")).toBe(true);
  });

  it("returns nothing when the user allows a channel with no messages", async () => {
    const r = await search({ watchedChannels: ["C_EMPTY"] });
    expect(r.messages).toEqual([]);
    expect(r.meta.returned).toBe(0);
  });
});

describe("muted people", () => {
  it("drops a muted author everywhere they post", async () => {
    const r = await search({ mutedUsers: ["U_NOISY"] });
    expect(r.messages.map((m) => m.authorId)).toEqual(["U_PRIYA", "U_DANA"]);
  });

  it("applies the channel allowlist and the mute together", async () => {
    const r = await search({ watchedChannels: ["C_ENG"], mutedUsers: ["U_NOISY"] });
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]?.authorId).toBe("U_PRIYA");
  });
});

describe("meta.returned reflects what Tempo actually reasoned over", () => {
  it("counts the filtered messages, not what Slack handed back", async () => {
    // The triage card says "I scanned N messages" from this number. Reporting
    // Slack's raw count would tell the user Tempo read channels it was told not to.
    const r = await search({ watchedChannels: ["C_ENG"] });
    expect(r.meta.returned).toBe(2);
  });
});
