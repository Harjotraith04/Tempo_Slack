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
