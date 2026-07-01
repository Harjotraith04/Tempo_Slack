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
  },
});
