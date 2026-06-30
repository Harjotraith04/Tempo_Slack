/**
 * End-to-end demo: runs the full "Sam returns from a week off" narrative through
 * the real Tempo pipeline (orchestrator → modules → RTS + AI + MCP) and prints
 * it to the console. Works with zero credentials (TEMPO_RTS=mock, TEMPO_AI=mock).
 *
 *   npm run demo
 *
 * This is both the verification harness and the storyboard for the 3-min video.
 */

import { buildContext } from "../src/agent/context.js";
import { respond } from "../src/agent/orchestrator.js";
import { checkDraft } from "../src/modules/decoder.js";
import { config } from "../src/config.js";

function rule(title: string) {
  console.log("\n" + "─".repeat(72));
  console.log(`  ${title}`);
  console.log("─".repeat(72));
}

function renderBlocks(blocks: any[]) {
  for (const b of blocks) {
    if (b.type === "header") console.log(`\n## ${b.text.text}`);
    else if (b.type === "section") console.log(b.text.text);
    else if (b.type === "context") console.log(`  ⌁ ${b.elements.map((e: any) => e.text).join(" ")}`);
    else if (b.type === "divider") console.log("  · · ·");
    else if (b.type === "actions")
      console.log(`  [ ${b.elements.map((e: any) => e.text.text).join(" ] [ ")} ]`);
  }
}

async function main() {
  console.log(`\nTEMPO — executive-function co-pilot for Slack`);
  console.log(`(RTS=${config.runtime.rts}, AI=${config.ai.mode})`);
  console.log(`Scene: Sam Rivera, a PM, opens Slack on Monday after a week off.`);

  const ctx = buildContext({ subjectName: "Sam" });

  rule('1. "What needs me today?" — Triage');
  renderBlocks((await respond(ctx, "what needs me today?")).blocks);

  rule('2. "What does this really mean?" — Tone decode (Marco\'s message)');
  renderBlocks(
    (await respond(ctx, 'decode: "No rush 🙂 whenever you get a chance I guess. Not like the handoff is waiting on it."')).blocks,
  );

  rule('3. "How will my reply land?" — Draft check');
  renderBlocks(
    (await import("../src/blocks/index.js")).draftCheckBlocks(await checkDraft("No.")),
  );

  rule('4. "What did I promise?" — Commitment Ledger');
  renderBlocks((await respond(ctx, "show my commitments")).blocks);

  rule('5. "Protect my focus" — Focus Guardian (+ MCP calendar/task)');
  renderBlocks((await respond(ctx, "block 90 min of focus time")).blocks);

  rule('6. "Catch me up" — Re-entry brief');
  renderBlocks((await respond(ctx, "catch me up on what I missed")).blocks);

  console.log("\n" + "─".repeat(72));
  console.log("  Nothing above was sent or changed without Sam's tap. Nothing RTS");
  console.log("  returned was stored. This is assistive tech for the Slack firehose.");
  console.log("─".repeat(72) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
