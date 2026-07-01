/**
 * Verifies the live RTS field mapping (src/rts/live.ts) against a real Slack
 * workspace. Standalone — never imported by app.ts/orchestrator.ts/tests, and
 * NOT wired into `npm test`/`npm run demo`, so it can never break the
 * zero-credential path.
 *
 *   npm run verify:rts
 *
 * With no SLACK_USER_TOKEN configured this prints a clear "skipped" message
 * and exits 0 (safe to run by accident, including in CI). With a token, it
 * runs a couple of representative searches and reports which normalised
 * RtsMessage/RtsUser fields came back populated vs. empty/defaulted, so the
 * defensive mapping in live.ts can be checked/patched against the real
 * payload shape.
 */

import { config } from "../src/config.js";
import { LiveRtsClient } from "../src/platform/slack/rts/live.js";
import { SUBJECT_USER_ID } from "../src/platform/slack/rts/fixtures.js";
import type { RtsMessage, RtsUser } from "../src/ports/rts.js";

const QUERIES = [
  "questions, requests, or decisions that mention me or are addressed to me",
  "promises and commitments: I'll send, I will, on it, on me, get you, by Friday, by EOD",
];

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

async function main(): Promise<void> {
  if (!config.slack.userToken) {
    console.log(
      "Live RTS verification skipped — no SLACK_USER_TOKEN configured.\n" +
        "This is expected for the zero-credential demo. To verify field mapping against a\n" +
        "real workspace, set SLACK_USER_TOKEN (and optionally TEMPO_RTS=live) and re-run\n" +
        "`npm run verify:rts`.",
    );
    process.exit(0);
  }

  const client = new LiveRtsClient({
    userToken: config.slack.userToken,
    subjectUserId: SUBJECT_USER_ID,
  });

  console.log(`Verifying live RTS field mapping as user ${SUBJECT_USER_ID}...\n`);

  let allMessages: RtsMessage[] = [];
  let allUsers: RtsUser[] = [];

  for (const query of QUERIES) {
    console.log(`Query: "${query}"`);
    const res = await client.search({ query, limit: 10 });
    console.log(`  → ${res.messages.length} messages, ${res.users.length} users (source: ${res.meta.source})`);
    allMessages = allMessages.concat(res.messages);
    allUsers = allUsers.concat(res.users);
  }

  if (allMessages.length === 0) {
    console.log(
      "\nNo messages returned. Either the workspace has nothing matching these queries, or the\n" +
        "live field mapping needs adjustment in src/rts/live.ts — check for an API error above.",
    );
    process.exit(0);
  }

  console.log("\nMessage field coverage:");
  console.log(
    fieldCoverage(allMessages, [
      "permalink",
      "channelId",
      "channelName",
      "authorId",
      "authorName",
      "authorRealName",
      "text",
      "ts",
    ]),
  );

  if (allUsers.length > 0) {
    console.log("\nUser field coverage:");
    console.log(fieldCoverage(allUsers, ["id", "name", "realName", "title", "email", "tz"]));
  } else {
    console.log("\nNo users returned by these queries.");
  }

  console.log(
    "\nCompare any field reading 0/N populated against src/rts/live.ts's normaliseMessages/\n" +
      "normaliseUsers — Slack's actual payload shape may use different key names than assumed.",
  );
}

main().catch((err) => {
  console.error("Live RTS verification failed with an API error:", err);
  process.exit(1);
});
