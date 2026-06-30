/**
 * Module 5 — Re-entry ("The Bridge").
 *
 * Returning from PTO/sick/away is brutal for anyone with re-entry anxiety. This
 * reconstructs — in plain language — what changed for your projects, what was
 * decided while you were gone, who is waiting on you, and the three things that
 * matter most. Time-bounded RTS reconstruction + summarisation.
 */

import { z } from "zod";
import { structured } from "../agent/llm.js";
import type { RtsClient, RtsMessage } from "../rts/index.js";

export interface ReentryBrief {
  topThree: string[];
  decisions: string[];
  changesToYourProjects: string[];
  peopleWaiting: string[];
  nowExpectedOfYou: string[];
  awayDays: number;
}

const Schema = z.object({
  topThree: z.array(z.string()).max(3),
  decisions: z.array(z.string()),
  changesToYourProjects: z.array(z.string()),
  peopleWaiting: z.array(z.string()),
  nowExpectedOfYou: z.array(z.string()),
});

const SYSTEM = `You are Tempo, welcoming Sam Rivera (a PM) back after time away. From the Slack activity he missed, write a calm, skimmable re-entry brief in plain language. Group into: the 3 things that matter most (topThree), decisions made while away, changes to his projects, people waiting on him, and what's now expected of him. Be concrete, short, and reassuring — no jargon, no firehose. Prefer 2-5 bullet items per section.`;

export async function runReentry(
  rts: RtsClient,
  opts: { afterTs: string; awayDays: number },
): Promise<ReentryBrief> {
  const res = await rts.search({
    query: "everything important that happened while I was away: decisions, blockers, requests for me",
    after: opts.afterTs,
    limit: 40,
  });

  const brief = await structured({
    system: SYSTEM,
    prompt: buildPrompt(res.messages),
    schema: Schema,
    temperature: 0.3,
    mock: () => mockBrief(res.messages),
  });

  return { ...brief, awayDays: opts.awayDays };
}

function buildPrompt(messages: RtsMessage[]): string {
  return messages
    .map((m) => `#${m.channelName} (${m.channelType}) — ${m.authorRealName ?? m.authorName}: "${m.text}"`)
    .join("\n");
}

function mockBrief(messages: RtsMessage[]): z.infer<typeof Schema> {
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
