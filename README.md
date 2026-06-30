# Tempo — your working memory for Slack

> **Assistive technology for the way humans actually work.**
> Tempo triages the firehose, remembers your commitments, decodes tone, and protects your attention — and it never acts without your tap.

Built for the **Slack Agent Builder Challenge** · Track: **Slack Agent for Good** (accessibility + cognitive health).
Uses all three challenge technologies: **Real-Time Search (RTS) API · MCP · Slack AI / Assistant**.

---

## Why Tempo

Slack is a flat firehose. For the ~15–20% of knowledge workers who are **neurodivergent** (ADHD, autism, anxiety, dyslexia), for **non-native speakers**, and frankly for everyone drowning in unreads, it is exhausting — sometimes genuinely disabling. Every message looks equally urgent; promises evaporate into threads; tone is invisible; coming back from a week off is a panic.

Slack has no model of *your* obligations, *your* context, or *your* attention. The **RTS API (GA Feb 2026)** is the first time an agent can build one — searching a person's entire footprint across the workspace, **permission-aware**, with **nothing stored**. Tempo is the executive-function prosthesis that becomes possible.

This is not a helpdesk bot wrapped in Slack UI. It's a new category: **Slack as assistive tech.**

---

## What it does — five modules

| Module | What it does |
|--------|--------------|
| **1. Triage** ("the Surface") | Scans everything since you were last active and surfaces the *few* things that actually need you — **ACT / BLOCKER / FYI / NOISE** — including *implicit* blockers where nobody @-mentioned you. |
| **2. Commitment Ledger** ("the Memory") | Finds promises you made and promises made to you, parses the due date, and flags what's **overdue / at risk** before it slips. |
| **3. Tone Decoder** ("the Translator") | Explains a message's *implied* meaning, tone, and real urgency — and checks how *your* draft will land, with a softer rewrite. The accessibility core. |
| **4. Focus Guardian** ("the Shield") | Blocks deep-work time on your calendar and creates a task **via MCP**; sets an interrupt budget so only true blockers break through. |
| **5. Re-entry** ("the Bridge") | After time away, a calm, plain-language brief: what was decided, what changed for your projects, who's waiting on you. |

Everything is **human-in-the-loop**: Tempo drafts and proposes; you approve. It **never auto-sends**.

---

## Run the demo in 30 seconds (zero credentials)

The full pipeline ships with a seeded world ("Sam returns from a week off") and runs on a **mock RTS adapter** + **deterministic mock AI**, so you can see everything with no Slack app and no API key:

```bash
npm install
npm run demo      # runs the whole narrative through the real modules
npm test          # 16 tests across RTS, all five modules, and a11y
```

`npm run demo` prints triage, tone decode, draft check, the commitment ledger (computing "overdue" from "by Friday"), the focus block + MCP task, and the re-entry brief — exactly what renders in Slack.

---

## Architecture

```
   Slack (Assistant pane · App Home · /tempo · scheduled DM)
        │  Block Kit  ▲ approvals (nothing auto-sent)
        ▼            │
   Bolt (TypeScript) ── Socket Mode (dev) | Express/Vercel (prod)
        │
   Orchestrator ──► Modules ──► RTS client  ──► assistant.search.context
                       │         (USER token, no action_token, NO STORE)
                       ├──────►  LLM (Claude via AI SDK, or mock)
                       └──────►  MCP clients ──► Calendar / Notion / Linear
        │
   Postgres/Neon: encrypted user tokens + prefs  (never RTS content)
```

**Key decision — user tokens.** Tempo acts with each user's *own* Slack user token. Slack's docs are explicit: **user tokens need no `action_token`** (only bot tokens do). So RTS is scoped to exactly what the user can already see, *and* a background cron can run a real triage — see `api/cron/morning-digest.ts`. With a bot token, proactive triage would be impossible.

### How each required technology is used
- **RTS API** — `src/rts/` calls `assistant.search.context` for every read (triage candidates, commitment language, relationship history, re-entry). Live results are grounded into the model **in-memory and discarded**.
- **MCP** — `src/mcp/` makes Tempo an MCP *client* for outward actions (calendar block, task creation). Mock by default; the real-MCP seam is marked for dropping in `@modelcontextprotocol/sdk`.
- **Slack AI / Assistant** — `src/app.ts` wires the Assistant pane (suggested prompts, status), `/tempo`, App Home, and Block Kit.

