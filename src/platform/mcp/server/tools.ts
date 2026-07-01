/**
 * Tempo-as-an-MCP-server: the tool definitions (v3.0). SDK-FREE — each tool is a
 * pure `(args, ctx) => { summary, data }` over the existing domain, so the whole
 * inbound surface is unit-testable and demoable with no `@modelcontextprotocol/
 * sdk` and no credentials. `serve.ts` is the only file that adapts these to the
 * real MCP `Server`.
 *
 * Trust model (mirrors the outbound client): a tool runs as the INITIATING user
 * — RTS uses their token — and returns only DERIVED facts. Never raw RTS message
 * content (no excerpts, no `sourceText`) crosses the MCP boundary.
 */

import { z } from "zod";
import type { TempoContext } from "../../../application/context.js";
import { liveTriage, liveCommitments } from "../../../application/read-models.js";
import { decodeMessage } from "../../../modules/decoder.js";
import { planFocusBlock } from "../../../modules/focus.js";

export interface TempoToolResult {
  /** Human/agent-readable text (the MCP `content`). */
  summary: string;
  /** The structured payload (the MCP `structuredContent`). */
  data: Record<string, unknown>;
}

export interface TempoTool {
  name: string;
  description: string;
  /** A Zod raw shape (what MCP `registerTool` expects for `inputSchema`). */
  inputShape: z.ZodRawShape;
  run(args: Record<string, unknown>, ctx: TempoContext): Promise<TempoToolResult>;
}

const numArg = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export const TEMPO_TOOLS: TempoTool[] = [
  {
    name: "tempo_triage",
    description:
      "Triage the user's Slack since they were last active into what actually needs them (ACT / BLOCKER / FYI), ranked, including implicit blockers nobody @-mentioned them on. Returns derived facts only — never raw message content.",
    inputShape: { limit: z.number().int().min(1).max(20).optional().describe("Max items to return (default 5).") },
    async run(args, ctx) {
      const r = await liveTriage(ctx);
      const items = r.needsYou.slice(0, numArg(args.limit, 5)).map((i) => ({
        permalink: i.permalink,
        from: i.authorName,
        channel: i.channelName,
        category: i.category,
        urgency: i.urgency,
        reason: i.reason,
        suggestedAction: i.suggestedAction,
      }));
      const summary = items.length
        ? `${items.length} thing${items.length > 1 ? "s" : ""} need you: ` +
          items.map((i) => `${i.suggestedAction} (${i.reason})`).join("; ")
        : "You're all caught up.";
      return { summary, data: { scanned: r.scanned, needsYou: items } };
    },
  },
  {
    name: "tempo_commitments",
    description:
      "List the promises the user made and were made to them, with due dates and status (overdue / at-risk / open / done). Derived facts only — no message text.",
    inputShape: {},
    async run(_args, ctx) {
      const c = await liveCommitments(ctx);
      const commitments = c.map((x) => ({
        direction: x.direction,
        counterparty: x.counterparty,
        what: x.what,
        dueText: x.dueText,
        status: x.status,
        permalink: x.permalink,
      }));
      const iOwe = c.filter((x) => x.direction === "i_owe").length;
      return {
        summary: `${iOwe} open promise${iOwe === 1 ? "" : "s"} you made and ${c.length - iOwe} owed to you.`,
        data: { commitments },
      };
    },
  },
  {
    name: "tempo_decode",
    description:
      "Decode a Slack message's implied meaning, tone, real urgency, and social expectation — with an honest confidence (0-1) and a caveat. The message text is supplied by the caller.",
    inputShape: {
      text: z.string().min(1).describe("The message text to decode."),
      from: z.string().optional().describe("The sender's name, for relationship grounding."),
    },
    async run(args, ctx) {
      const d = await decodeMessage(String(args.text ?? ""), ctx.llm, {
        rts: ctx.rts,
        authorName: args.from ? String(args.from) : undefined,
      });
      return { summary: `Probably means: ${d.impliedMeaning}`, data: { ...d } };
    },
  },
  {
    name: "tempo_focus",
    description:
      "Protect a deep-work focus block on the initiating user's behalf: a real calendar block + a task (via MCP) plus Slack DND/status. Human-in-the-loop — the tool call itself is the user's explicit request.",
    inputShape: { minutes: z.number().int().min(5).max(480).optional().describe("How long to protect (default 90).") },
    async run(args, ctx) {
      const p = await planFocusBlock({
        nowTs: ctx.nowTs,
        durationMins: numArg(args.minutes, 90),
        title: "Deep work (protected by Tempo)",
        subjectUserId: ctx.subjectUserId,
        userToken: ctx.userToken,
        mcp: ctx.container.mcp(),
        slack: ctx.container.slackActions({ userToken: ctx.userToken }),
      });
      return { summary: p.summary, data: { ...p } };
    },
  },
];
