/**
 * Orchestrator — turns a user's free-text message or slash command into the
 * right Tempo module call, and returns Slack-ready blocks + fallback text.
 *
 * Routing is intent-keyword first (deterministic, reliable, works in mock mode);
 * when live AI is available an LLM fallback could be slotted in for fuzzy asks.
 * Modules do the real work; this just dispatches and renders.
 */

import type { KnownBlock } from "@slack/types";
import { afterTsOf, type TempoContext } from "./context.js";
import { runTriage } from "../modules/triage.js";
import { runLedger } from "../modules/ledger.js";
import { decodeMessage } from "../modules/decoder.js";
import { runReentry } from "../modules/reentry.js";
import { planFocusBlock } from "../modules/focus.js";
// The application layer wires outbound adapters to the ports the domain modules
// declare; the per-turn container (on ctx) resolves mock/live by config.
import { isSuppressed } from "../platform/persistence/snoozes.js";
import { syncCommitments } from "../platform/persistence/commitments.js";
import { getPrefs } from "../platform/persistence/prefs.js";
import { recordMetrics } from "../platform/persistence/metrics.js";
import {
  triageBlocks,
  ledgerBlocks,
  decodeBlocks,
  reentryBlocks,
  focusBlocks,
  helpBlocks,
  emptyStateBlocks,
} from "../platform/slack/blockkit/index.js";

import { toSpeech, condense, applyReadingLevel, resolveA11yPrefs } from "../accessibility/index.js";

export type Intent = "triage" | "commitments" | "decode" | "catchup" | "focus" | "help";

export interface TempoResponse {
  intent: Intent;
  text: string; // fallback / accessibility text
  blocks: KnownBlock[];
  /** Calm linear script for read-aloud / TTS users. */
  speech: string;
}

export function routeIntent(input: string): Intent {
  const t = input.toLowerCase();
  if (/\b(triage|need(s)? me|what.?s new|unread|today|priorit)/.test(t)) return "triage";
  if (/\b(commit|promis|owe|ledger|deliver)/.test(t)) return "commitments";
  if (/\b(catch ?up|catch me up|missed|away|pto|vacation|back|re-?entry)/.test(t)) return "catchup";
  if (/\b(focus|deep work|block (my )?time|do not disturb|dnd|protect)/.test(t)) return "focus";
  if (/\b(decode|what does this mean|really mean|tone|subtext|passive)/.test(t)) return "decode";
  return "help";
}

export interface RespondOpts {
  /** Whether to count this call toward the user's weekly metrics. Passive
   * surfaces (App Home auto-refresh) pass `false` so they don't inflate KPIs;
   * user-initiated asks (Assistant / slash / mention) default to `true`. */
  record?: boolean;
}

export async function respond(
  ctx: TempoContext,
  input: string,
  opts: RespondOpts = {},
): Promise<TempoResponse> {
  const a11y = resolveA11yPrefs(getPrefs(ctx.subjectUserId));
  const r = await respondCore(ctx, input, opts.record ?? true);
  const text = applyReadingLevel(condense(r.text, a11y.verbosity), a11y.readingLevel);
  return { ...r, text, speech: toSpeech({ intent: r.intent, text }) };
}

/** Filters out anything the user snoozed/marked done, the way every triage render must. */
async function liveTriage(ctx: TempoContext) {
  const raw = await runTriage(ctx.rts, ctx.llm, { afterTs: afterTsOf(ctx) });
  return {
    ...raw,
    needsYou: raw.needsYou.filter((i) => !isSuppressed(ctx.subjectUserId, i.permalink, ctx.nowTs)),
  };
}

/** The "show the rest" path — same live triage, no maxItems cap. Not reachable
 * through free-text routing; app.ts's "show_rest" button calls this directly. */
export async function triageAll(ctx: TempoContext): Promise<TempoResponse> {
  const r = await liveTriage(ctx);
  const text = r.needsYou.length
    ? `All ${r.needsYou.length} items: ` + r.needsYou.map((i) => i.suggestedAction).join("; ")
    : "You're all caught up.";
  return {
    intent: "triage",
    text,
    blocks: triageBlocks(r, { maxItems: r.needsYou.length || 1 }),
    speech: toSpeech({ intent: "triage", text }),
  };
}

