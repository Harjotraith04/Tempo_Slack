# Devpost submission draft — Tempo (Slack Agent for Good)

> Paste-ready copy for the Devpost form. Placeholders to fill during W2/W3 are marked `⟨…⟩`.
> Deadline: **Mon Jul 13, 2026, 5:00 PM PDT** — submit by Jul 12.

---

## Inspiration

For millions of people, Slack isn't a tool — it's an anxiety machine. Every message looks equally urgent, promises evaporate into threads, tone is invisible, and returning from a week away means 412 unreads and a knot in your stomach. For the ~15–20% of knowledge workers who are neurodivergent (ADHD, autism, anxiety, dyslexia) and for non-native speakers, this isn't an annoyance — it's genuinely disabling. Slack has no model of *your* obligations, *your* context, or *your* attention.

Tempo reframes the Slack agent as **assistive technology**: an executive-function co-pilot that does for attention and working memory what a screen reader does for sight.

## What it does

Five modules, all grounded live in the user's own permissioned data, all human-in-the-loop:

- **Triage — "The Surface."** Sorts everything since you were last active into ACT / BLOCKER / FYI / NOISE — including *implicit* blockers nobody @-mentioned you on — and delivers a calm "3 things actually need you" card. Never more than your chosen max; the rest waits behind a button.
- **Commitment Ledger — "The Memory."** Finds the promises you made and were made to you, parses due dates, flags overdue and at-risk, and drafts the nudge or the deadline-renegotiation — you review and send.
- **Tone Decoder — "The Translator."** Explains what "no rush 🙂" actually means — implied urgency, subtext, and how your own draft will land, with a softer rewrite and an honest confidence caveat.
- **Focus Guardian — "The Shield."** One tap protects a deep-work block: **real Slack Do-Not-Disturb + status** (your own token, genuinely flipped — verified on a live account), plus a calendar hold and task via outbound **MCP** *(mock-backed in this submission — see below)*. Only true blockers break through.
- **Re-entry — "The Bridge."** A plain-language brief after time away: what was decided, what changed, who's waiting on you — so day one back isn't spent excavating.
- **Conversation — "The Door."** Everything else. Tempo answers in its own voice and always offers the one thing it can genuinely do next, so chat is a doorway into the product rather than a dead end.

### The one place we take the LLM *out* of the loop

Tempo is built for people under cognitive strain — neurodivergent workers, people burning out, people drowning in a firehose. Given that audience, **someone will eventually type something that isn't about Slack at all.** An agent for that audience has to have an answer for that moment, and "let the model improvise" is not one.

So the crisis check runs **before any model call**, and on a match returns **fixed words written by a human**. No generation, no temperature, no surprises. Our test spies on the LLM port and **fails if it is touched at all** — not "prompted carefully": *never reached*. Those words are warm, brief, and honest that Tempo is a work tool and not a counsellor; they point to **findahelpline.com** (international — a US-only number is useless to most of the world) and to a trusted human. They don't diagnose, don't promise it'll be fine, don't interrogate. The card shows **no product buttons** — nudging someone toward "want me to triage your inbox?" in that moment would be grotesque.

The **false-positive** direction is tested just as hard, because it is also real harm: *"this deadline is killing me"* must **not** trip it. Answering ordinary workplace hyperbole with a hotline card is patronising, and it teaches people not to talk to Tempo honestly. Genuine-but-non-crisis distress goes to a supportive path where the empathy is **backed by an action** — cut the firehose to the two or three things that matter, or protect the time. Reducing cognitive load *is* the product.

### Consent: you choose where Tempo may look

Tempo already reads only what *you* can see (RTS runs on your own token). Consent scoping narrows it further, from the Slack settings modal: **"only watch these channels"** and **"never track these people."** It's one `RtsClient` decorator wired in once, so every module inherits it — **and it holds on every surface**: the Slack app, the scheduled morning digest, and the inbound MCP server all resolve it through the same chokepoint, so an external agent calling Tempo over MCP cannot read around your settings. *"Reads only what you can see"* becomes *"and only where you allow."*

The accessibility spine runs through every surface: adjustable verbosity, reading level (plain-language mode), max items, **read-aloud audio (TTS)**, dyslexia-friendly formatting, English/Spanish speech, and a machine-checked accessibility audit that fails the build if any response regresses. A morning digest DM (Vercel cron) proves the proactive path; a privacy dashboard on the same domain gives full export/delete.

**Privacy is architectural, not a promise:** Tempo grounds every answer live via RTS and discards it. What it reads is **never persisted** — enforced at the schema level and by tests. It acts only with each user's own token, on their own permissioned data, and never without a tap.

## How we built it — all three required technologies

1. **Real-Time Search API** (the foundation — Tempo is impossible without it): `assistant.search.context` with a **user token**, which needs no `action_token` — the key that legally unlocks *proactive* grounding (the morning cron) and the privacy story (permission-scoped, nothing stored).
2. **MCP, both directions — and the inbound one is live.** Tempo *is* an **MCP server** at `/api/mcp/server` — `tempo_triage`, `tempo_commitments`, `tempo_decode`, `tempo_focus` — callable right now by Agentforce/Claude/Cursor behind default-deny, signed per-user tokens (**try it yourself with the curl below**). Tempo is infrastructure, not just an app. Outbound MCP clients (Google Calendar / Notion / Linear / GitHub via `@modelcontextprotocol/sdk` over Streamable HTTP) are built and behind the same port, but **ship against a mock in this submission** — we chose not to stand up third-party OAuth we couldn't test end-to-end, and the Focus Guardian is explicitly hardened so an unreachable calendar server degrades to "couldn't reach your calendar" while the real DND still lands.
3. **Slack AI / agent surfaces:** the 2026 Agent experience (`agent_view`, suggested prompts, status), App Home dashboard, Block Kit actions, Workflow Builder custom steps, Canvas, and Lists.

