# Tempo — Enterprise & Global (v3.8)

How Tempo scales to an enterprise org and to a global, multilingual workforce, and what's built vs. what an
enterprise deployment configures. (Descriptive — review with your security/compliance team before rollout.)

## Multilingual (built)

Tempo is internationalized (`src/accessibility/i18n/`): a dependency-free message catalog + `t()` lookup, the
user's `locale` preference selecting the table, English as the fallback. Today the **read-aloud speech script**
(the accessibility core) ships in English + Spanish, settable from the web companion's Settings (**Language**).
Dynamic AI-generated content (item reasons, drafts) localizes on the live path by prompting the LLM in the
user's locale; the same catalog seam extends to every card label. This is the non-native-speaker promise —
calm, plain-language help in your own language.

## Accessibility certification (built)

Accessibility is a machine-checked gate, not a hope: `auditResponse` (`src/accessibility/audit.ts`) asserts
every response has a non-empty, **markdown-free** read-aloud script, that every interactive button carries a
screen-reader label, and that plain reading level really is one-idea-per-sentence. `audit.test.ts` runs it
across **every** response type (triage / commitments / catch-up / focus / decode / help / team / handoff) —
so a regression that makes any surface inaccessible fails the build.

## Data residency (built seam)

Persistence is fully abstracted behind the `Store` port with a config seam (`TEMPO_STORE=file|postgres` +
`DATABASE_URL`). To keep data in a region, point `DATABASE_URL` at a Neon (or other Postgres) instance in that
region — no code change. **RTS content is never stored anywhere** (Invariant 1), so the residency surface is
only tokens (encrypted) + prefs + counts-only derived facts — the minimum. See [`PRIVACY.md`](PRIVACY.md).

## Enterprise Grid install (configuration)

- **Org-wide install** — set `org_deploy_enabled` in `manifest.json` and install at the org level; Tempo runs
  per-user with each user's own token (RTS needs no `action_token`), so the trust model is unchanged at scale.
- **Least-privilege scopes** — every scope is justified and drift-tested (`src/platform/slack/oauth/scopes.ts`).
- **Secrets hardening** — `assertSecretsHardened()` blocks weak encryption keys in any live posture.
- **Audit posture** — Tempo persists only **counts + timestamps** (privacy-safe metrics); admin/audit hooks
  should record events at the same counts-only grain, never message content, honoring Invariant 1.

## Owner / enterprise-integration items (not code)

These require your org's systems and are configured/integrated by the deploying enterprise, not shipped here:

- **SCIM** provisioning/deprovisioning (wire Tempo's token store to your IdP's lifecycle).
- **DLP** integration (Tempo stores no message content, so the DLP surface is minimal — confirm with your team).
- **Admin console / audit-log export** into your SIEM.
- **Data-residency contracts** + the regional `DATABASE_URL`.
- **Accessibility certification sign-off** (e.g. VPAT) — the automated audit above is the evidence base.
- **True cross-language RTS** at scale + additional locale catalogs beyond en/es.