async function respondCore(
  ctx: TempoContext,
  input: string,
  record: boolean,
): Promise<Omit<TempoResponse, "speech">> {
  const intent = routeIntent(input);
  const after = afterTsOf(ctx);
  const prefs = getPrefs(ctx.subjectUserId);
  const a11y = resolveA11yPrefs(prefs);

  switch (intent) {
    case "triage": {
      const r = await liveTriage(ctx);
      const top = r.needsYou.slice(0, a11y.maxItems);
      if (record) recordMetrics(ctx.subjectUserId, { messagesTriaged: r.scanned });
      return {
        intent,
        text: top.length
          ? `${top.length} thing${top.length > 1 ? "s" : ""} need${top.length > 1 ? "" : "s"} you: ` +
            top.map((i) => `${i.suggestedAction} (${i.reason})`).join("; ")
          : "You're all caught up.",
        blocks: top.length ? triageBlocks(r, { maxItems: a11y.maxItems }) : emptyStateBlocks("triage"),
      };
    }
    case "commitments": {
      const fresh = await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs });
      const c = syncCommitments(ctx.subjectUserId, fresh);
      if (record) recordMetrics(ctx.subjectUserId, { obligationsSurfaced: c.length });
      return {
        intent,
        text:
          `You have ${c.filter((x) => x.direction === "i_owe").length} open promises and ` +
          `${c.filter((x) => x.direction === "owed_to_me").length} owed to you.`,
        blocks: c.length ? ledgerBlocks(c) : emptyStateBlocks("commitments"),
      };
    }
    case "catchup": {
      const b = await runReentry(ctx.rts, ctx.llm, { afterTs: after, awayDays: ctx.awayDays });
      return b.topThree.length
        ? { intent, text: "The 3 that matter most: " + b.topThree.join("; "), blocks: reentryBlocks(b) }
        : { intent, text: "Nothing major to catch up on.", blocks: emptyStateBlocks("catchup") };
    }
    case "focus": {
      const mins = Number(input.match(/(\d{2,3})\s*(min|m)\b/)?.[1] ?? prefs?.focusDefaultMins ?? 90);
      const p = await planFocusBlock({
        nowTs: ctx.nowTs,
        durationMins: mins,
        title: "Deep work (protected by Tempo)",
        subjectUserId: ctx.subjectUserId,
        userToken: ctx.userToken,
        mcp: ctx.container.mcp(),
        slack: ctx.container.slackActions({ userToken: ctx.userToken }),
      });
      if (record) recordMetrics(ctx.subjectUserId, { focusMinutesProtected: mins });
      return { intent, text: p.summary, blocks: focusBlocks(p) };
    }
    case "decode": {
      const text = extractDecodeTarget(input) ?? (await latestAmbiguousMessage(ctx));
      if (!text) {
        return { intent: "help", text: "Paste a message and I'll decode it.", blocks: helpBlocks() };
      }
      const d = await decodeMessage(text, ctx.llm, { rts: ctx.rts });
      return { intent, text: `Probably means: ${d.impliedMeaning}`, blocks: decodeBlocks(d, text) };
    }
    default:
      return { intent: "help", text: "Here's what I can do.", blocks: helpBlocks() };
  }
}

function extractDecodeTarget(input: string): string | undefined {
  // "decode: <text>" or quoted text after the trigger word.
  const afterColon = input.split(/decode\s*:?/i)[1]?.trim();
  if (afterColon && afterColon.length > 3) return stripQuotes(afterColon);
  const quoted = input.match(/["“](.+?)["”]/)?.[1];
  return quoted;
}

function stripQuotes(s: string): string {
  return s.replace(/^["“]|["”]$/g, "").trim();
}

/** Demo/live convenience: find the most recent message that mentions the user. */
async function latestAmbiguousMessage(ctx: TempoContext): Promise<string | undefined> {
  const res = await ctx.rts.search({
    query: "messages addressed to me that might be ambiguous or passive-aggressive",
    after: afterTsOf(ctx),
    limit: 10,
  });
  const candidate = res.messages.find((m) => m.mentionsMe) ?? res.messages[0];
  return candidate?.text;
}
