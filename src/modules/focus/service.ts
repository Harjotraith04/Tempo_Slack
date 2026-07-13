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

/** Run an outbound side-effect, degrading to `undefined` instead of throwing. */
async function safely<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch (err) {
    console.error("focus: outbound MCP call failed; continuing without it", err);
    return undefined;
  }
}

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

  // Outbound MCP is BEST-EFFORT and must run behind its own guard.
  //
  // The mock never throws, so for a long time this was written as a bare await —
  // and the moment a real MCP server was pointed at it, an unreachable host, a
  // slow one, or a rejected token would throw here, *before* the DND and status
  // calls below ever ran. The user would have asked Tempo to protect their focus
  // and gotten an error, with their DND untouched.
  //
  // That's backwards. DND + status are the substance of a focus block; the
  // calendar event and task are a garnish. A garnish must never take down the
  // meal. So a failure degrades to "no calendar link" and the block still happens.
  const cal = await safely(() =>
    calendar.blockFocus({
      title,
      startTs,
      endTs,
      description: opts.sourcePermalink ? `From Slack: ${opts.sourcePermalink}` : undefined,
    }),
  );

  let task: TaskResult | undefined;
  if (opts.taskTitle) {
    task = await safely(() =>
      tasks.create({
        title: opts.taskTitle!,
        due: opts.due,
        sourcePermalink: opts.sourcePermalink,
        notes: "Created by Tempo from a Slack obligation.",
      }),
    );
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
    // Say only what actually happened. Claiming a calendar hold that failed is
    // exactly the kind of confident lie that makes an assistant untrustworthy.
    summary: `Blocked ${durationMins} min for "${title}"${task ? " and created a task" : ""}.${
      cal ? "" : " (Couldn't reach your calendar — the Slack block is still on.)"
    } Do-Not-Disturb on until the block ends; only true blockers will break through.`,
    dndApplied: dnd.ok,
    statusApplied: status.ok,
    digestScheduledFor,
  };
}