Engineering: a hexagonal TypeScript modular monolith (Bolt) — domain modules depend only on ports; every external system (RTS, OpenAI, Slack Web API, MCP, Postgres, TTS) has mock + live adapters, so **the entire product runs credential-free**: `npm run demo` plays the whole story in 26 deterministic scenes, and 411 tests + typecheck + build + demo run on every commit. Deployed on Vercel Fluid Compute via `@vercel/slack-bolt` (sub-3-second acks, background processing), Neon Postgres (AES-256-GCM token encryption), least-privilege scopes enforced by a drift test.

## Challenges we ran into

- **Grounding on an API whose payload we couldn't see yet.** RTS (`assistant.search.context`) returns a *flat* result — `content`, `message_ts`, `author_user_id`, `channel_id` — with no per-message channel-type flag, quite different from the nested shape you'd guess. We mapped strictly to the published reference, inferred DM-vs-channel from the Slack channel-ID prefix, and built a `verify:rts` field-coverage probe so the very first live call tells us exactly which field to reconcile — instead of debugging blind in the demo.
- **The 3-second ack vs. real model work.** Slack retries anything slower than 3 seconds, but triage does live RTS + LLM reasoning. We moved to `@vercel/slack-bolt` on Fluid Compute — ack immediately, finish the work in the background via `waitUntil` — so the agent stays responsive without dropping requests.
- **A platform that moved under us.** The Assistant experience we first built on was deprecated for new apps mid-project; we migrated to the 2026 **Agent experience** (`agent_view`, `app_home_opened` + `message.im`) while keeping both message paths working with no double-replies.
- **"Never store what it reads" as an engineering constraint, not a slogan.** It forced derived-facts-only everywhere — e.g. the Commitment Ledger's Slack List rows carry the parsed obligation, never the source message — and we proved it at the schema level and in tests rather than promising it in the privacy page.
- **One codebase that runs with and without credentials.** Every external system (RTS, OpenAI, Slack Web API, MCP, Postgres, TTS) has a mock and a live adapter behind a port, so `npm run demo` and 411 tests stay green with zero secrets across all 15 build phases — which is also what let us harden the live seams against the docs before a single key existed.

## Accomplishments we're proud of

- A genuinely new category — nobody ships assistive tech for attention/memory on Slack.
- The never-persist-RTS-content invariant proven by schema + tests, not promised in prose.
- 411 tests and a full product demo that run with zero credentials.
- Accessibility as a machine-checked build gate, in English and Spanish.

## Impact statement (Agent for Good)

Tempo targets the people Slack quietly disables: **neurodivergent workers** (~15–20% of the workforce), **non-native speakers** navigating implicit tone in a second language, and **everyone sliding toward burnout** in the firehose. It reduces cognitive load (triage + max-items caps), externalizes working memory (the Ledger), translates social subtext (the Decoder), defends recovery time (Focus + Re-entry), and speaks its answers aloud for those who process audio better. The same design serves the whole community beyond the target group — calm, ranked, plain-language communication is universal design, like curb cuts. And because Tempo's calm-UX primitives ship as an open accessibility SDK, other builders can make *their* agents cognitively accessible too.

## What's next

Marketplace listing (the scopes audit, privacy policy, and data-governance work are already done), more locales, connecting the outbound MCP clients to real calendar/task servers, and the Attention OS: the same permission-aware working memory across email and calendar via MCP source adapters. **Those sources are mock-only today, behind a flag that is off — we build the seam, we do not call it an integration.**

---

## Form fields

- **Track:** Slack Agent for Good
- **Video:** ⟨FILL: public YouTube URL — under 3 min, live sandbox footage⟩
- **Architecture diagram:** upload `docs/architecture.png` (source: `docs/architecture.mmd`)
- **Sandbox URL:** https://e0bhn1bngfj-52jkceoz.slack.com/
  <br><sub>workspace `devpostslack` · judges must be **Member**, not Guest</sub>
- **Repo:** https://github.com/Harjotraith04/Tempo_Slack
- **Live app:** https://tempo-slack.vercel.app
- **Privacy dashboard / settings / export / delete:** https://tempo-slack.vercel.app/privacy
- **Tech tags:** Slack RTS API · MCP · Slack AI/Agents · TypeScript · Bolt · Vercel · Neon Postgres · OpenAI

### Call Tempo's MCP server yourself (judges)

Tempo isn't just an MCP *client* — it **is** an MCP server. Point MCP Inspector at it, or:

```bash
curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
  -H "Authorization: Bearer ⟨FILL: TEMPO_MCP_SERVER_TOKEN⟩" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Returns `tempo_triage`, `tempo_commitments`, `tempo_decode`, `tempo_focus`. Callers are default-deny: no
token, or an unrecognised one, gets a 401 — there is no ambient authority.

## `#start-here` channel note (pin in the sandbox for judges)

> **Try Tempo in 2 minutes** 👋
> 1. Open **Tempo** from the Agents section (or click the workspace's Tempo icon) → tap a suggested prompt: *"What needs me today?"*
> 2. `/tempo commitments` — the promises Sam made & is owed, with nudge/renegotiate drafts.
> 3. Ask *"how does this sound: fine, we can discuss it later"* — the Tone Decoder.
> 4. *"Block 2 hours for deep work"* — watch your **real** DND + status flip. (The calendar line on that card is a *mock* MCP server — the inbound MCP server below is the live one.)
> 5. Open **App Home** for the live dashboard + ⚙️ accessibility settings (try read-aloud!).
> Tempo never stores what it reads and never acts without your tap. Full story: `npm run demo` in the repo.
