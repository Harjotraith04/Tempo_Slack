# Tempo — Slack Marketplace Listing Package

Everything needed for the listing, in one place. Owner-only logistics are marked **[owner]**.

## Track
**Slack Agent for Good** (accessibility + cognitive health), simultaneously eligible for Best Technological
Implementation, Most Innovative, and Best UX.

## Short description (≤ 140 chars)
> Your working memory for Slack — triages the firehose, remembers your commitments, decodes tone, protects
> your focus. Never stores what it reads.

## Long description
Tempo is an **executive-function co-pilot** for Slack — assistive technology for the way humans actually work.
It triages everything since you were last active down to *what truly needs you*, remembers the promises you
made and were made to you, decodes the implicit tone and subtext of messages, protects your deep-work time,
and gently catches you up after time away. It is grounded **live** in the Slack Real-Time Search API, acts
through **MCP**, and lives natively in Slack's **AI / Assistant** surfaces. It never stores what it reads and
never acts without your tap.

## Explicit impact statement
Slack is a flat firehose: every message looks equally urgent, commitments evaporate into threads, tone is
invisible, and returning from time off is a panic. For the ~15–20% of knowledge workers who are neurodivergent
(ADHD, autism, anxiety, dyslexia), for non-native English speakers, and for anyone at risk of burnout, this
isn't an annoyance — it's genuinely *disabling*. Tempo reframes a Slack agent as **assistive technology for
human attention and memory**: calm, ranked, plain-language, read-aloud-capable, and privacy-preserving. The
TAM extends far beyond the target community to everyone drowning in unreads.

## Features
- **Triage — "The Surface":** ACT / BLOCKER / FYI / NOISE, incl. *implicit* blockers nobody @-mentioned you on.
- **Commitment Ledger — "The Memory":** promises made & owed, with due dates, at-risk/overdue flags, and
  **auto-close** when you deliver + **dropped-ball** nudges before things slip.
- **Tone Decoder — "The Translator":** literal vs. implied meaning, tone, real urgency, and a softer rewrite
  of *your* draft — with an honest confidence + caveat.
- **Focus Guardian — "The Shield":** a real calendar block + a task via MCP, plus Slack DND + status.
- **Re-entry — "The Bridge":** a plain-language brief of what changed while you were away.
- **Learns from you (privately):** tunes ranking + tone confidence from your own taps — counts only, never
  content, and fully exportable/erasable.
- **Native surfaces:** Tempo Canvas, Workflow Builder steps, Slack Lists, reminders, bookmarks, read-aloud.
- **Web companion:** a privacy dashboard, data export/delete, and settings.

## Uses all three required technologies
- **Slack RTS API** (essential — the product is impossible without it): `assistant.search.context` via the
  user's token — [`src/platform/slack/rts/live.ts`](../src/platform/slack/rts/live.ts).
- **MCP:** outbound Calendar/Notion/Linear/GitHub via `@modelcontextprotocol/sdk` —
  [`src/platform/mcp/`](../src/platform/mcp/).
- **Slack AI / Assistant:** the Assistant pane, App Home, `/tempo`, Workflow steps —
  [`src/main/app.ts`](../src/main/app.ts).

## Privacy & security
- Privacy policy: [`PRIVACY.md`](../PRIVACY.md) (and the live web page at `/privacy-policy`).
- Security posture + disclosure: [`SECURITY.md`](../SECURITY.md).
- Least-privilege scopes, each justified: [`src/platform/slack/oauth/scopes.ts`](../src/platform/slack/oauth/scopes.ts).

## Screenshots / video **[owner]**
Capture from `npm run demo` (20 scenes) and the running web companion:
1. Triage — "3 things actually need you today."
2. Tone decode — Marco's "no rush 🙂" → what it really means → a softened reply.
3. Commitment Ledger — the forgotten promise, drafted.
4. Focus Guardian — DND + status + a calendar block + a task, via MCP.
5. Re-entry — "what changed while you were out."
6. Web privacy dashboard — "exactly what Tempo stores about you," with export + delete.
~3-min video beats are in [`MASTER_PLAN.md`](../MASTER_PLAN.md) §1.6.

## Submission checklist
- [x] Text description + explicit impact statement (above).
- [x] Architecture (Part III of `MASTER_PLAN.md`) + privacy/security docs.
- [x] Least-privilege scopes, reconciled + drift-tested.
- [ ] **[owner]** Slack developer sandbox URL with access granted to `slackhack@salesforce.com` **and**
      `testing@devpost.com`.
- [ ] **[owner]** ~3-minute demo video with working-product footage; real screenshots.
- [ ] **[owner]** Deploy the web companion + set its OAuth redirect URL in the manifest; publish the
      privacy-policy URL.
- [ ] **[owner]** 10+ active workspaces (Marketplace requirement); Slack's own security/functional review.
- [ ] **[owner]** Replace the `privacy@` / `security@` contact placeholders with real addresses.
