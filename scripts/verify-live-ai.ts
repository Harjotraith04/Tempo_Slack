/**
 * Standalone live-OpenAI check — mirrors verify-live-postgres.ts / verify-live-rts.ts.
 *
 * NEVER imported by the app/orchestrator/tests, and NOT wired into `npm test` /
 * `npm run demo`, so it can't break the zero-credential path. With no
 * OPENAI_API_KEY it prints a clear "skipped" and exits 0; with one it makes
 * two real calls through the same LiveLlm adapter the modules use — one
 * structured() and one text() — and reports.
 *
 *   npm run verify:ai
 *
 * Why this exists: the live AI path was the ONLY seam without a verify script,
 * and it is the one that fails hardest. The adapter passes `temperature` on
 * every request (platform/ai/live.ts), and the newer Claude models reject
 * non-default sampling params with a 400 — so a wrong TEMPO_MODEL breaks all
 * five reasoning modules at once, and the mock never covers for it (the mock
 * adapter is selected only when the key is ABSENT). This catches that in one
 * command instead of in the middle of a demo.
 */

import "dotenv/config";
import { z } from "zod";
import { config } from "../src/config.js";
import { LiveLlm } from "../src/platform/ai/live.js";

const Triage = z.object({
  urgency: z.enum(["low", "medium", "high"]),
  reason: z.string(),
});

async function main(): Promise<void> {
  if (!config.ai.apiKey) {
    console.log(
      "Live AI verification skipped — no OPENAI_API_KEY configured.\n" +
        "This is expected for the zero-credential demo. Set OPENAI_API_KEY and re-run\n" +
        "`npm run verify:ai` to exercise the real OpenAI path.",
    );
    process.exit(0);
  }

  // A gpt-5.*/o-series id would make the AI SDK SILENTLY strip temperature —
  // the calls below would still pass, hiding the regression. Warn loudly.
  if (/^(o|gpt-5)/.test(config.ai.model)) {
    console.log(
      `⚠️  TEMPO_MODEL="${config.ai.model}" looks like a reasoning model. The AI SDK strips\n` +
        "   `temperature` for those WITHOUT erroring, so every call silently runs at the\n" +
        "   default sampling. Use a gpt-4.1-class model (e.g. gpt-4.1-mini) instead.\n",
    );
  }

  console.log(`Verifying live OpenAI via the LiveLlm adapter (model: ${config.ai.model})…\n`);
  const llm = new LiveLlm();

  console.log("1/2  structured() — the path every triage/ledger/decoder call takes");
  const obj = await llm.structured({
    system: "You triage Slack messages for a busy executive. Be terse.",
    prompt: 'Triage this message: "Need your sign-off on the DPA before Friday or the launch slips."',
    schema: Triage,
    mock: () => ({ urgency: "high" as const, reason: "blocking deadline" }),
    temperature: 0.2,
  });
  console.log(`     ✅ ${JSON.stringify(obj)}\n`);

  console.log("2/2  text() — the path every draft/reentry call takes");
  const text = await llm.text({
    system: "You write short, warm Slack replies.",
    prompt: "Draft a one-sentence reply promising the DPA sign-off by Thursday.",
    mock: () => "On it — you'll have the signed DPA by Thursday.",
    temperature: 0.4,
  });
  console.log(`     ✅ ${text.trim()}\n`);

  console.log(`✅ Live AI OK — model ${config.ai.model} accepted both calls (temperature included).`);
  console.log("All five reasoning modules will resolve against real OpenAI.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Live AI verification failed:", err);
  console.error(
    `\nModel in use: ${config.ai.model}\n` +
      "If this is a 400 mentioning `temperature`, the model rejects non-default sampling params.\n" +
      "The adapter sends temperature on every call, so pin a model that accepts it:\n" +
      "  TEMPO_MODEL=gpt-4.1-mini\n" +
      "If it's a 401, the key is wrong. If it's a model_not_found, your account can't reach that id.\n",
  );
  process.exit(1);
});
