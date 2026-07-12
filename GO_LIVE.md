# GO LIVE — Tempo's credential-only final mile

Everything in the repo is built and green. This is the **one ordered checklist** that turns it live and
submitted. It's the only work left, and it's all owner actions (accounts, keys, a recording) — no more features.
Distilled from `MASTER_PLAN.md` Part VII §7.2 (W2/W3). Deadline **Mon Jul 13, 5 PM PDT — submit Sun Jul 12**,
keep Jul 13 as buffer.

Sequence rationale: bring it up **locally first (Socket Mode)** so the one make-or-break unknown — the live RTS
field mapping — is de-risked before any deploy. Only then go to Vercel for the public HTTP surface, OAuth, and
cron.

---

## 0 · Day 1 — start the two slow externals immediately
These have the longest lead time; kick them off before anything else.

- [ ] Join the **Slack Developer Program** → provision a **sandbox** (free: 8 users, 3 workspaces, 6-month life).
- [ ] **Request the Slack-AI-Search (semantic RTS) sandbox from the Slack partnerships team** via the Developer
      Program. This is the single longest wait in the whole plan. Standard (non-semantic) RTS may work in a
      normal sandbox meanwhile — you'll test that on Day 1 with `verify:rts`. *Cut line:* non-semantic RTS still
      returns real, permission-aware results; **never demo on mock RTS in the video.**

Get these accounts/keys in parallel (all free tier):
- [ ] **OpenAI API key** (`sk-…`) — flips BOTH the LLM and read-aloud (TTS) to live automatically.
- [ ] **Neon Postgres** project → copy its `DATABASE_URL`.
- [ ] **Vercel account** (for the two deploys in §4).
- [ ] Generate a real **encryption key**: `openssl rand -base64 48` → `TEMPO_ENCRYPTION_KEY` (must be 32+ chars,
      not the dev default; the live posture rejects a weak key).

---

