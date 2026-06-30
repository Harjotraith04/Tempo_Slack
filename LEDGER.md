# Tempo — Build Ledger

**Current version:** v0.3.0 &nbsp;·&nbsp; **Updated:** 2026-07-01 &nbsp;·&nbsp; **Modes:** RTS=mock, AI=mock, SLACK_ACTIONS=mock

**How to use:** read this, then open [`MASTER_PLAN.md`](MASTER_PLAN.md) → Part V, find this version's phase, and build the next unchecked items (honoring the invariants in Part VI). Keep `npm run demo` + `npm test` green. Then append a `History` entry below, bump `version` in `package.json`, and **commit + push automatically** — short title-only commit message, no description, no AI co-author/attribution trailer.

---

## Status
- **Phase 0 / v0.1.0 — Foundation:** DONE.
- **Phase 1a / v0.2.0 — Foundational slice (stores + Slack-native focus + real interactivity):** DONE.
- **Phase 1b / v0.3.0 — Live App Home dashboard + a11y settings modal + "show the rest":** DONE.

## Next up → Phase 1 / v1.0.0 "Hackathon Winner" (remaining)
See `MASTER_PLAN.md` → Part V, Year 1, Phase 1 for full detail. Persistence, Slack-native focus, real interactivity, and the user-facing App Home/settings surfaces are all done (see History below); what's left:
- [ ] Read-aloud audio (TTS) — `a11y/index.ts`'s `toSpeech()` only produces text today, no audio synthesis. `UserPrefs.readAloud` is already stored and settable via the settings modal, just not consumed by anything yet.
- [ ] Onboarding first-run flow
- [ ] Deploy + seed + judging access + 3-min video + architecture diagram + write-up

---

## History

### v0.3.0 — 2026-07-01 — Live App Home dashboard + a11y settings modal + "show the rest"
**Built:** App Home (`app_home_opened`) now publishes a live dashboard — real triage + commitments, recomputed and suppression/renegotiation-aware on every open, via the same `respond()` path the Assistant pane and `/tempo` use; a `⚙️ Settings` button opens a real `views.open` modal (verbosity, reading level, max items, default focus length, read-aloud) that saves to `db/prefs.ts` on submit (`app.view("settings_modal", ...)`); `db/prefs.ts` extended with `readingLevel`/`readAloud`/`maxItems`; a `resolveA11yPrefs()` helper in `a11y/index.ts` merges stored prefs over the existing defaults. These prefs are now actually consumed, not just stored: triage caps to the user's `maxItems` (was hardcoded to 3) and exposes a real "Show the rest" button (new `orchestrator.triageAll()` + `show_rest` action handler) instead of a text-only hint nobody could act on; focus block duration falls back to the user's `focusDefaultMins` when not stated in the request; response text is condensed for "brief" verbosity.
**Also fixed:** ephemeral confirmations and drafted messages (`nudge`/`renegotiate`/`draft_reply`/`draft_deliverable`) now fall back to DMing the user when there's no channel in context — needed because App Home button clicks carry no `channel`, only a `view` container, so without this fallback every Home-tab button silently did nothing visible after its store write. A pluralization bug ("1 things need you") surfaced now that `maxItems` can be set to 1; fixed.
**Quality:** 65 tests passing (up from 47) across 14 files, including settings-modal submission/pre-fill tests, App-Home-without-a-channel DM-fallback tests, and orchestrator-level prefs-wiring tests · typecheck clean · build clean · `npm run demo` extended with an 8th scene showing the dashboard reflect Scene 7's snooze/renegotiate state, plus a settings save/read round-trip.
**Open seams:** read-aloud is now a real, savable preference but still produces no audio — `toSpeech()` is text-only; wiring it to TTS is the next concrete step. No onboarding flow. Deploy/seed/judging/video/write-up still outstanding. Intent routing still keyword-only; insecure default encryption key unchanged; file-backed stores still assume a writable local filesystem (Vercel limitation, deferred to v2.4 per last entry).
**Next:** read-aloud audio + onboarding, then deploy/submission logistics.

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
