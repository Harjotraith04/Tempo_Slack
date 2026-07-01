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
