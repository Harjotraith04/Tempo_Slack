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
import type { TriageItem, TriageResult } from "../../../modules/triage.js";
import type { Commitment } from "../../../modules/ledger.js";
import type { ToneDecode, DraftCheck } from "../../../modules/decoder.js";
import type { FocusPlan } from "../../../modules/focus.js";
import type { ReentryBrief } from "../../../modules/reentry.js";
import type { UserMetrics } from "../../../ports/store.js";
import type { HandoffSuggestion } from "../../../modules/handoff/index.js";
import type { LoadAssessment } from "../../../modules/intelligence/index.js";

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

export function triageBlocks(r: TriageResult, opts: { maxItems?: number } = {}): KnownBlock[] {
  const maxItems = opts.maxItems ?? 3;
  const top = r.needsYou.slice(0, maxItems);
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
    // Triage action buttons carry the permalink AND the sender id, so the
    // handler can attribute the learning signal to a person (see actionTarget).
    const v = JSON.stringify({ p: item.permalink, s: item.authorId });
    blocks.push({
      type: "actions",
      elements: [
        linkBtn("Open in Slack", item.permalink),
        btn("Draft a reply", "draft_reply", v, "primary"),
        btn("Snooze", "snooze", v),
        btn("Done", "mark_done", v),
      ],
    } as KnownBlock);
  }

  if (r.needsYou.length > top.length) {
    blocks.push(divider);
    blocks.push(context(`+ ${r.needsYou.length - top.length} more lower-priority items.`));
    blocks.push({
      type: "actions",
      elements: [btn("Show the rest", "show_rest", "show_rest")],
    } as KnownBlock);
  }
  return blocks;
}

// ── Commitment Ledger ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Commitment["status"], string> = {
  overdue: "⚠️ Overdue",
  at_risk: "⏳ Due soon",
  open: "Open",
  done: "✓ Done",
  renegotiating: "🔄 Renegotiating",
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
        btn("Draft it now", "draft_deliverable", c.permalink, "primary"),
        btn("Renegotiate", "renegotiate", c.permalink),
        btn("Remind me", "remind_commitment", c.permalink),
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
      elements: [
        linkBtn("Open", c.permalink),
        btn("Nudge them", "nudge", c.permalink),
        btn("Remind me", "remind_commitment", c.permalink),
      ],
    } as KnownBlock);
  }
  return blocks;
}

/** A calm proactive "these are slipping" nudge — derived facts only, appended to
 * the morning digest (dropped-ball prevention). Empty when nothing is at risk. */
export function droppedBallBlocks(commitments: Commitment[]): KnownBlock[] {
  if (commitments.length === 0) return [];
  const lines = commitments
    .map(
      (c) =>
        `• ${STATUS_LABEL[c.status]} · *${c.what}* — ` +
        (c.direction === "i_owe" ? `you owe ${c.counterparty}` : `${c.counterparty} owes you`) +
        (c.dueText ? ` (${c.dueText})` : ""),
    )
    .join("\n");
  const many = commitments.length > 1;
  return [
    divider,
    section(
      `⚠️ *${commitments.length} commitment${many ? "s are" : " is"} slipping* — a gentle heads-up before ${many ? "they" : "it"} falls through:\n${lines}`,
    ),
  ];
}

// ── Proactive intelligence (v3.4) ────────────────────────────────────────────

/** An opt-in, calm overload heads-up — only when the week reads busy/heavy, and
 * only ever ending in a suggestion the user can tap (never an action). */
export function overloadBlocks(a: LoadAssessment): KnownBlock[] {
  if (a.level === "calm" || a.drivers.length === 0) return [];
  const emoji = a.level === "heavy" ? "🌡️" : "📊";
  return [
    divider,
    section(
      `${emoji} *A gentle heads-up — your week looks ${a.level}.*\n` +
        a.drivers.map((d) => `• ${d}`).join("\n"),
    ),
    ...(a.suggestion ? [context(`${a.suggestion} — only if you want; I won't do anything without your tap.`)] : []),
  ];
}

/** Smart batching — non-urgent FYIs gathered into one calm section instead of
 * interrupting for each. Derived facts only (author + the AI's one-line reason). */
