# 🎬 RECORDING SCRIPT — read this on your phone

**Target: 3 minutes.** Judges are not required to watch past 3:00.
**Bold text = what you SAY.** `Code blocks = what you TYPE or PASTE.`

Before you hit record:
- ✅ DND + status are **already clear** — the moon icon will appear fresh. Don't touch anything.
- Have 3 tabs open: **VS Code** · **GitHub repo** · **Slack (devpostslack)**
- Terminal open in the repo folder.

---

# PART 1 — The problem (0:00–0:30)

*(Start on your slide / face cam. This is the most important 30 seconds of the video.)*

> **"Slack redesigned itself around reducing cognitive load. That's the right diagnosis — but a client can only quiet the noise it can *see*.**
>
> **It can't know which of your 400 unreads is a promise *you* made three weeks ago. It can't know that 'no rush 🙂' is actually furious. And it can't know that someone is quietly blocked on you, in a thread that never @-mentioned you.**
>
> **The important part of Slack isn't in the messages. It's *in between* them.**
>
> **Neurotypical native speakers rebuild that layer automatically, for free. For the fifteen to twenty percent of knowledge workers who are neurodivergent — and for anyone working in a second language — it's exhausting, or invisible.**
>
> **Tempo gives that layer back. Not a productivity bot. Assistive technology."**

---

# PART 2 — The codebase (0:30–1:15)

*(Screen-share VS Code.)*

> **"It's a hexagonal TypeScript monolith on Bolt. Domain modules depend only on ports — they never import an SDK. So every external system has a mock and a live adapter, and the entire product runs with zero credentials."**

### ▶️ TYPE THIS:

```
npm run demo
```

> **"That's the whole product — triage, commitments, tone, focus, re-entry — running end to end with no API keys at all. Twenty-six deterministic scenes. It's also our CI smoke test."**

### ▶️ TYPE THIS:

```
npm run preflight
```

> **"Typecheck, four hundred and eleven tests, build, the demo, and a manifest drift check. One command."**

*(While it runs — open `src/modules/converse/safety.ts`.)*

> **"And this is the file I most want to show you.**
>
> **Tempo is built for people under strain — burnt out, overwhelmed, neurodivergent. Given that audience, someone will eventually type something that isn't about Slack at all.**
>
> **In that moment, a generative model is exactly the wrong thing to have in the loop. It can improvise. It can minimise. It can hallucinate a helpline that doesn't exist.**
>
> **So this check runs *before* any model call, and returns fixed words written by a human. And our test spies on the LLM port and *fails if it's touched at all*. Not 'prompted carefully' — never reached."**

*(Scroll to `converse.test.ts` — show `expect(llm.structured).not.toHaveBeenCalled()`.)*

> **"That's the line. The one place in the whole product where we deliberately take the AI *out* of the loop."**

---

# PART 3 — GitHub (1:15–1:30)

*(Switch to the GitHub tab. Scroll the README.)*

> **"Everything's open. Four hundred and eleven tests, CI on every commit, least-privilege scopes enforced by a drift test — the manifest can't ask for a scope the code doesn't use.**
>
> **And the architecture diagram shows the two things I'm proudest of: the consent layer, and that crisis check sitting in front of the model."**

*(Open `docs/architecture.png` briefly — point at the red CRISIS CHECK box.)*

---

# PART 4 — LIVE IN SLACK (1:30–2:40)

*(Switch to Slack. Open the **Tempo** DM under "Agents & apps".)*

## 4a. It's an agent, not a command bar

### ▶️ TYPE IN SLACK:

```
hi
```

**EXPECT:** a real conversational reply + a button.

> **"It talks. Everything that isn't a command still gets a real answer — and always an offer of something it can actually do."**

## 4b. 💜 THE MOMENT — lead with this

### ▶️ TYPE IN SLACK:

```
I'm completely overwhelmed this week
```

**EXPECT:** an acknowledgement, no gushing, no diagnosis — and a concrete offer to make the day smaller.

> **"It doesn't diagnose. It doesn't tell me it'll be fine. It offers the one thing it can actually do — cut the firehose down to what matters, or protect the time. The empathy is backed by an action, because reducing cognitive load *is* the product."**

## 4c. Triage — the invisible blocker

### ▶️ TYPE IN SLACK:

```
what needs me today?
```

**EXPECT (~10–15 seconds — talk over it):** *"I scanned **30** messages"* → about **5** cards.

> *(While it thinks:)* **"That's a live Real-Time Search call on my *own* user token, then reasoning over the result. Nothing it reads is ever stored."**

👉 **Now find the card labelled `Someone's blocked on you`** and point at it:

> **"This one. Nobody @-mentioned me. It's buried in a channel. Slack's own unread badge *cannot* find this — there's no notification to show. That's the thing that lives in between the messages."**

👉 **Then point at the incident it *didn't* raise** (or any FYI):

> **"And it skipped the production incident — scary words, but engineering already closed it. That's the discrimination a keyword matcher can't do."**

## 4d. The Translator — read their tone, then check your own

*(This is the accessibility core. Two directions, back to back — their words, then mine.)*

### ▶️ TYPE IN SLACK:

```
decode: "No rush 🙂 whenever you get a chance I guess. Not like the handoff is waiting on it."
```

**EXPECT:** literal meaning vs. **probably means**, the tone, the *real* urgency, what they expect back — and a confidence score with a caveat.

