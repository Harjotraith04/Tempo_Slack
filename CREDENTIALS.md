# CREDENTIALS — everything Tempo needs to go live

> ⚠️ **SUPERSEDED — kept for history.** This describes the pre-deployment world (a second Vercel project, a `web/` Next.js app, placeholder URLs). None of that exists any more: there is ONE Vercel project and the dashboard is served from `api/web/*` on the same domain.
> **The only current tracker is [`SUBMIT.md`](SUBMIT.md).**

The single checklist of every account, key, and approval Tempo needs. Nothing else in the repo is
blocking: the code is complete and `npm run preflight` is green with **zero** credentials.

**Provider note:** Tempo runs on **OpenAI** (both the reasoning modules and read-aloud). There is no
Anthropic dependency — one `OPENAI_API_KEY` covers both seams.

---

## TL;DR — the whole list

| # | What | Where | Cost | Time | Approval needed? |
|---|---|---|---|---|---|
| 1 | Slack Developer Program + sandbox | https://api.slack.com/developer-program | Free | ~10 min | **No — instant** |
| 2 | OpenAI API key | https://platform.openai.com/api-keys | ~$5 | ~5 min | No |
| 3 | Neon Postgres | https://console.neon.tech | Free | ~5 min | No |
| 4 | Vercel account | https://vercel.com/signup | Free | ~5 min | No |
| 5 | `TEMPO_ENCRYPTION_KEY` | `openssl rand -base64 48` | Free | 5 sec | No |
| 6 | `CRON_SECRET` | `openssl rand -hex 32` | Free | 5 sec | No |

**Everything on the critical path is self-serve. There is nothing you have to wait on.**

---

## 1. Slack Developer Program → sandbox  *(do this first)*

**https://api.slack.com/developer-program**

- **Free. Provisioning is instant — there is no review queue.** A card is required for identity
  verification only; you are not charged.
- **Use the sandbox, not your personal Slack.** The sandbox provisions as an **Enterprise Grid** org,
  and that is the only reason Slack **Lists** works at all (Lists is a paid-plan feature and will fail
  outright on an ordinary free workspace).
- Limits: 8 users, 2 active sandboxes, 6-month life. All fine for us.
- Membership in the Developer Program is **itself a track requirement** — confirm it shows on your
  account.

**What you'll copy out of it** (after creating the app from `manifest.json` and installing once):

| Value | Where in Slack | Env var |
|---|---|---|
| Bot token (`xoxb-…`) | OAuth & Permissions | `SLACK_BOT_TOKEN` |
| User token (`xoxp-…`) | OAuth & Permissions | `SLACK_USER_TOKEN` |
| Signing secret | Basic Information | `SLACK_SIGNING_SECRET` |
| Client ID / secret | Basic Information | `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` |
| Your own user id (`U…`) | Your Slack profile → Copy member ID | `SLACK_SUBJECT_USER_ID` |

> **Add the three seed-only scopes at the first install and leave them:** `channels:manage`,
> `channels:read`, `chat:write.customize`. `npm run seed` needs them. Removing them later forces a
> reinstall, which **rotates your bot token** and breaks the live deploy mid-flight.

## 2. OpenAI API key

**https://platform.openai.com/api-keys** → add ~$5 credit.

- **One key, two seams.** `OPENAI_API_KEY` flips **both** the five reasoning modules **and** read-aloud
  (TTS) to live. That's intended — you get real audio for free.
- **Set `TEMPO_MODEL=gpt-4.1-mini`.** Do **not** use a `gpt-5.*` or `o`-series model. Tempo passes a
  `temperature` on every call, and the AI SDK **silently strips** `temperature` for reasoning models —
  no error, no 400, the call just quietly runs at default sampling. That is an invisible regression you
  cannot afford to debug on deadline. `gpt-4.1-mini` genuinely honours temperature and supports the
  structured output the modules need.
- Verify in one command: **`npm run verify:ai`**.

## 3. Neon Postgres

**https://console.neon.tech** → new project → copy the **pooled** connection string.

- Must end with `?sslmode=require`.
- Required for the Vercel deploy: the file store is **rejected at startup** on Vercel (read-only
  filesystem). Setting `DATABASE_URL` auto-switches `TEMPO_STORE` to `postgres` — don't set it yourself.
- Verify: **`npm run verify:postgres`** (non-destructive round-trip).

## 4. Vercel

**https://vercel.com/signup** — free Hobby tier. **Two projects from the same repo:**

1. **Root app** — the Slack event/OAuth/cron surface.
2. **Web companion** — Root Directory = `web`, and turn **ON** *"Include source files outside of the
   Root Directory in the Build Step"* (it imports `../src`). Optional; cut it if time runs short.

## 5 & 6. Two secrets you generate yourself

```sh
openssl rand -base64 48   # → TEMPO_ENCRYPTION_KEY  (encrypts stored user OAuth tokens)
openssl rand -hex 32      # → CRON_SECRET           (auth for the morning-digest cron)
```

`TEMPO_ENCRYPTION_KEY` must be 32+ chars and must not contain "change-me" — the live posture
**deliberately crashes** on a weak key. If `CRON_SECRET` is unset, the cron endpoint is **open to
anyone**; set it.

