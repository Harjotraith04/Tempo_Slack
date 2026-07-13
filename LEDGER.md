# Tempo — Build Ledger

**Current version:** v4.2.0 &nbsp;·&nbsp; **Updated:** 2026-07-13 &nbsp;·&nbsp; **Deployed:** https://tempo-slack.vercel.app

**Production modes:** RTS=**live**, AI=**live** (OpenAI), STORE=**postgres** (Neon), SLACK_ACTIONS=live*, MCP_SERVER=on*, MCP(outbound)=mock, TTS=live, PROACTIVE=off, TEAM=off, ATTENTION_OS=off, LOCALE=en
<br><sub>*set during the final bring-up — see [`SUBMIT.md`](SUBMIT.md) P1.</sub>

> ⚠️ **Submission day.** [`SUBMIT.md`](SUBMIT.md) is the only current tracker. This file, `docs/STATUS.md`, and
> `GO_LIVE.md` describe a pre-deployment world and are kept for history only.

**How to use:** read this, then open [`MASTER_PLAN.md`](MASTER_PLAN.md) → Part V, find this version's phase, and build the next unchecked items (honoring the invariants in Part VI). Keep `npm run demo` + `npm test` green. Then append a `History` entry below, bump `version` in `package.json`, and **commit + push automatically** — short title-only commit message, no description, no AI co-author/attribution trailer.

---

## Status
- **Phase 0 / v0.1.0 — Foundation:** DONE.
- **Phase 1a / v0.2.0 — Foundational slice (stores + Slack-native focus + real interactivity):** DONE.
- **Phase 1b / v0.3.0 — Live App Home dashboard + a11y settings modal + "show the rest":** DONE.
- **Phase 1c / v0.4.0 — Read-aloud audio (TTS) + first-run onboarding:** DONE.
- **Phase 1 / v1.0.0 — Hackathon Winner:** *code* DONE (all five modules real inside Slack); submission logistics deferred to the owner (see below).
- **Phase 2 / v1.5.0 — Hardening:** DONE.
- **Phase 3 / v1.8.0 — Monolith refactor:** DONE (layered Part-IV tree · ports/adapters · dependency rule).
- **Phase 4 / v2.0.0 — Native Surfaces:** DONE (Tempo Canvas · Workflow Builder custom steps · Slack Lists sync · reminders/bookmarks · finished the hexagonal inversion).
- **Phase 5 / v2.2.0 — Real MCP outbound:** DONE (Calendar/Notion/Linear/GitHub via `@modelcontextprotocol/sdk`, Streamable HTTP, mock default, per-client double-gate).
- **Phase 6 / v2.4.0 — Persistence & scale:** DONE (Neon Postgres adapter behind one `Store` port · async repos threaded via the DI container · file default · schema-level + guard proof no RTS content is persisted).
- **Phase 7 / v2.6.0 — Web companion:** DONE (Next.js app under `web/` · privacy dashboard · data export/delete · web settings editor · signed-cookie session · all logic shared from `src/` so the root zero-cred gates stay green).
- **Phase 8 / v2.8.0 — Intelligence:** DONE (learned per-sender urgency store keyed by authorId, blended into triage ranking + tone-decoder confidence · fed by snooze/done/draft taps · dropped-ball digest nudges · keyword commitment-fulfillment auto-close · counts-only, in the export + erasable).
- **Phase 9 / v2.9.0 — Marketplace-readiness:** DONE *code/docs* (least-privilege scopes as a single source of truth + drift test · data-governance completeness guard · `PRIVACY.md`/`SECURITY.md` · web `/privacy-policy` page · listing package); submission logistics deferred to the owner (below).
- **Phase 10 / v3.0.0 — Tempo as an MCP server:** DONE (`tempo_triage`/`tempo_commitments`/`tempo_decode`/`tempo_focus` exposed at `/api/mcp/server` over Streamable HTTP · SDK-isolated · derived-facts-only · acts as the initiating user · shared read-models extracted).
- **Phase 11 / v3.2.0 — Agentforce integration:** DONE (default-deny per-caller identity via signed per-user agent tokens · Agentforce Employee Agent descriptor packaging the tools+persona+trust · graceful @mention handoff routing; also fixed the v3.0 MCP-server fail-open/ambient-authority security findings).
- **Phase 12 / v3.4.0 — Proactive intelligence:** DONE (opt-in overload/burnout early-warning `analyzeLoad` from counts only · smart batching of non-urgent FYIs · folded into the one calm morning-digest touchpoint behind `TEMPO_PROACTIVE` · notifies only, never acts, never stores content).
- **Phase 13 / v3.6.0 — Team & manager mode:** DONE (opt-in, aggregated + anonymized `aggregateTeamLoad` over the counts-only stores · k-anonymity redaction below 3 members · `/tempo team` surface gated by `TEMPO_TEAM` · never any individual content or per-person number; personal-agent posture stays the default).
- **Phase 14 / v3.8.0 — Enterprise & Global:** DONE (true multilingual `i18n` catalog + `t()` + `locale` pref, localized read-aloud in en/es · automated accessibility certification `auditResponse` over every response type · `ENTERPRISE.md` for Grid/residency/audit; SCIM/DLP left as owner-only integrations).
- **Phase 15 / v4.0.0 — Attention OS + ecosystem:** DONE (`MultiSourceRtsClient` grounds triage/ledger/re-entry across Slack + mock email/calendar as one working memory behind the same `RtsClient` port · open accessibility SDK doc · capstone demo). **The 3-year roadmap is complete.**

## Owner-only submission logistics (need a real workspace + a human; can't be built)
These are the remaining v1.0 "Hackathon Winner" items that require *your* Slack sandbox, tokens, and a recording — not code:
- [ ] Deploy to a Slack sandbox
- [ ] Seed the sandbox (`npm run seed -- --execute`) so live RTS has data
- [ ] Grant judging access (`slackhack@salesforce.com` + `testing@devpost.com`)
- [ ] Record the ~3-min demo video (beats in `MASTER_PLAN.md` §1.6)
- [ ] Architecture diagram
- [ ] Devpost write-up + explicit impact statement

