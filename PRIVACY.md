# Tempo — Privacy Policy

_Last updated: 2026-07-02. This is a truthful description of how Tempo handles data, written to match
the code. It is **not legal advice** — have counsel review it before a real Marketplace listing._

Tempo is a personal executive-function assistant inside Slack. It is a **personal agent on your own data** —
not surveillance of your coworkers. Two principles govern everything:

1. **Tempo never stores what it reads.** It grounds its reasoning **live** in the Slack Real-Time Search (RTS)
   API using **your own** user token, uses the results in-memory to answer you, and discards them. No message,
   file, channel, or thread content is ever written to disk or a database.
2. **Tempo never acts without your tap.** It proposes; you approve. Nothing is sent or changed on your behalf
   without an explicit action from you.

## What Tempo stores

Only the minimum needed to function, tied to your Slack user id:

| Data | Why | Sensitivity |
|---|---|---|
| Your OAuth **user token** | To run RTS and your own write-actions as you | **Encrypted at rest** (AES-256-GCM) |
| **Preferences** | Verbosity, reading level, max items, read-aloud, focus/DND defaults | Settings only |
| **Pinned commitments** | The promises you chose to track — *derived facts only* (what / counterparty / due / permalink) | No message text |
| **Snoozes / done** | Which items you dismissed — a permalink + a status | No message text |
| **Usage metrics** | Counts only (messages triaged, obligations surfaced, focus minutes, items recovered) | Integers + timestamps |
| **Learned signals** | Per-sender engagement **counts** (keyed by Slack user id) that tune your ranking | Integers only |
| **Surface ids** | The opaque ids of your Tempo Canvas / List | Handles, not content |

## What Tempo never stores

Any message, file, channel name, or thread content returned by RTS. Conversation transcripts. Anything you
didn't explicitly approve. No PII-bearing RTS payloads, ever. This is enforced structurally (the commitment
type omits the raw text; no store has a message-content column) and by tests.

## Consent — you choose where Tempo may look

Tempo reads only what **you** can already see: Real-Time Search runs on your own user token, so it can never reach a channel you aren't in. **Consent scoping** lets you narrow that further, from Slack (App Home → ⚙️ Settings):

| Control | Default | Effect |
|---|---|---|
| **Only watch these channels** | *blank* — everywhere you can see | Pick channels and Tempo grounds **only** there. It reads nowhere else. |
| **Never track these people** | *nobody* | Tempo ignores them wherever they post — messages and sender roster alike. |

Two things worth stating plainly, because they are the parts that are easy to get wrong:

- **It holds on every surface.** The Slack app, the scheduled morning digest, and the inbound MCP server all resolve your scope through one code path. An external agent calling Tempo over MCP gets the same restrictions you set in Slack — it cannot read around them.
- **You can always see and change it.** Your current scope is listed on your [privacy dashboard](https://tempo-slack.vercel.app/privacy) alongside everything else Tempo stores, and clearing the picker restores "everywhere you can see".

## Your rights (access, export, delete)

The **web companion** (`/privacy`) shows you *exactly* what's stored about you, lets you **download all of it
as JSON** (`/api/data/export`), and lets you **delete everything** with one tap (`/api/data/delete`) — which
erases your token, preferences, commitments, snoozes, metrics, signals, and surface ids, and signs you out.
A test (`user-data.governance.test.ts`) guarantees the export and delete cover **every** stored category.

## Permissions (least privilege)

Tempo requests only the scopes it actually uses; each is justified in
[`src/platform/slack/oauth/scopes.ts`](src/platform/slack/oauth/scopes.ts), and a test asserts the app
manifest never requests more. RTS runs on **your** user token, scoped to exactly what you can already see.

## Contact

Data questions / requests: open an issue at [https://github.com/Harjotraith04/Tempo_Slack/issues](https://github.com/Harjotraith04/Tempo_Slack/issues).

You do not need to ask us to exercise any of the rights above — every one of them is a button. Export and
delete live in the web dashboard (`/privacy`), and delete is immediate and total.
