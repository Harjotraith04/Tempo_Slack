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
import { isSuppressed } from "../db/snoozes.js";
import { syncCommitments } from "../db/commitments.js";
import {
  triageBlocks,
  ledgerBlocks,
  decodeBlocks,
  reentryBlocks,
  focusBlocks,
  helpBlocks,
} from "../blocks/index.js";

import { toSpeech } from "../a11y/index.js";

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

export async function respond(ctx: TempoContext, input: string): Promise<TempoResponse> {
  const r = await respondCore(ctx, input);
  return { ...r, speech: toSpeech({ intent: r.intent, text: r.text }) };
}

async function respondCore(
  ctx: TempoContext,
  input: string,
): Promise<Omit<TempoResponse, "speech">> {
  const intent = routeIntent(input);
  const after = afterTsOf(ctx);

  switch (intent) {
    case "triage": {
      const raw = await runTriage(ctx.rts, { afterTs: after });
      const r = {
        ...raw,
        needsYou: raw.needsYou.filter((i) => !isSuppressed(ctx.subjectUserId, i.permalink, ctx.nowTs)),
      };
      const top = r.needsYou.slice(0, 3);
      return {
        intent,
        text: top.length
          ? `${top.length} things need you: ` + top.map((i) => `${i.suggestedAction} (${i.reason})`).join("; ")
          : "You're all caught up.",
        blocks: triageBlocks(r),
      };
    }
    case "commitments": {
      const fresh = await runLedger(ctx.rts, { nowTs: ctx.nowTs });
      const c = syncCommitments(ctx.subjectUserId, fresh);
      return {
        intent,
        text:
          `You have ${c.filter((x) => x.direction === "i_owe").length} open promises and ` +
          `${c.filter((x) => x.direction === "owed_to_me").length} owed to you.`,
        blocks: ledgerBlocks(c),
      };
    }
    case "catchup": {
      const b = await runReentry(ctx.rts, { afterTs: after, awayDays: ctx.awayDays });
      return { intent, text: "The 3 that matter most: " + b.topThree.join("; "), blocks: reentryBlocks(b) };
    }
    case "focus": {
      const mins = Number(input.match(/(\d{2,3})\s*(min|m)\b/)?.[1] ?? 90);
      const p = await planFocusBlock({
        nowTs: ctx.nowTs,
        durationMins: mins,
        title: "Deep work (protected by Tempo)",
        subjectUserId: ctx.subjectUserId,
        userToken: ctx.userToken,
      });
      return { intent, text: p.summary, blocks: focusBlocks(p) };
    }
    case "decode": {
      const text = extractDecodeTarget(input) ?? (await latestAmbiguousMessage(ctx));
      if (!text) {
        return { intent: "help", text: "Paste a message and I'll decode it.", blocks: helpBlocks() };
      }
      const d = await decodeMessage(text, { rts: ctx.rts });
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
