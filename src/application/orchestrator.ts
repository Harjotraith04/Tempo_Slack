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
import { liveTriage, liveCommitments } from "./read-models.js";
import { decodeMessage } from "../modules/decoder.js";
import { runReentry } from "../modules/reentry.js";
import { converse, CRISIS_SPEECH } from "../modules/converse.js";
import { planFocusBlock } from "../modules/focus.js";
import { familiarity as familiarityOf } from "../modules/intelligence/index.js";
// The application layer wires outbound adapters to the ports the domain modules
// declare; the per-turn container (on ctx) resolves mock/live by config, and
// ctx.store is the resolved persistence adapter (file or Postgres).
import {
  triageBlocks,
  ledgerBlocks,
  decodeBlocks,
  reentryBlocks,
  focusBlocks,
  helpBlocks,
  chatBlocks,
  handoffBlocks,
  emptyStateBlocks,
} from "../platform/slack/blockkit/index.js";
import { detectHandoff } from "../modules/handoff/index.js";
import { teamLoad } from "./use-cases/team.js";
import { teamLoadBlocks } from "../platform/slack/blockkit/index.js";
import { config, flags } from "../config.js";

import { toSpeech, condense, applyReadingLevel, resolveA11yPrefs, resolveLocale } from "../accessibility/index.js";
import { CORPUS_QUERY } from "../ports/rts.js";