> **"Literally: no rush. Actually: they're frustrated, the handoff is waiting, and this is due today. That gap — between what the words say and what they mean — is invisible to Slack, and it's exhausting to compute all day if implicit subtext doesn't come free to you.**
>
> **And look at the last line: seventy-two percent, and it *says* it can be wrong. It doesn't pretend to read minds."**

👉 **Now the other direction — my own words:**

### ▶️ TYPE IN SLACK:

```
draft: "No."
```

**EXPECT:** *"Likely to feel curt or dismissive"* + the risks + a warmer rewrite + a plain-language version.

> **"Same module, pointed the other way. Before I send, I get to see how I'll land — and the rewrite is a suggestion I accept or reject. Tempo never sends anything for me.**
>
> **That's the whole thesis in two messages: understand what *they* meant, and control what *I* mean."**

## 4e. Focus Guardian — 🌙 THE MONEY SHOT

⚠️ **Make sure your avatar / member list is visible in frame before you type.**

### ▶️ TYPE IN SLACK:

```
block 2 hours
```

**EXPECT:** a "Focus time protected" card — **and the 🌙 moon icon + 🎯 status appear next to your name.**

🎥 **HOLD THE SHOT. Do not cut away.**

> **"That's my *real* Do-Not-Disturb, flipped with my own token. The agent stopped talking and did something."**

⚠️ **BE HONEST HERE — say this out loud:**

> **"The calendar line on that card is a *mock* MCP server — I didn't stand up third-party OAuth I couldn't test end to end. The DND and the status are real. The inbound MCP server is real, and you can call it yourself."**

*(This costs you nothing and it's the difference between a judge trusting the rest of the demo and not.)*

## 4f. Consent

*(Click **App Home** → ⚙️ **Settings**.)*

Show the two pickers: **"Only watch these channels"** and **"Never track these people."**

> **"Tempo already reads only what *I* can see — it runs on my token. This makes it read only where I *allow*. And it holds on every surface: the app, the scheduled digest, and the MCP server all go through the same code path. An external agent can't read around it."**

---

# PART 5 — MCP + Privacy (2:40–2:55)

*(Back to terminal.)*

> **"And Tempo isn't just an MCP *client*. It *is* an MCP server. Anyone can call one — few expose one."**

### ▶️ PASTE THIS (token is already in your env — see the cheat sheet):

```
curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
  -H "Authorization: Bearer $TEMPO_MCP_SERVER_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**EXPECT:** `tempo_triage`, `tempo_commitments`, `tempo_decode`, `tempo_focus`.

> **"Four tools, live, behind a default-deny gate. Judges can run that exact command."**

*(Open https://tempo-slack.vercel.app/privacy in the browser.)*

> **"And every single field it stores is listed right here. Export it. Delete it — immediately and totally. It never stores what it reads."**

---

# PART 6 — Close (2:55–3:00)

> **"Tempo is assistive technology for attention and working memory. Built for the people Slack quietly disables — and it never sends anything, and never stores what it reads. Thank you."**

---
---

# 📋 CHEAT SHEET — just the commands

## Terminal (run in the repo folder)

**First, once per terminal session** — paste your MCP token in (I gave it to you in chat; it's also in your Vercel env). It is deliberately **not** committed to this public repo:

```
export TEMPO_MCP_SERVER_TOKEN=<paste-your-token>
```

```
npm run demo
```

```
npm run preflight
```

```
curl -sX POST https://tempo-slack.vercel.app/api/mcp/server \
  -H "Authorization: Bearer $TEMPO_MCP_SERVER_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Slack — type these in the Tempo DM, in this order

```
hi
```

```
I'm completely overwhelmed this week
```

```
what needs me today?
```

```
decode: "No rush 🙂 whenever you get a chance I guess. Not like the handoff is waiting on it."
```

```
draft: "No."
```

```
block 2 hours
```

## Files to show on screen

```
src/modules/converse/safety.ts
src/modules/converse/converse.test.ts
docs/architecture.png
```

## Browser tabs

```
https://github.com/Harjotraith04/Tempo_Slack
https://tempo-slack.vercel.app/privacy
```

## ⚠️ BETWEEN EVERY TAKE

```
npm run reset:demo
```

*(Clears DND + status so the moon icon appears **fresh** next time. If you skip this, the money shot won't land — you'll already be snoozed.)*

---

# 🚨 If something goes wrong

| Problem | Do this |
|---|---|
| Triage takes >15s | **Talk over it.** It's a real RTS + LLM round-trip. Say what it's doing. |
| Moon icon doesn't appear | You still have DND on from a previous take → `npm run reset:demo` |
| "I hit a snag" | Upstream hiccup. **Nothing was changed** — that's the guarantee. Just retry. |
| Triage shows different items than you expected | **Fine — don't read from a script.** Just find the `Someone's blocked on you` card and point at *that*. The LLM ranks live; the point is that a blocker with no @-mention surfaced at all. |

---

# ✅ Say these — all verified true

- All three required technologies, **live**: RTS · Slack AI/Agent surfaces · **MCP (and Tempo *is* the server)**
- **Real** DND + status writes, on the user's own token
- **411 tests**, 55 files; whole product runs credential-free
- **Never stores what it reads** — enforced at the schema level and by tests
- **The crisis path never calls the LLM** — the test fails if it's touched

# ❌ Never say

- That the **calendar / task MCP integration is live.** It's mock-backed. The card literally prints `(mock)` and a judge will see it. **Own it — being caught is much worse than admitting it.**
