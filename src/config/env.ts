import "dotenv/config";

/**
 * Environment readers + the validated `config` object.
 *
 * We deliberately fail loud at startup for anything required, but keep optional
 * integrations (MCP targets, gateway) soft so the demo runs with a minimal
 * `.env`.
 */

export function opt(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function req(name: string, fallback?: string): string {
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
export type McpMode = "mock" | "live";
export type StoreMode = "file" | "postgres";

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
    // Vercel sets VERCEL=1 in every deployment. There is no socket mode on
    // serverless, so the receiver defaults to http there — which also flips
    // isLivePosture() on, so the secrets/persistence assertions actually bite
    // in production instead of silently accepting dev defaults.
    receiver: (opt("TEMPO_RECEIVER") ?? (opt("VERCEL") ? "http" : "socket")) as ReceiverMode,
    isVercel: Boolean(opt("VERCEL")),
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
  // Outbound MCP — how Tempo *acts* in the world (Focus Guardian's calendar
  // block + task). mock = deterministic, zero I/O (default). live = connect to a
  // real MCP server over Streamable HTTP per client (Google Calendar / Notion /
  // Linear / GitHub, whichever server URL is configured). Each client also
  // requires its own URL to go live — a partial config leaves the other on mock.
  mcp: {
    mode: (opt("TEMPO_MCP") ?? "mock") as McpMode,
    calendarUrl: opt("TEMPO_MCP_CALENDAR_URL"),
    calendarToken: opt("TEMPO_MCP_CALENDAR_TOKEN"),
    calendarTool: opt("TEMPO_MCP_CALENDAR_TOOL") ?? "create_event",
    calendarProvider: opt("TEMPO_MCP_CALENDAR_PROVIDER") ?? "google-calendar",
    tasksUrl: opt("TEMPO_MCP_TASKS_URL"),
    tasksToken: opt("TEMPO_MCP_TASKS_TOKEN"),
    tasksTool: opt("TEMPO_MCP_TASKS_TOOL") ?? "create_task",
    tasksProvider: opt("TEMPO_MCP_TASKS_PROVIDER") ?? "notion",
    // Inbound: Tempo exposed AS an MCP server (v3.0) so external agents
    // (Agentforce / Claude / Cursor / ChatGPT) can call tempo.triage/etc.
    // Off by default, and DEFAULT-DENY when on: a caller must present a signed
    // per-user agent token, OR the shared `token` — and the shared token only
    // grants access when an explicit `user` is also configured (no ambient
    // authority, no hardcoded identity).
    server: {
      enabled: opt("TEMPO_MCP_SERVER") === "on",
      token: opt("TEMPO_MCP_SERVER_TOKEN"),
      user: opt("TEMPO_MCP_SERVER_USER"),
    },
  },
  // Team & manager mode (v3.6) — the opt-in roster (explicit consent: nobody is
  // aggregated unless listed) + the k-anonymity floor. Off unless TEMPO_TEAM=on.
  team: {
    members: (opt("TEMPO_TEAM_MEMBERS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    minMembers: Number(opt("TEMPO_TEAM_MIN") ?? 3),
  },
  // Persistence — where tokens/prefs/commitments/snoozes/metrics/surfaces live.
  // file = JSON files under TEMPO_STORE_DIR (default; the zero-credential
  // demo/tests). postgres = Neon behind the same repository interfaces. File
  // stays the default; postgres also requires DATABASE_URL to actually engage
  // (auto-detected to postgres when DATABASE_URL is set — same convention as AI).
  store: {
    mode: (opt("TEMPO_STORE") ??
      (opt("DATABASE_URL") ? "postgres" : "file")) as StoreMode,
    databaseUrl: opt("DATABASE_URL"),
  },
} as const;
