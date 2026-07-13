# SUBMIT — the last 8 hours

**Deadline: Mon Jul 13 2026, 5:00 PM PT.** This is the only tracker that is current.
`docs/STATUS.md`, `GO_LIVE.md`, and `LEDGER.md` "Next up" all describe a pre-deployment world and are stale — ignore them.

**Where we actually are:** the code is finished (311 tests, typecheck clean, no stubs), the root app is deployed and live, and RTS + Slack AI + Postgres + OpenAI are all genuinely running. What remains is (a) three production switches that are off, (b) the frontend that was never deployed, and (c) the submission assets, none of which exist yet.

---

## The judge's-eye problem

A judge opens the sandbox and does five things. Here is what happens today:

| They do | They get |
|---|---|
| DM the agent "what needs me today?" | ~~Triage computed as if they were "Sam Rivera"~~ **FIXED** — commit `445788a` |
| Open the agent pane | ~~No greeting — the welcome handler never fires~~ **FIXED** — commit `445788a` |
| Click "Block 2 hours" | ❌ Card says *"Do-Not-Disturb on until 4:32 PM"*. **Their DND does not change.** |
| Curl the MCP endpoint the write-up leads with | ❌ **404** |
| Click the OAuth link in the manifest | ❌ **404** — the web app was never deployed |

Three env vars and one deploy close all of that.

---

## P0 · Submission blockers — OWNER, start now (~3h)

Nothing else scores if these are missing. Stage One judging is pass/fail on them.

- [ ] **Invite the judges** — `slackhack@salesforce.com` + `testing@devpost.com`, role **Member** (not Guest).
      ⚠️ **This silently fails if you skip a step.** A sandbox caps at 8 users and ships 7 placeholder demo
      accounts, which fill every slot. You must deactivate them at **Organization settings → People → Members**
      — one level *above* workspace settings. Removing them from the workspace does nothing; the org-level user
      record still holds the slot. Confirm both judges appear in the member list before you move on.
- [ ] **Record the ≤3-min video** — *after P1 lands*, or you will film the fake DND. Public YouTube.
      Judges spend 5–7 min per project, so the first 60s carries the impact story, not the architecture.
- [ ] **Devpost form** — track ("Slack Agent for Good"), description, **impact statement**, video URL, sandbox
      URL, architecture diagram upload. Copy is already drafted in `docs/devpost-submission.md`; two `⟨…⟩`
      placeholders remain (lines 63, 65).
- [ ] **Confirm Slack Developer Program membership** shows on the account — it's a track requirement.

---

## P1 · Make the demo true — three env vars + one deploy (~40 min)

These are production secret changes, so run them yourself. Everything they switch on is already built and tested.

### 1. Focus Guardian currently lies — turn on live Slack writes

`webapi/mock.ts` returns `{ok: true, nextDndEndTs: …}` **without calling Slack**, and the card renders
"Do-Not-Disturb on until the block ends" anyway. The real adapter (`webapi/live.ts`, `dnd.setSnooze`) is written
and `dnd:write` / `users.profile:write` are already in the manifest.

```bash
vercel env rm TEMPO_SLACK_ACTIONS production --yes
printf 'live' | vercel env add TEMPO_SLACK_ACTIONS production
```

*Then smoke-test it:* DM the app "block 2 hours" and **confirm the DND moon icon actually appears** in Slack.
If Canvas or Lists throw — their API shapes were written against the docs and have never made a real call —
turn them off (`TEMPO_LISTS=off`, `TEMPO_CANVAS=off`). They are not core. DND and status are.

### 2. MCP is 100% dark — and it's a required hackathon technology

`/api/mcp/server` 404s at the `isMcpServerEnabled()` gate. The server is fully built: 4 tools
(`tempo_triage`, `tempo_commitments`, `tempo_decode`, `tempo_focus`) behind a default-deny HMAC auth model.

```bash
printf 'on'          | vercel env add TEMPO_MCP_SERVER production
printf "$(openssl rand -hex 24)" | vercel env add TEMPO_MCP_SERVER_TOKEN production   # save this value
printf 'U0BGXCRL9N0' | vercel env add TEMPO_MCP_SERVER_USER production
```

