/**
 * Guards on the seeded world itself.
 *
 * The mock derives each message's permalink from its channel + timestamp, and
 * `gatherCandidates` dedupes by permalink. So two fixtures in the SAME channel at
 * the SAME `minsAgo` collapse into one — silently. No error, no warning: one of
 * them simply stops existing.
 *
 * That is not hypothetical. Enriching this file from 19 to 32 messages landed a
 * new `#eng` message on exactly `3 * DAY`, where the hero blocker already sat —
 * and it deleted the single most important message in the demo. Every test still
 * passed except one, and the failure pointed somewhere else entirely.
 *
 * This test makes that impossible to do again quietly.
 */

import { describe, expect, it } from "vitest";
import { MESSAGES, CHANNELS, USERS, SUBJECT_USER_ID } from "./fixtures.js";

describe("no two fixtures collide on channel + timestamp", () => {
  it("every (channelId, minsAgo) pair is unique", () => {
    const seen = new Map<string, string[]>();
    for (const m of MESSAGES) {
      const key = `${m.channelId}@${m.minsAgo}`;
      seen.set(key, [...(seen.get(key) ?? []), m.text.slice(0, 60)]);
    }
    const collisions = [...seen.entries()].filter(([, texts]) => texts.length > 1);

    expect(
      collisions,
      `These fixtures share a channel + timestamp, so the mock gives them the same ` +
        `permalink and one SILENTLY overwrites the other:\n` +
        collisions.map(([k, t]) => `  ${k}\n${t.map((x) => `    "${x}…"`).join("\n")}`).join("\n"),
    ).toEqual([]);
  });
});

describe("the demo's load-bearing moments are present", () => {
  // If any of these vanish, the story the video tells stops being true.
  const PLANTS = [
    ["the implicit blocker nobody @-mentioned", /blocked on the atlas migration/i],
    ["the passive-aggressive 'no rush'", /no rush/i],
    ["the VP's deadlined ask", /checklist owner/i],
    ["the promise Sam made and missed", /finalized atlas api spec/i],
    ["the promise Sam is owed", /updated pricing numbers/i],
  ] as const;

  for (const [what, re] of PLANTS) {
    it(`still contains ${what}`, () => {
      expect(MESSAGES.some((m) => re.test(m.text))).toBe(true);
    });
  }
});

describe("referential integrity", () => {
  it("every message points at a channel that exists", () => {
    const ids = new Set(CHANNELS.map((c) => c.id));
    const orphans = MESSAGES.filter((m) => !ids.has(m.channelId)).map((m) => m.channelId);
    expect([...new Set(orphans)]).toEqual([]);
  });

  it("every message points at an author that exists", () => {
    const ids = new Set(USERS.map((u) => u.id));
    const orphans = MESSAGES.filter((m) => !ids.has(m.authorId)).map((m) => m.authorId);
    expect([...new Set(orphans)]).toEqual([]);
  });

  it("the subject user is in the cast", () => {
    expect(USERS.some((u) => u.id === SUBJECT_USER_ID)).toBe(true);
  });
});