## 1 · Create the Slack app in the sandbox
- [ ] Slack app settings → **Create app → From manifest** → paste `manifest.json`. (URLs are still placeholders;
      that's fine for local Socket Mode — we fill them in §4.)
- [ ] **App settings → Socket Mode → enable** (the manifest ships `socket_mode_enabled: false` for prod; local
      dev needs it on). Generate an **app-level token** (`xapp-…`) → `SLACK_APP_TOKEN`.
- [ ] **Install to workspace.** Copy the **Bot token** (`xoxb-…`) and **Signing secret**.
- [ ] Under OAuth, note the **Client ID / Client secret** (for the §4 web OAuth flow).
- [ ] **Get a user token** (`xoxp-…`): easiest is to run the OAuth flow once (§4), or for pure local dev install
      with the user scopes and copy the user token → `SLACK_USER_TOKEN` (Tempo acts as this person, "Sam").

### Seed-only scopes (add temporarily, remove after §3)
The seed script needs three scopes that are **deliberately not in the manifest** (least-privilege). Add them to
the sandbox app for seeding, then remove:
`channels:manage` (create channels), `channels:read` (reuse existing), `chat:write.customize` (persona
username/emoji). Reinstall after adding.

---

## 2 · Local `.env` (Socket Mode, real keys)
Copy `.env.example` → `.env` and set:

```
SLACK_BOT_TOKEN=xoxb-…
SLACK_SIGNING_SECRET=…
SLACK_CLIENT_ID=…
SLACK_CLIENT_SECRET=…
SLACK_APP_TOKEN=xapp-…
SLACK_USER_TOKEN=xoxp-…
OPENAI_API_KEY=sk-…                  # TEMPO_AI + TEMPO_TTS auto-detect "live"
TEMPO_MODEL=gpt-4.1-mini             # NOT gpt-5.*/o-series: temperature is silently stripped
TEMPO_ENCRYPTION_KEY=<32+ random>
DATABASE_URL=postgres://…neon.tech/…?sslmode=require   # TEMPO_STORE auto-detects "postgres"
TEMPO_RECEIVER=socket
TEMPO_RTS=live
TEMPO_SLACK_ACTIONS=live
```

- [ ] `npm run verify:postgres` — non-destructive round-trip against Neon (confirms `DATABASE_URL` + schema).
- [ ] `npm run dev` — Bolt connects over Socket Mode; DM the app "what needs me today?" to sanity-check the loop.

---

## 3 · Seed the sandbox, then the make-or-break RTS check
- [ ] `npm run seed` — dry-run plan (channels + message count). Review.
- [ ] `npm run seed -- --execute` — creates demo channels and posts the "Northwind / Sam returns" story so live
      RTS has real data. (Needs the seed-only scopes from §1.)
- [ ] **`npm run verify:rts`** — the budget-a-full-session step. It runs representative searches and prints
      per-field coverage of the normalised `RtsMessage`/`RtsUser`.
  - The mapping in `src/platform/slack/rts/live.ts` already follows the published payload
    (`content`/`message_ts`/`author_user_id`/`author_name`/`channel_id`/`channel_name`; users
    `user_id`/`full_name`/`title`/`email`/`timezone`; `channelType` inferred from the id prefix).
  - Any field reading **0/N populated** is the one real key name to reconcile — fix it there, re-run until every
    field is populated. This is the highest-value hour in the whole bring-up.

---

## 4 · Deploy to Vercel (root app + web companion)
### Root app
- [ ] `vercel link` the repo → deploy. Set env vars (Project → Settings → Environment Variables):
      `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `OPENAI_API_KEY`, `TEMPO_MODEL`,
      `TEMPO_ENCRYPTION_KEY`, `DATABASE_URL`, `PUBLIC_URL=https://<app>.vercel.app`, `TEMPO_STORE=postgres`,
      `TEMPO_RTS=live`, `TEMPO_SLACK_ACTIONS=live`, `CRON_SECRET=<random>`.
      (`VERCEL=1` is set automatically → receiver defaults to HTTP and the secrets-hardening + no-file-store gates
      arm. A weak key or `TEMPO_STORE=file` will crash on purpose — that's the fail-loud guard.)
- [ ] **Fill the manifest URLs in one command:**
      `npm run manifest:urls -- https://<app>.vercel.app https://<web>.vercel.app`
      then paste the updated `manifest.json` into the Slack app (Settings → App Manifest) and set
      `socket_mode_enabled: false` (prod). Reinstall.

### Web companion (second Vercel project)
- [ ] New Vercel project, same repo, **Root Directory = `web`**, and turn **ON** "Include source files outside of
      the Root Directory in the Build Step" (the web app imports `../src` via `externalDir`).
- [ ] Env: `PUBLIC_URL=https://<web>.vercel.app`, plus `DATABASE_URL`, `TEMPO_ENCRYPTION_KEY`,
      `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET` (shares the domain/session).
- [ ] The web OAuth callback is the second `redirect_urls` entry `manifest:urls` already filled.

### OAuth + verify the rest
- [ ] Visit `https://<app>.vercel.app/api/oauth/start` → authorize → token stored (encrypted) in Neon.
- [ ] Live Slack actions in the sandbox: focus DND/status, canvas, Lists. **Slack Lists is the one guessed
      shape** — `syncListItems` creates the list with a schema and writes rows against the returned `column_id`s,
      but confirm the `rich_text` value encoding on a real call. *Cut line:* `TEMPO_LISTS=off` (not core).
- [ ] Outbound MCP (optional/full scope): point `TEMPO_MCP=live` + `TEMPO_MCP_CALENDAR_URL` at one real MCP
      server → `npm run verify:mcp` (lists tools, non-destructive). *Cut line:* keep MCP outbound mock; the
      inbound server already proves the MCP box.
- [ ] Inbound MCP server: `TEMPO_MCP_SERVER=on` + `TEMPO_MCP_SERVER_TOKEN` → `npm run verify:mcp-server`, then
      hit `/api/mcp/server` with MCP Inspector.
- [ ] TTS (optional): set `OPENAI_API_KEY` to enable real read-aloud audio.

---

## 5 · Dress rehearsal (the judge's 7 minutes)
Walk the `MASTER_PLAN.md` §1.6 storyline live in the sandbox, end to end:
open Tempo → onboarding → "what needs me?" → RTS-grounded triage card with working buttons → `/tempo commitments`
→ ledger with nudge/renegotiate drafts → "block 2 hours" → DND + status flip (+ calendar via MCP) → App Home
dashboard + settings modal → read-aloud. Confirm the Vercel cron morning-digest DM fires (or trigger
`/api/cron/morning-digest` with the `CRON_SECRET` header). **Freeze features here.**

---

## 6 · Submission assets (W3)
- [x] Architecture diagram — done (`docs/architecture.svg` / `.png`, source `docs/architecture.mmd`).
- [x] Devpost write-up + impact statement — drafted (`docs/devpost-submission.md`); only the two URLs below remain.
- [ ] **Record the ≤3-min video** against the **live sandbox** on the §1.6 beats. Public YouTube/Vimeo, real
      footage, no copyrighted audio. (`npm run demo` is the storyboard, not the footage.) → paste URL into
      `docs/devpost-submission.md` "Video".
- [ ] **Screenshots** for the Devpost gallery (triage card, ledger, focus flip, App Home).
- [ ] **Invite judges** to the sandbox: `slackhack@salesforce.com` + `testing@devpost.com`. Verify the invites
      landed. Pin the `#start-here` note (bottom of `docs/devpost-submission.md`). → paste sandbox URL into
      "Sandbox URL".
- [ ] **Confirm Slack Developer Program membership** shows on the account (a track requirement).
- [ ] **Submit on Devpost by Jul 12.** Jul 13 = buffer (re-render video / fix a reject).

---

## Definition of done
A judge added to the sandbox can, unaided, reproduce every claim in the write-up: open Tempo → suggested prompt →
real RTS-grounded triage with working buttons → commitments with drafts → focus block flips DND + status → App
Home live dashboard + settings — and the video + diagram + text tell the same story they just lived.

## Cut lines (if time runs short)
Five modules live + real RTS + one working MCP direction + video + diagram = a complete winning submission.
Everything else is polish: `TEMPO_LISTS=off`, canvas off, outbound MCP stays mock (inbound proves the box),
TTS off, web companion optional. See `MASTER_PLAN.md` §7.4 for the full risk register.