*Then verify:*
```bash
npm run verify:mcp-server
curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
  -H "Authorization: Bearer <the token>" -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
**Put the endpoint + a scoped token in the Devpost write-up.** A judge scoring *Technological Implementation*
who can call your MCP server by hand is worth more than any paragraph claiming you built one.

### 3. Redeploy + reinstall the app

The manifest changed in commit `445788a` (added `users:read`, `assistant_thread_started`,
`assistant_thread_context_changed`). The new scope and events **only take effect on reinstall.**

```bash
vercel --prod                      # picks up the new env vars
# then: api.slack.com/apps → your app → App Manifest → paste manifest.json → Save → Reinstall
```

### 4. Deploy the web companion — the frontend half of the score

*Design* is 25% of the score and asks literally: *"Is there a balanced blend of frontend and backend?"*
Backend: ~13k lines, hexagonal, 311 tests. Frontend in production: a static HTML page.
The real Next.js app — a **privacy dashboard showing every byte Tempo stores about you**, settings, JSON
export, delete-everything — is built and unshipped, and `manifest.json` already points its OAuth redirect at
the 404.

New Vercel project, same repo:
- **Root Directory = `web`**
- **"Include source files outside of the Root Directory" = ON** (it imports `../src` via `externalDir`)
- Env: `PUBLIC_URL=https://<web>.vercel.app`, `DATABASE_URL`, `TEMPO_ENCRYPTION_KEY`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`

Verify: `curl -o /dev/null -w '%{http_code}' https://tempo-slack-web.vercel.app/privacy` → **200**.

---

## P2 · Cheap points — DONE (commits `ca02f0b`, `94dbb16`)

- [x] **Landing page** (`public/index.html`) — currently a 106-line text shim. Add the architecture diagram,
      the video embed, and the impact story. **One thing left for you: replace `VIDEO_ID` in
      `public/index.html` with the YouTube id once the demo is up.**
- [x] **Architecture diagram** — `docs/architecture.png` is accurate but renders as a wide, pale, low-contrast
      band; at Devpost gallery scale the text is illegible. Re-render dark + narrow.
- [x] **Contact placeholders** — `privacy@your-domain` / `security@your-domain` still sit in `PRIVACY.md:50`,
      `SECURITY.md:35`, `web/app/privacy-policy/page.tsx:69`. An assistive-tech app whose privacy contact is a
      placeholder undercuts its own strongest claim.
- [x] **Stale trackers** — `docs/STATUS.md` and `LEDGER.md:3` still say "nothing is live" / `RTS=mock, AI=mock,
      STORE=file`. A judge browsing the repo reads them as current state.

---

## P3 · Cut lines — deliberately NOT doing

Feature freeze is in effect. **Do not** start any of these:

- Outbound MCP live (`TEMPO_MCP=live`) — the inbound server already proves the MCP box. `/tempo focus` will emit
  a mock calendar link; **say so honestly** in the write-up rather than fixing it under time pressure.
- A new dashboard UI · publishing the a11y SDK to npm · Marketplace submission (wrong track).
- `TEMPO_TEAM`, `TEMPO_ATTENTION_OS` — both off by default. Attention-OS's email/calendar sources are mock-only
  **by design**; frame them as a roadmap direction, never as working integrations.
- `TEMPO_PROACTIVE` is the one judgement call — a genuine differentiator ("it warned me before I drowned"), fully
  built, but off by default. Enable it *only* if P0 and P1 are done and it survives a smoke test.

---

## Definition of done

A judge added to the sandbox can, unaided, reproduce every claim in the write-up:

open Tempo → **it greets them by name** → suggested prompt → **RTS-grounded triage about them, not Sam** →
buttons work → `/tempo commitments` → ledger with drafts → "block 2 hours" → **DND and status actually flip** →
App Home dashboard → web privacy dashboard → and, if they're curious, they can **call the MCP server themselves.**

The video, the diagram, and the text all tell the same story they just lived.

## Scorecard — where the points are

| Criterion (each 25%) | Standing |
|---|---|
| **Technological Implementation** | Strong once MCP is on: all three required techs live, 311 tests, hexagonal architecture, CI. RTS is genuinely battle-tested (the `CORPUS_QUERY=""` and author-hydration findings are real empirical work). |
| **Design** | **The weak axis.** Backend is enormous, production frontend is a static page. P1 §4 + P2 landing page is the entire fix. |
| **Potential Impact** | Strong story (~15–20% of knowledge workers are neurodivergent) — but it only scores if it's in the **first 60 seconds** of the video and in the Devpost impact field. |
| **Quality of the Idea** | Genuinely novel. Not a helpdesk bot. Leave it alone. |
