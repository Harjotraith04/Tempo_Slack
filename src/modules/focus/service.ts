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

import type { McpClients, SlackActionsClient, TaskResult } from "./ports.js";
import { clockLabel, nextSlot, type FocusPlan } from "./domain.js";

export async function planFocusBlock(opts: {
  nowTs: number;
  durationMins?: number;
  title?: string;
  taskTitle?: string;
  sourcePermalink?: string;
  due?: number;
  subjectUserId?: string;
  userToken?: string;
  /** Outbound adapters, injected by the application layer (dependency rule:
   * this domain module depends only on the ports, never on `platform/`). */
  mcp: McpClients;
  slack: SlackActionsClient;
}): Promise<FocusPlan> {
  const { calendar, tasks } = opts.mcp;
  const slack = opts.slack;
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

  // Slack-native: DND + status, because the user just asked Tempo to protect
  // their focus — that ask *is* the tap. Digest scheduling is best-effort.
  const durationMins = opts.durationMins ?? 90;
  const dnd = await slack.setFocusDnd({ minutes: durationMins });
  const status = await slack.setFocusStatus({
    statusText: `Focusing — back at ${clockLabel(endTs)}`,
    statusEmoji: "🎯",
    expirationTs: endTs,
  });
  let digestScheduledFor: number | undefined;
  if (opts.subjectUserId) {
    const digest = await slack.scheduleDigest({
      userId: opts.subjectUserId,
      postAtTs: endTs,
      text: `Focus block done — here's what came in while you were heads-down.`,
    });
    if (digest.ok) digestScheduledFor = endTs;
  }

  return {
    title,
    startTs,
    endTs,
    calendar: cal,
    task,
    dndUntilTs: endTs,
    summary: `Blocked ${durationMins} min for "${title}"${task ? ` and created a task` : ""}. Do-Not-Disturb on until the block ends; only true blockers will break through.`,
    dndApplied: dnd.ok,
    statusApplied: status.ok,
    digestScheduledFor,
  };
}
