/**
 * Tempo Canvas — the living personal command center, rendered as a calm Markdown
 * document (canvases.create/edit take Markdown, not Block Kit). Same design
 * spine as the Block Kit cards: ranked, never a firehose, one idea per line,
 * plain language, and only derived facts — never raw RTS message text.
 */

import type { TriageResult } from "../../../modules/triage.js";
import type { Commitment } from "../../../modules/ledger.js";
import type { FocusPlan } from "../../../modules/focus.js";

const STATUS_MARK: Record<Commitment["status"], string> = {
  overdue: "⚠️ overdue",
  at_risk: "⏳ due soon",
  open: "open",
  done: "✓ done",
  renegotiating: "🔄 renegotiating",
};

function clock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateLine(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Compose today's plan into a Markdown canvas. Deliberately caps the lists so
 * the canvas stays a calm command center, not a dump. `focus` is optional — the
 * canvas shows a call-to-action when no block is planned (opening a canvas must
 * never *start* a focus block).
 */
export function buildCanvasMarkdown(opts: {
  name: string;
  nowTs: number;
  triage: TriageResult;
  commitments: Commitment[];
  focus?: FocusPlan;
  maxItems?: number;
}): string {
  const maxItems = opts.maxItems ?? 5;
  const needs = opts.triage.needsYou.slice(0, maxItems);
  const iOwe = opts.commitments.filter((c) => c.direction === "i_owe" && c.status !== "done");
  const owed = opts.commitments.filter((c) => c.direction === "owed_to_me" && c.status !== "done");

  const lines: string[] = [];
  lines.push(`# Tempo — ${opts.name}`);
  lines.push(`_${dateLine(opts.nowTs)}. Your working memory for Slack — updated live, nothing stored._`);
  lines.push("");

  lines.push("## What needs you");
  if (needs.length === 0) {
    lines.push("- You're all caught up ✨");
  } else {
    for (const i of needs) {
      lines.push(`- **${i.suggestedAction}** — ${i.reason} (${i.channelName ? `#${i.channelName}` : "dm"})`);
    }
  }
  lines.push("");

  lines.push("## Commitments");
  lines.push("**You promised:**");
  if (iOwe.length === 0) lines.push("- Nothing outstanding — nice.");
  else for (const c of iOwe) lines.push(`- ${STATUS_MARK[c.status]} — ${c.what} → ${c.counterparty}${c.dueText ? ` (${c.dueText})` : ""}`);
  lines.push("");
  lines.push("**Owed to you:**");
  if (owed.length === 0) lines.push("- No one owes you anything tracked.");
  else for (const c of owed) lines.push(`- ${STATUS_MARK[c.status]} — ${c.what} ← ${c.counterparty}${c.dueText ? ` (${c.dueText})` : ""}`);
  lines.push("");

  lines.push("## Focus");
  if (opts.focus) {
    lines.push(`- 🎯 ${opts.focus.title}: ${clock(opts.focus.startTs)}–${clock(opts.focus.endTs)}, Do-Not-Disturb on until ${clock(opts.focus.dndUntilTs)}.`);
  } else {
    lines.push("- Ask Tempo to *protect my focus* to block real calendar time + Do-Not-Disturb. Tempo never starts a focus block on its own.");
  }
  lines.push("");
  lines.push("_Nothing here was sent or changed without your tap._");

  return lines.join("\n");
}
