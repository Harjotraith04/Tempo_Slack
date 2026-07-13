/**
 * Idempotent schema for the Postgres store. Applied once per connection on the
 * first query (see connect.ts). Every table holds ONLY derived facts, install
 * metadata, prefs, or opaque Slack ids.
 *
 * INVARIANT 1 — never persist RTS content: `tempo_commitments` deliberately has
 * NO `source_text` / message-content column; the only text columns are the
 * user-facing derived summary (`what`), the counterparty name, and the user's
 * own renegotiation note. All timestamps are Unix **seconds** (bigint).
 */

export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS tempo_tokens (
     user_id text PRIMARY KEY,
     team_id text NOT NULL,
     enc text NOT NULL,
     installed_at bigint NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS tempo_prefs (
     user_id text PRIMARY KEY,
     verbosity text,
     reading_level text,
     read_aloud boolean,
     max_items integer,
     focus_default_mins integer,
     dnd_default_mins integer,
     last_active_ts bigint,
     onboarded_at bigint,
     updated_at bigint NOT NULL
   )`,
  // NOTE: no source_text / message-content column, by design (Invariant 1).
  `CREATE TABLE IF NOT EXISTS tempo_commitments (
     user_id text NOT NULL,
     permalink text NOT NULL,
     id text NOT NULL,
     direction text NOT NULL,
     counterparty text NOT NULL,
     what text NOT NULL,
     due_text text,
     due_ts bigint,
     status text NOT NULL,
     pinned_at bigint NOT NULL,
     updated_at bigint NOT NULL,
     renegotiation_note text,
     last_nudged_at bigint,
     PRIMARY KEY (user_id, permalink)
   )`,
  `CREATE TABLE IF NOT EXISTS tempo_snoozes (
     user_id text NOT NULL,
     permalink text NOT NULL,
     kind text NOT NULL,
     until_ts bigint,
     created_at bigint NOT NULL,
     PRIMARY KEY (user_id, permalink)
   )`,
  `CREATE TABLE IF NOT EXISTS tempo_metrics (
     user_id text PRIMARY KEY,
     messages_triaged integer NOT NULL,
     obligations_surfaced integer NOT NULL,
     focus_minutes_protected integer NOT NULL,
     items_recovered integer NOT NULL,
     week_start_ts bigint NOT NULL,
     updated_at bigint NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS tempo_surfaces (
     user_id text PRIMARY KEY,
     canvas_id text,
     list_id text,
     updated_at bigint NOT NULL
   )`,
  // Learned per-sender engagement (v2.8) — counts only, keyed by a sender id.
  // No message-content column, by design (Invariant 1).
  `CREATE TABLE IF NOT EXISTS tempo_sender_signals (
     user_id text NOT NULL,
     author_id text NOT NULL,
     engaged integer NOT NULL,
     deprioritized integer NOT NULL,
     updated_at bigint NOT NULL,
     PRIMARY KEY (user_id, author_id)
   )`,

  // ── Additive column migrations ────────────────────────────────────────────
  // `CREATE TABLE IF NOT EXISTS` is a no-op on an existing table, so columns
  // added after a table first shipped need their own statement. ADD COLUMN IF
  // NOT EXISTS is idempotent, which matters because MIGRATIONS runs on EVERY
  // cold start (connect.ts) — a non-idempotent statement here would 500 the
  // whole app on the second boot.
  //
  // Consent scope (v4.3): which channels Tempo may ground in, and who it must
  // ignore. Both nullable — NULL/empty means "everywhere", the behaviour that
  // predates this column.
  `ALTER TABLE tempo_prefs ADD COLUMN IF NOT EXISTS watched_channels text[]`,
  `ALTER TABLE tempo_prefs ADD COLUMN IF NOT EXISTS muted_users text[]`,
];
