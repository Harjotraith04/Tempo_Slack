# Tempo — Build Ledger

**Current version:** v0.1.0 &nbsp;·&nbsp; **Updated:** 2026-07-01 &nbsp;·&nbsp; **Modes:** RTS=mock, AI=mock

**How to use:** read this, then open [`MASTER_PLAN.md`](MASTER_PLAN.md) → Part V, find this version's phase, and build the next unchecked items (honoring the invariants in Part VI). Keep `npm run demo` + `npm test` green. Then append a `History` entry below and bump `version` in `package.json`.

---

## Status
- **Phase 0 / v0.1.0 — Foundation:** DONE.

## Next up → Phase 1 / v1.0.0 "Hackathon Winner"
See `MASTER_PLAN.md` → Part V, Year 1, Phase 1 for full detail.
- [ ] Live RTS verify + Claude (`scripts/verify-live-rts.ts`)
- [ ] Slack-native Focus: `dnd.setSnooze` + `users.profile.set` + `chat.scheduleMessage`
- [ ] Real interactivity: post drafts · persistent snooze · show-the-rest · mark-done · renegotiate
- [ ] App Home dashboard + a11y settings modal
- [ ] Stores: prefs · commitments · snoozes; multi-user cron; add `@slack/web-api` dependency
- [ ] Read-aloud audio; onboarding first-run
- [ ] Tests: Block Kit render + live-mode contract (mocked WebClient)
- [ ] Deploy + seed + judging access + 3-min video + architecture diagram + write-up

---

## History

### v0.1.0 — 2026-07-01 — Foundation
**Built:** 5 modules (triage / ledger / decoder / focus / reentry) on mock RTS + mock AI; Bolt Assistant pane, `/tempo`, App Home, button actions; OAuth user-token flow; AES-256-GCM encrypted token store; Vercel cron morning digest; seed-workspace script; zero-credential console demo.
**Quality:** 16 tests passing · typecheck clean · build clean.
**Open seams:** live RTS field mapping unverified; MCP outbound is mock; file-based token store; `prefs`/`commitments`/`snoozes` stores not yet created; cron single-user; intent routing keyword-only; insecure default encryption key.
**Next:** v1.0.0.
