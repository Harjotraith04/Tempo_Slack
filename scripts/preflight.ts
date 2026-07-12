/**
 * Preflight — proves the repo is credential-free ready before the GO_LIVE.md
 * bring-up. One command that runs the CI core plus every skip-safe live check,
 * so "nothing left to build" is verified, not assumed.
 *
 *   npm run preflight
 *
 * Runs: typecheck · tests · build · demo (zero-credential E2E) · web build ·
 * the five verify:* scripts (each self-skips with exit 0 when no creds are set,
 * or actually probes the service if you have keys) · a manifest sanity check.
 * Exits non-zero if any hard step fails. Manifest placeholders are reported as
 * information, not a failure — the committed manifest is a template until you
 * run `npm run manifest:urls` at deploy time.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const STEPS: [label: string, cmd: string][] = [
  ["typecheck", "npm run typecheck"],
  ["tests", "npm test"],
  ["build", "npm run build"],
  ["demo (zero-credential E2E)", "npm run demo"],
  ["web build", "npm run web:build"],
  ["verify:ai (skip-safe)", "npm run verify:ai"],
  ["verify:postgres (skip-safe)", "npm run verify:postgres"],
  ["verify:rts (skip-safe)", "npm run verify:rts"],
  ["verify:mcp (skip-safe)", "npm run verify:mcp"],
  ["verify:mcp-server (skip-safe)", "npm run verify:mcp-server"],
];

function run(label: string, cmd: string): boolean {
  console.log(`\n\x1b[1m▶ ${label}\x1b[0m  (${cmd})`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

/** Non-fatal unless the manifest is invalid or missing required structure. */
function checkManifest(): boolean {
  console.log(`\n\x1b[1m▶ manifest sanity\x1b[0m  (manifest.json)`);
  let raw: string;
  try {
    raw = readFileSync(resolve(ROOT, "manifest.json"), "utf8");
  } catch (err) {
    console.error("  ✗ manifest.json not readable:", err);
    return false;
  }
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw);
  } catch (err) {
    console.error("  ✗ manifest.json is not valid JSON:", err);
    return false;
  }
  const oauth = (m.oauth_config ?? {}) as { scopes?: { user?: unknown[]; bot?: unknown[] } };
  const features = (m.features ?? {}) as Record<string, unknown>;
  const settings = (m.settings ?? {}) as Record<string, unknown>;
  const missing: string[] = [];
  if (!features.agent_view) missing.push("features.agent_view");
  if (!oauth.scopes?.user?.length) missing.push("oauth_config.scopes.user");
  if (!oauth.scopes?.bot?.length) missing.push("oauth_config.scopes.bot");
  if (!settings.event_subscriptions) missing.push("settings.event_subscriptions");

  // Slack's validator rejects these combinations, and it does so only at
  // app-creation/update time — i.e. in a browser, at the worst moment. Catch
  // them here instead. Each one cost us a round trip to discover.
  const socket = settings.socket_mode_enabled === true;
  const functions = m.functions as Record<string, unknown> | undefined;
  if (functions && Object.keys(functions).length > 0 && settings.org_deploy_enabled !== true) {
    missing.push("settings.org_deploy_enabled must be true when `functions` are declared");
  }
  if (!socket) {
    // With socket mode off, EVERY inbound surface needs its own request URL —
    // including each slash command, which is easy to forget because the events
    // and interactivity URLs sit elsewhere in the file.
    const cmds = (features.slash_commands ?? []) as { command?: string; url?: string }[];
    for (const c of cmds) {
      if (!c.url) missing.push(`features.slash_commands["${c.command}"].url (required when socket mode is off)`);
    }
    const inter = settings.interactivity as { is_enabled?: boolean; request_url?: string } | undefined;
    if (inter?.is_enabled && !inter.request_url) missing.push("settings.interactivity.request_url");
    const ev = settings.event_subscriptions as { request_url?: string } | undefined;
    if (ev && !ev.request_url) missing.push("settings.event_subscriptions.request_url");
  }

  if (missing.length) {
    console.error(`  ✗ manifest invalid: ${missing.join("; ")}`);
    return false;
  }
  const placeholders = ["https://YOUR_DEPLOYMENT", "https://YOUR_WEB_DEPLOYMENT"].filter((p) => raw.includes(p));
  if (placeholders.length) {
    console.log(
      `  ✓ valid; ${oauth.scopes!.user!.length} user + ${oauth.scopes!.bot!.length} bot scopes. ` +
        `\x1b[33mtemplate — run \`npm run manifest:urls\` at deploy time.\x1b[0m`,
    );
  } else {
    console.log(`  ✓ valid; deployment URLs filled (no placeholders).`);
  }
  return true;
}

function main(): void {
  console.log("Tempo preflight — proving credential-free readiness.\n");
  const results: [string, boolean][] = [];
  for (const [label, cmd] of STEPS) results.push([label, run(label, cmd)]);
  results.push(["manifest sanity", checkManifest()]);

  console.log("\n\x1b[1m── Summary ──\x1b[0m");
  for (const [label, ok] of results) console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}`);
  const failed = results.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(`\n${failed.length} step(s) failed. Not ready — fix the above.`);
    process.exit(1);
  }
  console.log("\nAll green. Credential-free readiness confirmed → follow GO_LIVE.md for the live bring-up.");
}

main();