export type Intent = "triage" | "commitments" | "decode" | "catchup" | "focus" | "team" | "help" | "chat";

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
  if (/\b(focus|deep work|do not disturb|dnd|protect)/.test(t)) return "focus";
  // "block 2 hours" / "block 90 min" / "block my calendar" — the bare "block"
  // phrasing people actually use. The old pattern demanded the literal words
  // "block time", so "block 2 hours" fell through to the help menu. `\bblock\b`
  // deliberately does NOT match "blocked" (as in "we're blocked on the spec"),
  // which is triage input, not a focus request.
  if (/\bblock\b.*\b(\d+\s*(h|hrs?|hours?|m|mins?|minutes?)\b|time|calendar)/.test(t)) return "focus";
  if (/\b(decode|what does this mean|really mean|tone|subtext|passive)/.test(t)) return "decode";
  if (/\b(team|manager mode|workload)\b/.test(t)) return "team";
  // Explicit menu request still gets the menu.
  if (/\b(help|what can you do|commands|how do i use|capabilities)\b/.test(t)) return "help";
  // Everything else is a CONVERSATION, not a dead end. This used to return
  // "help", which meant "hi", "who are you", "thanks" and — worst of all — "I'm
  // overwhelmed" all got answered with a feature menu. For a product about
  // cognitive load, answering distress with a command list is the most off-brand
  // thing it could possibly do.
  return "chat";
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
  const prefs = await ctx.store.prefs.get(ctx.subjectUserId);
  const a11y = resolveA11yPrefs(prefs);
  const locale = resolveLocale(prefs);
  const r = await respondCore(ctx, input, opts.record ?? true);

  // The crisis path speaks for itself, verbatim. Running it through the usual
  // pipeline would condense it, then bolt on the standard lead-in ("Here's what
  // I found.") and outro ("Take it one step at a time.") — chirpy scaffolding
  // around the one message that must never sound automated.
  if (r.speech) {
    return { ...r, text: r.text, blocks: r.blocks, speech: r.speech };
  }

  const text = applyReadingLevel(condense(r.text, a11y.verbosity), a11y.readingLevel);
  return { ...r, text, speech: toSpeech({ intent: r.intent, text }, locale) };
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
): Promise<Omit<TempoResponse, "speech"> & { speech?: string }> {
  const intent = routeIntent(input);
  const after = afterTsOf(ctx);
  const prefs = await ctx.store.prefs.get(ctx.subjectUserId);
  const a11y = resolveA11yPrefs(prefs);

  // A clearly out-of-scope request — one that only grazed a broad catch-up
  // keyword (e.g. "roll *back* the deploy", "file my PTO *request*") or matched
  // nothing — is handed off gracefully rather than guessed. The precise intents
  // (triage/commitments/decode/focus) are never intercepted.
  if (intent === "catchup" || intent === "help") {
    const handoff = detectHandoff(input);
    if (handoff) {
      return {
        intent: "help",
        text:
          `That looks like a ${handoff.category} task — not something I do. ` +
          `I focus on: ${handoff.capabilities.join(", ")}. Try ${handoff.suggestion}.`,
        blocks: handoffBlocks(handoff),
      };
    }
  }

  switch (intent) {
    case "triage": {
      const r = await liveTriage(ctx);
      const top = r.needsYou.slice(0, a11y.maxItems);
      if (record) await ctx.store.metrics.record(ctx.subjectUserId, { messagesTriaged: r.scanned });
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
      const c = await liveCommitments(ctx);
      if (record) await ctx.store.metrics.record(ctx.subjectUserId, { obligationsSurfaced: c.length });
      return {
        intent,
        text:
          `You have ${c.filter((x) => x.direction === "i_owe").length} open promises and ` +
          `${c.filter((x) => x.direction === "owed_to_me").length} owed to you.`,
        blocks: c.length ? ledgerBlocks(c) : emptyStateBlocks("commitments"),
      };
    }
    case "catchup": {
      const b = await runReentry(ctx.rts, ctx.llm, { afterTs: after, awayDays: ctx.awayDays, name: ctx.subjectName });
      return b.topThree.length
        ? { intent, text: "The 3 that matter most: " + b.topThree.join("; "), blocks: reentryBlocks(b) }
        : { intent, text: "Nothing major to catch up on.", blocks: emptyStateBlocks("catchup") };
    }
    case "focus": {
      const mins = parseFocusMinutes(input, prefs?.focusDefaultMins ?? 90);
      const p = await planFocusBlock({
        nowTs: ctx.nowTs,
        durationMins: mins,
        title: "Deep work (protected by Tempo)",
        subjectUserId: ctx.subjectUserId,
        userToken: ctx.userToken,
        mcp: ctx.container.mcp(),
        slack: ctx.container.slackActions({ userToken: ctx.userToken }),
      });
      if (record) await ctx.store.metrics.record(ctx.subjectUserId, { focusMinutesProtected: mins });
      return { intent, text: p.summary, blocks: focusBlocks(p) };
    }
    case "decode": {
      const pasted = extractDecodeTarget(input);
      const candidate = pasted ? undefined : await latestAmbiguousMessage(ctx);
      const text = pasted ?? candidate?.text;
      if (!text) {
        return { intent: "help", text: "Paste a message and I'll decode it.", blocks: helpBlocks() };
      }
      // Learned relationship grounding: how much history the user has with this
      // sender (from the same per-sender signals triage learns from).
      let fam = 0;
      if (candidate?.authorId) {
        const sigs = await ctx.store.signals.forUser(ctx.subjectUserId);
        fam = familiarityOf(sigs.find((s) => s.authorId === candidate.authorId));
      }
      const d = await decodeMessage(text, ctx.llm, {
        rts: ctx.rts,
        authorName: candidate?.authorName,
        familiarity: fam,
      });
      return { intent, text: `Probably means: ${d.impliedMeaning}`, blocks: decodeBlocks(d, text) };
    }
    case "team": {
      // Opt-in, anonymized team view — the personal-agent posture is the default.
      if (!flags.team) {
        return {
          intent: "help",
          text: "Team mode is off. It's an opt-in, fully-anonymized view — ask an admin to enable TEMPO_TEAM.",
          blocks: helpBlocks(),
        };
      }
      const r = await teamLoad(ctx.store, config.team.members, config.team.minMembers);
      const text = r.redacted
        ? `The team view stays hidden until at least ${r.minMembers} members opt in (currently ${r.memberCount}) — to keep everyone anonymous.`
        : `Team (anonymized): ${r.totalObligations} open obligations across ${r.memberCount} members; load is ${r.loadDistribution}.`;
      return { intent: "team", text, blocks: teamLoadBlocks(r) };
    }
    case "chat": {
      const r = await converse(input, ctx.llm, { name: ctx.subjectName });
      return {
        intent: "chat",
        text: r.reply,
        blocks: chatBlocks(r),
        // Crisis words are hand-written; they bypass condensing, reading-level
        // rewrites and the standard speech scaffolding entirely.
        ...(r.crisis ? { speech: CRISIS_SPEECH } : {}),
      };
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

/** Demo/live convenience: the most recent message that mentions the user —
 * returned whole so the decode path can key relationship grounding by sender. */
async function latestAmbiguousMessage(
  ctx: TempoContext,
): Promise<{ text: string; authorId?: string; authorName?: string } | undefined> {
  const res = await ctx.rts.search({
    query: CORPUS_QUERY,
    after: afterTsOf(ctx),
    limit: 10,
  });
  const candidate = res.messages.find((m) => m.mentionsMe) ?? res.messages[0];
  if (!candidate) return undefined;
  return {
    text: candidate.text,
    authorId: candidate.authorId,
    authorName: candidate.authorRealName ?? candidate.authorName,
  };
}

/**
 * How long to protect. People say "block 2 hours" at least as often as
 * "block 90 minutes", and the previous minutes-only pattern silently ignored
 * the former and fell back to the default — so asking for two hours got you
 * ninety minutes with no indication anything had been misread.
 *
 * Accepts: "2 hours" · "2h" · "1.5 hrs" · "90 minutes" · "90 min" · "45m".
 * Clamped to Slack's own 5–480 minute bounds (see manifest `block_focus`).
 */
export function parseFocusMinutes(input: string, dflt: number): number {
  const clamp = (n: number) => Math.max(5, Math.min(480, Math.round(n)));

  const hours = input.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hours) return clamp(parseFloat(hours[1]!) * 60);

  const mins = input.match(/(\d{1,3})\s*(?:minutes?|mins?|m)\b/i);
  if (mins) return clamp(Number(mins[1]!));

  return clamp(dflt);
}
