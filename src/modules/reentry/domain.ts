/**
 * Re-entry — domain types + pure logic (schema, system prompt, prompt builder,
 * and the deterministic mock brief that doubles as the test oracle). The
 * RTS reconstruction lives in service.ts.
 */

import { z } from "zod";
import type { RtsMessage } from "../../ports/rts.js";

export interface ReentryBrief {
  topThree: string[];
  decisions: string[];
  changesToYourProjects: string[];
  peopleWaiting: string[];
  nowExpectedOfYou: string[];
  awayDays: number;
}

export const Schema = z.object({
  topThree: z.array(z.string()).max(3),
  decisions: z.array(z.string()),
  changesToYourProjects: z.array(z.string()),
  peopleWaiting: z.array(z.string()),
  nowExpectedOfYou: z.array(z.string()),
});

export const system = (name: string) =>
  `You are Tempo, welcoming ${name} back after time away. From the Slack activity they missed, write a calm, skimmable re-entry brief in plain language. Group into: the 3 things that matter most (topThree), decisions made while away, changes to their projects, people waiting on them, and what's now expected of them. Be concrete, short, and reassuring — no jargon, no firehose. Prefer 2-5 bullet items per section.`;

export function buildPrompt(messages: RtsMessage[]): string {
  return messages
    .map((m) => `#${m.channelName} (${m.channelType}) — ${m.authorRealName ?? m.authorName}: "${m.text}"`)
    .join("\n");
}

export function mockBrief(messages: RtsMessage[]): z.infer<typeof Schema> {
  const has = (s: string) => messages.some((m) => m.text.toLowerCase().includes(s));
  const decisions: string[] = [];
  const changes: string[] = [];
  const waiting: string[] = [];
  const expected: string[] = [];

  if (has("aug 1") || has("ga")) {
    decisions.push("Atlas GA moved from Aug 1 → Aug 15 to absorb the security review (decided in #leadership).");
    changes.push("Your Atlas launch plan and checklist need to shift to the new Aug 15 date.");
  }
  if (has("blocked") || has("waiting on")) {
    waiting.push("Priya + eng are blocked waiting on your Atlas API spec — they can't start the migration sprint.");
    expected.push("Send the finalized Atlas API spec (or a firm ETA) to unblock eng.");
  }
  if (has("board") || has("eod")) {
    waiting.push("Dana needs the Atlas launch checklist owner confirmed for the board deck.");
    expected.push("Confirm the checklist owner to Dana by EOD Monday.");
  }
  if (has("pricing")) {
    changes.push("Jordan owes you updated pricing numbers (was due Wednesday) — Tempo is tracking it.");
  }

  const topThree = [
    expected[0] ?? "Unblock eng on the Atlas spec.",
    expected[1] ?? "Confirm the checklist owner for Dana.",
    decisions[0] ?? "Note the Atlas GA date change.",
  ].slice(0, 3);

  return { topThree, decisions, changesToYourProjects: changes, peopleWaiting: waiting, nowExpectedOfYou: expected };
}
