# Tempo — Status & Next Steps

**Version:** v4.1.1 · **Updated:** 2026-07-07 · **Deadline:** Mon Jul 13 2026, 5 PM PDT (submit Jul 12)

> ⚠️ **SUPERSEDED — this file is history.** Since it was written, Tempo was deployed
> (https://tempo-slack.vercel.app); RTS, AI, Postgres and the Slack write-actions all went live; the `web/`
> Next.js app and its second Vercel project were deleted (the dashboard is now `api/web/*` on the same domain).
> **The only current tracker is [`SUBMIT.md`](SUBMIT.md).** Read that instead.

---

## Where things stand

| Area | State |
|---|---|
| Feature roadmap (5 modules, RTS, MCP in/out, web, i18n, a11y, …) | ✅ Complete & green (411 tests, typecheck, build, 26-scene demo, web build) |
| W1 — P0 code fixes (Agent experience, `@vercel/slack-bolt`, fail-open gates) | ✅ Done (v4.1.0) |
| **Credential-free readiness** (this pass, v4.1.1) | ✅ Done — see below |
| W2 — live bring-up (deploy, OAuth, seed, verify live seams) | ⏳ Owner — needs keys → `GO_LIVE.md` |
| W3 — submission assets (video, screenshots, judge invites, submit) | ⏳ Owner — `GO_LIVE.md` §6 (diagram + Devpost draft already done) |

## What was completed without credentials (v4.1.1)

1. **Live seams hardened against the published Slack API references** (they were guessed — and wrong):
   - **RTS** (`src/platform/slack/rts/live.ts`): corrected to the real *flat* `assistant.search.context` payload
     — `content`, `message_ts`, `author_user_id`, `author_name`, `channel_id`, `channel_name` (users:
     `user_id`/`full_name`/`title`/`email`/`timezone`). No channel-type field exists, so it's inferred from the
     Slack channel-id prefix (D=DM, G=mpim). Params sent as arrays; `limit` capped at the documented max 20. Old
     keys kept as fallbacks; 2 new tests lock the documented shape.
   - **Slack Lists** (`src/platform/slack/webapi/live.ts`): rewritten to the real contract — `slackLists.create`
     takes `name` + a column `schema` and returns `column_id`s, which the rows now reference with typed
     `rich_text` values (was the invalid `{key,text}` shape).
   - Canvas / reminders / bookmarks / MCP: verified already-correct against the docs — no change.
2. **One-command deploy prep:** `npm run manifest:urls -- <app-url> [web-url]` fills the four manifest deployment
   placeholders (with `--check` gate); `web/vercel.json` added; all 19 OAuth scopes confirmed complete.
3. **`npm run preflight`:** runs typecheck + tests + build + demo + web build + all four skip-safe `verify:*` +
   manifest sanity — one command that proves credential-free readiness. Currently **all green**.
4. **Docs:** [`GO_LIVE.md`](GO_LIVE.md) runbook written; Devpost draft "Challenges" filled (only the video +
   sandbox URL remain); LEDGER "Next up" points at `GO_LIVE.md`.

## What to do next (owner — needs keys)

Follow **[`GO_LIVE.md`](GO_LIVE.md)** top to bottom. The critical-path summary:

1. **Day 1 (start immediately — longest lead):** join the Slack Developer Program → provision a sandbox →
   **request the semantic-RTS sandbox from Slack partnerships.** Get OpenAI key, Neon `DATABASE_URL`, Vercel
   account, and a strong `TEMPO_ENCRYPTION_KEY`.
2. **Local first (Socket Mode):** create the app from `manifest.json`, fill `.env`, `npm run verify:postgres`,
   `npm run seed -- --execute`, then **`npm run verify:rts`** and reconcile any 0/N field — the make-or-break step.
3. **Deploy:** `npm run manifest:urls -- <app> <web>` → Vercel root app + web companion (Root Dir `web`,
   include-files-outside-root ON) → OAuth → verify remaining live seams.
4. **Assets:** record the ≤3-min live video, screenshots, invite `slackhack@salesforce.com` +
   `testing@devpost.com`, paste the video + sandbox URLs into `docs/devpost-submission.md`, **submit Jul 12.**

## Key files
- **[`GO_LIVE.md`](GO_LIVE.md)** — the full ordered runbook (the thing to actually follow).
- `docs/devpost-submission.md` — paste-ready write-up (2 URLs left to fill).
- `docs/architecture.svg` / `.png` — submission diagram (done).
- `MASTER_PLAN.md` Part VII §7.4 — risk register & cut lines. `LEDGER.md` — full history.
