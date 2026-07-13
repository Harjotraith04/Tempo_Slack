# DEMO — the recording runbook

Everything you need on camera, in order. Nothing here is aspirational: every command below has been run against the live deployment today.

**Before you start:**

```bash
npm run reset:demo     # clears DND + focus status, so the moon icon appears FRESH on camera
```

Run it again between every take. The Focus Guardian genuinely flips your Do-Not-Disturb, so once you've demoed it, it stays on — and the moon icon *appearing* is the money shot.

---

## The one-minute version (if you only show three things)

1. **"I'm completely overwhelmed this week"** → a real, human reply that offers to make the day smaller. *This is the Agent-for-Good moment.*
2. **"what needs me today?"** → 30 messages become 5. Point at the **BLOCKER nobody @-mentioned him on**.
3. **"block 2 hours"** → **the moon icon appears.** The agent stops talking and does something.

---

## Commands to run on screen

| Command | What it proves | Takes |
|---|---|---|
| `npm run preflight` | Typecheck · **411 tests** · build · demo · manifest sanity — all green, one command | ~40s |
| `npm run demo` | The **entire product** runs with **zero credentials** — 26 deterministic scenes, mock adapters behind every port. This is the hexagonal architecture paying rent. | ~5s |
| `npm test` | 411 tests, 55 files | ~7s |
| `npm run reset:demo` | Clears DND + status between takes | ~1s |

**The one a judge can run themselves** — Tempo *is* an MCP server:

```bash
curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
  -H "Authorization: Bearer $TEMPO_MCP_SERVER_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

→ `tempo_triage`, `tempo_commitments`, `tempo_decode`, `tempo_focus`. Drop the token and it's a 401 — default-deny, no ambient authority.

Swap `tools/list` for a real call to show it *working*:

```bash
-d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tempo_triage","arguments":{}}}'
```

---

## The Slack beats, in order

Type these verbatim into the Tempo DM.

### 1. It's an agent, not a command bar *(20s)*

> **`hi`**

Answers like a person, offers to look at your day. (Before today this returned a static menu — every regex miss fell through to a feature list.)

### 2. The Agent-for-Good moment *(30s — lead with this)*

> **`I'm completely overwhelmed this week`**

Tempo acknowledges it plainly, doesn't gush, doesn't diagnose — and offers **something it can actually do**: cut the firehose to the few things that matter, or protect the time.

**Say the line that matters:** *for anything that reads as a genuine crisis, the LLM is never called at all.* A generative model can improvise, minimise, or hallucinate a helpline that doesn't exist — so `safety.ts` intercepts before any model call and returns fixed, human-written words pointing to real help. The test spies on the LLM port and fails if it's touched.

Show `src/modules/converse/safety.ts` on screen if you're doing a code walkthrough. It's the strongest thing in the build.

### 3. Triage — the implicit blocker *(40s)*

> **`what needs me today?`**

30 messages → 5 that need you. Point at:
- **BLOCKER · Priya in #demo-eng** — *"blocked on the Atlas migration"*. **She never @-mentioned him.** Slack's own unread badge cannot find this. RTS + reasoning can.
- **ACT · Dana** — a customer threatening to churn.
- Note it **skipped** the production incident: scary words, but eng already closed it. That's the discrimination a keyword matcher can't do.

### 4. Tone Decoder *(25s)*

> **`what does this mean: "no rush 🙂"`**

Literal vs. implied, real urgency, what they actually expect. For a non-native speaker or an autistic user, this layer is invisible and exhausting to compute manually.

### 5. Focus Guardian — the payoff *(25s)*

> **`block 2 hours`**

**Hold the shot on the 🌙 moon icon appearing** next to your name, and the 🎯 status. This is *your own token* flipping your *real* DND. Don't cut away.

> Be honest on camera: the **calendar line is a mock** MCP server. The DND and status are real. Say it — it costs nothing and it's the difference between a judge trusting the rest of the demo and not.

### 6. Consent *(20s)*

App Home → ⚙️ **Settings** → **"Only watch these channels"** → pick `#demo-eng` → re-run *"what needs me today?"* → results now come **only** from there.

**The line:** *Tempo already reads only what you can see — this makes it read only where you allow.* And it holds on **every** surface: the app, the scheduled digest, and the MCP server all go through the same chokepoint.

### 7. Privacy *(20s)*

**https://tempo-slack.vercel.app/privacy**

Every field it stores, listed — including your consent scope. Export as JSON. Delete everything, immediately and totally. **It never stores what it reads.**

---

## The claims you can make, and the one you can't

**True, verified, say freely:**
- All three required technologies, live: **RTS**, **Slack AI/Agent surfaces**, and **MCP — and Tempo *is* the server**, not just a client
- Real DND + status writes on the user's own token
- 411 tests, 55 files; the whole product runs credential-free
- Never persists what it reads — enforced at the schema level and by tests
- The crisis path bypasses the LLM entirely

**Do not claim:** that the **calendar/task MCP integration is live.** It is mock-backed. The focus card says `(mock)` on its face, and a judge will see it. Owning it is free; being caught is not.

---

## If something goes wrong on camera

- **Triage is slow (>15s):** it's a real RTS + LLM round-trip over 30 messages. Talk over it — say what it's doing.
- **The moon icon doesn't appear:** you already have DND on from a previous take. `npm run reset:demo`.
- **Anything returns "I hit a snag":** an upstream hiccup. Nothing was changed — that's the guarantee. Retry.
