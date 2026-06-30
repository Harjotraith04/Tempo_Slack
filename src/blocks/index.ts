/**
 * Block Kit builders — Tempo's calm, accessible UI.
 *
 * Design rules (this is what makes it assistive tech, not decoration):
 *  - Never dump a firehose: small, ranked, scannable.
 *  - Plain language, one idea per line.
 *  - Low-stimulation: minimal emoji, generous dividers, clear hierarchy.
 *  - Every claim links back to the source message (jump links).
 *  - Human-in-the-loop: actions are buttons the user taps, never auto-sent.
 */

import type { KnownBlock } from "@slack/types";
import type { TriageItem, TriageResult } from "../modules/triage.js";
import type { Commitment } from "../modules/ledger.js";
import type { ToneDecode, DraftCheck } from "../modules/decoder.js";
import type { FocusPlan } from "../modules/focus.js";
import type { ReentryBrief } from "../modules/reentry.js";

const CAT_LABEL: Record<TriageItem["category"], string> = {
  ACT: "Needs a reply",
  BLOCKER: "Someone's blocked on you",
  FYI: "Worth knowing",
  NOISE: "Skipped",
};

function header(text: string): KnownBlock {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}
function section(md: string): KnownBlock {
  return { type: "section", text: { type: "mrkdwn", text: md } };
}
function context(md: string): KnownBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text: md }] };
}
const divider: KnownBlock = { type: "divider" };

function btn(
  text: string,
  actionId: string,
  value: string,
  style?: "primary" | "danger",
): any {
  const b: any = { type: "button", text: { type: "plain_text", text }, action_id: actionId, value };
  if (style) b.style = style;
  return b;
}

function linkBtn(text: string, url: string): any {
  // URL buttons open directly with no server round-trip. Slack still requires an
  // action_id; it just won't trigger our handlers.
  return { type: "button", text: { type: "plain_text", text }, url, action_id: "open_link" };
}

// ── Triage ───────────────────────────────────────────────────────────────────

export function triageBlocks(r: TriageResult): KnownBlock[] {
  const top = r.needsYou.slice(0, 3);
  const blocks: KnownBlock[] = [
    header(top.length ? `${top.length} thing${top.length > 1 ? "s" : ""} actually need you` : "You're all caught up"),
    context(
      `I scanned *${r.scanned}* recent messages and quietly handled *${r.handledQuietly}* that didn't need you.`,
    ),
  ];

  for (const item of top) {
    blocks.push(divider);
    blocks.push(
      section(
        `*${CAT_LABEL[item.category]}* · ${item.authorName ?? "someone"} in *#${item.channelName ?? "dm"}*\n` +
          `> ${item.excerpt}\n` +
          `_Why this matters:_ ${item.reason}`,
      ),
    );
    blocks.push({
      type: "actions",
      elements: [
        linkBtn("Open in Slack", item.permalink),
        btn("Draft a reply", "draft_reply", item.permalink, "primary"),
        btn("Snooze", "snooze", item.permalink),
        btn("Done", "mark_done", item.permalink),
      ],
    } as KnownBlock);
  }

  if (r.needsYou.length > top.length) {
    blocks.push(divider);
    blocks.push(context(`+ ${r.needsYou.length - top.length} more lower-priority items. Ask me to "show the rest" when you're ready.`));
  }
  return blocks;
}

// ── Commitment Ledger ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Commitment["status"], string> = {
  overdue: "⚠️ Overdue",
  at_risk: "⏳ Due soon",
  open: "Open",
  done: "✓ Done",
};

export function ledgerBlocks(commitments: Commitment[]): KnownBlock[] {
  const mine = commitments.filter((c) => c.direction === "i_owe");
  const theirs = commitments.filter((c) => c.direction === "owed_to_me");
  const blocks: KnownBlock[] = [header("Your commitments")];

  blocks.push(section("*You promised:*"));
  if (mine.length === 0) blocks.push(context("Nothing outstanding — nice."));
  for (const c of mine) {
    blocks.push(
      section(
        `${STATUS_LABEL[c.status]} · *${c.what}* — to ${c.counterparty}${c.dueText ? ` (${c.dueText})` : ""}`,
      ),
    );
    blocks.push({
      type: "actions",
      elements: [
        linkBtn("Open", c.permalink),
        btn("Draft it now", "draft_deliverable", c.id, "primary"),
        btn("Renegotiate", "renegotiate", c.id),
      ],
    } as KnownBlock);
  }

  blocks.push(divider);
  blocks.push(section("*Owed to you:*"));
  if (theirs.length === 0) blocks.push(context("No one owes you anything tracked."));
  for (const c of theirs) {
    blocks.push(section(`${STATUS_LABEL[c.status]} · *${c.what}* — from ${c.counterparty}${c.dueText ? ` (${c.dueText})` : ""}`));
    blocks.push({
      type: "actions",
      elements: [btn("Open", "open_link", c.permalink), btn("Nudge them", "nudge", c.id)],
    } as KnownBlock);
  }
  return blocks;
}

