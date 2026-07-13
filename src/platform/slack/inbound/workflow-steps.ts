/**
 * Workflow Builder custom steps (v2.0) — expose Tempo's core actions as steps
 * anyone can drop into a no-code Slack workflow:
 *   • summarize_missed — "Summarize what I missed" (Re-entry brief)
 *   • draft_reply      — "Draft a reply" (never sends; returns the text)
 *   • block_focus      — "Block focus time" (Focus Guardian)
 *   • add_commitment   — "Add a commitment" (tracks it with a native reminder)
 *
 * Each step just composes an existing use-case behind the same ports, wrapped in
 * `safely` so a failure `fail()`s the step calmly rather than hanging the
 * workflow. The manifest declares these under `functions` (see manifest.json);
 * `function_executed` events route here through whichever receiver is active.
 */

import type { App } from "@slack/bolt";
import type { TempoContext } from "../../../application/context.js";
import { respond } from "../../../application/orchestrator.js";
import { draftReply } from "../../../modules/draft.js";
import { remindAboutCommitment } from "../../../application/use-cases/surfaces.js";

type BoltApp = InstanceType<typeof App>;

export interface WorkflowStepDeps {
  /** Build a per-user context (shares the inbound layer's container + token store). */
  contextFor: (userId: string) => Promise<TempoContext>;
  /** The same calm error-guard the rest of the handlers use. */
  safely: (label: string, work: () => Promise<unknown>, recover?: () => Promise<unknown>) => Promise<void>;
  /** Calm failure copy. */
  snag: string;
}

export function registerWorkflowSteps(app: BoltApp, deps: WorkflowStepDeps): void {
  const { contextFor, safely, snag } = deps;
  const userOf = (inputs: any): string => String(inputs?.user ?? "U_SAM");

  app.function("summarize_missed", async ({ inputs, complete, fail }) => {
    await safely(
      "fn:summarize_missed",
      async () => {
        const res = await respond(await contextFor(userOf(inputs)), "catch me up on what I missed");
        await complete({ outputs: { summary: res.text } });
      },
      () => fail({ error: snag }),
    );
  });

  app.function("draft_reply", async ({ inputs, complete, fail }) => {
    await safely(
      "fn:draft_reply",
      async () => {
        const ctx = await contextFor(userOf(inputs));
        const message = String((inputs as any)?.message ?? "");
        const draft = await draftReply(message, ctx.llm, ctx.subjectName);
        await complete({ outputs: { draft } });
      },
      () => fail({ error: snag }),
    );
  });

  app.function("block_focus", async ({ inputs, complete, fail }) => {
    await safely(
      "fn:block_focus",
      async () => {
        const minutes = Number((inputs as any)?.minutes) || 90;
        const res = await respond(await contextFor(userOf(inputs)), `block ${minutes} min of focus time`);
        await complete({ outputs: { summary: res.text } });
      },
      () => fail({ error: snag }),
    );
  });

  app.function("add_commitment", async ({ inputs, complete, fail }) => {
    await safely(
      "fn:add_commitment",
      async () => {
        const what = String((inputs as any)?.what ?? "").trim();
        const counterparty = String((inputs as any)?.counterparty ?? "someone").trim() || "someone";
        // Track it with a native reminder a day out (the closest real effect to
        // "adding" a commitment, since the Ledger itself is rebuilt live from RTS).
        const time = Math.floor(Date.now() / 1000) + 24 * 3600;
        const r = await remindAboutCommitment(await contextFor(userOf(inputs)), {
          what,
          counterparty,
          direction: "i_owe",
          time,
        });
        await complete({
          outputs: {
            confirmation: r.ok
              ? `Tracking "${what}" for ${counterparty} — I set a reminder so it won't slip.`
              : `Noted "${what}" for ${counterparty}.`,
          },
        });
      },
      () => fail({ error: snag }),
    );
  });
}
