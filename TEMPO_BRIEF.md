# Tempo — Complete Technical Brief

> **Purpose of this document.** A single, verified source of truth about the Tempo project — problem,
> solution, architecture, tech stack, engineering decisions, and numbers. Feed this to any tool
> (Claude, GPT, Gemini, Gamma, Beautiful.ai) to generate a deck, a write-up, or a submission.
>
> Every fact below was checked against the actual code, not from memory. The **"Do not claim"**
> section at the end lists things that sound true but are not — do not let a generator invent them.

---

## 1. Identity

| Field | Value |
|---|---|
| **Project name** | **Tempo** |
| **Version** | v4.2.0 |
| **Tagline** | *Your working memory for Slack* |
| **One-liner** | Slack, but it remembers, triages, and protects your attention. |
| **Positioning** | Not a helpdesk bot wrapped in Slack UI. A new category: **Slack as assistive technology.** |
| **Elevator pitch** | An executive-function co-pilot that does for attention and working memory what a screen reader does for sight. |
| **Author** | Harjot Singh Raith |
| **GitHub** | [@Harjotraith04](https://github.com/Harjotraith04) — `github.com/Harjotraith04/Tempo_Slack` |
| **Competition** | Slack Agent Builder Challenge |
| **Track** | **Agent for Good** — accessibility + cognitive health |
| **Required tech** | Uses **all three**: Real-Time Search API · MCP · Slack AI / Assistant |
| **License** | MIT |

---

## 2. Problem statement

Slack is a **flat firehose**. Every message looks equally urgent, commitments evaporate into
threads, tone is invisible, and returning from time off is a panic.

**Slack has no model of *your* obligations, *your* context, or *your* attention** — it treats the
412th unread exactly like the 1st. The work of deciding what matters — the *executive function* —
is silently pushed onto the person least able to spare it.

**Who this actually disables:**

- **Neurodivergent workers — ~15–20% of the knowledge workforce** (ADHD, autism, anxiety, dyslexia). For them this isn't an annoyance; it's genuinely *disabling*.
- **Non-native speakers**, who must decode implicit tone and urgency in a second language.
- **Everyone else**, for whom it is a quiet daily tax on focus and wellbeing.

**Punchiest framing:** *"For millions of people, Slack isn't a tool — it's an anxiety machine."*

### Why now

Slack's **Real-Time Search (RTS) API went GA in February 2026.** For the first time, an agent can
model *a single person's entire footprint and obligations across a workspace* — permission-aware,
semantic, and with **no data stored externally**. That is the unlock that makes a personal working
memory possible. Tempo could not have been built before this.

---

## 3. The solution — five modules

| # | Module | Nickname | What it does |
|---|---|---|---|
| 1 | **Triage** | *the Surface* | Scans everything since you were last active and sorts it into **ACT / BLOCKER / FYI / NOISE** — including *implicit* blockers where nobody @-mentioned you. "3 things actually need you today." Ranked and capped at your `maxItems`; the rest waits behind a button. |
| 2 | **Commitment Ledger** | *the Memory* | Finds promises **you made** and promises **made to you**; parses the due date ("by Friday" → overdue); flags **overdue / at-risk** *before* it slips; drafts a nudge or a deadline renegotiation. Auto-closes when delivered. |
| 3 | **Tone Decoder** | *the Translator* | Explains a message's **implied** meaning, tone, and *real* urgency — and checks how **your** draft will land, offering a softer rewrite. Reports honest confidence. **This is the accessibility core.** |
| 4 | **Focus Guardian** | *the Shield* | Flips **real** Slack **DND + status** (verified live), books a calendar hold + task via outbound **MCP** *(mock-backed in this submission)*, and sets an **interrupt budget** so only true blockers break through. |
| 5 | **Re-entry** | *the Bridge* | After time away: a calm, plain-language brief — what was decided, what changed for your projects, who's waiting on you. |

### The trust guarantee

**Human-in-the-loop.** Tempo drafts and proposes; *you* approve. **It never auto-sends.**
This is enforced in code, not policy — no auto-send path exists anywhere in the codebase.

### Surfaces it lives on

- **Agent pane** (2026 `agent_view`) with suggested prompts: *"What needs me today?"* · *"What did I promise?"* · *"Catch me up"*
- **`/tempo`** slash command and **@mention**
- **App Home** dashboard + accessibility settings modal
- **Block Kit** cards with snooze / mark-done / nudge / renegotiate buttons
- **Scheduled morning-digest DM** (Vercel Cron — proactive, not reactive)
- **Tempo Canvas** — a living personal command center (`canvases.create` / `edit`)
- **Workflow Builder custom steps** (4): *Summarize what I missed · Draft a reply · Block focus time · Add a commitment*
- **Slack Lists sync** — mirrors the Commitment Ledger to a native List (derived facts only, never message text)
- **Native reminders & bookmarks**
- **Web companion** — `/privacy` dashboard, `/settings`, `/api/data/export`, `/api/data/delete`
- **Tempo as an MCP server** — external agents (Agentforce, Claude, Cursor) can call Tempo

---

## 4. Tech stack

### Core

| Layer | Technology |
|---|---|
| **Language** | TypeScript 5.7 — `strict`, `noUncheckedIndexedAccess`, ESM (`module: NodeNext`), target ES2022 |
| **Runtime** | Node.js ≥ 20 |
| **Build** | `tsc` → `dist/`. No bundler. |
| **Slack framework** | **Bolt for TypeScript v4** (`@slack/bolt`) |
| **Hosting** | **Vercel** — Fluid Compute + Cron |
| **Database** | **Neon Postgres** (`@neondatabase/serverless`) |
| **LLM** | **OpenAI `gpt-4.1-mini`** via the **Vercel AI SDK** *(⚠️ not Claude — see §10)* |
| **TTS** | **OpenAI `tts-1`** (voice: `alloy`) for read-aloud |
| **Testing** | **vitest** |
| **CI** | GitHub Actions — Node 20 |

### Production dependencies — all 10 of them

| Package | Version | Used for |
|---|---|---|
| `@slack/bolt` | ^4.2.0 | App, Assistant pane, ExpressReceiver, workflow steps |
| `@slack/web-api` | ^7.16.0 | Every Slack Web API call (RTS, DND, canvas, lists, OAuth) |
| `@vercel/slack-bolt` | ^1.6.0 | `VercelReceiver` — immediate ack + `waitUntil` background work |
| `ai` | ^4.0.0 | Vercel AI SDK — `generateObject` / `generateText` |
| `@ai-sdk/openai` | ^1.3.24 | OpenAI provider |
| `@modelcontextprotocol/sdk` | ^1.29.0 | MCP — **both** client and server |
| `@neondatabase/serverless` | ^0.10.4 | Postgres driver |
| `zod` | ^3.23.8 | LLM structured-output schemas + MCP tool input schemas |
| `chrono-node` | ^2.7.7 | Natural-language due-date parsing ("by Friday" → timestamp) |
| `dotenv` | ^16.4.5 | Env loading |

**Dev:** `typescript`, `tsx`, `vitest`, `@types/node`.

**Zero dependencies used for:** TTS (global `fetch`), crypto (`node:crypto`), sessions (HMAC via
`node:crypto`), HTML rendering (hand-rolled server-rendered pages — no React, no Next.js).

### The three required technologies — how each is used

**1. Real-Time Search (RTS) API**
- Calls `assistant.search.context` for **every read**: triage candidates, commitment language, relationship history, re-entry.
- Runs on the user's **own user token** (see §7 — this is the key architectural decision).
- Paginates via `next_cursor`, max 5 pages, `limit` capped at the documented max of 20.
- **The corpus query is the empty string.** RTS retrieval is lexical and AND-scoped, so any keyword query *subtracts* the implicit-blocker messages. Principle: **RTS grounds, the model reasons.**
- Results are grounded into the model **in-memory and discarded** — never persisted.

**2. MCP — both directions**
- **Outbound (Tempo as MCP *client*)** — Streamable HTTP via `@modelcontextprotocol/sdk`. Focus Guardian calls `create_event` on a calendar MCP server and `create_task` on a tasks MCP server (Google Calendar / Notion / Linear / GitHub).
- **Inbound (Tempo *is* an MCP server)** — stateless Streamable HTTP at `/api/mcp/server`, exposing **4 tools**:
  - `tempo_triage` — `{limit?: 1–20}` → ranked ACT/BLOCKER/FYI items
  - `tempo_commitments` — → promises made / owed, with status
  - `tempo_decode` — `{text, from?}` → implied meaning, tone, urgency, confidence
  - `tempo_focus` — `{minutes?: 5–480}` → calendar block + task + Slack DND/status
  - **Default-deny auth**: a caller presents a signed **per-user** agent token. No token → **401**. No ambient authority, no hardcoded identity. Tools return **derived facts only** — no raw message text ever crosses the MCP boundary.

**3. Slack AI / Assistant**
- Agent pane (`agent_view`) with suggested prompts and status, `/tempo`, App Home, Block Kit, Workflow Builder custom functions.

### Slack API surface used

`assistant.search.context` · `conversations.history` · `conversations.open` · `chat.postMessage` ·
`chat.postEphemeral` · `chat.update` · `chat.scheduleMessage` · `views.publish` · `views.open` ·
`files.uploadV2` · `users.info` · `dnd.setSnooze` · `users.profile.set` · `canvases.create` ·
`canvases.edit` · `slackLists.create` · `slackLists.items.create` · `reminders.add` ·
`bookmarks.add` · `oauth.v2.access`

### OAuth scopes — 11 user + 13 bot, every one justified

- **User (11):** `search:read.public`, `search:read.private`, `search:read.im`, `search:read.mpim`, `search:read.files`, `search:read.users`, `dnd:write`, `users.profile:write`, `canvases:write`, `lists:write`, `reminders:write`
- **Bot (13):** `assistant:write`, `chat:write`, `im:write`, `im:history`, `commands`, `app_mentions:read`, `files:write`, `bookmarks:write`, `users:read`, `channels:manage`, `channels:read`, `chat:write.customize`, `channels:history`

Single source of truth: `src/platform/slack/oauth/scopes.ts` — each scope carries a `why` and a
`usedBy`. **A test asserts `manifest.json` requests exactly this set — no more, no less**, so scopes
cannot silently drift.

---

## 5. Architecture

### Pattern — hexagonal modular monolith (ports & adapters)

```
main/          entrypoints + Bolt wiring          ← inbound
application/   orchestrator · container · context · read-models · use-cases
modules/       DOMAIN: triage · ledger · decoder · focus · reentry · draft ·
               handoff · intelligence · onboarding · team
ports/         the interfaces the domain depends on:
               RtsClient · LlmPort · SlackActionsClient · McpClients · Store
platform/      ADAPTERS (implement the ports; mock + live):
               slack/{rts,webapi,blockkit,oauth,inbound} · ai · mcp ·
               persistence/{file,pg} · sources · web · agentforce
accessibility/ verbosity · reading level · read-aloud (TTS) · i18n (en/es)
shared/        cache · session · timeout · webClientOptions
```

**Dependency rule:** `inbound → application → modules → ports`. **Domain modules import only
`ports/`, never `platform/`, and never an SDK.** This is what makes every external system swappable
between a mock and a live adapter.

### End-to-end request flow (Slack message → answer)

```
Slack POST /api/slack/events
 → api/slack/events.ts  (exports POST, not default — a default export makes Vercel
                         discard the Response and hang to timeout)
 → src/main/vercel.ts   VercelReceiver verifies the signature, ACKs in <3s,
                         and finishes the real work in waitUntil()
 → src/main/app.ts      handler: app.message / /tempo / app_mention / Assistant.userMessage
                         · safely() wraps it — a thrown handler never kills Bolt
                         · replyWithPlaceholder() posts "_Reading your Slack…_" immediately
 → contextFor(user)     load prefs → resolve display name → resolve the user's OAuth token
                         → build TempoContext = Caching(Scoped(MultiSource(RTS)))
 → withTimeout(orchestrator.respond(ctx, text), 45s)
      routeIntent(text)                            → e.g. "triage"
      read-models.liveTriage(ctx):
         rts.search({ query: "", after: lastActiveTs })   ← Slack RTS API
         → llm.structured({ schema, temperature: 0.1 })   ← OpenAI gpt-4.1-mini
         → rank() using bounded learned per-sender weights
         → filter snoozed / done
      → blockkit.triageBlocks() + a11y transforms + speech script
 → chat.update() rewrites the placeholder into the finished answer
 → if prefs.readAloud → OpenAI tts-1 → files.uploadV2 into a DM
```

**Button press:** `ack()` → `safely()` → parse the action target → store write → ephemeral
confirmation. `draft_reply` re-searches RTS for the source text, drafts a reply, and posts it with
*"review and send it yourself"* — **Tempo never sends.**

**Focus:** parse minutes → MCP `calendar.blockFocus` + `tasks.create` (best-effort, guarded) →
`dnd.setSnooze` + `users.profile.set` + `chat.scheduleMessage` for the post-block digest.

**Cron:** Vercel Cron (`0 16 * * 1-5`) → verify `CRON_SECRET` → list stored tokens → run a real
per-user triage sequentially → DM the digest.

**Inbound MCP:** agent POSTs `/api/mcp/server` → runtime assertions → 404 unless enabled →
resolve the caller's signed per-user token, else **401** → load *that user's* Slack token → run the
**same** `liveTriage` / `liveCommitments` read-models the Slack path uses.

### Entry points

| Path | Role |
|---|---|
| `src/main/dev.ts` | Local dev — Socket Mode |
| `src/main/vercel.ts` | Production composition root |
| `api/slack/events.ts` | All Slack traffic (`maxDuration: 120`) |
| `api/mcp/server.ts` | Inbound MCP endpoint (`maxDuration: 60`) |
| `api/cron/morning-digest.ts` | Proactive daily triage (`maxDuration: 300`) |
| `api/oauth/start.ts` · `callback.ts` | Per-user OAuth install |
| `api/web/*` · `api/data/*` | Privacy dashboard, settings, GDPR export & erasure |

### Data model

Two interchangeable adapters behind one `Store` port, **7 repos each**: `tokens`, `prefs`,
`commitments`, `snoozes`, `metrics`, `surfaces`, `signals`.

- **File adapter** (default) — JSON, for zero-credential local runs
- **Postgres adapter** (Neon) — auto-selected when `DATABASE_URL` is set; idempotent migrations on first query
- Tokens encrypted at rest with **AES-256-GCM**

---

## 6. Privacy & security — the two invariants

### Invariant 1 — Tempo never stores what it reads

It grounds its reasoning **live** in RTS using *your own* user token, uses the results **in memory**,
and **discards them**. No message, file, channel or thread content is ever written to disk or a database.

**This is enforced structurally, not promised:**
- The pinned-commitment type is literally `Omit<Commitment, "sourceText">`
- `stripSourceText()` runs at the persistence boundary
- The Postgres schema has **no message-content column**
- Metrics are integers only; learned signals are **counts keyed by sender id**, never content
- Guard tests assert all of the above

### Invariant 2 — Tempo never acts without your tap

It proposes; you approve. Nothing is sent or changed without an explicit action from you.

### What *is* stored (the complete list — 7 categories)

1. Encrypted OAuth user token (AES-256-GCM)
2. Preferences (verbosity, reading level, locale, read-aloud, maxItems)
3. Pinned commitments — **derived facts only**: what / counterparty / due / permalink
4. Snoozes & done — permalink + status
5. Usage metrics — **counts only**
6. Learned signals — **per-sender counts**, keyed by Slack user id
7. Surface ids — Canvas / List handles, not content

### Rights are buttons, not requests

`/privacy` shows exactly what's held · `/api/data/export` (portability, JSON) ·
`/api/data/delete` (erasure — immediate and total across all 7 repos). A governance test guarantees
export and delete cover **every** stored category, and that an export can *structurally* never
contain a decrypted token or RTS content.

### Security posture

- **Least privilege** — every scope declared and justified; drift-tested against the manifest
- **Fail-loud startup assertions** — `assertSecretsHardened()` refuses to boot in any live posture on a weak/default encryption key; `assertVercelRuntime()` rejects the file store on Vercel's read-only filesystem
- **OAuth CSRF** — single-use `state` in a short-lived HttpOnly cookie, constant-time compared
- **Sessions** — HMAC-signed HttpOnly cookies; the same scheme backs the MCP agent tokens
- **Rate-limit resilience** — one shared retry/backoff config for every `WebClient`

**The one-liner:** *Privacy is architectural, not a promise.*

---

## 7. Signature engineering decisions

**1. User tokens, not bot tokens — the decision the whole product rests on.**
Slack's docs are explicit: **user tokens need no `action_token`** (only bot tokens do). So RTS is
scoped to exactly what the user can already see, **and** a background cron can run a *real* triage.
With a bot token, proactive triage would be **impossible**. This is simultaneously the privacy story:
a personal agent on personal, already-permissioned data — *not surveillance of others*.

**2. Mock/live seams everywhere, double-gated.**
RTS, LLM, Slack write-actions, TTS, MCP-out, MCP-in and the store each have a mock **and** a live
adapter, and each goes live only when *both* the mode flag **and** the required credential are
present. Consequence: **the entire product runs with zero credentials** — which is why `npm run demo`
is CI's end-to-end smoke test.

**3. SDK isolation.**
Every heavyweight SDK is confined to exactly one file and **dynamically imported**: the MCP client,
the MCP server, the Neon driver, the Vercel receiver, the OpenAI provider. The zero-credential path
never loads any of them.

**4. "A garnish must never take down the meal."**
In Focus Guardian, DND + status are the *substance* of a focus block; the calendar event and the task
are a garnish. Outbound MCP is wrapped in its own guard — if it fails, the Slack block still lands,
and the summary says only what **actually** happened ("Couldn't reach your calendar — the Slack block
is still on"). **Tempo never claims an action it didn't take.**

**5. Errors can never strand a user.**
`safely()` means a thrown handler never crashes Bolt or leaves a dead button. `withTimeout()` converts
a *hang* into an error (because `safely` only fires on a throw). A message can never be left reading
*"Reading your Slack…"* forever.

**6. Default-deny inbound MCP.** No ambient authority. A shared token is useless without an explicit
user identity.

**7. Consent scoping.** A `ScopedRtsClient` decorator wraps the grounded source, so every module
inherits the user's channel allowlist and muted-user list **without knowing it exists**.

**8. Accessibility as a machine-checked gate.** `auditResponse` asserts — in CI, across **every**
response type — that each response carries a non-empty, markdown-free read-aloud script, labeled
buttons, and true plain language.

---

## 8. Accessibility features (the "for Good" substance)

- **Adjustable verbosity** — `standard` or `brief` (one line), per user
- **Reading level** — `plain` breaks dense punctuation into short, one-idea sentences **without dropping information** (numbers, units and parentheticals are preserved)
- **Read-aloud** — every response carries a calm, markdown-free speech script, synthesized to real audio and DM'd
- **Multilingual** — i18n message catalog, English + Spanish, so the read-aloud speaks *your* language
- **Ranked, capped output** — never more than your `maxItems`; a "show the rest" button instead of a firehose
- **Calm empty & error states** — *"you're all caught up ✨"* instead of a blank, and an honest *"nothing was changed"* card on failure
- **Learns from you, privately** — re-ranks triage from **your own taps only**, stored as counts per sender id, never content; the learned weight is **bounded ±20** so it reorders near-ties but can never override a genuine urgent ask
- **Open accessibility SDK** — the calm-UX primitives are extracted so other builders can make *their* agents cognitively accessible

**Opt-in, off by default:** Proactive overload heads-up (computed from counts only, *notifies* — never
acts) · Team mode (aggregate-only, anonymized, **k-anonymity-redacted below 3 opted-in members**) ·
Attention OS (one working memory spanning Slack + email + calendar behind the same port).

---

## 9. Numbers

| Metric | Value |
|---|---|
| Version | v4.2.0 |
| TypeScript files | 196 (145 source + 51 test) |
| Lines of code | ~14.6k total (~10.4k non-test, ~4.3k test) |
| Tests | **411** (55 test files, vitest) |
| Production dependencies | **10** |
| Git-tracked files | 225 |
| Demo | **26 scenes**, runs **credential-free** |
| OAuth scopes | 11 user + 13 bot, each justified and drift-tested |
| MCP tools exposed | 4 |
| Domain modules | 10 |
| Persistence repos | 7 × 2 adapters |
| Vercel API routes | 11 |
| Build phases shipped | 15 (v0.1 → v4.2) |

**Impact numbers:** ~15–20% of knowledge workers are neurodivergent · RTS API GA'd **February 2026** ·
412 unreads (the narrative pain number) · k-anonymity floor of 3 · learned weight bounded ±20 ·
Slack's 3-second ack deadline · RTS `limit` capped at 20.

---

## 10. ⚠️ Do NOT claim these (they sound true; they are not)

- ❌ **"Powered by Claude / Anthropic."** **False.** It is **OpenAI `gpt-4.1-mini`** + `tts-1`. The Anthropic dependency was removed; only two stale code comments still say "Claude" (`src/platform/ai/index.ts`, `scripts/verify-live-ai.ts`). A judge who greps the repo will find OpenAI.
- ❌ **"Creates a real Google Calendar event."** Outbound MCP ships against a **mock** by design — third-party OAuth that couldn't be tested end-to-end was deliberately not stood up. Frame it as *"MCP-ready, mock-backed."*
- ✅ **411 tests across 55 files** — every doc now says this. If you change anything, re-run `npm test` and use the real number rather than quoting a stale one.
- ❌ **A `web/` Next.js app.** It was deleted. The web pages are hand-rolled server-rendered HTML in `src/platform/web`.
- ❌ **Attention OS email/calendar sources as working integrations.** They are mock-only **by design** — a roadmap direction, not a shipped integration.

**The honest framing that still wins:** every seam is *built, tested, and one environment variable
away from live*. That is a stronger engineering claim than a half-working integration, and it is true.

---

## 11. Lines worth quoting

> "For millions of people, Slack isn't a tool — it's an anxiety machine."

> "Slack has no memory of you. It remembers every message, and nothing about which ones were load-bearing."

> "This is not a helpdesk bot wrapped in Slack UI. It's a new category: **Slack as assistive tech.**"

> "Privacy is architectural, not a promise."

> "A garnish must never take down the meal."

> "Calm, ranked, plain-language communication is universal design — **like curb cuts**."

> "Nothing above was sent or changed without Sam's tap. Nothing RTS returned was stored."

> "**Tempo turns Slack into assistive technology — built on RTS + MCP.**"

---

## 12. Assets already in the repo

| Asset | Path |
|---|---|
| Architecture diagram | `docs/architecture.mmd` (Mermaid source) · `docs/architecture.png` · `.svg` |
| Devpost write-up | `docs/devpost-submission.md` |
| Marketplace listing | `docs/marketplace-listing.md` |
| Accessibility SDK doc | `docs/accessibility-sdk.md` |
| Privacy / Security / Enterprise | `PRIVACY.md` · `SECURITY.md` · `ENTERPRISE.md` |
| Full plan & roadmap | `MASTER_PLAN.md` |
| Engineering log | `LEDGER.md` |
| Runnable demo | `npm run demo` — 26 scenes, zero credentials |
