# Tempo — Master Plan

> **Tempo** — your working memory for Slack. Assistive technology for human attention and memory.
> One document: the vision, the hackathon-winning strategy, the full product, a professional modular-monolith architecture, the complete code structure, every Slack + MCP integration, and a multi-phase 3-year roadmap.
>
> This file is the source of truth for **what to build**. [`LEDGER.md`](LEDGER.md) tracks **what's already built** and **what's next**. The build loop is in **Part VI**.

**Contents:** [I. Vision & Hackathon Strategy](#part-i--vision--hackathon-strategy) · [II. Product](#part-ii--product) · [III. Architecture](#part-iii--architecture-professional-modular-monolith) · [IV. Code Structure](#part-iv--code-structure-the-monolith-tree) · [V. 3-Year Roadmap](#part-v--the-3-year-roadmap) · [VI. Build Loop](#part-vi--the-build-loop)

---

# Part I — Vision & Hackathon Strategy

## 1.1 Executive summary
Tempo is an **executive-function co-pilot for Slack** — assistive technology for the way humans actually work. It triages the firehose down to *what actually needs you*, remembers the promises you made and were made to you, decodes the implicit tone of messages, protects your focus, and gently catches you up after time away. It is grounded live in the Slack **Real-Time Search (RTS) API**, acts through **MCP**, and lives natively in Slack's **AI / Assistant** surfaces. It never stores what it reads and never acts without your tap.

**One-liner:** *Slack, but it remembers, triages, and protects your attention.*

**Who it's for:** the ~15–20% of knowledge workers who are neurodivergent (ADHD, autism, anxiety, dyslexia), non-native English speakers, and everyone drowning in unreads or at risk of burnout.

## 1.2 Problem statement
Slack is a **flat firehose**: every message looks equally urgent, commitments evaporate into threads, tone is invisible, and returning from time off is a panic. Slack has **no model of *your* obligations, *your* context, or *your* attention** — it treats the 412th unread like the 1st. For neurodivergent users and non-native speakers this isn't an annoyance; it's genuinely *disabling*. For everyone else it's a quiet, daily tax on focus and wellbeing.

## 1.3 Why now
The **RTS API went GA in February 2026.** For the first time an agent can model *a single person's entire footprint and obligations across a workspace* — permission-aware, semantic, and with **no data stored externally**. This is the unlock that makes a personal working-memory possible. Tempo is the product that unlock implies.

## 1.4 The moat (why it wins on *Quality of Idea* + *Impact*)
Almost every hackathon entry ships the obvious: HR/IT/Sales helpdesk bots, standup summarizers, knowledge Q&A. Tempo targets a domain **nobody is building for** — **Slack as a hostile interface for human attention and memory** — and reframes Slack agents as **assistive technology**. That framing is unique, has a TAM far beyond its target community, and tells an impact story judges remember.

## 1.5 Hackathon strategy
**Challenge:** Slack Agent Builder Challenge · ~$42k pool · deadline ~Jul 13, 2026 · must use ≥1 of {Slack AI, MCP server, RTS API}. Judges spend ~5–7 min/project and explicitly penalize "a generic chatbot wrapped in a Slack UI."

**Judging criteria → how Tempo scores:**
| Criterion | How Tempo wins |
|---|---|
| Technological Implementation | Uses **all three** required techs; RTS is *essential* (impossible without it); clean, tested, mock/live architecture |
| Design | Calm, accessible, Slack-native UX (Assistant pane, Block Kit, App Home, modals) — strong **Best UX** candidate |
| Potential Impact | Accessibility + mental health + global inclusion; huge TAM beyond the target community |
| Quality of the Idea | A genuinely novel category — assistive tech for attention/memory |

**Track:** **Slack Agent for Good** (accessibility + cognitive health). Fewer deep-technical competitors, impact weighted heavily, and a technically rich build is *simultaneously* eligible for the cross-cutting prizes — **Best Technological Implementation, Most Innovative, Best UX**. One build competes for up to four buckets. We deliberately avoid the **Organizations** track (Marketplace + 5 active production workspaces in <2 weeks = unwinnable distribution problem).

**Submission checklist:**
- [ ] Text description + **explicit impact statement**.
- [ ] ~3-minute demo video with **working-product footage** (beats in §1.6).
- [ ] **Architecture diagram** (from Part III).
- [ ] **Slack developer sandbox URL** with access granted to `slackhack@salesforce.com` **and** `testing@devpost.com`.
- [ ] Prominently call out using **all three** required technologies.

## 1.6 The 3-minute video beats
1. The pain — Monday, 412 unreads, visible overwhelm. *"For millions, Slack isn't a tool — it's an anxiety machine."*
2. **Triage** — "3 things actually need you today."
3. **Tone decode** — Marco's "no rush 🙂" → what it really means → a softened reply.
4. **Commitment Ledger** — the forgotten promise to Priya, drafted.
5. **Focus Guardian** — DND + status + a calendar block + a task, via MCP.
6. **Re-entry** — "what changed while you were out."
7. Close — the impact stat; *"Tempo turns Slack into assistive technology — built on RTS + MCP."*

---

# Part II — Product

## 2.1 Surfaces
Assistant pane (home base — suggested prompts, status, threaded replies) · App Home dashboard · `/tempo` slash command · scheduled "good morning" digest DM · Block Kit cards with inline approve/snooze/draft actions · (later) **Tempo Canvas** and **Workflow Builder steps**.

## 2.2 Feature catalog
**Shipped (v0.1) — the five core modules, all human-in-the-loop:**
| Module | What it does | Slack / MCP / AI |
|---|---|---|
| **Triage — "The Surface"** | Sorts everything since you were last active into **ACT / BLOCKER / FYI / NOISE**, incl. *implicit* blockers nobody @-mentioned you on; delivers a calm "3 things need you" card | RTS semantic search · AI classification + urgency |
| **Commitment Ledger — "The Memory"** | Finds promises you made & were made to you; parses due dates; flags **overdue / at-risk**; nudges before things slip | RTS · AI extraction · date parsing |
| **Tone Decoder — "The Translator"** | Explains a message's implied meaning, tone, real urgency; checks how *your* draft will land + offers a softer rewrite | RTS (relationship grounding) · AI |
| **Focus Guardian — "The Shield"** | Protects deep-work blocks; interrupt budget so only true blockers break through | MCP (calendar/task) · (v1) Slack DND/status/scheduled |
| **Re-entry — "The Bridge"** | Plain-language brief after time away: decisions, changes, who's waiting | RTS time-bounded · AI summarization |

**Future (see Part V):** onboarding, accessibility preferences & read-aloud, learned urgency / relationship intelligence, commitment-fulfillment detection, privacy-safe analytics, opt-in overload early-warning, team/manager mode, multilingual.

## 2.3 Accessibility design spine (what makes it "for Good")
Calm, low-stimulation Block Kit · ranked, **never more than N** items · plain language, one idea per line · honest **confidence + caveat** on tone reads · **read-aloud (TTS)** · adjustable **verbosity / reading level / max items** · dyslexia-friendly formatting · **i18n** · and a strict **"Tempo never acts without your tap"** rule. Accessibility is a first-class constraint on every surface, not a theme.

---

# Part III — Architecture (professional modular monolith)

## 3.1 Principles
- **Modular monolith** — one deployable, internally partitioned into bounded contexts. Simplicity of a monolith, discipline of modules.
- **Hexagonal (ports & adapters)** — the domain defines **ports** (interfaces); infrastructure provides **adapters**. The domain never imports Slack/AI/DB SDKs.
- **Dependency inversion** — dependencies point inward: `inbound → application → modules → ports`. `platform/*` implements ports.
- **Mock/live parity** — every external port (RTS, AI, MCP, persistence) has a `mock` and a `live` adapter. The whole app runs credential-free.
- **Never persist RTS content** — ground the model live, discard. Only tokens/prefs/approved metadata are stored.
- **Human-in-the-loop** — propose, never auto-act.
- **Accessibility-first** and **config-driven modes**.

## 3.2 Layered design
```
   Slack surfaces · HTTP API · Cron · MCP-in            (INBOUND ADAPTERS)
        │  parse/validate, no business logic
        ▼
   APPLICATION LAYER   orchestrator · intent router · use-cases · response assembly
        │  depends on domain + ports only
        ▼
   DOMAIN MODULES (bounded contexts)   pure-ish; depend only on ports
        │
        ▼
   OUTBOUND ADAPTERS / INFRASTRUCTURE
     Slack RTS · Slack Web API · AI (Claude) · MCP client/server · persistence · jobs
        ⇅
   CROSS-CUTTING   config · logging · errors (Result) · crypto · ratelimit · cache · i18n · feature-flags
```
The **application layer** translates a user intent into one or more **use-cases**, each calling **domain modules** through **ports**, then assembles a response (Block Kit + read-aloud script + fallback text). Domain modules contain the actual reasoning and never touch transport.

## 3.3 Bounded contexts (domain modules)
`triage` · `commitments` · `tone` · `focus` · `reentry` · `drafting` · `onboarding` · `preferences` (a11y/settings) · `intelligence` (urgency model + relationship graph) · `analytics` (privacy-safe). Each module owns its domain types, a service, and the ports it needs; modules don't import each other's internals — they compose in the application layer.

## 3.4 Integration architecture — *everything Slack + MCP*
**Slack RTS (grounding engine).** `assistant.search.context` via a **user token** (needs **no `action_token`** — only bot tokens do), permission-scoped, results **never stored**. Port: `RtsClient` (`search(params) → RtsSearchResult`) with `live` + `mock` adapters; `assistant.search.info` for capabilities.

**Slack Web API (action surface).**
| Method | Purpose | Scope |
|---|---|---|
| `chat.postMessage` / `postEphemeral` | drafts, digests, confirmations | `chat:write` |
| `chat.scheduleMessage` | batched non-disruptive digests | `chat:write` |
| `dnd.setSnooze` | protect focus blocks | `dnd:write` |
| `users.profile.set` | focus status ("🎯 Focusing — back at 3:30") | `users.profile:write` |
| `views.publish` / `views.open` | App Home + settings modal | — |
| `conversations.open` | DM the morning digest | `im:write` |
| `canvases.create` / `canvases.edit` / `conversations.canvases.create` | Tempo Canvas command center | `canvases:write` |
| **Slack Lists** | native commitment tracking | (per Lists API) |
| `assistant.threads.*` | pane status/title/prompts | `assistant:write` |

**Slack inbound.** Events, actions, slash command, Assistant pane, App Home, **Workflow Builder custom steps** (`functions` in the manifest + `function_executed` listeners), OAuth (user + bot scopes). *Note: custom steps require a paid plan + org-level install to appear in Workflow Builder.*

**AI.** Port `LlmPort` → Claude via the Vercel AI SDK; `structured()` (schema-validated) and `text()`, each with a deterministic `mock()` that doubles as the test oracle; versioned prompt templates.

**MCP — outbound (Tempo acts in the world).** `CalendarClient` / `TaskClient` ports implemented over real MCP servers (Google Calendar, Notion, Linear, GitHub) via `@modelcontextprotocol/sdk`; mock by default.

**MCP — inbound (Tempo as infrastructure, v3).** Expose `tempo.triage`, `tempo.commitments`, `tempo.decode`, `tempo.focus` **as an MCP server** so Agentforce / Claude / Cursor / ChatGPT can call Tempo — honoring the same trust model (acts as the initiating user; stores nothing from RTS).

**Persistence.** Repository ports (`tokens`, `prefs`, `commitments`, `snoozes`, `analytics`, `urgency`) over a DB adapter (file-backed now → **Neon Postgres**). **RTS content is never persisted.**

**Jobs.** Scheduler + cron (morning digest, nudges) — proving the user-token/no-`action_token` proactive path.

## 3.5 Data model (stored vs never-stored)
| Stored (encrypted where sensitive) | Never stored |
|---|---|
| OAuth user/bot tokens | Any message/file/channel content from RTS |
| Prefs (verbosity, reading level, max items, read-aloud, locale) | Conversation transcripts |
| Snoozes, user-approved pinned commitments (permalink + user's note) | Anything not explicitly approved by the user |
| Privacy-safe metrics (counts only); learned per-user urgency weights | PII-bearing RTS payloads |

## 3.6 Cross-cutting concerns
`config` (env + modes + feature flags) · structured `logging` + privacy-safe `observability` · `errors` via a `Result<Ok,Err>` type · `crypto` (AES-256-GCM) · `ratelimit` + `cache` (RTS backoff/pagination, per-session caching) · `i18n` · `feature-flags`.

## 3.7 Mock/live two-mode design
`TEMPO_RTS=mock|live` (RTS adapter) · `TEMPO_AI=mock|live` (Claude vs deterministic reasoning) · `TEMPO_RECEIVER=socket|http` (Bolt receiver). This is why `npm run demo` and the test suite run with **zero credentials**, and why flipping env serves a real workspace with the same code. **Never break the mock path** — it's how judges and contributors verify instantly.

## 3.8 Security, privacy & compliance
Encryption at rest; **minimum** scopes (RTS uses specific `search:read.*`, distinct from the discouraged legacy umbrella `search:read`); data **export/delete** endpoints + privacy dashboard; TLS 1.2+; truthful security claims. Aligns with Slack Marketplace requirements (granular scopes, deletion mechanisms, 10+ active workspaces, up-to-7-week functional review) for the v2.9 listing.

## 3.9 Testing strategy
Unit (domain modules against the `mock()` oracle) · contract (mocked `WebClient` — assert correct method + args for RTS, DND, status, scheduled) · e2e (the `demo` narrative) · accessibility (read-aloud strips markdown, verbosity condenses, every response carries a speech script). The zero-credential demo + suite must stay green at every commit.

## 3.10 Deployment & runtime
Local: Socket Mode (`npm run dev`). Prod: Vercel — Express receiver at `/api/slack/events`, OAuth callbacks, **cron** morning digest, Fluid Compute. Env-driven; CI runs test + typecheck + build on every change.

---

# Part IV — Code Structure (the monolith tree)

Target professional layout. **Dependency rule:** `inbound → application → modules → ports`; `platform/*` implements ports; **modules never import `platform/`**; `shared/*` importable everywhere.

```
src/
  main/         bootstrap.ts · socket.ts · http.ts · container.ts      # composition root / DI wiring
  config/       index.ts · env.ts · modes.ts · feature-flags.ts
  shared/       result.ts · errors.ts · logger.ts · clock.ts · ids.ts · crypto.ts · ratelimit.ts · cache.ts · types.ts
  application/  orchestrator.ts · router.ts · response.ts
                use-cases/{triage,commitments,decode,focus,reentry,catchup,draft,onboard}.ts
  modules/      triage/ commitments/ tone/ focus/ reentry/ drafting/
                onboarding/ preferences/ intelligence/ analytics/
                  └─ each: domain.ts · service.ts · ports.ts · index.ts · *.test.ts
  platform/
    slack/
      rts/      port.ts · live.ts · mock.ts · fixtures.ts · index.ts
      webapi/   chat.ts · dnd.ts · status.ts · scheduled.ts · views.ts · canvas.ts · lists.ts · conversations.ts · client.ts
      blockkit/ triage.ts · commitments.ts · tone.ts · focus.ts · reentry.ts · home.ts · settings-modal.ts · primitives.ts
      inbound/  events.ts · actions.ts · commands.ts · assistant.ts · home.ts · workflow-steps.ts
      oauth/    install.ts · callback.ts · scopes.ts
    ai/         port.ts · claude.ts · mock.ts · structured.ts · prompts/
    mcp/        client/{calendar,notion,linear,github,port,index}.ts · server/{tools,server}.ts
    persistence/ db/{client,migrations}.ts · repositories/{tokens,prefs,commitments,snoozes,analytics,urgency,ports}.ts
    jobs/       scheduler.ts · morning-digest.ts · nudges.ts
  accessibility/ verbosity.ts · speech.ts · tts.ts · i18n/
api/    slack/events.ts · oauth/{start,callback}.ts · cron/morning-digest.ts · mcp/server.ts (v3) · data/{export,delete}.ts (v2)
web/    (v2) Next.js companion: settings · privacy dashboard · OAuth
scripts/ demo.ts · seed-workspace.ts · verify-live-rts.ts
test/   integration/ · e2e/
MASTER_PLAN.md · LEDGER.md · README.md · package.json · tsconfig.json · vercel.json · manifest.json · .env.example
```

**Module anatomy** (every domain module follows this):
- `domain.ts` — types + pure logic. `ports.ts` — interfaces the module needs (e.g., `RtsClient`, `LlmPort`). `service.ts` — orchestrates domain + ports. `index.ts` — public surface. `*.test.ts` — unit tests against the `mock()` oracle.

**Adding a capability:** define result types + a `zod` schema → gather context via `RtsClient` → reason via `structured()/text()` with a deterministic `mock()` → return typed data (no Slack types) → add a Block Kit builder + a route + a demo scene + tests.

**Current → target mapping (refactor in Phase 3 / v1.8):** today's `src/{modules,rts,agent,blocks,mcp,db,a11y}` + `src/app.ts` collapse into this layout — `agent/orchestrator` → `application/`, `rts` → `platform/slack/rts`, `blocks` → `platform/slack/blockkit`, `db` → `platform/persistence`, `a11y` → `accessibility/`, `app.ts` → `main/` + `platform/slack/inbound`. Behavior-preserving; tests stay green throughout.

---

# Part V — The 3-Year Roadmap

> Versions are **capability gates**, not calendar dates ("with Claude Code, years in days"). Each phase is a coherent, shippable increment with many features. Current state + immediate next step always live in [`LEDGER.md`](LEDGER.md).

| Year | Phase | Version | Theme |
|---|---|---|---|
| 1 | 0 | v0.1 | Foundation ✅ |
| 1 | 1 | v1.0 | Hackathon Winner 🎯 |
| 1 | 2 | v1.5 | Hardening |
| 1 | 3 | v1.8 | Monolith refactor |
| 2 | 4 | v2.0 | Native Surfaces |
| 2 | 5 | v2.2 | Real MCP outbound |
| 2 | 6 | v2.4 | Persistence & scale |
| 2 | 7 | v2.6 | Web companion |
| 2 | 8 | v2.8 | Intelligence |
| 2 | 9 | v2.9 | Marketplace |
| 3 | 10 | v3.0 | Tempo as an MCP server |
| 3 | 11 | v3.2 | Agentforce integration |
| 3 | 12 | v3.4 | Proactive intelligence |
| 3 | 13 | v3.6 | Team & manager mode |
| 3 | 14 | v3.8 | Enterprise & Global |
| 3 | 15 | v4.0 | Attention OS + ecosystem |

## Year 1 — Idea → category-defining product

### Phase 0 · v0.1 — Foundation ✅ (shipped)
5 modules on mock RTS + mock AI; Bolt Assistant pane / `/tempo` / App Home / actions; OAuth user-token flow; encrypted token store; Vercel cron morning digest; seed script; 16 tests; zero-credential demo.

### Phase 1 · v1.0 — Hackathon Winner 🎯
**Make everything real inside Slack and ship the submission.**
- **Live RTS verified** (`scripts/verify-live-rts.ts`; fix `live` field mapping) + **live Claude**; mock fallback retained.
- **Slack-native Focus Guardian:** `dnd.setSnooze` + `users.profile.set` status + `chat.scheduleMessage` digests (alongside MCP calendar/task).
- **Real interactivity:** post AI drafts in-thread · persistent snooze · "show the rest" · mark-done · renegotiate (deadline-push draft).
- **App Home dashboard** (live triage + commitments + focus schedule) + **a11y settings modal** (`views.open`).
- **Fill stores:** `prefs`, `commitments`, `snoozes` repositories; **multi-user cron**; add `@slack/web-api` as an explicit dependency.
- **Read-aloud** audio (TTS) or speech-script delivery; **onboarding** first-run.
- **Tests:** Block Kit render tests + live-mode contract tests (mocked WebClient).
- **Submission:** deploy to sandbox · seed · grant judging access · 3-min video · architecture diagram · Devpost write-up + impact statement.
- *KPIs:* messages triaged, obligations surfaced, focus-minutes protected, "missed items recovered."

### Phase 2 · v1.5 — Hardening
Rate-limit backoff · RTS pagination + per-session caching · error/empty states · privacy-safe metrics · accessibility audit (Block Kit semantics, screen-reader) · secrets hardening (remove dev default key in prod) · CI.

### Phase 3 · v1.8 — Monolith refactor
Restructure to the Part-IV architecture (ports/adapters, DI container, layered) with **no behavior change** and full test parity. Establishes the professional foundation everything else builds on.

## Year 2 — Native surfaces, platform & distribution

### Phase 4 · v2.0 — Native Surfaces
**Tempo Canvas** (living personal command center, auto-updated with today's triage/commitments/focus via `canvases.create`/`edit`) · **Workflow Builder custom steps** (*Summarize what I missed*, *Draft a reply*, *Block focus time*, *Add a commitment*) · **Slack Lists** sync of the Commitment Ledger · bookmarks/reminders · richer Block Kit.

### Phase 5 · v2.2 — Real MCP outbound
Calendar/Notion/Linear/GitHub clients via `@modelcontextprotocol/sdk`; `getMcpClients()` branches on env; mock remains default.

### Phase 6 · v2.4 — Persistence & scale
Neon Postgres · repositories · migrations · analytics store · swap the file token store. Assert (in test) that no RTS content is ever persisted.

### Phase 7 · v2.6 — Web companion
Next.js on Vercel: settings · privacy dashboard · **data export/delete** · OAuth onboarding.

### Phase 8 · v2.8 — Intelligence
Learned per-user/per-sender **urgency model** · **relationship graph** · **commitment-fulfillment detection** (auto-close kept promises) · **dropped-ball prevention**. Learns from snooze/done/draft signals only — never from stored RTS content.

### Phase 9 · v2.9 — Marketplace
Granular-scopes audit · data deletion/access/export · privacy policy · security review · 10+ active workspaces · listing assets · submit.

## Year 3 — Agentic infrastructure & the Attention OS

### Phase 10 · v3.0 — Tempo as an MCP server
Expose `tempo.triage/commitments/decode/focus` as MCP tools so Agentforce/Claude/Cursor/ChatGPT can call Tempo. Tempo becomes infrastructure, not just an app.

### Phase 11 · v3.2 — Agentforce integration
@mention handoffs; Tempo as an Agentforce Employee Agent honoring the trust layer; route work between Tempo and other agents in-conversation.

### Phase 12 · v3.4 — Proactive intelligence
Opt-in, private **overload / burnout early-warning** · meeting-load balancing · smart batching of non-urgent noise into fewer, calmer touchpoints.

### Phase 13 · v3.6 — Team & manager mode
Opt-in, **aggregated, anonymized**: team load, response fairness, knowledge bus-factor. Never exposes individual message content; default posture stays a personal agent on personal data.

### Phase 14 · v3.8 — Enterprise & Global
Enterprise Grid org-wide install · admin console · audit logs · SCIM · data residency · DLP · **true multilingual** across all surfaces + cross-language RTS (the non-native-speaker promise at scale) · accessibility certification.

### Phase 15 · v4.0 — Attention OS + ecosystem
Tempo becomes the **permission-aware working-memory layer across all work tools** — Slack + email + calendar + docs + tickets, unified via MCP. Plus an **open accessibility SDK** so others build calm, neurodivergent-friendly agent UIs, and published workplace cognitive-accessibility impact studies.

---

# Part VI — The Build Loop

Tempo is built as a **continuously buildable** product. There is no separate prompts folder — this section *is* the build prompt. Any Claude Code session does exactly this:

### The standing prompt
1. **Read [`LEDGER.md`](LEDGER.md)** → note `Current version` and the `Next up` checklist.
2. **Open this file → Part V**, find the current phase, and take the next unchecked items as scope.
3. **Establish a green baseline:** `npm test`, `npm run typecheck`, `npm run demo`.
4. **Build** those items following Part III (architecture) and Part IV (code structure), honoring the invariants below.
5. **Keep the zero-credential demo + tests green** at every step; extend `scripts/demo.ts` for any new user-visible capability.
6. **Record:** append a `History` entry to `LEDGER.md`, bump `package.json` `version`, and rewrite `Next up` to the following phase.
7. **Commit and push automatically** once the phase builds successfully (green baseline from step 5 holds): commit with a short, plain commit message — title only, no body/description, no AI co-author/attribution trailer of any kind — then push to the tracked remote branch. Do this without asking; it's pre-authorized for every successfully built phase.

### Invariants (never violate)
1. **Never persist RTS content** — ground live, discard.
2. **Never act without a tap** — propose; the user approves.
3. **Never break the zero-credential demo** — no required cred to run `npm run demo` / `npm test`.
4. **Accessibility-first** on every surface.
5. **User-token RTS** — no `action_token`; permission-scoped.
6. **Match existing patterns / extend ports** — don't invent parallel ones.
7. **Commit messages never name an AI/model as author or co-author** — short title only, no description, no `Co-Authored-By` trailer.

### Versioning
Semver tied to phases. `package.json` `version` is canonical; `LEDGER.md` is the human history.

---

## Sources (platform grounding)
RTS: docs.slack.dev/apis/web-api/real-time-search-api · MCP: docs.slack.dev/ai/slack-mcp-server · Agents: docs.slack.dev/ai/agents · Canvas: docs.slack.dev/surfaces/canvases · Workflow custom steps: api.slack.com/automation/functions/custom-bolt · DND/status/scheduled: `dnd.setSnooze` (`dnd:write`), `users.profile.set`, `chat.scheduleMessage` · Marketplace: docs.slack.dev/slack-marketplace · Agentforce-in-Slack + custom MCP servers: Salesforce Developers blog (2026).
