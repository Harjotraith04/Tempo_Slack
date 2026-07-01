/**
 * Posture predicates + startup assertions derived from `config`.
 *
 * "Live posture" = this process is talking to a real Slack workspace in any
 * way; the secrets-hardening assertion only bites there, so the zero-credential
 * demo/tests (fully mocked) keep running with the dev default key.
 */

import { config } from "./env.js";

export function assertSlackRuntime(): void {
  if (!config.slack.signingSecret && config.runtime.receiver === "http") {
    throw new Error("SLACK_SIGNING_SECRET is required for the http receiver.");
  }
  if (config.runtime.receiver === "socket" && !config.slack.appToken) {
    throw new Error("SLACK_APP_TOKEN (xapp-...) is required for socket mode.");
  }
  if (!config.slack.botToken) {
    throw new Error("SLACK_BOT_TOKEN is required.");
  }
}

export const isLiveRts = () => config.runtime.rts === "live";
export const isLiveSlackActions = () => config.runtime.slackActions === "live";
export const isLiveTts = () => config.tts.mode === "live";
export const isLiveMcp = () => config.mcp.mode === "live";

/** True when Tempo should serve its inbound MCP endpoint (v3.0). */
export const isMcpServerEnabled = () => config.mcp.server.enabled;

/** Persistence posture. Storage isn't a "live Slack" posture, so it stays a
 * standalone predicate and does NOT feed isLivePosture(). The factory still
 * double-gates on a configured DATABASE_URL (see platform/persistence). */
export const isPostgresStore = () => config.store.mode === "postgres";

/** The dev fallback in `req("TEMPO_ENCRYPTION_KEY", ...)` — safe for local mock
 * work and tests, never for anything touching a real workspace. */
export const INSECURE_DEFAULT_KEY = "dev-insecure-key-change-me-please";

/** True when this process is talking to a real Slack workspace in any way. */
export function isLivePosture(): boolean {
  return (
    config.runtime.receiver === "http" ||
    config.runtime.rts === "live" ||
    config.runtime.slackActions === "live"
  );
}

/**
 * Fail fast if we're in a live/prod posture but still using the insecure default
 * (or a too-weak / placeholder) token-encryption key. The dev default stays
 * usable for `npm run demo` / the test suite, which run fully mocked.
 */
export function assertSecretsHardened(): void {
  if (!isLivePosture()) return;
  const key = config.runtime.encryptionKey;
  const weak = !key || key === INSECURE_DEFAULT_KEY || key.length < 32 || /change[-_ ]?me/i.test(key);
  if (weak) {
    throw new Error(
      "TEMPO_ENCRYPTION_KEY must be set to a strong, unique 32+ character secret before running " +
        "against a real Slack workspace (live RTS, live Slack actions, or the http receiver). " +
        "The dev default is only allowed in fully-mocked local/test runs. See .env.example.",
    );
  }
}

/**
 * Called by every Vercel `api/` entrypoint. No-ops outside Vercel (local dev
 * uses Socket Mode via createApp; tests/demo run fully mocked). On Vercel it
 * fails fast — a clear startup crash in the function logs beats a fail-open:
 *  - the receiver defaults to http there (see env.ts), so isLivePosture() is
 *    true and the encryption-key check in assertSecretsHardened() actually
 *    bites instead of silently accepting the dev default key;
 *  - the file store writes JSON next to the process and Vercel's deployment
 *    filesystem is read-only — OAuth token saves and the cron would EROFS at
 *    runtime, so the misconfiguration is rejected up front.
 */
export function assertVercelRuntime(): void {
  if (!config.runtime.isVercel) return;
  assertSecretsHardened();
  if (config.store.mode === "file") {
    throw new Error(
      "TEMPO_STORE=file cannot run on Vercel — the deployment filesystem is read-only, so token/pref " +
        "writes would fail at runtime. Provision Postgres (e.g. Neon) and set DATABASE_URL " +
        "(TEMPO_STORE auto-detects to postgres). See .env.example.",
    );
  }
}
