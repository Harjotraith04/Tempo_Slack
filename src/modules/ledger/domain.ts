/**
 * Commitment Ledger — domain types + pure logic (schema, status rules, due-date
 * parsing, and the deterministic mock extractor that doubles as the test
 * oracle). No ports, no transport — see service.ts for the RTS/LLM orchestration.
 */

import * as chrono from "chrono-node";
import { z } from "zod";
import type { RtsMessage } from "../../ports/rts.js";

export type CommitmentDirection = "i_owe" | "owed_to_me";
export type CommitmentStatus = "open" | "at_risk" | "overdue" | "done" | "renegotiating";

export interface Commitment {
  id: string;
  direction: CommitmentDirection;
  counterparty: string;
  what: string;
  dueText?: string;
  dueTs?: number;
  status: CommitmentStatus;
  permalink: string;
  sourceText: string;
}

export const ExtractSchema = z.object({
  items: z.array(
    z.object({
      permalink: z.string(),
      isCommitment: z.boolean(),
      direction: z.enum(["i_owe", "owed_to_me"]),
      counterparty: z.string(),
      what: z.string(),
      dueText: z.string().optional(),
    }),
  ),
});

export const SYSTEM = `You are Tempo. Extract concrete interpersonal commitments from Slack messages for the user Sam Rivera.
A commitment is a promise to deliver something by some time. For each message decide:
- isCommitment: true only if there is a real deliverable + (usually) a time.
- direction: "i_owe" if Sam is the one promising; "owed_to_me" if someone is promising Sam.
- counterparty: the other person's name.
- what: the deliverable, in a short imperative phrase ("Send the Atlas API spec").
- dueText: the raw time phrase if any ("by Friday", "EOD Monday", "Wednesday").
Ignore vague encouragement, banter, and FYIs.`;

const AT_RISK_WINDOW = 24 * 3600;

export function parseDue(dueText: string | undefined, refTs: string): number | undefined {
  if (!dueText) return undefined;
  const ref = new Date(Number(refTs.split(".")[0]) * 1000);
  const d = chrono.parseDate(dueText, ref, { forwardDate: true });
  return d ? Math.floor(d.getTime() / 1000) : undefined;
}

export function statusFor(dueTs: number | undefined, nowTs: number): CommitmentStatus {
  if (dueTs === undefined) return "open";
  if (dueTs < nowTs) return "overdue";
  if (dueTs - nowTs <= AT_RISK_WINDOW) return "at_risk";
  return "open";
}

/** Most urgent first: overdue, then at-risk, then by due date. */
export function sortByUrgency(commitments: Commitment[]): Commitment[] {
  const order: Record<CommitmentStatus, number> = {
    overdue: 0,
    at_risk: 1,
    renegotiating: 2,
    open: 3,
    done: 4,
  };
  return commitments.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return (a.dueTs ?? Infinity) - (b.dueTs ?? Infinity);
  });
}

export function buildPrompt(messages: RtsMessage[]): string {
  return messages
    .map(
      (m) =>
        `permalink=${m.permalink} from=${m.authorRealName ?? m.authorName} to_channel=#${m.channelName} (${m.channelType})\n  "${m.text}"`,
    )
    .join("\n");
}

export function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `c_${(h >>> 0).toString(36)}`;
}

// ── Deterministic mock extractor ─────────────────────────────────────────────

export function mockExtract(m: RtsMessage): z.infer<typeof ExtractSchema>["items"][number] | null {
  const t = m.text.toLowerCase();
  const me = (m.authorName ?? "").toLowerCase() === "sam";

  if (t.includes("finalized atlas api spec") && t.includes("friday")) {
    return {
      permalink: m.permalink,
      isCommitment: true,
      direction: "i_owe",
      counterparty: "Priya Nair",
      what: "Send the finalized Atlas API spec",
      dueText: "Friday",
    };
  }
  if (t.includes("pricing numbers") && t.includes("wednesday")) {
    return {
      permalink: m.permalink,
      isCommitment: true,
      direction: "owed_to_me",
      counterparty: "Jordan Park",
      what: "Send the updated pricing numbers",
      dueText: "Wednesday",
    };
  }
  // Generic catch for other "I'll ... by ..." patterns.
  if ((t.includes("i'll") || t.includes("i will")) && /by\s+\w+/.test(t)) {
    const due = t.match(/by\s+([a-z]+)/)?.[1];
    return {
      permalink: m.permalink,
      isCommitment: true,
      direction: me ? "i_owe" : "owed_to_me",
      counterparty: me ? "someone" : (m.authorRealName ?? "someone"),
      what: m.text.slice(0, 60),
      dueText: due ? `by ${due}` : undefined,
    };
  }
  return { permalink: m.permalink, isCommitment: false, direction: "i_owe", counterparty: "", what: "" };
}
