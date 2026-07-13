/**
 * Seeds a real Slack sandbox with the Northwind narrative so LIVE RTS returns
 * the same story the mock does. Safe by default: prints a dry-run plan unless
 * you pass --execute and a SLACK_BOT_TOKEN is present.
 *
 *   npm run seed              # dry run — prints what it would post
 *   npm run seed -- --execute # actually creates channels + posts history
 *
 * Persona attribution uses chat.postMessage username/icon overrides, which need
 * the `chat:write.customize` bot scope. DM-only fixtures are posted into a
 * #tempo-inbox channel (the bot can't post as other users in true DMs); the
 * content is identical, so RTS finds it either way.
 *
 * SEED-ONLY SCOPES — deliberately NOT in manifest.json / oauth/scopes.ts (the
 * app itself never needs them, and adding them would break the least-privilege
 * story the scopes drift-test enforces). To run --execute, temporarily add to
 * the sandbox app and remove after seeding:
 *   channels:manage        (conversations.create — the demo channels)
 *   channels:read          (conversations.list — find existing channels)
 *   chat:write.customize   (persona username/icon_emoji overrides)
 */

import { WebClient } from "@slack/web-api";
import { CHANNELS, MESSAGES, USERS, DEMO_NOW } from "../src/platform/slack/rts/fixtures.js";
import { config } from "../src/config.js";

const EXECUTE = process.argv.includes("--execute");

const ICONS: Record<string, string> = {
  U_SAM: ":bust_in_silhouette:",
  U_PRIYA: ":woman_technologist:",
  U_MARCO: ":art:",
  U_DANA: ":briefcase:",
  U_JORDAN: ":bar_chart:",
  U_RAVI: ":hammer_and_wrench:",
  U_TINA: ":office:",
};

function nameFor(id: string): string {
  return USERS.find((u) => u.id === id)?.realName ?? id;
}

/** Map fixture channels to seedable public channels (DMs → #tempo-inbox). */
function seedChannelName(channelId: string): string {
  const ch = CHANNELS.find((c) => c.id === channelId);
  if (!ch) return "tempo-inbox";
  if (ch.type === "im" || ch.type === "mpim") return "tempo-inbox";
  return `demo-${ch.name}`;
}

async function main() {
  const targets = [...new Set(MESSAGES.map((m) => seedChannelName(m.channelId)))];

  console.log(`\nSeed plan (DEMO_NOW=${new Date(DEMO_NOW * 1000).toISOString()})`);
  console.log(`Channels to ensure: ${targets.map((t) => "#" + t).join(", ")}`);
  console.log(`Messages to post:   ${MESSAGES.length}`);

  if (!EXECUTE) {
    console.log("\n— DRY RUN — re-run with `npm run seed -- --execute` to apply.\n");
    for (const m of MESSAGES.slice(0, 6)) {
      console.log(`  #${seedChannelName(m.channelId)} <${nameFor(m.authorId)}>: ${m.text.slice(0, 70)}…`);
    }
    console.log(`  …and ${MESSAGES.length - 6} more.\n`);
    return;
  }

  if (!config.slack.botToken) throw new Error("SLACK_BOT_TOKEN required to --execute.");
  const web = new WebClient(config.slack.botToken);

  // Ensure channels exist (create or reuse).
  const channelIds = new Map<string, string>();
  for (const name of targets) {
    try {
      const res = (await web.conversations.create({ name })) as any;
      channelIds.set(name, res.channel.id);
      console.log(`created #${name}`);
    } catch (e: any) {
      if (e?.data?.error === "name_taken") {
        const list = (await web.conversations.list({ limit: 1000 })) as any;
        const found = list.channels.find((c: any) => c.name === name);
        if (found) channelIds.set(name, found.id);
        console.log(`reusing #${name}`);
      } else throw e;
    }
  }

  // IDEMPOTENT. This used to post every message on every run, so a second seed
  // (e.g. to add new scenarios) silently duplicated the entire story — a
  // workspace showing everything twice, with a triage to match. Read what's
  // already there and post only what's missing.
  const existing = new Map<string, Set<string>>();
  for (const [name, id] of channelIds) {
    // Reusing an existing channel does NOT mean the bot is a member of it, and a
    // non-member can neither read history nor post. Join first — otherwise the
    // history read throws, we assume the channel is empty, and then every
    // postMessage fails too, killing the run half-way through the story.
    try {
      await web.conversations.join({ channel: id });
    } catch {
      /* already a member, or a private channel we were invited to — either is fine */
    }

    const seen = new Set<string>();
    try {
      const hist = (await web.conversations.history({ channel: id, limit: 1000 })) as any;
      for (const msg of hist.messages ?? []) if (msg.text) seen.add(String(msg.text).trim());
    } catch (e: any) {
      console.log(`  (couldn't read #${name} history: ${e?.data?.error ?? e}; assuming empty)`);
    }
    existing.set(name, seen);
  }

  // Post history oldest → newest.
  const ordered = [...MESSAGES].sort((a, b) => b.minsAgo - a.minsAgo);
  let posted = 0;
  let skipped = 0;
  let failed = 0;
  for (const m of ordered) {
    const name = seedChannelName(m.channelId);
    const channel = channelIds.get(name);
    if (!channel) continue;

    if (existing.get(name)?.has(m.text.trim())) {
      skipped++;
      continue;
    }
    // One bad channel must not abandon the seed half-written. A partially-posted
    // story is worse than a failed one: the next run dedupes against it and the
    // gaps become permanent.
    try {
      await web.chat.postMessage({
        channel,
        text: m.text,
        username: nameFor(m.authorId),
        icon_emoji: ICONS[m.authorId] ?? ":speech_balloon:",
      });
      posted++;
    } catch (e: any) {
      failed++;
      console.log(`  ⚠️  #${name}: ${e?.data?.error ?? e} — skipping "${m.text.slice(0, 40)}…"`);
    }
  }
  console.log(
    `\nSeeded ${posted} new message(s); skipped ${skipped} already present` +
      (failed ? `; ${failed} FAILED (see above)` : "") +
      `. Set TEMPO_RTS=live to demo against real RTS.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