---

## The one thing you cannot get — and don't need

### Semantic search (Slack AI Search)

Slack's own docs: *"To request a sandbox with this feature, please join the Slack Developer Program and
**reach out to the Slack partnerships team**."*

- **There is no self-serve path.** It is a human request with no published SLA — realistically weeks,
  with a real chance of no reply for a solo developer.
- **Do not put it on the critical path.** Send the email as a track signal, then proceed as if it will
  never arrive.

**Why this doesn't hurt us:** `assistant.search.context` is **GA and self-serve in keyword mode**, which
is what the `search:read.*` scopes grant. Keyword RTS returns **real, live, permission-aware Slack
results** — so the demo is genuinely grounded in real Slack data. The only rule that matters is: **never
demo on mock RTS.** Keyword mode satisfies it. The architecture diagram claims only "permission-aware,
live" — no semantic claim anywhere in the submission.

> **The open question keyword mode raises:** every query Tempo issues is written as a natural-language
> *semantic* prompt. A keyword engine may return nothing for those. `npm run verify:rts` now tests both
> query styles side by side and reports whether the **planted demo moments** actually surface — run it
> right after seeding, and it tells you in one command whether anything needs changing.

---

## Nothing else needs approval — the gotchas that look like blockers but aren't

| Thing | Status |
|---|---|
| **Slack Lists** (`lists:write`) | GA, but **paid-plan only** → works in the sandbox (Enterprise Grid), fails on a free workspace. Cut line: `TEMPO_LISTS=off`. |
| **Canvas** (`canvases:write`) | GA. On free-tier teams a `channel_id` is required. Cut line: `TEMPO_CANVAS=off`. |
| **`agent_view`** in the manifest | GA and correct. (The *legacy* `assistant_view` is the one new apps get rejected for — we don't use it.) |
| **`functions` block** (Workflow steps) | Never blocks app creation. Only *running* a step in Workflow Builder needs a paid plan. |
| **Bot-token RTS** | Would need an `action_token` from a triggering event. We use a **user token**, which doesn't — and it's the only way to reach private channels and DMs. Nothing to do. |
| **Sandbox message retention** (~90 days) | Irrelevant — `npm run seed` plants fresh messages minutes before the demo. |
| **Outbound MCP** (calendar/tasks) | Needs a real MCP server you don't have. **Skip it** — the inbound MCP server already proves the MCP requirement. |

---

## Final `.env` (local bring-up)

```sh
# Slack — from the sandbox app, after one install
SLACK_BOT_TOKEN=xoxb-...
SLACK_USER_TOKEN=xoxp-...
SLACK_SIGNING_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SUBJECT_USER_ID=U...          # your own member id — makes verify:rts meaningful

# OpenAI — one key, powers reasoning AND read-aloud
OPENAI_API_KEY=sk-...
TEMPO_MODEL=gpt-4.1-mini            # NOT gpt-5.*/o-series (temperature is silently stripped)

# Storage + secrets
DATABASE_URL=postgres://...neon.tech/...?sslmode=require
TEMPO_ENCRYPTION_KEY=<openssl rand -base64 48>
CRON_SECRET=<openssl rand -hex 32>
PUBLIC_URL=https://<your-app>.vercel.app

# Postures
TEMPO_RTS=live
TEMPO_SLACK_ACTIONS=mock            # flip to live only AFTER the deploy, so a stray
                                    # local run can't flip your own DND/status
```

**On Vercel, set the same values** plus `TEMPO_SLACK_ACTIONS=live`. Do **not** set `TEMPO_RECEIVER` or
`TEMPO_STORE` — Vercel sets `VERCEL=1`, which flips the receiver to HTTP and arms the hardening gates,
and `TEMPO_STORE` auto-detects Postgres from `DATABASE_URL`. A weak encryption key, a file store, or a
missing `PUBLIC_URL` will crash the function **on purpose** — that's the guard working; read the log.

---

## Verify in this order

Each command is skip-safe (exits 0 with no credentials), so run them as the keys land.

```sh
npm run preflight          # everything, credential-free. Green right now.
npm run verify:ai          # real OpenAI call — catches a wrong TEMPO_MODEL
npm run verify:postgres    # Neon round-trip
npm run seed -- --execute  # plant the demo story in the sandbox
npm run verify:rts         # ← the make-or-break check. Run it AFTER seeding.
npm run verify:mcp-server  # inbound MCP tools + auth
```

Then walk the judge's path in a clean browser **with your local dev server stopped**: `/api/oauth/start`
→ authorize → DM Tempo *"what needs me today?"* → triage card → `/tempo commitments` → *"block 2 hours"*
→ DND + status flip → App Home.

## Cut lines, in the order to take them
`TEMPO_LISTS=off` → `TEMPO_CANVAS=off` → outbound MCP stays mock → TTS off → skip the web companion.
Five modules live + real keyword-RTS grounding + one working MCP direction + the video + the diagram is
a complete submission.

**The one line never to cross:** if RTS returns nothing usable, set `TEMPO_RTS=mock` and **say so plainly
in the Devpost copy.** A mock demo presented as live is the only failure mode that gets you disqualified
rather than merely out-scored.