---

## Privacy & compliance (a feature, not a footnote)

- Tempo **never stores anything RTS returns** — it grounds the model live and throws the data away (Slack ToS).
- It acts only with the user's **own** permissioned token; nothing it can read is anything they couldn't already see.
- It **never sends a message or changes anything without an explicit tap.**
- The only persisted data is **encrypted auth tokens + preferences** (`src/db/tokens.ts`, AES-256-GCM).

This is also why the **for-Good / accessibility** framing is clean: it's a *personal* assistant on personal data — not surveillance of others.

---

## Project layout

```
src/
  config.ts            env + runtime modes (RTS live/mock, AI live/mock, receiver)
  rts/                 RTS client: types, live (assistant.search.context), mock, fixtures
  agent/               llm wrapper, TempoContext, orchestrator (intent routing)
  modules/             triage · ledger · decoder · focus · reentry · draft
  mcp/                 outward MCP clients (calendar/tasks) + real-MCP seam
  blocks/              calm, accessible Block Kit builders
  a11y/                verbosity + read-aloud (TTS) script
  db/tokens.ts         encrypted user-token store
  app.ts · dev.ts      Bolt wiring (socket + express) and local entrypoint
api/                   Vercel: slack/events · oauth/{start,callback} · cron/morning-digest
scripts/               demo.ts (narrative) · seed-workspace.ts (live sandbox seeding)
manifest.json          Slack app manifest (scopes, assistant, /tempo, events)
```

---

## Running against a real Slack workspace

1. Create a Slack app from `manifest.json` (set the Request URLs / redirect to your deployment).
2. Fill `.env` from `.env.example` (`SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` for socket mode, `SLACK_USER_TOKEN` for the demo user, optional `ANTHROPIC_API_KEY`).
3. Seed the sandbox so live RTS has data: `npm run seed -- --execute`.
4. Flip to live: set `TEMPO_RTS=live` (and `TEMPO_AI=live` if you have a key).
5. `npm run dev` (Socket Mode) and open the Tempo assistant, or `/tempo triage`.

> **Enabling live RTS:** `assistant.search.context` is available to directory-published or internal apps. Confirm access for your app first; until then `TEMPO_RTS=mock` runs the identical experience. The live response field mapping in `src/rts/live.ts` is defensive — verify field names against your first live call.

---

## Submission checklist (Agent for Good)

- [x] Uses ≥1 required tech — **all three** (RTS + MCP + Slack AI).
- [x] Working product (`npm run demo`, 16 tests) + Slack surfaces.
- [ ] ~3-min demo video (storyboard below) with working footage.
- [ ] Architecture diagram (above).
- [ ] Sandbox URL with access to `slackhack@salesforce.com` + `testing@devpost.com`.
- [ ] Impact statement (accessibility / neurodiversity / non-native speakers / burnout).

### 3-minute video beats
1. The pain — Monday, 412 unreads, overwhelm.
2. **Triage** — "3 things actually need you."
3. **Tone decode** — Marco's "no rush 🙂" → what it really means → softened reply.
4. **Commitment Ledger** — the forgotten promise to Priya, drafted.
5. **Focus Guardian** — calendar block + Notion task via MCP, DND on.
6. **Re-entry** — "what changed while you were out."
7. Close — the impact stat; "Slack as assistive technology, built on RTS + MCP."

---

## Master plan & build ledger

Tempo is built as a **continuously buildable** product. Two documents drive it:

- **[`MASTER_PLAN.md`](MASTER_PLAN.md)** — the whole plan: vision, hackathon strategy, the professional modular-monolith architecture, the full code structure, every Slack + MCP integration, and the multi-phase 3-year roadmap. The build loop lives in its Part VI.
- **[`LEDGER.md`](LEDGER.md)** — the current repo version + progress. Read it, build the next item from the master plan, then update it.

## License

MIT (hackathon submission).
