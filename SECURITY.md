# Tempo — Security

## Posture

- **Token encryption at rest.** OAuth user tokens are encrypted with **AES-256-GCM** (random 12-byte IV per
  write, GCM auth tag) before persistence — [`src/platform/persistence/crypto.ts`](src/platform/persistence/crypto.ts).
  The key is derived (SHA-256) from `TEMPO_ENCRYPTION_KEY`.
- **Secrets hardening gate.** `assertSecretsHardened()`
  ([`src/config/modes.ts`](src/config/modes.ts)) throws at startup in any live/prod posture (http receiver,
  live RTS, or live Slack actions) if the encryption key is the dev default, a placeholder, or shorter than 32
  chars. The insecure default is usable **only** in fully-mocked local/test runs.
- **Least-privilege OAuth scopes.** Every requested scope is declared and justified in
  [`src/platform/slack/oauth/scopes.ts`](src/platform/slack/oauth/scopes.ts); a test asserts `manifest.json`
  never requests more (no over-request). RTS uses a **user** token — scoped to exactly what the user can
  already see, needing no `action_token`.
- **OAuth CSRF protection.** Both the Slack-install and web "Sign in with Slack" flows mint a random,
  single-use `state`, stored in a short-lived `HttpOnly` cookie and verified constant-time at the callback —
  [`src/shared/session.ts`](src/shared/session.ts).
- **Web sessions.** The web companion authenticates the browser with a stateless, expiring, HMAC-signed
  `HttpOnly; Secure; SameSite=Lax` cookie (no server session store, no new secret) — same module.
- **Never persist RTS content (Invariant 1).** RTS results are used in-memory and discarded; enforced
  structurally (no message-content column/field) and by tests. See [`PRIVACY.md`](PRIVACY.md).
- **Human-in-the-loop.** Tempo never sends a message or changes anything without an explicit user tap.
- **Transport.** All Slack Web API + RTS calls go over TLS via `@slack/web-api` with rate-limit backoff
  ([`src/shared/webClientOptions.ts`](src/shared/webClientOptions.ts)).

## Zero-credential verification

`npm test`, `npm run typecheck`, and `npm run demo` run fully mocked, with no credentials — so the security
posture (encryption, scope declarations, session/CSRF logic, the never-store-RTS invariant) is exercised in
CI without any real workspace.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to **security@\<your-domain\>** (replace before listing).
We aim to acknowledge within 3 business days. Please do not open public issues for security reports.