// ── Tone decode ──────────────────────────────────────────────────────────────

export function decodeBlocks(d: ToneDecode, original?: string): KnownBlock[] {
  const pct = Math.round(d.confidence * 100);
  return [
    header("What this message really means"),
    ...(original ? [section(`> ${original}`)] : []),
    section(
      `*Literally:* ${d.literalMeaning}\n` +
        `*Probably means:* ${d.impliedMeaning}\n` +
        `*Tone:* ${d.emotionalTone}\n` +
        `*Real urgency:* ${d.urgencyRead}\n` +
        `*They expect:* ${d.socialExpectation}`,
    ),
    context(`Confidence ${pct}%. ${d.caveat}`),
  ];
}

export function draftCheckBlocks(c: DraftCheck): KnownBlock[] {
  return [
    header("How your message will land"),
    section(`*Likely impression:* ${c.howItLands}`),
    ...(c.risks.length ? [section("*Watch out for:*\n" + c.risks.map((r) => `• ${r}`).join("\n"))] : []),
    divider,
    section(`*Suggested rewrite:*\n> ${c.rewrite}`),
    context(`Plain version: ${c.plainLanguage}`),
    {
      type: "actions",
      elements: [btn("Use rewrite", "use_rewrite", "rewrite", "primary"), btn("Keep mine", "keep_draft", "keep")],
    } as KnownBlock,
  ];
}

// ── Focus ────────────────────────────────────────────────────────────────────

function clock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function focusBlocks(p: FocusPlan): KnownBlock[] {
  return [
    header("Focus time protected"),
    section(
      `*${p.title}*\n${clock(p.startTs)}–${clock(p.endTs)} blocked on your calendar.\n` +
        (p.task ? `Task created: <${p.task.url}|${p.task.provider}>\n` : "") +
        `Do-Not-Disturb on until ${clock(p.dndUntilTs)} — only true blockers break through.`,
    ),
    context(`Calendar: <${p.calendar.htmlLink}|${p.calendar.provider}> · ${p.summary}`),
  ];
}

// ── Re-entry ─────────────────────────────────────────────────────────────────

function bullets(items: string[]): string {
  return items.length ? items.map((i) => `• ${i}`).join("\n") : "_Nothing here._";
}

export function reentryBlocks(b: ReentryBrief): KnownBlock[] {
  return [
    header(`Welcome back — here's your ${b.awayDays} days, calmly`),
    section("*The 3 that matter most:*\n" + bullets(b.topThree)),
    divider,
    section("*Decided while you were out:*\n" + bullets(b.decisions)),
    section("*Changed for your projects:*\n" + bullets(b.changesToYourProjects)),
    section("*People waiting on you:*\n" + bullets(b.peopleWaiting)),
    section("*Now expected of you:*\n" + bullets(b.nowExpectedOfYou)),
    context("Take it one item at a time. Ask me to draft any of these for you."),
  ];
}

// ── App Home + help ──────────────────────────────────────────────────────────

export function homeBlocks(): KnownBlock[] {
  return [
    header("Tempo"),
    section("Your working memory for Slack. I triage the firehose, remember your commitments, decode tone, and protect your focus — and I never act without your tap."),
    divider,
    section("*Try:*"),
    section("• `/tempo triage` — what actually needs you\n• `/tempo commitments` — promises you made & are owed\n• `/tempo catchup` — a calm re-entry brief\n• `/tempo focus` — protect a deep-work block\n• Paste a confusing message and ask *what does this really mean?*"),
    context("Grounded live in the Slack Real-Time Search API. Nothing it reads is stored."),
  ];
}

export function helpBlocks(): KnownBlock[] {
  return homeBlocks();
}
