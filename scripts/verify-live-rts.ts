/**
 * Verifies the live RTS seam (src/platform/slack/rts/live.ts) against a real
 * Slack workspace. Standalone — never imported by app.ts/orchestrator.ts/tests,
 * and NOT wired into `npm test`/`npm run demo`, so it can never break the
 * zero-credential path. With no SLACK_USER_TOKEN it prints "skipped" and exits 0.
 *
 *   npm run verify:rts     (run it AFTER `npm run seed -- --execute`)
 *
 * It answers three questions, in the order they can kill the demo:
 *
 *  1. RETRIEVAL MODE — does this workspace have SEMANTIC search (Slack AI
 *     Search), or only KEYWORD? Semantic is not self-serve: it needs a Slack
 *     partnerships request. Probed via `assistant.search.info`.
 *
 *  2. DO OUR QUERIES SURVIVE KEYWORD MODE? Every query the app issues is a
 *     natural-language SEMANTIC prompt ("questions, requests, or decisions that
 *     mention me..."). A keyword engine may return ZERO results for those — the
 *     triage card would look broken while every seam is actually wired fine. So
 *     we run the app's real queries side by side with short keyword variants and
 *     print both.
 *
 *  3. DO THE PLANTED DEMO MOMENTS ACTUALLY SURFACE? Result counts are not the
 *     bar — the demo depends on specific seeded messages (Priya's blocker,
 *     Dana's ask, the broken promise). We check for those by name, because a
 *     query returning 20 rows of #random banter is a failure that "20 results"
 *     would hide.
 *
 * Plus per-field coverage of the normalised RtsMessage/RtsUser, so any mapping
 * mismatch in live.ts is caught before the demo rather than during it.
 */

import { WebClient } from "@slack/web-api";
import { config } from "../src/config.js";
import { webClientOptions } from "../src/shared/webClientOptions.js";
import { LiveRtsClient } from "../src/platform/slack/rts/live.js";
import { SUBJECT_USER_ID } from "../src/platform/slack/rts/fixtures.js";
import type { RtsMessage, RtsUser } from "../src/ports/rts.js";

/** What the app ACTUALLY issues now: the corpus query (see ports/rts.ts). */
const APP_QUERIES: { label: string; query: string }[] = [
  { label: "CORPUS_QUERY (triage / ledger / re-entry / decoder)", query: "" },
];

/**
 * The old, natural-language queries — kept as a REGRESSION CHECK. Live RTS
 * retrieval is lexical and AND-scoped, so these match nothing. If they ever
 * start returning results, Slack has shipped true semantic retrieval and the
 * corpus-query approach could be revisited.
 */
const KEYWORD_QUERIES: { label: string; query: string }[] = [
  { label: "regression: intent-style query (expect 0)", query: "questions, requests, or decisions that mention me" },
  { label: "lexical spot-check (expect >0)", query: "Atlas" },
];

/**
 * The planted moments the demo's story depends on (see rts/fixtures.ts `plant:`
 * tags). Matching is on a distinctive substring of each seeded message.
 */
const PLANTS: { name: string; needle: string }[] = [
  { name: "promise-to-priya", needle: "finalized Atlas API spec" },
  { name: "promise-to-sam", needle: "updated pricing numbers" },
  { name: "eng-blocker", needle: "blocked on the Atlas migration" },
  { name: "leadership-decision", needle: "moving Atlas GA" },
  { name: "marco-passive-aggressive", needle: "No rush on the design review" },
  { name: "dana-act", needle: "launch checklist owner confirmed" },
];

function plantsHit(messages: RtsMessage[]): string[] {
  const blob = messages.map((m) => m.text).join("\n").toLowerCase();
  return PLANTS.filter((p) => blob.includes(p.needle.toLowerCase())).map((p) => p.name);
}

