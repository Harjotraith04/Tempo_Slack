/**
 * Module 4 — Focus Guardian ("The Shield").
 *
 * Protects attention. Turns a Slack obligation into a real, scheduled focus
 * block (calendar) + a tracked task (Notion/Linear) via outward MCP, and sets
 * an "interrupt budget" so only genuinely urgent things break through DND.
 *
 * The actual external writes go through the MCP clients (mock by default, real
 * MCP server when configured) — Tempo acting in the world, not just reading.
 */

import { getMcpClients, type CalendarResult, type TaskResult } from "../mcp/index.js";
import type { TriageItem } from "./triage.js";

export interface FocusPlan {
  title: string;
  startTs: number;
  endTs: number;
  calendar: CalendarResult;
  task?: TaskResult;
  dndUntilTs: number;
  summary: string;
}

/** Round up to the next 15-minute boundary. */
function nextSlot(nowTs: number): number {
  const q = 15 * 60;
  return Math.ceil(nowTs / q) * q;
}

export async function planFocusBlock(opts: {
  nowTs: number;
  durationMins?: number;
  title?: string;
  taskTitle?: string;
  sourcePermalink?: string;
  due?: number;
}): Promise<FocusPlan> {
  const { calendar, tasks } = getMcpClients();
  const duration = (opts.durationMins ?? 90) * 60;
  const startTs = nextSlot(opts.nowTs);
  const endTs = startTs + duration;
  const title = opts.title ?? "Deep work (protected by Tempo)";

  const cal = await calendar.blockFocus({
    title,
    startTs,
    endTs,
    description: opts.sourcePermalink ? `From Slack: ${opts.sourcePermalink}` : undefined,
  });

  let task: TaskResult | undefined;
  if (opts.taskTitle) {
    task = await tasks.create({
      title: opts.taskTitle,
      due: opts.due,
      sourcePermalink: opts.sourcePermalink,
      notes: "Created by Tempo from a Slack obligation.",
    });
  }

  return {
    title,
    startTs,
    endTs,
    calendar: cal,
    task,
    dndUntilTs: endTs,
    summary: `Blocked ${opts.durationMins ?? 90} min for "${title}"${task ? ` and created a task` : ""}. Do-Not-Disturb on until the block ends; only true blockers will break through.`,
  };
}

/** The interrupt budget: only these would be allowed to break a focus block. */
export function whatBreaksThrough(items: TriageItem[], threshold = 85): TriageItem[] {
  return items.filter(
    (i) => (i.category === "ACT" || i.category === "BLOCKER") && i.urgency >= threshold,
  );
}
