import "dotenv/config";

/**
 * Centralised, validated configuration for Tempo.
 *
 * We deliberately fail loud at startup for anything required, but keep optional
 * integrations (MCP targets, gateway) soft so the demo runs with a minimal
 * `.env`.
 */

function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function req(name: string, fallback?: string): string {
  const v = opt(name) ?? fallback;
  if (v === undefined) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return v;
}

export type ReceiverMode = "socket" | "http";
export type RtsMode = "mock" | "live";
export type SlackActionsMode = "mock" | "live";

export const config = {
  slack: {
    botToken: opt("SLACK_BOT_TOKEN"),
    signingSecret: opt("SLACK_SIGNING_SECRET"),
    appToken: opt("SLACK_APP_TOKEN"),
    clientId: opt("SLACK_CLIENT_ID"),
    clientSecret: opt("SLACK_CLIENT_SECRET"),
    /** Single user token used to drive local demos as "Sam". */
    userToken: opt("SLACK_USER_TOKEN"),
  },
  ai: {
    anthropicApiKey: opt("ANTHROPIC_API_KEY"),
    gatewayApiKey: opt("AI_GATEWAY_API_KEY"),
    model: req("TEMPO_MODEL", "claude-sonnet-5"),
    // "live" calls Claude; "mock" uses deterministic canned reasoning so the
    // demo runs with no API key. Auto-detected from ANTHROPIC_API_KEY.
    mode: (opt("TEMPO_AI") ??
      (opt("ANTHROPIC_API_KEY") ? "live" : "mock")) as "live" | "mock",
  },
  runtime: {
    receiver: (opt("TEMPO_RECEIVER") ?? "socket") as ReceiverMode,
    port: Number(opt("PORT") ?? 3000),
    rts: (opt("TEMPO_RTS") ?? "mock") as RtsMode,
    // Independent from TEMPO_RTS: a dev connected to a real sandbox for RTS
    // shouldn't have Tempo silently flip their own DND/status/profile unless
    // they explicitly opt in to live Slack-write actions.
    slackActions: (opt("TEMPO_SLACK_ACTIONS") ?? "mock") as SlackActionsMode,
    encryptionKey: req("TEMPO_ENCRYPTION_KEY", "dev-insecure-key-change-me-please"),
  },
  tts: {
    apiKey: opt("OPENAI_API_KEY"),
    voice: opt("TEMPO_TTS_VOICE") ?? "alloy",
    // live = call OpenAI's speech endpoint; mock = deterministic silent WAV
    // (runs with no key). Auto-detects to "live" when OPENAI_API_KEY is set.
    mode: (opt("TEMPO_TTS") ??
      (opt("OPENAI_API_KEY") ? "live" : "mock")) as "live" | "mock",
  },
} as const;

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