function fieldCoverage<T extends object>(items: T[], fields: (keyof T)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const present = items.filter((i) => {
      const v = i[f];
      return v !== undefined && v !== null && v !== "";
    }).length;
    out[String(f)] = `${present}/${items.length} populated`;
  }
  return out;
}

/**
 * Ask Slack whether this workspace has semantic search. The method is part of
 * the RTS surface but may not exist on every workspace/plan — treat any error as
 * "unknown", never as a failure.
 */
async function probeSearchMode(userToken: string): Promise<string> {
  const web = new WebClient(userToken, webClientOptions);
  try {
    const info = (await web.apiCall("assistant.search.info")) as unknown as Record<string, unknown>;
    const flat = JSON.stringify(info);
    const semantic = /"[a-z_]*ai_search[a-z_]*":\s*true/i.test(flat);
    console.log(`  raw: ${flat}`);
    if (semantic) return "AI Search FLAG is on — but note: live retrieval is still LEXICAL and AND-scoped (verified). Use CORPUS_QUERY.";
    return "KEYWORD only (no Slack AI Search on this workspace)";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `unknown — assistant.search.info failed (${msg}). Assume KEYWORD.`;
  }
}

async function runSet(
  client: LiveRtsClient,
  title: string,
  set: { label: string; query: string }[],
): Promise<{ messages: RtsMessage[]; users: RtsUser[]; totalHits: number }> {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  let messages: RtsMessage[] = [];
  let users: RtsUser[] = [];
  let totalHits = 0;

  for (const { label, query } of set) {
    let res;
    try {
      res = await client.search({ query, limit: 20 });
    } catch (err) {
      console.log(`  \x1b[31m✗\x1b[0m ${label}\n      API error: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const hits = plantsHit(res.messages);
    totalHits += hits.length;
    const mark = res.messages.length === 0 ? "\x1b[31m✗\x1b[0m" : hits.length > 0 ? "\x1b[32m✓\x1b[0m" : "\x1b[33m~\x1b[0m";
    console.log(`  ${mark} ${label}`);
    console.log(`      "${query.slice(0, 68)}${query.length > 68 ? "…" : ""}"`);
    console.log(
      `      → ${res.messages.length} messages, ${res.users.length} users` +
        `  |  planted moments: ${hits.length ? hits.join(", ") : "\x1b[33mNONE\x1b[0m"}`,
    );
    messages = messages.concat(res.messages);
    users = users.concat(res.users);
  }
  return { messages, users, totalHits };
}

async function main(): Promise<void> {
  if (!config.slack.userToken) {
    console.log(
      "Live RTS verification skipped — no SLACK_USER_TOKEN configured.\n" +
        "This is expected for the zero-credential demo. To verify against a real workspace,\n" +
        "set SLACK_USER_TOKEN (and SLACK_SUBJECT_USER_ID) and re-run `npm run verify:rts`.",
    );
    process.exit(0);
  }

  // SUBJECT_USER_ID is a fixture id ("U_SAM") that exists only in the mock
  // workspace. Against a real one it matches nobody, so anything derived from
  // the subject (mentionsMe) reads 0/N and looks like a mapping bug when it isn't.
  const subjectUserId = process.env.SLACK_SUBJECT_USER_ID ?? SUBJECT_USER_ID;
  if (subjectUserId === SUBJECT_USER_ID) {
    console.log(
      `⚠️  Using the fixture subject id "${SUBJECT_USER_ID}", which does not exist in a real\n` +
        "   workspace. Set SLACK_SUBJECT_USER_ID to your own Slack user id (U…) so the\n" +
        "   subject-derived fields below (mentionsMe) are meaningful.\n",
    );
  }

  console.log("\x1b[1m▶ Retrieval mode\x1b[0m");
  console.log(`  ${await probeSearchMode(config.slack.userToken)}`);

  // Pass the bot token exactly as getRtsClient() does — it's what hydrates the
  // display names for app-posted messages (RTS returns those with no author).
  const client = new LiveRtsClient({
    userToken: config.slack.userToken,
    subjectUserId,
    botToken: config.slack.botToken,
  });
  if (!config.slack.botToken) {
    console.log("⚠️  No SLACK_BOT_TOKEN — author names cannot be hydrated; expect authorName 0/N.\n");
  }
  console.log(`\nSearching as ${subjectUserId}. (Run this AFTER \`npm run seed -- --execute\`.)`);

  const app = await runSet(client, "▶ The app's real queries (semantic-style)", APP_QUERIES);
  const kw = await runSet(client, "▶ Keyword variants (the fallback)", KEYWORD_QUERIES);

  const all = app.messages.concat(kw.messages);
  const allUsers = app.users.concat(kw.users);

  if (all.length === 0) {
    console.log(
      "\n\x1b[31m✗ No messages returned by ANY query.\x1b[0m Either the workspace has no matching content\n" +
        "  (did the seed run?), the search scopes weren't granted, or live.ts needs a mapping fix.\n" +
        "  Check for an API error above — a scope error prints here rather than returning empty.",
    );
    process.exit(1);
  }

  console.log("\n\x1b[1m▶ Message field coverage\x1b[0m (across every query)");
  console.log(
    fieldCoverage(all, [
      "permalink",
      "channelId",
      "channelName",
      "channelType",
      "authorId",
      "authorName",
      "text",
      "ts",
    ]),
  );
  if (allUsers.length > 0) {
    console.log("\n\x1b[1m▶ User field coverage\x1b[0m");
    console.log(fieldCoverage(allUsers, ["id", "name", "realName", "title", "email", "tz"]));
  } else {
    console.log("\n▶ User field coverage: no users returned by these queries.");
  }

  console.log("\n\x1b[1m── Verdict ──\x1b[0m");
  console.log(
    `  App's own queries:  ${app.messages.length} messages, ${app.totalHits} planted-moment hits`,
  );
  console.log(
    `  Keyword variants:   ${kw.messages.length} messages, ${kw.totalHits} planted-moment hits`,
  );

  if (app.totalHits > 0) {
    console.log(
      "\n\x1b[32m✅ The app's queries surface the planted moments as-is. Nothing to change — ship it.\x1b[0m",
    );
  } else if (kw.totalHits > 0) {
    console.log(
      "\n\x1b[33m⚠️  The app's semantic-style queries returned nothing useful, but the keyword variants DID.\x1b[0m\n" +
        "  This workspace is keyword-only. The five call sites need keyword-friendly queries:\n" +
        "    src/modules/triage/service.ts:31 · src/modules/ledger/service.ts:36,87\n" +
        "    src/modules/reentry/service.ts:19 · src/application/orchestrator.ts:224\n" +
        "  Tell Claude: \"keyword-only — add the query variants.\"",
    );
  } else {
    console.log(
      "\n\x1b[31m❌ Neither query style surfaced a planted moment.\x1b[0m Search is returning rows, but not the\n" +
        "  ones the demo needs. Confirm the seed actually posted (check the channels in Slack), and\n" +
        "  check the field coverage above — an empty `text` column means live.ts is mis-mapping the payload.",
    );
  }

  // Field-mapping hint, only when something is actually empty.
  const emptyText = all.filter((m) => !m.text).length;
  if (emptyText > 0) {
    console.log(
      `\n  \x1b[31mNote: ${emptyText}/${all.length} messages have an EMPTY text field.\x1b[0m The mapping in\n` +
        "  src/platform/slack/rts/live.ts expects `content` (with `text` as fallback). Print the raw\n" +
        "  payload and reconcile the key names — this is the one real mapping risk.",
    );
  }
}

main().catch((err) => {
  console.error("\nLive RTS verification failed with an API error:", err);
  console.error(
    "\nIf this is `missing_scope`, the six search:read.* USER scopes aren't granted — reinstall the app.\n" +
      "If it's `unknown_method`, this workspace has no RTS access at all; fall back to search.messages.",
  );
  process.exit(1);
});