**Owner-only Marketplace logistics (v2.9, can't be built):** deploy the web companion + set its real OAuth
redirect URL in `manifest.json`; publish the `/privacy-policy` URL; **10+ active workspaces** (Slack
Marketplace requirement); pass Slack's own security + functional review; capture real screenshots; replace the
`privacy@`/`security@` contact placeholders; submit. Full package: `docs/marketplace-listing.md`.

## Next up → **run [`GO_LIVE.md`](GO_LIVE.md)** — the credential-only final mile
Everything completable without keys is now done (see the v4.1.1 History entry): the guessed live seams are
hardened against the published Slack API references (RTS payload mapping corrected to the flat
`content`/`message_ts`/`author_user_id`/`channel_id` shape + channel-type inference; Slack Lists rewritten to the
real `slackLists.create` schema + `column_id` contract), a one-command `npm run manifest:urls` fills the four
deployment placeholders, `npm run preflight` proves credential-free readiness, `web/vercel.json` + Devpost draft
are in place. **`GO_LIVE.md` is the single ordered checklist** for the only work left — all owner actions
(accounts, keys, a recording). It distills `MASTER_PLAN.md` Part VII W2/W3 below into copy-paste steps.

The 3-year feature roadmap (v0.1 → v4.0) is complete and green, but a 2026-07-02 full audit found **nothing is
live**: no deployment, placeholder manifest URLs, every seam mocked, no video/diagram/sandbox/judge access —
and the real Devpost deadline is **Mon Jul 13, 5 PM PDT** (submit Jul 12). Part VII is the single execution
plan; work it top-to-bottom:
- [x] **W1 · P0 code fixes** — DONE in v4.1.0 (see History): Agent-experience migration, `@vercel/slack-bolt`
  receiver, all fail-open gates closed, manifest fixed, cron test moved, TTS/versions/seed-scopes cleaned.
- [ ] **W2 · Live bring-up (owner + Claude):** Developer Program + sandbox + **day-1 partnerships request for
  the semantic-RTS sandbox** → Vercel deploy (+ Neon, real key, `TEMPO_STORE=postgres`) → app from fixed
  manifest → OAuth → seed → **`verify:rts` and fix the guessed field mapping** → live Slack actions →
  `verify:mcp`/`verify:mcp-server`/`verify:postgres` → web companion deploy → full live E2E by Jul 8.
- [ ] **W3 · Submission assets:** architecture diagram (Mermaid→SVG in `docs/`) · ~3-min live-footage video on
  the §1.6 beats · Devpost write-up + explicit impact statement · judge invites (`slackhack@salesforce.com`,
  `testing@devpost.com`) + `#start-here` channel · screenshots · **submit Jul 12**.
Cut lines + risk register + day-by-day calendar: `MASTER_PLAN.md` §7.3–7.5.

---

## History

### v4.1.1 — 2026-07-06 — Credential-free readiness: live seams hardened against the docs + one-command deploy prep + GO_LIVE runbook
**Built:** everything that could be completed *without* keys, so the only work left is the owner's credential-only
push (accounts → deploy → video → submit, now the single checklist in [`GO_LIVE.md`](GO_LIVE.md)).
- **Live RTS field mapping corrected to the published shape** (`src/platform/slack/rts/live.ts`): the real
  `assistant.search.context` result is *flat* — `content`, `message_ts`, `author_user_id`, `author_name`,
  `channel_id`, `channel_name` (users: `user_id`/`full_name`/`title`/`email`/`timezone`), not the nested
  `channel`/`author` objects previously guessed. There's no per-message channel-type flag, so channel type is now
  inferred from the Slack channel-id prefix (D=im, G=mpim). Request params `content_types`/`channel_types` sent as
  arrays per the reference; request `limit` capped at the documented max 20. Old fields kept as fallbacks; two new
  tests lock the documented shape. `verify:rts` now also reports `channelType` coverage.
- **Slack Lists rewritten to the real contract** (`src/platform/slack/webapi/live.ts`): `slackLists.create` takes
  `name` (not `title`) + a column `schema`, returns `list_metadata.schema[]` with generated `column_id`s;
  `slackLists.items.create` now addresses those `column_id`s with typed `rich_text` values (was the invalid
  `{key,text}` shape). Threads the create-response column map into every row; keeps the never-throws /
  derived-facts-only posture; the `rich_text` encoding is the one thing left to confirm live (cut line
  `TEMPO_LISTS=off`). Canvas/reminders/bookmarks verified already-correct against the method docs (comments
  updated). MCP in/out already SDK-conformant — left as-is.
- **One-command deploy prep:** `scripts/set-manifest-urls.ts` + `npm run manifest:urls -- <app> [web]` fills the
  four `YOUR_DEPLOYMENT`/`YOUR_WEB_DEPLOYMENT` placeholders (scheme/trailing-slash normalised; `--check` gates
  it); `web/vercel.json` added; the manifest's 11 user + 8 bot scopes confirmed complete for the full surface.
- **`npm run preflight`** (`scripts/preflight.ts`): runs typecheck + tests + build + demo + web build + all four
  skip-safe `verify:*` + a manifest sanity check — one command that proves credential-free readiness (placeholders
  reported as info, since the committed manifest is a template until deploy).
- **`GO_LIVE.md`** — the single ordered credential-only checklist (Developer Program + semantic-RTS request day 1
  → local Socket-Mode bring-up → seed → `verify:rts` fix loop → Vercel root+web deploy → OAuth → E2E → video +
  judge invites → submit Jul 12). LEDGER "Next up" now points here. **Devpost draft** "Challenges" section filled
  (only video + sandbox URL remain).
**Quality:** **284 tests** (up from 282; +2 RTS documented-shape tests) across 46 files · typecheck clean · build
clean · `npm run demo` green (26 scenes) · web build green · versions aligned at 4.1.1 (root/web/MCP-server).
**Open seams:** live RTS/Lists/MCP/Postgres remain unverified against a real service by design — the mappings are
now doc-aligned rather than guessed, and each `verify:*` script confirms it on the first live call (W2).
**Next:** `GO_LIVE.md` — the owner's live bring-up + submission assets.

### v4.1.0 — 2026-07-02 — Submission W1: Agent-experience migration + serverless receiver + every fail-open gate closed
**Built:** the P0 pre-deploy fixes from `MASTER_PLAN.md` Part VII §7.2 W1 — the code work that had to land before
the first real Vercel deploy, all verified against the 2026 platform facts (Devpost deadline Jul 13 5 PM PDT;
new-app Agent experience; `@vercel/slack-bolt`).
- **Agent-experience migration** — `manifest.json` moves `assistant_view`/`assistant_description` →
  **`agent_view`/`agent_description`** (new apps can only use the Agent messaging experience), drops the
  deprecated `assistant_thread_started`/`assistant_thread_context_changed` event subscriptions, and sets
  `socket_mode_enabled: false` (prod is HTTP; toggle Socket Mode in app settings for local dev). In code, a new
  top-level **`app.message` DM handler** serves the Agent experience: Bolt's `Assistant` middleware provably
  intercepts only *threaded* IM messages (and stops their propagation), so the new handler sees exactly the
  top-level human DMs — both experiences served, double-reply impossible. Guards: skips threads, subtypes,
  bots, empty text, non-IM.
- **Serverless receiver** (`src/main/vercel.ts`, the only file touching `@vercel/slack-bolt@1.6`) —
  `api/slack/events.ts` now exports `createVercelHandler()`: a web-standard handler that **acks Slack inside
  the 3-second deadline and finishes the RTS/LLM work in the background via `waitUntil`** (the old
  `ExpressReceiver` + `processBeforeResponse: true` did full model calls before responding — guaranteed retry
  storms live). Signature verification is owned by the receiver; missing `SLACK_SIGNING_SECRET`/`SLACK_BOT_TOKEN`
  throw at startup.
- **Every fail-open gate closed:**
  - `config.runtime.receiver` now defaults to **http when `VERCEL=1`** (new `config.runtime.isVercel`), so
    `isLivePosture()` is true on every Vercel deploy and `assertSecretsHardened()` actually bites there —
    previously a default-env deploy served real traffic with the dev encryption key.
  - New **`assertVercelRuntime()`** (config/modes.ts), called by **all five** `api/` entrypoints (events, both
    OAuth routes, cron, MCP server): no-op off Vercel; on Vercel enforces a hardened key **and rejects
    `TEMPO_STORE=file`** (read-only FS ⇒ OAuth/cron would EROFS at runtime — now a clear startup crash).
  - `createExpressApp` (kept for self-hosting) **throws on a missing signing secret** instead of verifying
    signatures against `""`, requires the bot token, and drops `processBeforeResponse` (persistent servers ack
    immediately).
- **Housekeeping** — `api/cron/morning-digest.test.ts` → `src/main/morning-digest.cron.test.ts` (it deployed as
  a live route); read-aloud fallback filename now derives from the actual mime (mp3 vs wav); versions aligned
  at 4.1.0 (root/web/MCP-server advertised); seed-only scopes (`channels:manage`, `channels:read`,
  `chat:write.customize`) documented in the seed header as deliberately-not-in-manifest; `.env.example` +
  README updated (Agent experience, Vercel receiver, Postgres-on-Vercel, real test counts).
**Quality:** **282 tests** passing (up from 273) across 46 files — new Vercel-posture suite (http default on
`VERCEL=1` · hardened-key rejection · file-store rejection · postgres+strong-key pass · off-Vercel no-op ·
receiver override) and the agent-DM handler suite (routes a plain IM through the orchestrator · ignores
threaded/bot/subtype/non-IM/empty) · typecheck clean · build clean · `npm run demo` green (26 scenes) · web
build green.
**Open seams:** `agent_view` manifest keys + the VercelReceiver behavior are **unverified against real Slack**
(same posture as every live seam — first sandbox app-creation in W2 confirms them; if Slack's validator wants
different agent keys, the fix is manifest-only). Local Socket Mode now requires toggling Socket Mode on in app
settings (manifest ships prod-false).
**Next:** Part VII **W2 — live bring-up** (owner: Developer Program + sandbox + semantic-RTS partnerships
request + Vercel/Neon/Anthropic accounts; then deploy → OAuth → seed → `verify:rts` and fix the live field
mapping) and **W3 — submission assets**.

### v4.0.0 — 2026-07-02 — Attention OS + ecosystem (the finale): one working memory across work tools
**Built:** the capstone. Tempo generalizes beyond Slack into the permission-aware **working-memory layer across
work tools** — and the whole 3-year, 15-phase roadmap is now complete, green, and demoable credential-free.
- **Multi-source grounding** (`src/platform/sources/`) — `MultiSourceRtsClient` implements the *same*
  `RtsClient` port the domain already depends on, but fans one search across a primary (Slack RTS) + extra
  sources (mock email/calendar today; MCP-backed adapters in production), tags each result with its `source`,
  and merges/dedupes into one calm list. Because it's just another `RtsClient`, **triage / commitments /
  re-entry ground across every source with zero domain change** — `RtsMessage.source` + `TriageItem.source`
  carry provenance, surfaced as "· via email" in the card. Gated by `flags.attentionOs` (`TEMPO_ATTENTION_OS`,
  default off, so Slack stays the sole source); `buildContext` wraps the primary in `MultiSourceRtsClient` only
  when extras are configured. The same never-persist-content invariant holds for every source.
- **Open accessibility SDK** (`docs/accessibility-sdk.md`) — the calm-UX primitives (`resolveA11yPrefs` ·
  `condense` · `plainify`/`applyReadingLevel` · `toSpeech` · `t`/i18n · `auditResponse`) documented as a pure,
  dependency-free, framework-agnostic surface (`@tempo/accessibility`) others can build calm, neurodivergent-
  friendly agent UIs on — with a worked example and the design principles baked in.
- **Capstone** — a 26th demo scene grounds triage across Slack + a mock email + a mock calendar as one ranked
  list (email/calendar items surface as ACT alongside Slack), and prints the whole arc.
**Quality:** **273 tests** passing (up from 268) across 46 files — `multi.test.ts` (merge + source-tagging +
dedupe · keeps the primary's identity/mode · **triage grounds across sources** so an email item surfaces
alongside Slack · flag-gated default = no extras) · typecheck clean · root build clean · `npm run demo`
extended to **26 scenes** (Slack + email + calendar → one triage) · web app still builds. The multi-source
wrap is behind a default-off flag, so every prior test/behavior is byte-for-byte unchanged.
**Open seams:** the extra sources are deterministic mocks (a real deployment swaps them for MCP-backed source
adapters — the same live-seam posture as the outbound MCP client); dedupe is by source+permalink; the accessibility
SDK is documented in-repo, not yet a published package. Cross-source ranking uses the existing per-sender
learning + urgency (source-agnostic).
**Milestone:** with v4.0 the **entire 3-year roadmap (Phases 0–15, v0.1 → v4.0) is complete** — every phase
built, tested, green, and shippable credential-free. What remains is owner-only live verification (flipping the
mock/live gates against real services) + the Marketplace/hackathon submission logistics.

### v3.8.0 — 2026-07-02 — Enterprise & Global: true multilingual + automated accessibility certification
**Built:** the global + enterprise-readiness layer — the two pillars that make the "for-Good / assistive tech"
promise scale, plus the enterprise posture as docs.
- **True multilingual (i18n)** (`src/accessibility/i18n/`) — a dependency-free message catalog + `t(key,
  locale, params?)` with English fallback + `{param}` interpolation, and `resolveLocale` (normalizes
  `es-MX`→`es`). The **read-aloud speech script** — the accessibility core — now ships in **English + Spanish**:
  `toSpeech(input, locale)` localizes the opener + outro (and strips ALL markdown so a TTS never voices
  "asterisk"). A new `UserPrefs.locale` drives it, settable from the web companion's Settings (**Language**);
  the orchestrator threads the resolved locale into every response's speech. Dynamic AI content localizes on
  the live path (Claude prompted in-locale); this catalog is the seam the other surfaces extend into.
- **Accessibility certification** (`src/accessibility/audit.ts`) — `auditResponse(response, a11y)` makes
  accessibility a machine-checked gate: it flags an empty/`markdown`-bearing read-aloud script, an unlabeled
  button, or plain-level text that still has semicolon runs. `audit.test.ts` runs it across **every** response
  type (triage / commitments / catch-up / focus / decode / help / team / handoff) + a Spanish-locale response
  + a deliberate false-green guard — so a regression that makes any surface inaccessible fails the build.
- **Enterprise posture** (`ENTERPRISE.md`) — Grid org-wide install, the data-**residency** seam (the existing
  `TEMPO_STORE`/`DATABASE_URL` abstraction → a regional Postgres, no code change; RTS content never stored),
  least-privilege scopes + secrets hardening, and a counts-only audit posture. SCIM / DLP / SIEM export /
  VPAT sign-off are marked owner-only enterprise integrations.
**Quality:** **268 tests** passing (up from 254) across 45 files — `i18n.test.ts` (locale lookup + English
fallback + normalization + no-gaps-per-locale), and the **certification** `audit.test.ts` (10 tests: every
response type accessible · Spanish read-aloud still markdown-free · catches an inaccessible response) ·
typecheck clean · root build clean · `npm run demo` extended to **25 scenes** (an en-vs-es read-aloud + a live
7/7 accessibility audit) · web app still builds, now with a Language selector in Settings.
**Open seams:** the localized surface is the speech script + the catalog seam; visible card text + dynamic AI
content localize on the live Claude path (English on the mock path) — extending the catalog to every label is
incremental. Only en/es ship (adding a locale is one catalog object). SCIM/DLP/data-residency contracts +
cross-language RTS at scale remain owner-only enterprise integrations.
**Next:** Phase 15 / v4.0 — Attention OS + ecosystem (unify sources beyond Slack · open accessibility SDK) —
the finale.

### v3.6.0 — 2026-07-02 — Team & manager mode: opt-in, aggregated, anonymized (k-anonymity guardrail)
**Built:** the first *team* view — and it holds the line on privacy hard. The default posture stays a personal
agent on personal data; team mode is **opt-in** (`TEMPO_TEAM`, default off) + an **explicit roster** (nobody's
included unless listed), **aggregate-only**, and **k-anonymity-redacted** below 3 members so no individual can
ever be inferred.
- **Pure anonymizing aggregation** (`modules/team/domain.ts`) — `aggregateTeamLoad(members, {minMembers})`
  rolls up the counts-only data Tempo already keeps (weekly metrics + per-sender signals, reusing v3.4's
  `analyzeLoad` for a per-member load score) into a `TeamLoadResult`: team totals + per-person averages + a
  **coarse distribution** (balanced / uneven / concentrated via coefficient-of-variation) for load and
  response-fairness. The aggregator takes **no user id** (only `{metrics, signals}` per member), so identity
  can't leak into the output even by accident. Below the k floor it returns a fully **redacted** result (no
  aggregates at all).
