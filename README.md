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

### Native surfaces (v2.0)

Tempo lives where you already work in Slack, beyond the Assistant pane and App Home:

- **Tempo Canvas** — a living personal command center (`canvases.create`/`edit`), auto-refreshed with today's triage, commitments, and focus. Tap *Update my Canvas* on App Home, or it refreshes with your morning digest.
- **Workflow Builder custom steps** — drop Tempo into any no-code workflow: *Summarize what I missed*, *Draft a reply*, *Block focus time*, *Add a commitment* (manifest `functions` + `function_executed` listeners).
- **Slack Lists sync** — mirror your Commitment Ledger to a native Slack List (*Sync commitments to a List*). Only derived facts are written — never the source message text.
- **Native reminders & bookmarks** — set a Slack reminder before a commitment slips; bookmark your Canvas into a channel.

All of it is still mock-first (runs credential-free) and human-in-the-loop.

---

## Run the demo in 30 seconds (zero credentials)

The full pipeline ships with a seeded world ("Sam returns from a week off") and runs on a **mock RTS adapter** + **deterministic mock AI**, so you can see everything with no Slack app and no API key:

```bash
npm install
npm run demo      # runs the whole narrative through the real modules
npm test          # 155 tests: RTS, MCP, the five modules, native surfaces, persistence, a11y, hardening
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
- **MCP** — `src/platform/mcp/` makes Tempo an MCP *client* for outward actions (calendar block, task creation). **Mock by default; real via `@modelcontextprotocol/sdk`** — set `TEMPO_MCP=live` + a Streamable-HTTP server URL per client (`TEMPO_MCP_CALENDAR_URL` / `TEMPO_MCP_TASKS_URL`) to act through a real Google Calendar / Notion / Linear / GitHub MCP server. The SDK is dynamically imported, so the zero-credential path never loads it; verify a live wiring with `npm run verify:mcp`.
  - **MCP *server* (v3.0)** — Tempo is *also* an MCP server: `src/platform/mcp/server/` exposes `tempo_triage` / `tempo_commitments` / `tempo_decode` / `tempo_focus` at `/api/mcp/server` (Streamable HTTP) so Agentforce / Claude / Cursor / ChatGPT can call Tempo. Each tool acts as the initiating user and returns **derived facts only** (never raw RTS content). Off unless `TEMPO_MCP_SERVER=on`; `npm run verify:mcp-server` lists the tools.
  - **Agentforce (v3.2)** — the endpoint is **default-deny**: a caller presents a signed **per-user agent token** (`mintAgentToken`) and Tempo acts as *that* user — no ambient authority, no hardcoded identity. `src/platform/agentforce/` packages the tools + a persona + the trust contract as an Agentforce Employee Agent descriptor. And Tempo knows its boundaries: an out-of-scope @mention (`src/modules/handoff/`) is **handed off gracefully** ("that's an ops task — try your on-call agent") rather than guessed.
- **Slack AI / Assistant** — `src/app.ts` wires the Assistant pane (suggested prompts, status), `/tempo`, App Home, and Block Kit.

---

## Privacy & compliance (a feature, not a footnote)

- Tempo **never stores anything RTS returns** — it grounds the model live and throws the data away (Slack ToS).
- It acts only with the user's **own** permissioned token; nothing it can read is anything they couldn't already see.
- It **never sends a message or changes anything without an explicit tap.**
- The only persisted data is **encrypted auth tokens + preferences + derived facts** (`src/platform/persistence/`, tokens AES-256-GCM), behind one `Store` port with file **and** Neon Postgres adapters.

This is also why the **for-Good / accessibility** framing is clean: it's a *personal* assistant on personal data — not surveillance of others.

**Proactive, but calm (opt-in).** With `TEMPO_PROACTIVE=on`, the morning digest folds in a gentle **overload heads-up** ("your week looks heavy — 9 open obligations, no focus time protected; want me to block some?") and **batches non-urgent FYIs** into one section instead of interrupting for each. It's computed from the **counts** Tempo already keeps (`src/modules/intelligence/load.ts`), never message content, and only ever *notifies* — never acts.

**Learns from you (privately).** Tempo tunes triage ranking and tone-read confidence to *you* — but it learns **only from your own taps** (snooze / mark-done / draft), stored as **counts per sender id**, never from message content. The learned weight is bounded, so it reorders near-ties without ever overriding a genuine urgent ask. Those per-sender signals appear in your data export and are erased by "Delete everything," like everything else.

**Least-privilege scopes.** Every OAuth scope Tempo requests is declared and justified in one place (`src/platform/slack/oauth/scopes.ts`), and a test asserts `manifest.json` requests **exactly** that set — no more, no less. RTS runs on your own user token, scoped to what you can already see. See [`PRIVACY.md`](PRIVACY.md) and [`SECURITY.md`](SECURITY.md); the full listing package is in [`docs/marketplace-listing.md`](docs/marketplace-listing.md).

### Your data (the web companion, v2.6)

A small **Next.js app under [`web/`](web/)** gives every user direct control over what Tempo has stored:

- **Privacy dashboard** (`/privacy`) — shows *exactly* what's kept: token metadata (never the token itself), preferences, counts-only metrics, pinned commitments as **derived facts** (never message text), snoozes, and surface ids.
- **Export** (`/api/data/export`) — download everything as JSON (right to portability).
- **Delete** (`/api/data/delete`) — one tap erases your token, prefs, commitments, snoozes, metrics, and surface ids, and signs you out (right to erasure).
- **Settings** (`/settings`) — the same accessibility preferences as the Slack App Home, over the web.

Auth is a signed, expiring **HttpOnly session cookie** (HMAC over the user id, keyed off the same secret the token store uses) set at "Sign in with Slack". The app **shares the exact same domain** as the Slack app — the data-governance use-cases (`src/application/use-cases/user-data.ts`) and the `Store` ports — so an export can *structurally* never contain a decrypted token or RTS content (asserted in tests + demo scene 17). Run it locally: `npm run web:dev` (after `cd web && npm install`).

---

## Accessibility (a first-class constraint, audited)

Accessibility is enforced on every surface, not bolted on:

- **Adjustable verbosity** — `standard` or `brief` (one line), per user (`db/prefs.ts`).
- **Reading level** — `plain` breaks dense punctuation (em-dashes, `;`-joined lists) into short, one-idea sentences **without dropping any information** — numbers, units, and parentheticals are preserved (`a11y/plainify`).
- **Read-aloud** — every response carries a calm, markdown-free speech script; with the preference on, it's synthesized to real audio and DM'd (`a11y/tts/`).
- **Ranked, capped output** — never more than the user's `maxItems`; a "show the rest" affordance rather than a firehose.
- **Calm empty & error states** — "you're all caught up ✨" instead of a bare blank, and an honest "nothing was changed" card on failure (`blocks/emptyStateBlocks`, `errorBlocks`).
- **Privacy-safe impact** — a weekly "your week with Tempo" summary is **counts only**; it never records message content (`db/metrics.ts`).

Every response is verified in tests to carry a non-empty fallback `text` and a spoken `speech` script.

---

## Project layout — a layered modular monolith

Dependency rule: `inbound → application → modules → ports`; adapters in `platform/*`
implement the ports; **domain `modules/` never import `platform/`** (they depend only on `ports/`).

```
src/
  main/            Bolt wiring (createApp/express) + local entrypoint (dev.ts)   ← inbound
  application/     orchestrator (intent routing, response assembly) + TempoContext
  modules/         DOMAIN: triage · ledger · decoder · focus · reentry · draft · onboarding
  ports/           the interfaces the domain depends on: RtsClient · SlackActionsClient · Mcp
  platform/        ADAPTERS (implement the ports; mock + live)
    slack/rts/     RTS client: live (assistant.search.context) · mock · fixtures · caching
    slack/webapi/  Slack write-actions: DND · status · scheduled digest
    slack/blockkit/calm, accessible Block Kit builders (+ empty/error/metrics states)
    ai/            LLM wrapper (Claude via AI SDK, or deterministic mock)
    mcp/           outward MCP clients (calendar/tasks) + real-MCP seam
    persistence/   encrypted tokens · prefs · commitments · snoozes · metrics (counts only)
  accessibility/   verbosity · reading level (plain) · read-aloud (TTS)
  shared/          cross-cutting: WebClient retry/backoff options · request cache
  config.ts        env + runtime modes (RTS/AI/Slack-actions/TTS live-mock, receiver)
api/               Vercel: slack/events · oauth/{start,callback} · cron/morning-digest
scripts/           demo.ts (narrative) · seed-workspace.ts (live sandbox seeding)
manifest.json      Slack app manifest (scopes, assistant, /tempo, events)
```

---

## Running against a real Slack workspace

1. Create a Slack app from `manifest.json` (set the Request URLs / redirect to your deployment).
2. Fill `.env` from `.env.example` (`SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` for socket mode, `SLACK_USER_TOKEN` for the demo user, optional `ANTHROPIC_API_KEY`).
3. Seed the sandbox so live RTS has data: `npm run seed -- --execute`.
4. Flip to live: set `TEMPO_RTS=live` (and `TEMPO_AI=live` if you have a key).
5. `npm run dev` (Socket Mode) and open the Tempo assistant, or `/tempo triage`.

> **Enabling live RTS:** `assistant.search.context` is available to directory-published or internal apps. Confirm access for your app first; until then `TEMPO_RTS=mock` runs the identical experience. The live response field mapping in `src/platform/slack/rts/live.ts` is defensive (and now follows `next_cursor` pagination) — verify field names against your first live call.

---

## Submission checklist (Agent for Good)

- [x] Uses ≥1 required tech — **all three** (RTS + MCP + Slack AI).
- [x] Working product (`npm run demo`, 108 tests) + Slack surfaces.
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
