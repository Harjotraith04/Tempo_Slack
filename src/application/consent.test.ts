/**
 * Consent must hold on EVERY surface, not just the one you tested.
 *
 * We shipped "choose which channels Tempo may watch", wired it into Bolt's
 * `contextFor`, watched it work in Slack, and shipped. It was enforced on exactly
 * one of three surfaces. The morning-digest cron and the inbound MCP server both
 * called `buildContext()` directly and passed no scope — so the cron DM'd people
 * content from channels they had explicitly de-selected, and any external agent
 * calling `tempo_triage` read the user's entire visible Slack regardless of their
 * settings.
 *
 * A consent control that holds on one surface out of three is worse than none: it
 * makes a promise it doesn't keep, in the one area the whole product is staked on.
 * And the surface that leaked was the unattended one — nobody is watching a cron.
 *
 * `buildUserContext()` is now the single chokepoint that loads token + name +
 * prefs + scope. These tests pin that it actually applies the scope, and that
 * every entrypoint routes through it.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildUserContext } from "./context.js";
import { createContainer } from "./container.js";
import { getStore } from "../platform/persistence/index.js";
import { CORPUS_QUERY } from "../ports/rts.js";

/** Stands in for Bolt's client / a WebClient. */
const fakeClient = {
  users: { info: async () => ({ user: { profile: { real_name: "Ada Lovelace" } } }) },
};

const ctxFor = (userId: string) =>
  buildUserContext({ subjectUserId: userId, client: fakeClient, container: createContainer() });

describe("buildUserContext applies the user's stored consent scope", () => {
  it("watches everywhere when the user has set no filter", async () => {
    const ctx = await ctxFor("U_CONSENT_NONE");
    const res = await ctx.rts.search({ query: CORPUS_QUERY, limit: 50 });

    expect(res.messages.length).toBeGreaterThan(1);
    expect(new Set(res.messages.map((m) => m.channelId)).size).toBeGreaterThan(1);
  });

  it("honours a channel allowlist stored in prefs", async () => {
    const userId = "U_CONSENT_CHANNEL";
    await getStore().prefs.save(userId, { watchedChannels: ["C_ENG"] });

    const ctx = await ctxFor(userId);
    const res = await ctx.rts.search({ query: CORPUS_QUERY, limit: 50 });

    expect(res.messages.length).toBeGreaterThan(0);
    expect(res.messages.every((m) => m.channelId === "C_ENG")).toBe(true);

    await getStore().prefs.deleteForUser(userId);
  });

  it("honours a muted author stored in prefs", async () => {
    const userId = "U_CONSENT_MUTE";
    await getStore().prefs.save(userId, { mutedUsers: ["U_PRIYA"] });

    const ctx = await ctxFor(userId);
    const res = await ctx.rts.search({ query: CORPUS_QUERY, limit: 50 });

    expect(res.messages.length).toBeGreaterThan(0);
    expect(res.messages.some((m) => m.authorId === "U_PRIYA")).toBe(false);

    await getStore().prefs.deleteForUser(userId);
  });

  it("resolves the display name, so prompts are written for the real person", async () => {
    const ctx = await ctxFor("U_CONSENT_NAME");
    expect(ctx.subjectName).toBe("Ada Lovelace");
  });
});

/**
 * The structural guard. The bug wasn't that the filter was wrong — it was that two
 * entrypoints never asked for it. Tests that only exercise the happy path can't see
 * that, so this one reads the entrypoints and asserts none of them hand-rolls a
 * context any more.
 */
describe("every entrypoint routes through the chokepoint", () => {
  const ENTRYPOINTS = [
    "src/main/app.ts",
    "api/cron/morning-digest.ts",
    "api/mcp/server.ts",
  ];

  for (const file of ENTRYPOINTS) {
    it(`${file} uses buildUserContext, not a hand-rolled buildContext`, () => {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("buildUserContext");
      // A bare buildContext({...}) here is how the consent scope got dropped twice.
      expect(src).not.toMatch(/\bbuildContext\s*\(\s*\{/);
    });
  }
});