- **Opt-in roster + gate** — `config.team.members` (the explicit opt-in list) + `config.team.minMembers`
  (k, default 3) + `flags.team` (`TEMPO_TEAM`, default off). `teamLoad(store, roster, k)` gathers the roster's
  metrics/signals and aggregates; a new `/tempo team` orchestrator intent renders it (or "team mode is off"
  when the flag is down — the default).
- **`teamLoadBlocks`** — the anonymized aggregate card, or a calm redaction card, always ending "aggregates
  only — never any individual's messages, and never a single person's numbers."
**Quality:** **254 tests** passing (up from 245) across 43 files — the standout is `team.test.ts`, the
**privacy guardrail**: redacts below k · aggregates at/above k · asserts the output contains **no user id and
no per-person value** (an outlier's number never appears) · coarse-distribution descriptors only. Plus the
`teamLoad` use-case (roster gather + redaction), `teamLoadBlocks` render, and an orchestrator test that team
mode is **off by default**. Typecheck clean · root build clean · `npm run demo` extended to **24 scenes** (an
anonymized 3-member aggregate proving no id leaks, then a 2-member redaction) · web app still builds.
**Open seams:** membership is a config roster (an explicit, admin-configured opt-in); a per-user prefs toggle
("include me in team aggregates") + a manager-only gate on the surface are future refinements. The k floor is
a simple count threshold (no differential-privacy noise) — sufficient for count aggregates, conservative by
default. Aggregation is over the current rolling week (like the metrics store).
**Next:** Phase 14 / v3.8 — Enterprise & Global (true multilingual · Enterprise Grid posture · accessibility
certification).

### v3.4.0 — 2026-07-02 — Proactive intelligence: opt-in overload early-warning + smart batching
**Built:** the first *proactive* care in Tempo — everything before was reactive (you ask) or scheduled (the
morning digest). It stays calm and honest: **opt-in** (`TEMPO_PROACTIVE`, default off), **notifies only**
(never acts), and is computed **only from the counts Tempo already keeps** (never message content, Invariant 1).
- **Overload / burnout early-warning** (`modules/intelligence/load.ts`) — a pure `analyzeLoad(metrics,
  signals)` reads how loaded the user is from privacy-safe weekly metrics (obligations, firehose volume, focus
  minutes protected) + aggregate per-sender deprioritization, returns a `LoadAssessment { level: calm|busy|
  heavy, score, drivers[], suggestion }`. It's *structural*: it fires when the user takes on load faster than
  they protect time for it, and every heavy/busy read ends in a **gentle, opt-in suggestion** ("want me to
  block 90 min of focus?") — never an action.
- **Smart batching** — non-urgent FYIs are gathered into ONE calm "N low-priority updates batched" section
  (`batchedFyiBlocks`, derived facts only — author + the AI's one-line reason, never a raw excerpt) instead of
  interrupting for each. `overloadBlocks` renders the heads-up.
- **One calm touchpoint** — a `buildProactiveBlocks(ctx)` use-case (overload heads-up + batched FYIs) folded
  into the **morning digest** cron behind `flags.proactive` (new `TEMPO_PROACTIVE`, default off), so proactive
  care arrives in the single scheduled DM rather than as new interruptions.
**Quality:** **245 tests** passing (up from 234) across 41 files — `load.test.ts` (calm/busy/heavy thresholds ·
focus relieves load · batch-vs-focus suggestion · no-metrics user), `proactive.test.ts` (heavy week → opt-in
heads-up + batched FYIs · no raw excerpt · calm user → no heads-up), and `overloadBlocks`/`batchedFyiBlocks`
render tests (opt-in copy · never a raw excerpt) · typecheck clean · root build clean · `npm run demo` extended
to **23 scenes** (a heavy-week load read from counts + the folded touchpoint) · web app still builds.
**Open seams:** the load read is a *snapshot* heuristic over the current week (the metrics store keeps one
rolling week, not history), so it's a structural early-warning rather than a week-over-week trend — a small
load-history store would enable trend detection later. Proactive is a workspace-level opt-in flag; per-user
opt-in (a prefs toggle in the settings modal / web) is a future refinement. Thresholds are deliberately
conservative.
**Next:** Phase 13 / v3.6 — Team & manager mode (opt-in, aggregated + anonymized; never individual content).

### v3.2.0 — 2026-07-02 — Agentforce integration: per-caller identity · Employee Agent · graceful handoff
**Built:** the three Phase 11 bullets — making Tempo a first-class agent collaborator — and, in the process,
**fixed the v3.0 MCP-server security findings** a review flagged (fail-open auth + hardcoded-fixture ambient
authority).
- **Per-caller identity, DEFAULT-DENY** (`platform/mcp/server/auth.ts`) — the inbound MCP endpoint no longer
  acts as one hardcoded fixture user with a shared secret. `resolveMcpCaller` resolves a caller to the user it
  may act as via (1) a **signed per-user agent token** (`mintAgentToken`, reusing the v2.6 `signSession`/
  `verifySession` HMAC) → *that* user, their own stored token driving RTS (no ambient authority); or (2) a
  shared gate token accepted **only** when both `TEMPO_MCP_SERVER_TOKEN` **and** an explicit
  `TEMPO_MCP_SERVER_USER` are configured. No credential / invalid / expired / shared-token-without-user →
  `null` → 401. `api/mcp/server.ts` rewritten to this (removing the fail-open `if (token && …)` and the
  `SUBJECT_USER_ID` binding); a per-user caller can never fall back to the demo token.
- **Tempo as an Agentforce Employee Agent** (`platform/agentforce/descriptor.ts`) — `buildAgentforceDescriptor`
  packages the four MCP tools (derived from `TEMPO_TOOLS`, so they can't drift), a system **persona** stating
  the trust rules, the trust contract (`actsAsInitiatingUser`/`neverStoresRtsContent`/`humanInTheLoop`), and
  the MCP connection (`streamable-http` + `bearer-agent-token`). Pure + snapshot-tested.
- **Graceful @mention handoff** (`modules/handoff/`) — Tempo now knows its boundaries: `detectHandoff`
  classifies an out-of-scope request (time-off / expenses / ops / issue-tracking / data / scheduling) and the
  orchestrator hands it off ("that's an ops task — try your on-call agent") instead of guessing. Wired **before**
  the switch for the ambiguous `catchup`/`help` intents so a request that merely grazed a broad catch-up
  keyword ("roll *back* the deploy", "file my PTO *request*") routes correctly, while precise intents
  (triage/commitments/decode/focus) and legit re-entry ("I had PTO, catch me up") are never intercepted.
**Quality:** **234 tests** passing (up from 220) across 39 files — `auth.test.ts` (default-deny · agent-token
→ user · expired/garbage denied · shared-gate only with token+user), `descriptor.test.ts` (packages every
tool · trust contract · persona), `handoff.test.ts` (out-of-scope detection · never hijacks capabilities or
re-entry), and orchestrator handoff/catch-up routing tests · typecheck clean · root build clean · `npm run
demo` extended to **22 scenes** (mint→resolve an agent token with default-deny, the Employee Agent descriptor,
and an out-of-scope handoff) · web app still builds.
**Open seams:** the inbound `McpServer`/transport is still contract-shaped, **unverified against a real MCP
client**; caller→user is signed-token-based now, but issuing agent tokens to users (a web "connect an agent"
flow) is a future nicety. Handoff routing is keyword-based (deliberately conservative). The live Agentforce
*registration* (a Salesforce org + Agentforce setup) is owner-only.
**Next:** Phase 12 / v3.4 — Proactive intelligence (opt-in overload early-warning · smart batching · calm
touchpoints), counts-only and human-in-the-loop.

### v3.0.0 — 2026-07-02 — Tempo as an MCP server (inbound): triage/commitments/decode/focus as MCP tools
**Built:** Tempo has been an MCP *client* since v2.2; v3.0 makes it an MCP **server** too, so external agents
(Agentforce / Claude / Cursor / ChatGPT) can call `tempo_triage` · `tempo_commitments` · `tempo_decode` ·
`tempo_focus` — Tempo becomes *infrastructure*, not just an app, honoring the same trust model (acts as the
initiating user; returns derived facts only; stores nothing from RTS).
- **Shared read-models** (`src/application/read-models.ts`) — extracted `liveTriage` (suppression + learned
  weight blend) and `liveCommitments` (local overrides + fulfillment auto-close) that the orchestrator and
  the native-surface use-cases had each duplicated; both now delegate. Behavior-preserving (all 214 prior
  tests stayed green), and it gives the MCP tools the exact same reads every other surface uses.
- **SDK-free tool definitions** (`platform/mcp/server/tools.ts`) — the four tools as pure
  `(args, ctx) => { summary, data }` over the domain, so the whole inbound surface is unit-testable and
  demoable with **no SDK and no credentials**. Each returns **derived facts only** — triage omits the raw
  excerpt, commitments omit `sourceText`, decode operates on caller-supplied text — so no RTS content ever
  crosses the MCP boundary (asserted in tests).
- **SDK-isolated server** (`platform/mcp/server/serve.ts`) — the ONLY inbound file touching
  `@modelcontextprotocol/sdk`; `handleMcpHttp` lazily `await import`s `McpServer` +
  `StreamableHTTPServerTransport` on the first request, registers the tools, and serves statelessly. Same
  isolation discipline as the outbound `mcp/connect.ts` — the SDK never loads on the zero-credential path.
- **HTTP entry + gate** — `api/mcp/server.ts` (Streamable HTTP), off unless `TEMPO_MCP_SERVER=on`, bearer-
  gated by `TEMPO_MCP_SERVER_TOKEN`; acts as a configured initiating user (their token drives RTS). New
  `config.mcp.server` block + `isMcpServerEnabled()`. `scripts/verify-mcp-server.ts` (`npm run
  verify:mcp-server`) enumerates the exposed tools + reports the endpoint's enabled/gated state.
**Quality:** **220 tests** passing (up from 214) across 36 files — a new `server/tools.test.ts` runs all four
tools against a mock context and asserts the structured output + the never-leak-RTS invariant (no excerpt, no
`sourceText`) + the server-off-by-default gate; the read-model extraction kept every existing suite green ·
typecheck clean · root build clean · `npm run demo` extended to **21 scenes** (the four tools invoked exactly
as the server invokes them, proving derived-facts-only output) · web app still builds.
**Open seams:** the inbound `McpServer`/transport (`serve.ts`) + the `api/mcp/server.ts` HTTP wiring are
**contract-shaped but unverified against a real MCP client** (same posture as the outbound client and the
other live seams); `verify:mcp-server` lists the contract but doesn't round-trip. Caller identity is a single
configured user for now — real per-caller→user mapping is v3.2 (Agentforce). Only Streamable HTTP transport.
**Next:** Phase 11 / v3.2 — Agentforce integration (@mention handoffs · Tempo as an Employee Agent ·
per-caller identity mapping).

### v2.9.0 — 2026-07-02 — Marketplace-readiness: least-privilege scopes · data-governance guard · privacy/security
**Built:** the buildable half of Marketplace prep — the engineering, tests, and docs — with the real-workspace
logistics left to the owner (above). The flagship was a genuine bug-fix: **three scope declarations disagreed**.
- **Scopes as one audited source of truth** (`src/platform/slack/oauth/scopes.ts`) — a declarative table (each
  scope + its token + a plain justification + the exact method/event that needs it). `oauth/index.ts` now
  derives `USER_SCOPES`/`BOT_SCOPES` from it, so `buildAuthorizeUrl` requests the **full correct set** —
  fixing an **under-request bug** (the authorize URL had been omitting `dnd/profile/canvases/lists/reminders`
  user scopes + `files:write`/`bookmarks:write`/`app_mentions:read`/`im:history` bot scopes, so every live
  focus/canvas/list/reminder/bookmark/read-aloud call would have `missing_scope`-failed). `manifest.json` was
  pruned of **5 over-requested** bot scopes (`users:read`, `channels:history`, `groups:history`,
  `mpim:history`, `reactions:write`) that no call or event uses. A drift test (`scopes.test.ts`) now asserts
  manifest === `scopes.ts` (sorted) + every scope is documented — CI catches any future divergence.
- **Data-governance completeness guard** (`user-data.governance.test.ts`) — spies every repo of a real
  `Store`, runs `exportUserData` + `deleteUserData`, and asserts the export **reads every** repo (and never
  decrypts the token) while erasure **deletes every** repo. Adding a future repo without wiring it into
  export/erasure now fails the build — the DSR guarantee enforced by a test.
- **Privacy & security docs** — `PRIVACY.md` (a truthful, code-accurate policy: what's stored vs the hard
  never-store-RTS rule, and access/export/delete rights) and `SECURITY.md` (AES-256-GCM tokens + the hardening
  gate, least-privilege scopes, OAuth `state` CSRF, HttpOnly session cookie, responsible-disclosure stub).
- **Web `/privacy-policy` page** — a public, no-auth, accessible policy page in the Next.js companion (Slack
  Marketplace requires a reachable policy URL), linked from the landing page + the privacy dashboard.
- **Listing package** — `docs/marketplace-listing.md` (short/long description, explicit impact statement,
  feature list, the "uses all three required techs" callout mapped to files, screenshot beats, and the
  submission checklist with owner-only items marked).
**Quality:** **214 tests** passing (up from 209) across 35 files — `scopes.test.ts` (manifest↔code equality +
doc-completeness + no duplicates) and the governance guard · typecheck clean (JSON manifest imported with a
`with { type: "json" }` attribute for NodeNext) · root build clean · `npm run demo` extended to **20 scenes**
(a least-privilege scopes table + a live manifest-match assertion) · the web app still builds, now with a
statically-prerendered `/privacy-policy` route. No runtime behavior on the mock path changed — scopes matter
only to a real authorize URL.
**Open seams:** the corrected scopes are validated against the **code's calls**, not a real Slack install
(same "unverified live" posture as the other live seams) — but they're now correct-by-construction and
drift-tested. `PRIVACY.md`/listing copy is descriptive, not legal review. Owner-only logistics (10+
workspaces, screenshots, submission, Slack's own security review, real contact addresses) remain outside code.
**Next:** Phase 10 / v3.0 — Tempo as an MCP *server* (expose triage/commitments/decode/focus as MCP tools).

### v2.8.0 — 2026-07-02 — Intelligence: learned per-sender urgency · relationship confidence · dropped-ball · fulfillment
**Built:** all four Phase 8 bullets — Tempo now tunes itself to *you*, learning **only from your own taps**
(snooze / mark-done / draft), stored as **counts per sender id**, never from message content (Invariant 1).
- **Learned-signals store** (`signals` repo on the `Store` port) — a new `SenderSignal {userId, authorId,
  engaged, deprioritized, updatedAt}`, keyed by the sender's stable Slack id, in **both** adapters
  (`file/signals.ts`, `pg` `tempo_sender_signals` table, shared `logic.ts` helpers). No weekly roll (a bounded
  weight saturates instead). Wired into `UserDataExport` (`senderSignals`) + the `deleteForUser` erasure
  cascade — counts only, in the export, erasable.
- **Intelligence module** (`src/modules/intelligence`, pure) — `senderWeight = MAX_ADJUST·tanh(net/SCALE)`
  (bounded ±20 on the 0–130 rank scale, so learning reorders near-ties but never overrides a genuine ACT),
  `buildWeightMap`, and `familiarity`.
- **Triage ranking blend** — `TriageItem` now carries `authorId` (was dropped at the enrichment boundary);
  `rank(i, adjust?)` adds the learned per-sender term; `runTriage` takes a `senderAdjust`, resolved by the
  orchestrator/surfaces `liveTriage` from the user's signals. **Attribution:** triage action buttons now encode
  `{p: permalink, s: authorId}`; `actionTarget` parses it (bare-permalink fallback keeps ledger buttons + all
  existing payloads working), so `snooze`→deprioritized and `mark_done`/`draft_reply`→engaged record a signal.
- **Decoder relationship-confidence** — `decodeMessage` takes a `familiarity` (from the same signals);
  more history → a bounded confidence bump (capped at 1), none → an honest low-history caveat. The orchestrator
  threads the decoded message's `authorId` through.
- **Dropped-ball prevention** — `atRiskCommitments(ctx)` + `droppedBallBlocks()` append a calm "N commitments
  are slipping" heads-up to the morning-digest DM (best-effort; derived facts only).
- **Commitment-fulfillment auto-close** (the accepted-fuzzy heuristic) — pure `matchFulfillments(commitments,
  messages)` closes a still-open `i_owe` promise when a **past-tense** delivery message (`sent/shipped/…`)
  overlaps the deliverable ("send" ≠ "sent", so the original promise never self-closes); `detectFulfilled
  Commitments` searches RTS and the orchestrator marks matches `done` before sync, so the Ledger self-cleans.
**Quality:** **209 tests** passing (up from 190) across 33 files — new `intelligence` (weight bounds/
monotonicity/familiarity), file+pg `signals` (accumulate · scoped · erase · `ON CONFLICT` SQL), triage
(authorId populated · a `senderAdjust` re-ranks without changing membership), decoder (familiarity raises
confidence, zero-familiarity caveat), ledger `matchFulfillments` (delivery matches, future-tense/unrelated/
owed-to-me don't), dropped-ball render, and app-action learning (structured value records a signal, bare
permalink doesn't) · typecheck clean · root build clean · `npm run demo` extended to **19 scenes** (18: taps
re-rank triage + familiarity tunes a tone read; 19: fulfillment auto-close + a dropped-ball digest). The web
app still builds (the `Store`/`UserDataExport` widening is source-compatible).
**Open seams:** fulfillment auto-close is a **keyword heuristic** — it can miss or rarely false-close, but only
flips a re-derivable display status (never deletes data) and is confined to `matchFulfillments`; the learned
weight is bounded so a bad signal can't dominate. The new RTS fulfillment search shares the "unverified against
a real workspace" posture of the other live seams.
**Next:** Phase 9 / v2.9 — Marketplace (granular-scopes audit · DSR/export polish · privacy policy · security
review · listing assets).

### v2.6.0 — 2026-07-01 — Web companion (Next.js): privacy dashboard · data export/delete · settings
**Built:** the user-facing web companion Phase 7 called for — a real **Next.js App Router app under `web/`**
that lets a user *see, export, and delete* everything Tempo has stored, and edit their settings outside
Slack. It's the GDPR / Marketplace compliance backbone (data portability + right-to-erasure + transparency),
unlocked by v2.4's real persistence. The load-bearing decision: **all logic lives in `src/` and is covered by
root vitest + a demo scene; the Next.js app is a thin, react-free-at-the-root presentation layer** — so the
zero-credential gates (`npm test`/`typecheck`/`build`/`demo`) stay green and react-free.
- **Data-governance seam on the `Store` port** (`src/ports/store.ts`): `deleteForUser(userId)` on all six
  repos + `listForUser(userId)` on commitments/snoozes, implemented in **both** adapters (file: filter/drop
  the JSON map; pg: `DELETE … WHERE user_id` / `SELECT … WHERE user_id`). A new `UserDataExport` type carries
  token **metadata only** (never the decrypted token), prefs, counts-only metrics, surfaces, `PinnedCommitment`s
  (structurally no `sourceText`), snoozes — **no RTS content by construction**.
- **Adapter-agnostic use-cases** (`src/application/use-cases/user-data.ts`): `exportUserData(store, userId)`
  composes the ports into a `UserDataExport`; `deleteUserData(store, userId)` erases across all six stores
  (token last, so a partial failure never strands erased data behind a live session). Plus
  `settings.ts` (`parseSettingsForm` + `applySettings`) mirroring the Slack modal parser for the web form.
- **Signed browser session** (`src/shared/session.ts`) — a stateless HMAC-signed, expiring `HttpOnly; Secure;
  SameSite=Lax` cookie over the user id, keyed off the **same** `SHA-256(encryptionKey)` idiom the token store
  uses (no new secret). `verifySession` is constant-time (`timingSafeEqual`) + expiry-checked. This is what
  scopes "delete all my data" to the authenticated user only.
- **OAuth CSRF `state`** — both the web and the root Slack-install flows now mint a random single-use `state`
  (short-lived `HttpOnly; SameSite=Lax` cookie set at `/start`), and the callback rejects (400) unless the
  query `state` matches the cookie constant-time (`statesMatch`) — closing an OAuth login-CSRF hole flagged in
  review of the initial v2.6 commit.
- **Shared OAuth helpers** (`src/platform/slack/oauth/`) — extracted `buildAuthorizeUrl(redirectUri, state?)` +
  `exchangeCode` from the root `api/oauth/*` (behavior-preserving) and reused by both flows.
- **The `web/` Next.js app** (its own `package.json`/build, **not** an npm workspace — root `npm ci` stays
  react-free) shares `src/` via `next.config.mjs`'s `experimental.externalDir` + a `.js`→`.ts` `extensionAlias`,
  through a single bridge file `web/lib/domain.ts`. Surfaces: a landing/"Sign in with Slack" page, a
  **privacy dashboard** (`/privacy`), a **settings** form (`/settings`), and Route Handlers for OAuth
  start/callback, `/api/data/export` (JSON attachment), `/api/data/delete` (POST → erase + clear cookie), and
  `/api/settings`. Calm, accessible styling (system-ui, dark-mode, visible focus, semantic landmarks). Manifest
  gains the web callback redirect URL.
- **Isolation** so the root gates can't be touched: `vitest.config.ts` excludes `web/**` (via
  `configDefaults.exclude`), `tsconfig.json` excludes `web`, `.gitignore` ignores `web/.next`+`node_modules`,
  and root `web:dev`/`web:build` scripts are separate from `build`/CI.
**Quality:** **187 tests** passing (up from 169) across 31 files — `session.test.ts` (sign/verify round-trip ·
tamper · userId-swap · expiry · cookie parse), `user-data.test.ts` (every category exported · **never** the
token secret or `sourceText` · delete erases everything and leaves other users intact · settings form clears
blanks), extended `pg.test.ts` (scoped `DELETE`/`SELECT` for the new methods) + file-store coverage.
Typecheck clean · root build clean · `npm run demo` extended to **17 scenes** (sign a session → export → prove
no token secret / no RTS content → settings save → delete → export now empty). Separately, `cd web && npm
install && npm run build` **compiles all 8 routes and type-checks the shared domain**.
**Open seams:** the Next.js app's SSR/route-handler + signed-cookie/redirect behavior is **built and
type-checked but exercised only manually** (kept out of the root zero-cred CI, same "unverified live seam"
posture as live RTS/MCP/Postgres). The web app is intended as its own Vercel project (Root Directory `web`)
sharing the repo; two OAuth redirect URLs are registered. All prior unverified live seams unchanged.
**Next:** Phase 8 / v2.8 — Intelligence (learned per-user urgency · relationship graph · commitment-
fulfillment detection), learning only from action signals, never from stored RTS content.

### v2.4.0 — 2026-07-01 — Persistence & scale (Neon Postgres behind one repository port)
**Built:** the durable-storage swap Phase 6 called for — every store now sits behind a single async `Store` port with **two adapters** (file + Postgres), selected by config, so persistence survives Vercel's read-only FS *without* changing a line of domain logic. File stays the default, so the zero-credential demo/tests are untouched.
- **One repository port, two adapters:** new `src/ports/store.ts` defines the six async repos (`tokens`/`prefs`/`commitments`/`snoozes`/`metrics`/`surfaces`) + the `Store` bundle, and owns the data types (`UserPrefs`/`PinnedCommitment`/`Suppression`/`UserMetrics`/`SurfaceHandles`) so both adapters share one definition. The **file adapter** (`platform/persistence/file/*`, `buildFileStore()`) is the old JSON-file logic moved verbatim behind the port (one shared `jsonFile` load/save helper; `tokens` keeps AES-256-GCM + its historical hardcoded path). The **Postgres adapter** (`platform/persistence/pg/*`, `buildPgStore(db)`) implements the same port in SQL (`INSERT … ON CONFLICT` upserts, snake_case↔camelCase mapping). Shared decision rules (metrics weekly roll, commitment override-merge, suppression activeness) live once in `persistence/logic.ts` so the two adapters can't drift.
- **SDK-isolated live driver (mirrors the v2.2 MCP discipline):** the only file touching `@neondatabase/serverless` is `pg/connect.ts` — it `await import`s the driver **lazily on the first query**, runs the idempotent migrations once, and caches the connection. Every pg repo depends only on a tiny local `Db` seam (`pg/session.ts`), so the driver is **never loaded on the file/demo/test path** and the SQL is unit-testable against a fake in-memory `Db`.
- **Double-gated factory + DI thread:** `getStore()` (`persistence/index.ts`) returns the pg store only when `TEMPO_STORE=postgres` (auto-detected from `DATABASE_URL`) **AND** a `DATABASE_URL` is configured — else the file store (same double-gate as `getRtsClient`/`getMcpClients`). Wired through the container: `createContainer().store()` + a new `ctx.store` on `TempoContext`; the orchestrator, surfaces use-cases, App Home/actions, cron, and OAuth all read/write through `ctx.store` / `getStore()` (repos are async now, so call sites gained `await` — `contextFor` became async for the token read).
- **Config seam:** new `config.store` (`TEMPO_STORE` + `DATABASE_URL`) in `config/env.ts` + `isPostgresStore()` in `config/modes.ts` (standalone — storage isn't a "live Slack" posture, so it doesn't feed `isLivePosture()`). `.env.example` gets a Persistence block.
**Quality:** **169 tests** passing (up from 155) across 29 files — the file-store suites rewritten against `buildFileStore()` (the "file default stays green" proof), a new `pg/pg.test.ts` driving every pg repo against a fake `Db` (SQL + params + mapping, mirroring `mcp.test.ts`), the **Invariant-1 proof** (schema-level: the commitments DDL has no `source_text`/content column; guard: a full `sync()` of a `sourceText`-bearing commitment writes it into no column), and a factory test (default = file, cached singleton). Typecheck clean · build clean · `npm run demo` extended to **16 scenes** (a real pg round-trip via an in-memory fake `Db` — prefs + commitments — proving no content column, then proving the default resolves to file). New `scripts/verify-live-postgres.ts` (`npm run verify:postgres`) mirrors `verify:mcp`: prints "skipped" + exits 0 with no `DATABASE_URL`; with one, applies the schema and does a non-destructive write→read→delete round-trip.
**Open seams:** the live pg `query`/transport (`pg/connect.ts`) is **contract-tested only** (fake `Db`) and **unverified against a real Neon database** — same posture as live RTS/MCP; `verify:postgres` exists to check it but hasn't been run. The pg SQL is a best-effort mapping (bigint→Number coercion, ISO nothing — all Unix-seconds); a real driver quirk would surface only on the live path. `data export/delete` seams aren't added yet (they belong to the v2.6 web companion). All prior unverified live seams (RTS/Claude field mapping, v2.0 canvases/lists/reminders/bookmarks, v2.2 MCP callTool) unchanged.
**Next:** Phase 7 / v2.6 — Web companion (Next.js settings · privacy dashboard · data export/delete · OAuth onboarding).

### v2.2.0 — 2026-07-01 — Real MCP outbound (Calendar/Notion/Linear/GitHub via `@modelcontextprotocol/sdk`)
**Built:** the real outbound-MCP path so the Focus Guardian *acts in the world* through a live MCP server — with **zero change to the domain**, since `focus` already depended only on the `CalendarClient`/`TaskClient` ports (`src/ports/mcp.ts`, unchanged). This was purely a new adapter + its config gate + tests.
- **SDK-isolated live adapter:** `@modelcontextprotocol/sdk@1.29` added as a dependency, but **only one file touches it** — `platform/mcp/connect.ts` `await import`s the SDK **lazily on the first tool call** and builds a `Client` + `StreamableHTTPClientTransport` (URL + optional bearer token), cached per session. The mock / demo / test paths never construct a live session, so the SDK is never loaded there — the zero-credential path can't be broken even by an SDK ESM quirk. The adapters (`platform/mcp/live.ts`: `LiveMcpCalendarClient`/`LiveMcpTaskClient`) depend only on a tiny local `McpSession` seam (`session.ts`: `callTool(name, args) → McpToolResult`), not the SDK types.
- **Best-effort result mapping:** pure exported `mapCalendarResult`/`mapTaskResult` normalise a tool result to `CalendarResult`/`TaskResult` — prefer `structuredContent.{eventId|id|…}`/`{htmlLink|url|…}`, fall back to JSON-parsing the first text content, then to a synthesized id; an `isError` (or thrown SDK error) propagates (the focus response is wrapped by `safely()` upstream). ISO-8601 start/end/due are sent as the calendar/task lingua franca.
- **Double-gated factory:** `getMcpClients()` (`platform/mcp/index.ts`) now returns a `LiveMcp*Client` only when `TEMPO_MCP=live` **AND** that client's own server URL is configured — a partial config leaves the other on mock (same double-gate as `getRtsClient`/`getSlackActions`). Signature unchanged, so `container.mcp()` and `focus` are untouched. New `config.mcp` block (`TEMPO_MCP` + per-client `_URL`/`_TOKEN`/`_TOOL`/`_PROVIDER`, defaulting `create_event`/`google-calendar` and `create_task`/`notion`) + `isLiveMcp()`.
- **Verify script:** `scripts/verify-live-mcp.ts` (`npm run verify:mcp`) mirrors `verify:rts` — with no live config it prints "skipped" and exits 0; with one it connects to each configured server and **lists tools** (non-destructive — never creates a real event/task), reporting whether the configured tool name is exposed.
**Quality:** **155 tests** passing (up from 142) across 27 files — a new `platform/mcp/mcp.test.ts` covers the mapping (structuredContent · text-JSON fallback · synthesized-id fallback · `isError` throws), both live adapters against a fake `McpSession` (asserting the `callTool` name + ISO argument mapping + result), and the env-gated factory (mock by default · live only with flag **and** URL · independent per-client gate · never connects) · typecheck clean · build clean · `npm run demo` extended to **15 scenes** (a real live-mapping round-trip via a fake in-memory session, then proving the default resolves to mock).
**Open seams:** the live MCP `callTool`/transport (`connect.ts`) is **unverified against a real server** — contract-shaped and covered only via the `McpSession` fake, same posture as live RTS; `verify:mcp` exists to check it against a real workspace but hasn't been run. The argument/result field names are a best-effort superset (real servers vary — adjust `live.ts` + `TEMPO_MCP_*_TOOL` per server). Only Streamable HTTP transport is implemented (stdio is a documented future, confined to `connect.ts`). A calendar/task tool failure currently fails the whole focus response (guarded by `safely()`); a future hardening could still set DND. File-backed stores unchanged (Neon swap is v2.4).
**Next:** Phase 6 / v2.4 — Persistence & scale (Neon Postgres behind the repository interfaces).

### v2.0.0 — 2026-07-01 — Native Surfaces (Tempo Canvas · Workflow steps · Slack Lists · reminders/bookmarks) + finished hexagonal inversion
**Built:** Phase 4 in full — Tempo now lives across Slack's native surfaces, on top of the v1.8 layered architecture, whose remaining hexagonal seams this closes.
- **Hexagonal inversion finished (behavior-preserving, tests green throughout):**
  - `src/config.ts` → **`src/config/`** (`env` · `modes` · `feature-flags` · `index` barrel), with a one-line `config.ts` re-export shim so the ~15 `../config.js` import sites don't churn. New `feature-flags.ts` exposes `flags.canvas`/`flags.lists` (`TEMPO_CANVAS`/`TEMPO_LISTS`, default on).
  - A real **`LlmPort`** (`src/ports/ai.ts`) with `MockLlm`/`LiveLlm` adapters + `getLlm()` (`platform/ai/{mock,live,index}.ts`, split out of the old `llm.ts`). Every module now **receives** the LLM (`runTriage(rts, llm, …)`, `runLedger(rts, llm, …)`, `decodeMessage(text, llm, …)`, `checkDraft(draft, llm)`, `draft*(c, llm)`, `runReentry(rts, llm, …)`) instead of importing the free `structured`/`text`; the per-call `mock()` oracle (the test oracle) is preserved verbatim. `llm` is threaded onto `TempoContext`.
  - Every domain module split into the Part-IV **`domain.ts` · `service.ts` · `ports.ts` · `index.ts`** anatomy (`triage`, `ledger`, `decoder`, `reentry`, `focus`, `draft`; `onboarding` is a pure `domain`+`index`), each behind a one-line public-entry shim so importers are unchanged.
  - A threaded **DI container** (`src/application/container.ts`, `createContainer()`) is the single seam resolving RTS · AI · Slack-actions · MCP from config; `buildContext` threads it onto every context, the orchestrator's focus branch and `app.ts` now pull adapters from `ctx.container` instead of calling platform factories inline. (Placed in the application layer, not `main/`, to keep the dependency rule pointing inward.)
- **Tempo Canvas** — extended the `SlackActionsClient` port with `upsertCanvas` (+ `syncListItems`/`addReminder`/`addBookmark`), implemented in `MockSlackActions` (deterministic ids) and `LiveSlackActions` (via the `apiCall` escape hatch, `canvases.create`/`edit`). `buildCanvasMarkdown()` renders today's triage + commitments + focus as a calm Markdown command center (derived facts only — no RTS text); the `updateCanvas(ctx)` use-case creates-then-edits-in-place (id persisted in a new `persistence/surfaces.ts`, **id only**), wired to an App Home *Update my Canvas* button and auto-refreshed from the morning-digest cron.
- **Workflow Builder custom steps** — manifest `functions` block (4 steps) + `function_executed` bot event; `registerWorkflowSteps(app, deps)` (`platform/slack/inbound/workflow-steps.ts`) registers `summarize_missed` · `draft_reply` · `block_focus` · `add_commitment`, each composing an existing use-case behind `safely(...)` → `complete({outputs})`/`fail`.
- **Slack Lists sync** — `syncCommitmentsToList(ctx)` maps the live Ledger to `ListItem[]` (structurally free of `sourceText`) and upserts a native List (id persisted); App Home *Sync commitments to a List* button + the `add_commitment` step.
- **Reminders / bookmarks / richer Block Kit** — a *Remind me* button on every ledger row (`addReminder`, an hour before due), a Canvas channel-bookmark use-case, and a native-surfaces section on App Home.
**Quality:** **142 tests** passing (up from 108) across 26 files — new suites for the extended live/mock Slack adapters (`apiCall` contract), the canvas Markdown builder (incl. an explicit "never leaks RTS text" assertion), the surfaces use-cases (spy-container composition + no-`sourceText` invariant), the id-only surface store, the `LlmPort`/container, and the new App Home + workflow-step handlers · typecheck clean · build clean · `npm run demo` extended to **14 scenes** (Canvas create→edit, the 4 workflow steps, Lists sync + reminder + bookmark). The Stage-A refactor changed only import paths + signatures — no assertion logic — proving it preserved behavior.
**Open seams:** the v2.0 live `canvases.*` / `slackLists.*` / `reminders.add` / `bookmarks.add` calls are **contract-tested only** (mocked `WebClient`) and unverified against a real workspace — same posture as live RTS; the exact Slack Lists API shape (`slackLists.create`/`items.create`) is a best-effort guess. "Add a commitment" tracks via a native reminder rather than a manual-commitment store (the Ledger is still rebuilt live from RTS). Canvas/list/surface handles are file-backed (Neon swap still deferred to v2.4). Intent routing still keyword-only.
**Next:** Phase 5 / v2.2 — Real MCP outbound (Calendar/Notion/Linear/GitHub via `@modelcontextprotocol/sdk`).

### v1.8.0 — 2026-07-01 — Monolith refactor (layered Part-IV tree · ports/adapters · dependency rule)
**Built:** a behavior-preserving restructure of the flat `src/` tree into the professional Part-IV modular-monolith layout — **no feature change, full test parity** (108 tests stayed green throughout, `npm run demo` unchanged at 11 scenes).
- **Layered tree:** `agent/` → `application/` (orchestrator + TempoContext); `rts/` → `platform/slack/rts/`; `slack/` (write-actions) → `platform/slack/webapi/`; `blocks/` → `platform/slack/blockkit/`; `agent/llm.ts` → `platform/ai/`; `mcp/` → `platform/mcp/`; `db/` → `platform/persistence/`; `a11y/` → `accessibility/`; `app.ts`/`dev.ts` → `main/`. All ~40 source files moved via `git mv` (history preserved); ~90 relative imports across `src/`, `api/`, `scripts/` rewritten; `package.json` dev/start paths updated. The dependency direction is now `inbound (main) → application → modules → ports`, with `platform/*` implementing the ports.
- **Ports extracted:** the port interfaces now live in `src/ports/` (`rts.ts` ← old `rts/types.ts`, `slack.ts` ← old `slack/types.ts`, `mcp.ts` ← interfaces split out of the MCP adapter), with an `index.ts` barrel. Adapters import the ports and implement them.
- **Dependency rule enforced:** domain `modules/` no longer import `platform/` for their outbound needs — they import only `ports/`. `focus.ts` (the one module that used runtime adapters) is now fully dependency-inverted: it receives its `McpClients` + `SlackActionsClient` by injection, and the application layer (`orchestrator`) wires the concrete adapters via the platform factories (which resolve mock/live from config). `modules.test.ts` injects mocks the same way.
**Quality:** 108 tests passing across 21 files (unchanged) · typecheck clean · build clean · demo unchanged. The only test edits were mechanical: import-path updates + repointing `api/cron/morning-digest.test.ts`'s `vi.mock()` targets to the new module paths. No test logic or assertion changed — the proof the refactor preserved behavior.
**Open seams (deliberate deferrals, tracked in Next up):** the LLM is still reached as the `structured`/`text` free-functions in `platform/ai` rather than a fully-injected `LlmPort` (the per-call `mock()` oracle already gives testability); no threaded DI container (the platform `get*` factories serve as the mock/live composition seam); domain modules remain single files rather than the `domain.ts`/`service.ts`/`ports.ts` triplet Part IV sketches; `config.ts` kept at `src/config.ts` (not `config/`) to avoid churn on the most-imported module. All pre-existing runtime seams (live RTS/Claude field mapping unverified; file-backed stores; keyword routing) are unchanged.
**Next:** Phase 4 / v2.0 — Native Surfaces (Canvas, Workflow Builder steps, Slack Lists), plus finishing the hexagonal inversion above.

### v1.5.0 — 2026-07-01 — Hardening (rate-limit backoff · RTS pagination + caching · error/empty states · privacy-safe metrics · a11y audit · secrets · CI)
**Built:** the production-hardening layer for the live path, with the mock path (and every invariant) untouched.
- **Rate-limit backoff** — a new `src/shared/webClientOptions.ts` (exponential backoff + jitter, `rejectRateLimitedCalls: false` so 429s reach the retry machinery and `Retry-After` is honored) is now the single `WebClient` config used by `LiveRtsClient`, `LiveSlackActions`, and both Bolt clients (`clientOptions`).
- **RTS pagination + per-session cache** — `LiveRtsClient.search` follows `response_metadata.next_cursor` up to a 5-page cap and dedupes users; a new request-scoped `CachingRtsClient` decorator (+ `src/shared/cache.ts`'s `Memo`) wraps the resolved client in `buildContext`, so the repeated RTS hits a single `respond()` makes (module + decode/draft lookups) collapse to one call. In-memory, per-turn, discarded — never persisted.
- **Error/empty states** — a shared `safely()` guard wraps the previously-unwrapped surfaces (`/tempo`, `app_mention`, `app_home_opened`, and every RTS/AI-touching action) so a thrown Slack/AI error becomes a calm "nothing was changed" card instead of a dead button; `publishHome` publishes a fallback Home view on failure. New `emptyStateBlocks(intent)` renders a warm "you're all caught up ✨" card (wired into triage/commitments/catchup when there's genuinely nothing) instead of an empty section list.
- **Privacy-safe metrics** — a new counts-only `src/db/metrics.ts` (mirrors `db/prefs.ts`, weekly roll) tracks messages triaged / obligations surfaced / focus-minutes protected / items recovered; incremented from the orchestrator (user-initiated `respond` only — passive Home refreshes pass `record: false`) and from snooze/mark-done. Surfaced as a "Your week with Tempo" block in App Home. Integers + timestamps only; never RTS content.
- **Accessibility audit** — `readingLevel: "plain"` is now live (was a stored-but-unused switch, like `readAloud` before v0.4): new `plainify()` breaks em-dash asides and `;`-joined lists into short one-idea sentences while preserving every number, unit, hyphenated word, and parenthetical; wired through `respond()`. Added the "Accessibility" section to the README.
- **Secrets hardening** — `assertSecretsHardened()` throws at startup when in a live/prod posture (`http` receiver, or live RTS/Slack-actions) with the insecure default / placeholder / <32-char encryption key; called from `createApp`/`createExpressApp`. The dev default stays usable only in fully-mocked local/test runs.
- **CI** — new `.github/workflows/ci.yml` (Node 20): `npm ci` → typecheck → test → build → the zero-credential `demo` as an e2e smoke test.
**Quality:** 108 tests passing (up from 80) across 21 files — new suites for the retry policy, the request cache + `CachingRtsClient` call-count, live RTS cursor pagination (mocked `WebClient`), the metrics store (accumulate + weekly roll), empty/error/metrics blocks, the `safely()` guard, `assertSecretsHardened` across postures, and `plainify` · typecheck clean · build clean · `npm run demo` extended with an 11th scene (cache dedup, empty state, weekly impact, plain-vs-standard reading level).
**Open seams:** RTS cursor pagination is defensive but unverified against live (same posture as the rest of `live.ts`); the per-session cache caches rejected promises too (fine — request-scoped, and a failed `respond` fails wholesale anyway); metrics/prefs/snoozes/commitments/tokens stores still assume a writable local filesystem (Vercel read-only FS → Neon swap deferred to Phase 6/v2.4); intent routing still keyword-only. Live RTS/Claude field mapping still unverified against a real workspace.
**Next:** Phase 3 / v1.8 — the behavior-preserving monolith refactor to the Part-IV architecture.

### v0.4.0 — 2026-07-01 — Read-aloud audio (TTS) + first-run onboarding
**Built:** a new `TtsClient` port (`a11y/tts/{types,mock,live,index}.ts`) following the same mock/live double-gate pattern as `rts/` and `slack/` — mock synthesizes a real, deterministic, valid (silent) WAV file with no I/O; live calls OpenAI's `tts-1` speech endpoint over the global `fetch` (no new npm dependency), gated by `TEMPO_TTS` / auto-detected from `OPENAI_API_KEY`, same convention as `TEMPO_AI`. `app.ts`'s new best-effort `maybeSendReadAloud()` checks the user's stored `readAloud` preference, synthesizes the response's existing speech script, and DMs the resulting audio file (`files.uploadV2`, new `files:write` bot scope) — wired into every surface that produces a `TempoResponse`: the Assistant pane, `/tempo`, `app_mention`, and "Show the rest". `UserPrefs.readAloud` is no longer a dead switch.
Also built first-run onboarding: a new `modules/onboarding.ts` (`isFirstRun()` / `welcomeMessage()`) and `blocks/index.ts`'s `onboardingBlocks()` banner. A brand-new user's first App Home open now shows a five-module explainer + privacy promise above the live dashboard, with a "Got it — let's go" button (`complete_onboarding`) that persists a new `UserPrefs.onboardedAt` field and immediately republishes the Home view without the banner; the Assistant pane's `threadStarted` greeting now reads the same first-run flag to give new users the fuller explainer and returning users today's shorter greeting. `app_home_opened`'s fetch-and-publish logic was factored into a shared `publishHome()` helper to avoid duplicating it between the two call sites.
**Quality:** 80 tests passing (up from 65) across 13 files, including a new `a11y/tts/tts.test.ts` (deterministic mock WAV bytes + a mocked-`fetch` contract test for the live adapter, mirroring `slack/actions.test.ts`'s mocked-`WebClient` pattern), onboarding coverage in `modules.test.ts`/`blocks.test.ts`/`app.actions.test.ts` (banner shown/hidden, tap persists + republishes), and read-aloud delivery coverage in `app.actions.test.ts` (audio DMed when the pref is on, never synthesized when it's off) · typecheck clean · build clean · `npm run demo` extended with a 9th scene (synthesize a real response's speech script into audio) and a 10th (a brand-new user's onboarding banner, tap, and first-run flag flipping).
**Open seams:** live TTS (OpenAI `tts-1`) is unverified against a real call — only contract-tested via a mocked `fetch`, the same level of coverage `LiveRtsClient` had before `scripts/verify-live-rts.ts` existed; no equivalent verify script was added for TTS. Onboarding is App-Home-led; there's no separate onboarding surface beyond the Home banner + the Assistant greeting tweak. Intent routing still keyword-only; insecure default encryption key unchanged; file-backed stores still assume a writable local filesystem (deferred to v2.4 per earlier entries).
**Next:** deploy + seed + judging access + 3-min video + architecture diagram + write-up — the rest of the v1.0 "Hackathon Winner" submission checklist.

### v0.3.0 — 2026-07-01 — Live App Home dashboard + a11y settings modal + "show the rest"
**Built:** App Home (`app_home_opened`) now publishes a live dashboard — real triage + commitments, recomputed and suppression/renegotiation-aware on every open, via the same `respond()` path the Assistant pane and `/tempo` use; a `⚙️ Settings` button opens a real `views.open` modal (verbosity, reading level, max items, default focus length, read-aloud) that saves to `db/prefs.ts` on submit (`app.view("settings_modal", ...)`); `db/prefs.ts` extended with `readingLevel`/`readAloud`/`maxItems`; a `resolveA11yPrefs()` helper in `a11y/index.ts` merges stored prefs over the existing defaults. These prefs are now actually consumed, not just stored: triage caps to the user's `maxItems` (was hardcoded to 3) and exposes a real "Show the rest" button (new `orchestrator.triageAll()` + `show_rest` action handler) instead of a text-only hint nobody could act on; focus block duration falls back to the user's `focusDefaultMins` when not stated in the request; response text is condensed for "brief" verbosity.
**Also fixed:** ephemeral confirmations and drafted messages (`nudge`/`renegotiate`/`draft_reply`/`draft_deliverable`) now fall back to DMing the user when there's no channel in context — needed because App Home button clicks carry no `channel`, only a `view` container, so without this fallback every Home-tab button silently did nothing visible after its store write. A pluralization bug ("1 things need you") surfaced now that `maxItems` can be set to 1; fixed.
**Quality:** 65 tests passing (up from 47) across 14 files, including settings-modal submission/pre-fill tests, App-Home-without-a-channel DM-fallback tests, and orchestrator-level prefs-wiring tests · typecheck clean · build clean · `npm run demo` extended with an 8th scene showing the dashboard reflect Scene 7's snooze/renegotiate state, plus a settings save/read round-trip.
**Open seams:** read-aloud is now a real, savable preference but still produces no audio — `toSpeech()` is text-only; wiring it to TTS is the next concrete step. No onboarding flow. Deploy/seed/judging/video/write-up still outstanding. Intent routing still keyword-only; insecure default encryption key unchanged; file-backed stores still assume a writable local filesystem (Vercel limitation, deferred to v2.4 per last entry).
**Next:** read-aloud audio + onboarding, then deploy/submission logistics.

### v0.2.0 — 2026-07-01 — Foundational slice: persistence + Slack-native focus + real interactivity
**Built:** file-backed `prefs`/`commitments`/`snoozes` stores (mirroring `db/tokens.ts`'s pattern, `TEMPO_STORE_DIR`-overridable for tests/demo); a new `src/slack/` mock/live port (mirrors `src/rts/`) wiring Focus Guardian to real `dnd.setSnooze` + `users.profile.set` + a best-effort scheduled post-focus digest, gated by a new independent `TEMPO_SLACK_ACTIONS=mock|live` flag; real `snooze`/`mark_done`/`nudge`/`renegotiate` button handlers in `app.ts` (previously all four were stubs that just acked with a canned string — no persistence, no Slack effect); `scripts/verify-live-rts.ts` (zero-cred-safe, exits 0 with a clear skip message when no token is configured); multi-user cron with per-user failure isolation (`listInstalledUsers()` + sequential try/catch, falls back to the single demo user when the token store is empty); `@slack/web-api` promoted from a transitive to a direct dependency.
**Also fixed:** `ledgerBlocks()` was passing the opaque commitment `id` hash as the button value for `draft_deliverable`/`renegotiate`/`nudge` instead of the `permalink` the handlers actually look up by — `draft_deliverable` was silently drafting from an empty string. The "owed to you" row's `Open` button was also a dead plain button instead of a real URL link. Both fixed; locked in with a render test.
**Quality:** 47 tests passing (up from 16) across 11 files, including the first Block Kit render tests and the first mocked-`@slack/web-api` contract tests · typecheck clean · build clean · `npm run demo` extended with a 7th scene exercising the button-driven layer directly (not reachable through the free-text orchestrator path) · added `vitest.config.ts` (`fileParallelism: false`) after observing the new stores' shared `TEMPO_STORE_DIR` env var can race across concurrently-scheduled test files and write into the project root.
**Open seams:** file-backed stores (tokens + the three new ones) assume a writable local filesystem — Vercel's deployment filesystem is read-only, so persistence only really works for local Socket Mode dev today; this is inherited from `db/tokens.ts`, not new, and is explicitly deferred to the Neon Postgres swap in Phase 6/v2.4. Live RTS field mapping still unverified against a real workspace (the verify script now exists to do that, but hasn't been run against live Slack). `use_rewrite`/`keep_draft` remain unpersisted (no entity to persist against yet). App Home is still static; no settings modal; no TTS audio; no onboarding flow; intent routing still keyword-only; insecure default encryption key unchanged.
**Next:** the remaining Phase 1/v1.0 items above.

### v0.1.0 — 2026-07-01 — Foundation
**Built:** 5 modules (triage / ledger / decoder / focus / reentry) on mock RTS + mock AI; Bolt Assistant pane, `/tempo`, App Home, button actions; OAuth user-token flow; AES-256-GCM encrypted token store; Vercel cron morning digest; seed-workspace script; zero-credential console demo.
**Quality:** 16 tests passing · typecheck clean · build clean.
**Open seams:** live RTS field mapping unverified; MCP outbound is mock; file-based token store; `prefs`/`commitments`/`snoozes` stores not yet created; cron single-user; intent routing keyword-only; insecure default encryption key.
**Next:** v1.0.0.
