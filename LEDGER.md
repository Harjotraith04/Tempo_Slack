# Tempo — Build Ledger

**Current version:** v0.2.0 &nbsp;·&nbsp; **Updated:** 2026-07-01 &nbsp;·&nbsp; **Modes:** RTS=mock, AI=mock, SLACK_ACTIONS=mock

**How to use:** read this, then open [`MASTER_PLAN.md`](MASTER_PLAN.md) → Part V, find this version's phase, and build the next unchecked items (honoring the invariants in Part VI). Keep `npm run demo` + `npm test` green. Then append a `History` entry below, bump `version` in `package.json`, and **commit + push automatically** — short title-only commit message, no description, no AI co-author/attribution trailer.

---

## Status
- **Phase 0 / v0.1.0 — Foundation:** DONE.
- **Phase 1a / v0.2.0 — Foundational slice (stores + Slack-native focus + real interactivity):** DONE.

## Next up → Phase 1 / v1.0.0 "Hackathon Winner" (remaining)
See `MASTER_PLAN.md` → Part V, Year 1, Phase 1 for full detail. The persistence/interactivity foundation is done (see History below); what's left is the user-facing surfaces and submission logistics:
- [ ] App Home dashboard with live triage/commitments/focus data (today's App Home is still the static `homeBlocks()`) + a11y settings modal (`views.open`) — wire to the new `db/prefs.ts`
- [ ] "Show the rest" interactivity for triage (currently just a text hint, no button/handler)
- [ ] Read-aloud audio (TTS) — `a11y/index.ts`'s `toSpeech()` only produces text today, no audio synthesis
- [ ] Onboarding first-run flow
- [ ] Deploy + seed + judging access + 3-min video + architecture diagram + write-up

---

## History

### v0.2.0 — 2026-07-01 — Foundational slice: persistence + Slack-native focus + real interactivity
**Built:** file-backed `prefs`/`commitments`/`snoozes` stores (mirroring `db/tokens.ts`'s pattern, `TEMPO_STORE_DIR`-overridable for tests/demo); a new `src/slack/` mock/live port (mirrors `src/rts/`) wiring Focus Guardian to real `dnd.setSnooze` + `users.profile.set` + a best-effort scheduled post-focus digest, gated by a new independent `TEMPO_SLACK_ACTIONS=mock|live` flag; real `snooze`/`mark_done`/`nudge`/`renegotiate` button handlers in `app.ts` (previously all four were stubs that just acked with a canned string — no persistence, no Slack effect); `scripts/verify-live-rts.ts` (zero-cred-safe, exits 0 with a clear skip message when no token is configured); multi-user cron with per-user failure isolation (`listInstalledUsers()` + sequential try/catch, falls back to the single demo user when the token store is empty); `@slack/web-api` promoted from a transitive to a direct dependency.
**Also fixed:** `ledgerBlocks()` was passing the opaque commitment `id` hash as the button value for `draft_deliverable`/`renegotiate`/`nudge` instead of the `permalink` the handlers actually look up by — `draft_deliverable` was silently drafting from an empty string. The "owed to you" row's `Open` button was also a dead plain button instead of a real URL link. Both fixed; locked in with a render test.
**Quality:** 47 tests passing (up from 16) across 11 files, including the first Block Kit render tests and the first mocked-`@slack/web-api` contract tests · typecheck clean · build clean · `npm run demo` extended with a 7th scene exercising the button-driven layer directly (not reachable through the free-text orchestrator path) · added `vitest.config.ts` (`fileParallelism: false`) after observing the new stores' shared `TEMPO_STORE_DIR` env var can race across concurrently-scheduled test files and write into the project root.
**Open seams:** file-backed stores (tokens + the three new ones) assume a writable local filesystem — Vercel's deployment filesystem is read-only, so persistence only really works for local Socket Mode dev today; this is inherited from `db/tokens.ts`, not new, and is explicitly deferred to the Neon Postgres swap in Phase 6/v2.4. Live RTS field mapping still unverified against a real workspace (the verify script now exists to do that, but hasn't been run against live Slack). `use_rewrite`/`keep_draft` remain unpersisted (no entity to persist against yet). App Home is still static; no settings modal; no TTS audio; no onboarding flow; intent routing still keyword-only; insecure default encryption key unchanged.
**Next:** the remaining Phase 1/v1.0 items above.

### v0.1.0 — 2026-07-01 — Foundation
**Built:** 5 modules (triage / ledger / decoder / focus / reentry) on mock RTS + mock AI; Bolt Assistant pane, `/tempo`, App Home, button actions; OAuth user-token flow; AES-256-GCM encrypted token store; Vercel cron morning digest; seed-workspace script; zero-credential console demo.
**Quality:** 16 tests passing · typecheck clean · build clean.
**Open seams:** live RTS field mapping unverified; MCP outbound is mock; file-based token store; `prefs`/`commitments`/`snoozes` stores not yet created; cron single-user; intent routing keyword-only; insecure default encryption key.
**Next:** v1.0.0.
