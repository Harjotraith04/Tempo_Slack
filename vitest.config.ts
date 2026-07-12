import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // The new file-backed stores (src/db/{prefs,commitments,snoozes}.ts) key
    // their on-disk path off process.env.TEMPO_STORE_DIR, set/unset per test
    // file in beforeAll/afterAll. process.env is a single mutable global
    // shared by every test file vitest schedules onto a worker, so running
    // files in parallel can interleave one file's cleanup with another's
    // still-running test and write into the real project root instead of a
    // temp dir. The suite runs in well under a second, so trading file
    // parallelism for that guarantee is free.
    fileParallelism: false,
    // The web companion (web/) is a separate Next.js app with its own React
    // deps and its own test runner. Keep it out of the root suite so the
    // zero-credential contract (npm test with no react/next) stays intact.
    exclude: [...configDefaults.exclude, "web/**"],
    // The zero-credential contract, ENFORCED rather than assumed.
    //
    // src/config/env.ts does `import "dotenv/config"`, so a developer's real
    // .env leaks straight into the test process. With TEMPO_RTS=live and a real
    // SLACK_USER_TOKEN present, the suite starts making live Slack API calls —
    // tests hang, fail on `invalid_arguments`, and (worse) could mutate a real
    // workspace. Vitest applies `env` before any module loads, and dotenv never
    // overwrites an already-set variable, so pinning the mock posture here wins
    // over any .env. Tests must exercise the mock adapters, always.
    // Note we do NOT pin TEMPO_STORE — several tests assert the postgres/file
    // auto-detect off DATABASE_URL, so we clear the inputs and let config decide.
    env: {
      TEMPO_RTS: "mock",
      TEMPO_SLACK_ACTIONS: "mock",
      TEMPO_AI: "mock",
      TEMPO_TTS: "mock",
      TEMPO_MCP: "mock",
      // Empty string reads as absent via config's opt(), so the live adapters
      // stay unreachable even if a real credential is sitting in .env.
      SLACK_BOT_TOKEN: "",
      SLACK_USER_TOKEN: "",
      SLACK_SIGNING_SECRET: "",
      SLACK_CLIENT_ID: "",
      SLACK_CLIENT_SECRET: "",
      SLACK_SUBJECT_USER_ID: "",
      OPENAI_API_KEY: "",
      DATABASE_URL: "",
      TEMPO_MCP_SERVER: "",
      TEMPO_ENCRYPTION_KEY: "",
      PUBLIC_URL: "",
      CRON_SECRET: "",
    },
  },
});
