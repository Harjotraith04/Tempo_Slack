# SUBMIT — the state of play

**Deadline: Mon Jul 13 2026, 5:00 PM PT.** This is the only current tracker.
`GO_LIVE.md`, `docs/STATUS.md`, `CREDENTIALS.md` and `MASTER_PLAN.md` Part VII all describe a **pre-deployment world** and are kept for history only — ignore them.

**Everything is built, deployed, and verified live.** What remains is the video and the Devpost form.

---

## Canonical links

| What | Where |
|---|---|
| **App / landing** | https://tempo-slack.vercel.app |
| **Privacy dashboard** (every stored field · export · delete) | https://tempo-slack.vercel.app/privacy |
| **Settings** (accessibility + consent scope) | https://tempo-slack.vercel.app/settings |
| **MCP server** — Tempo *is* one | `https://tempo-slack.vercel.app/api/mcp/server` |
| **Install (OAuth)** | https://tempo-slack.vercel.app/api/oauth/start |
| **Sandbox** | https://e0bhn1bngfj-52jkceoz.slack.com/ (`devpostslack`) |
| **Repo** | https://github.com/Harjotraith04/Tempo_Slack |
| **Architecture diagram** | `docs/architecture.png` |

**One Vercel project.** `/privacy`, `/settings` and `/privacy-policy` are plain Node handlers under `api/web/*`, routed by rewrites in `vercel.json` — no second deployment, no Next.js, no React.

---

## What is real, and what is not

Judges will check. Every line below is what the code actually does.

| | |
|---|---|
| **Real-Time Search API** | ✅ **live** — `assistant.search.context` on the user's own token |
| **Slack AI / Agent surfaces** | ✅ **live** — Agent pane, App Home, Block Kit, modals, Workflow steps |
| **MCP — inbound** | ✅ **live** — Tempo *is* an MCP server; 4 tools; a judge can call it (below) |
| **MCP — outbound** (calendar / task) | ⚠️ **mock-backed in this submission.** Built against the real SDK, but we did not stand up third-party OAuth we couldn't test end to end. The focus card says `(mock)` on its face. |
| **Slack DND + status writes** | ✅ **real** — verified on a live account |
| **Postgres (Neon), OpenAI** | ✅ live |
| `TEMPO_TEAM`, `TEMPO_ATTENTION_OS`, `TEMPO_PROACTIVE` | off. Attention-OS sources are **mock-only by design** — the seam is real, the integrations are not, and we don't call them integrations. |

### A judge can call the MCP server themselves

```bash
curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
  -H "Authorization: Bearer <TEMPO_MCP_SERVER_TOKEN>" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Returns `tempo_triage`, `tempo_commitments`, `tempo_decode`, `tempo_focus`. Default-deny: no token, or an unrecognised one, gets a 401.

---

## Remaining — owner only

- [ ] **Record the ≤3-min video.** Beats, commands and exact phrases: **[`DEMO.md`](DEMO.md)**. Run `npm run reset:demo` between takes so the DND moon icon appears *fresh* on camera.
- [ ] **Fill three values:**
  - `docs/devpost-submission.md:64` → the YouTube URL
  - `docs/devpost-submission.md:79` → the `TEMPO_MCP_SERVER_TOKEN`
  - `public/index.html` → swap the placeholder card for the video iframe (instructions are in the file)
- [ ] **Submit on Devpost.** Track: **Slack Agent for Good**. Copy is written in `docs/devpost-submission.md` + `docs/devpost-story.md`; upload `docs/architecture.png`.

**Already done:** judges (`slackhack@salesforce.com`, `testing@devpost.com`) are **Members** of the sandbox and are in all 7 demo channels · app reinstalled with `users:read` · 30 seeded messages live · consent scoping, conversational agent and crisis-safety path all shipped.

---

## Scorecard

| Criterion (25% each) | Standing |
|---|---|
| **Technological Implementation** | All three required technologies, live. 411 tests, hexagonal ports/adapters, CI. RTS is genuinely battle-tested — the `CORPUS_QUERY=""` lexical-AND finding and the `U00` author-hydration workaround are real empirical results, not guesses. And Tempo **is** an MCP server, not just a client: anyone can call one, few expose one. |
| **Design** | Block Kit throughout, an accessibility spine (verbosity · plain language · read-aloud · en/es), and a server-rendered privacy dashboard on the same domain that lists **every** field it stores. |
| **Potential Impact** | ~15–20% of knowledge workers are neurodivergent. The **crisis-safety path — where we deliberately take the LLM *out* of the loop** — is the strongest artifact in the build. Lead with it. |
| **Quality of the Idea** | Genuinely novel. Not a helpdesk bot wrapped in Slack UI. |
