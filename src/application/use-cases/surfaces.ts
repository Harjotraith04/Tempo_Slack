/**
 * Native-surface use-cases (v2.0) — compose the existing domain modules onto
 * Slack's native surfaces: the Tempo Canvas (a living command center), a Slack
 * List mirror of the Commitment Ledger, and native reminders/bookmarks.
 *
 * These are pure orchestration over the ports the container resolves: they add
 * no new reasoning, and — like every Tempo action — only ever run from a user's
 * own tap / workflow step / their morning-digest cron. Only derived facts are
 * written to a canvas or list; raw RTS message text never is (Invariant 1).
 */

import { afterTsOf, type TempoContext } from "../context.js";
import { runTriage, type TriageResult } from "../../modules/triage.js";
import { runLedger, type Commitment } from "../../modules/ledger.js";
import { buildCanvasMarkdown } from "../../platform/slack/blockkit/canvas.js";
import type { ListItem } from "../../ports/slack.js";

/** Suppression-aware live triage — mirrors the orchestrator's own render path so
 * the canvas never shows something the user already snoozed/marked done. */
async function liveTriage(ctx: TempoContext): Promise<TriageResult> {
  const raw = await runTriage(ctx.rts, ctx.llm, { afterTs: afterTsOf(ctx) });
  const suppressed = new Set(
    (await ctx.store.snoozes.active(ctx.subjectUserId, ctx.nowTs)).map((s) => s.permalink),
  );
  return {
    ...raw,
    needsYou: raw.needsYou.filter((i) => !suppressed.has(i.permalink)),
  };
}

/** Live commitments with the user's local overrides (renegotiating/done) layered on. */
async function liveCommitments(ctx: TempoContext): Promise<Commitment[]> {
  const fresh = await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs });
  return ctx.store.commitments.sync(ctx.subjectUserId, fresh);
}

export interface UpdateCanvasResult {
  ok: boolean;
  canvasId?: string;
  markdown: string;
  created: boolean;
}

/** Create (first run) or refresh-in-place the user's Tempo Canvas from today's
 * live triage + commitments. Focus is intentionally left as a call-to-action:
 * refreshing a canvas must never *start* a focus block (Invariant 2). */
export async function updateCanvas(
  ctx: TempoContext,
  opts: { maxItems?: number } = {},
): Promise<UpdateCanvasResult> {
  const [triage, commitments] = await Promise.all([liveTriage(ctx), liveCommitments(ctx)]);
  const markdown = buildCanvasMarkdown({
    name: ctx.subjectName,
    nowTs: ctx.nowTs,
    triage,
    commitments,
    maxItems: opts.maxItems,
  });
  const existing = await ctx.store.surfaces.getCanvasId(ctx.subjectUserId);
  const slack = ctx.container.slackActions({ userToken: ctx.userToken });
  const res = await slack.upsertCanvas({
    canvasId: existing,
    title: `Tempo — ${ctx.subjectName}`,
    markdown,
  });
  if (res.ok && res.canvasId) await ctx.store.surfaces.save(ctx.subjectUserId, { canvasId: res.canvasId });
  return { ok: res.ok, canvasId: res.canvasId, markdown, created: !existing };
}

/** Map live commitments to Slack List rows — derived facts only; `sourceText`
 * is structurally absent from `ListItem`, so it can never leak (Invariant 1). */
export function commitmentsToListItems(commitments: Commitment[]): ListItem[] {
  return commitments
    .filter((c) => c.status !== "done")
    .map((c) => ({
      what: c.what,
      counterparty: c.counterparty,
      direction: c.direction,
      status: c.status,
      dueText: c.dueText,
      permalink: c.permalink,
    }));
}

export interface SyncListUseCaseResult {
  ok: boolean;
  listId?: string;
  itemsWritten?: number;
  count: number;
}

/** Create or refresh a Slack List mirror of the Commitment Ledger. */
export async function syncCommitmentsToList(ctx: TempoContext): Promise<SyncListUseCaseResult> {
  const commitments = await liveCommitments(ctx);
  const items = commitmentsToListItems(commitments);
  const existing = await ctx.store.surfaces.getListId(ctx.subjectUserId);
  const slack = ctx.container.slackActions({ userToken: ctx.userToken });
  const res = await slack.syncListItems({
    listId: existing,
    title: `${ctx.subjectName}'s commitments (Tempo)`,
    items,
  });
  if (res.ok && res.listId) await ctx.store.surfaces.save(ctx.subjectUserId, { listId: res.listId });
  return { ok: res.ok, listId: res.listId, itemsWritten: res.itemsWritten, count: items.length };
}

/** Set a native Slack reminder to follow up on a commitment before it slips. */
export async function remindAboutCommitment(
  ctx: TempoContext,
  opts: { what: string; counterparty: string; direction: Commitment["direction"]; time: number },
): Promise<{ ok: boolean; reminderId?: string }> {
  const verb = opts.direction === "i_owe" ? "deliver" : "follow up with";
  const text = `Tempo: ${verb} "${opts.what}"${opts.direction === "owed_to_me" ? ` — ${opts.counterparty} owes you this` : ` (for ${opts.counterparty})`}`;
  const slack = ctx.container.slackActions({ userToken: ctx.userToken });
  return slack.addReminder({ text, time: opts.time });
}

/** Pin a channel bookmark linking the user's Tempo Canvas. */
export async function bookmarkCanvas(
  ctx: TempoContext,
  opts: { channelId: string },
): Promise<{ ok: boolean; bookmarkId?: string }> {
  const canvasId = await ctx.store.surfaces.getCanvasId(ctx.subjectUserId);
  // Best-effort deep link to the canvas (opaque in mock; the real URL format is
  // resolved by Slack when the canvas is created live).
  const link = canvasId ? `https://slack.com/canvas/${canvasId}` : "https://slack.com/app_redirect?app=tempo";
  const slack = ctx.container.slackActions({ userToken: ctx.userToken });
  return slack.addBookmark({ channelId: opts.channelId, title: "📌 Tempo Canvas", link });
}