export function batchedFyiBlocks(items: TriageItem[]): KnownBlock[] {
  if (items.length === 0) return [];
  const shown = items.slice(0, 5);
  const more = items.length - shown.length;
  return [
    divider,
    section(
      `📥 *${items.length} low-priority update${items.length > 1 ? "s" : ""} batched* — nothing urgent, here when you have a moment:\n` +
        shown.map((i) => `• *${i.authorName ?? "someone"}* in #${i.channelName ?? "dm"}: ${i.reason}`).join("\n") +
        (more > 0 ? `\n• …and ${more} more` : ""),
    ),
  ];
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

// ── Empty & error states ─────────────────────────────────────────────────────

/** A calm "nothing to do here" card. Empty is a *good* outcome for an attention
 * tool — we say so warmly rather than showing a bare, anxious blank. */
export function emptyStateBlocks(intent: "triage" | "commitments" | "catchup"): KnownBlock[] {
  const copy: Record<typeof intent, { title: string; body: string }> = {
    triage: {
      title: "You're all caught up ✨",
      body: "Nothing needs you right now. I'll keep scanning quietly and surface anything that does.",
    },
    commitments: {
      title: "No open commitments",
      body: "Nothing you promised is outstanding, and no one owes you anything I'm tracking. Nice.",
    },
    catchup: {
      title: "Nothing major to catch up on",
      body: "No big decisions or changes while you were away. You can ease back in.",
    },
  };
  const c = copy[intent];
  return [header(c.title), section(c.body)];
}

/** Shown when a surface hits an unexpected error — reassures the user that
 * nothing was changed (Tempo never acts without a tap, errors included). */
export function errorBlocks(): KnownBlock[] {
  return [
    header("I hit a snag"),
    section("Something went wrong pulling that together — *nothing was changed*. Try again in a moment."),
  ];
}

// ── Weekly impact (privacy-safe counts) ──────────────────────────────────────

/** A gentle "your week with Tempo" summary. Counts only — never content. */
export function metricsBlocks(m?: UserMetrics): KnownBlock[] {
  if (!m || (m.messagesTriaged === 0 && m.obligationsSurfaced === 0 && m.focusMinutesProtected === 0 && m.itemsRecovered === 0)) {
    return [context("_Your week with Tempo will show here as you use it — counts only, never message content._")];
  }
  const parts = [
    `*${m.messagesTriaged}* messages triaged`,
    `*${m.obligationsSurfaced}* commitments surfaced`,
    `*${m.focusMinutesProtected}* focus-minutes protected`,
    `*${m.itemsRecovered}* items recovered`,
  ];
  return [
    section("*Your week with Tempo*\n" + parts.join(" · ")),
    context("Privacy-safe counts only — Tempo never stores what it reads."),
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

/** A graceful "that's not mine — here's who to ask" card when a request is
 * outside Tempo's four capabilities (v3.2 handoff routing). */
export function handoffBlocks(h: HandoffSuggestion): KnownBlock[] {
  return [
    header("Not my area — let me hand it off"),
    section(
      `This looks like a *${h.category}* request. I'm an executive-function co-pilot, so I focus on:\n` +
        h.capabilities.map((c) => `• ${c}`).join("\n"),
    ),
    context(`For this one, try ${h.suggestion}. Ask me anything in my wheelhouse and I've got you. 🫶`),
  ];
}

/** The App Home tab — live triage + commitments, reusing the same renders the
 * Assistant pane / `/tempo` produce, plus a settings entry point. Focus is
 * deliberately a static call-to-action, never a live block here: planning a
 * focus block has real side effects (MCP + Slack DND/status), and opening the
 * Home tab must never act without the user's explicit tap. */
export function homeDashboardBlocks(opts: {
  triage: KnownBlock[];
  commitments: KnownBlock[];
  metrics?: UserMetrics;
  /** Which v2.0 native surfaces to offer (feature-flagged). */
  surfaces?: { canvas?: boolean; lists?: boolean };
}): KnownBlock[] {
  const surfaceButtons: any[] = [];
  if (opts.surfaces?.canvas) surfaceButtons.push(btn("🗒️ Update my Canvas", "refresh_canvas", "refresh_canvas", "primary"));
  if (opts.surfaces?.lists) surfaceButtons.push(btn("✅ Sync commitments to a List", "sync_ledger_list", "sync_ledger_list"));

  return [
    header("Tempo"),
    section("Your working memory for Slack — calm, live, and grounded in what's actually happening. I never act without your tap."),
    {
      type: "actions",
      elements: [btn("⚙️ Settings", "open_settings", "open_settings")],
    } as KnownBlock,
    divider,
    ...metricsBlocks(opts.metrics),
    divider,
    ...opts.triage,
    divider,
    ...opts.commitments,
    ...(surfaceButtons.length
      ? [
          divider as KnownBlock,
          section("*Native surfaces:*\nKeep a living *Tempo Canvas* of today's plan, or mirror your Commitment Ledger to a *Slack List*. Both update only when you tap."),
          { type: "actions", elements: surfaceButtons } as KnownBlock,
        ]
      : []),
    divider,
    section("*Protect your focus:*\nRun `/tempo focus` (or ask the Assistant) to block real calendar time and turn on Do-Not-Disturb — Tempo never starts a focus block on its own."),
    context("Grounded live in the Slack Real-Time Search API. Nothing it reads is stored."),
  ];
}

// ── Onboarding ───────────────────────────────────────────────────────────────

/** The first-run banner — shown above the live App Home dashboard only until
 * the user taps through it (app.ts's "complete_onboarding" action). */
export function onboardingBlocks(): KnownBlock[] {
  return [
    header("Welcome to Tempo 👋"),
    section(
      "Your working memory for Slack — five things, always with your tap first:\n" +
        "• *Triage* — what actually needs you\n" +
        "• *Commitment Ledger* — promises made & owed\n" +
        "• *Tone Decoder* — what a message really means\n" +
        "• *Focus Guardian* — real Do-Not-Disturb + calendar protection\n" +
        "• *Re-entry* — a calm catch-up after time away",
    ),
    context("Nothing I read from Slack is ever stored. I only act when you tap a button."),
    {
      type: "actions",
      elements: [btn("Got it — let's go", "complete_onboarding", "complete_onboarding", "primary")],
    } as KnownBlock,
    divider,
  ];
}

// ── Settings modal ──────────────────────────────────────────────────────────

const VERBOSITY_OPTIONS = [
  { text: { type: "plain_text", text: "Standard — full context" }, value: "standard" },
  { text: { type: "plain_text", text: "Brief — one line" }, value: "brief" },
] as const;

const READING_LEVEL_OPTIONS = [
  { text: { type: "plain_text", text: "Plain language" }, value: "plain" },
  { text: { type: "plain_text", text: "Standard" }, value: "standard" },
] as const;

const MAX_ITEMS_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({
  text: { type: "plain_text", text: String(n) },
  value: String(n),
}));

const READ_ALOUD_OPTION = { text: { type: "plain_text", text: "Read responses aloud (speech script)" }, value: "on" };

export interface SettingsModalPrefs {
  verbosity: "brief" | "standard";
  readingLevel: "plain" | "standard";
  readAloud: boolean;
  maxItems: number;
  focusDefaultMins?: number;
}

/** Modal view for `views.open`. Submission lands in `app.view("settings_modal", ...)`. */
export function settingsModalView(prefs: SettingsModalPrefs): any {
  return {
    type: "modal",
    callback_id: "settings_modal",
    title: { type: "plain_text", text: "Tempo settings" },
    submit: { type: "plain_text", text: "Save" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "verbosity",
        label: { type: "plain_text", text: "How much detail?" },
        element: {
          type: "radio_buttons",
          action_id: "value",
          options: VERBOSITY_OPTIONS,
          initial_option: VERBOSITY_OPTIONS.find((o) => o.value === prefs.verbosity),
        },
      },
      {
        type: "input",
        block_id: "reading_level",
        label: { type: "plain_text", text: "Reading level" },
        element: {
          type: "radio_buttons",
          action_id: "value",
          options: READING_LEVEL_OPTIONS,
          initial_option: READING_LEVEL_OPTIONS.find((o) => o.value === prefs.readingLevel),
        },
      },
      {
        type: "input",
        block_id: "max_items",
        label: { type: "plain_text", text: "Max items per card" },
        element: {
          type: "static_select",
          action_id: "value",
          options: MAX_ITEMS_OPTIONS,
          initial_option: MAX_ITEMS_OPTIONS.find((o) => o.value === String(prefs.maxItems)) ?? MAX_ITEMS_OPTIONS[2],
        },
      },
      {
        type: "input",
        block_id: "focus_default_mins",
        optional: true,
        label: { type: "plain_text", text: "Default focus block length (minutes)" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          initial_value: prefs.focusDefaultMins ? String(prefs.focusDefaultMins) : undefined,
          placeholder: { type: "plain_text", text: "e.g. 90" },
        },
      },
      {
        type: "input",
        block_id: "read_aloud",
        optional: true,
        label: { type: "plain_text", text: "Accessibility" },
        element: {
          type: "checkboxes",
          action_id: "value",
          options: [READ_ALOUD_OPTION],
          initial_options: prefs.readAloud ? [READ_ALOUD_OPTION] : [],
        },
      },
    ],
  };
}
