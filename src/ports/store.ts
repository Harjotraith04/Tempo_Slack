/**
 * Persistence port — the repository interfaces the application layer depends on,
 * plus the data shapes they read/write. Two adapters implement this `Store`:
 * `platform/persistence/file` (JSON files, the default) and
 * `platform/persistence/pg` (Neon Postgres). `getStore()` resolves which by
 * config, exactly like `getRtsClient` / `getMcpClients` pick mock vs live.
 *
 * Every method is async so a real (network) database fits behind the same
 * interface as the file adapter — the file adapter just resolves immediately.
 *
 * COMPLIANCE (Invariant 1): nothing here carries RTS message content. The only
 * commitment fields persisted are DERIVED facts (what/counterparty/due/permalink)
 * — `PinnedCommitment` structurally omits `sourceText`, and the Postgres schema
 * has no message-content column.
 */

import type { Commitment } from "../modules/ledger.js";

// ── Data shapes (owned here so both adapters share one definition) ────────────

export interface UserPrefs {
  userId: string;
  verbosity?: "brief" | "standard";
  readingLevel?: "plain" | "standard";
  readAloud?: boolean;
  maxItems?: number;
  focusDefaultMins?: number;
  dndDefaultMins?: number;
  /** BCP-47-ish locale ("en", "es", "es-MX") — drives multilingual surfaces. */
  locale?: string;
  /**
   * Consent scope: the channel ids Tempo may ground in. Empty/absent = every
   * channel the user can already see (the pre-existing behaviour — an allowlist
   * that defaulted to *closed* would hand every current user an empty triage).
   */
  watchedChannels?: string[];
  /** Author ids Tempo must ignore wherever they post. */
  mutedUsers?: string[];
  lastActiveTs?: number;
  /** Set once the user has completed (or dismissed) first-run onboarding. */
  onboardedAt?: number;
  updatedAt: number;
}

/** A commitment the user has taken a local action on (renegotiating/done),
 * layered over the live-derived Ledger. Never carries `sourceText`. */
export interface PinnedCommitment extends Omit<Commitment, "sourceText"> {
  userId: string;
  pinnedAt: number;
  updatedAt: number;
  renegotiationNote?: string;
  lastNudgedAt?: number;
}

export type SuppressionKind = "snooze" | "done";

export interface Suppression {
  userId: string;
  permalink: string;
  kind: SuppressionKind;
  /** Unix ts the suppression expires; undefined = indefinite ("done"). */
  until?: number;
  createdAt: number;
}

export interface UserMetrics {
  userId: string;
  messagesTriaged: number;
  obligationsSurfaced: number;
  focusMinutesProtected: number;
  itemsRecovered: number;
  /** Start of the current rolling week; counts reset when it ages past 7 days. */
  weekStartTs: number;
  updatedAt: number;
}

/** The count fields a caller may increment. */
export type MetricCounts = Pick<
  UserMetrics,
  "messagesTriaged" | "obligationsSurfaced" | "focusMinutesProtected" | "itemsRecovered"
>;

export interface SurfaceHandles {
  userId: string;
  canvasId?: string;
  listId?: string;
  updatedAt: number;
}

/** Install metadata — never includes the decrypted token. */
export interface InstalledUser {
  userId: string;
  teamId: string;
  installedAt: number;
}

// ── Repository ports ──────────────────────────────────────────────────────────

export interface TokensRepo {
  save(userId: string, teamId: string, userToken: string): Promise<void>;
  get(userId: string): Promise<string | undefined>;
  /** Metadata only — never decrypts token material. */
  list(): Promise<InstalledUser[]>;
  /** Right-to-erasure: forget this user's token entirely. */
  deleteForUser(userId: string): Promise<void>;
}

export interface PrefsRepo {
  get(userId: string): Promise<UserPrefs | undefined>;
  save(
    userId: string,
    patch: Partial<Omit<UserPrefs, "userId" | "updatedAt">>,
  ): Promise<UserPrefs>;
  deleteForUser(userId: string): Promise<void>;
}

export interface CommitmentsRepo {
  /** Upsert live-derived commitments, preserving any local override
   * (renegotiating/done), and return `fresh` with that override applied. */
  sync(userId: string, fresh: Commitment[]): Promise<Commitment[]>;
  getByPermalink(userId: string, permalink: string): Promise<PinnedCommitment | undefined>;
  /** Every pinned commitment for the user (for the privacy dashboard / export). */
  listForUser(userId: string): Promise<PinnedCommitment[]>;
  markRenegotiating(userId: string, permalink: string, note?: string): Promise<PinnedCommitment | undefined>;
  markDone(userId: string, permalink: string): Promise<PinnedCommitment | undefined>;
  markNudged(userId: string, permalink: string): Promise<PinnedCommitment | undefined>;
  deleteForUser(userId: string): Promise<void>;
}

export interface SnoozesRepo {
  snooze(userId: string, permalink: string, untilTs: number): Promise<Suppression>;
  markDone(userId: string, permalink: string): Promise<Suppression>;
  isSuppressed(userId: string, permalink: string, nowTs: number): Promise<boolean>;
  active(userId: string, nowTs: number): Promise<Suppression[]>;
  /** Every suppression for the user (active or expired) — for export. */
  listForUser(userId: string): Promise<Suppression[]>;
  deleteForUser(userId: string): Promise<void>;
}

export interface MetricsRepo {
  record(userId: string, patch: Partial<MetricCounts>, nowTs?: number): Promise<UserMetrics>;
  get(userId: string, nowTs?: number): Promise<UserMetrics | undefined>;
  deleteForUser(userId: string): Promise<void>;
}

export interface SurfacesRepo {
  getHandles(userId: string): Promise<SurfaceHandles | undefined>;
  getCanvasId(userId: string): Promise<string | undefined>;
  getListId(userId: string): Promise<string | undefined>;
  save(
    userId: string,
    patch: Partial<Pick<SurfaceHandles, "canvasId" | "listId">>,
  ): Promise<SurfaceHandles>;
  deleteForUser(userId: string): Promise<void>;
}

/** A learned per-sender engagement signal (v2.8 Intelligence). COUNTS ONLY,
 * keyed by the sender's stable Slack id — never any message content. */
export type SignalKind = "engaged" | "deprioritized";

export interface SenderSignal {
  userId: string;
  /** The sender's stable Slack user id (an identifier, not message content). */
  authorId: string;
  /** Times the user acted on this sender's items (drafted a reply, marked done). */
  engaged: number;
  /** Times the user pushed this sender's items away (snoozed). */
  deprioritized: number;
  updatedAt: number;
}

export interface SignalsRepo {
  record(userId: string, authorId: string, kind: SignalKind, nowTs?: number): Promise<SenderSignal>;
  /** Every sender signal for the user — to build the ranking weight map. */
  forUser(userId: string): Promise<SenderSignal[]>;
  deleteForUser(userId: string): Promise<void>;
}

/** The bundle of repositories the application layer resolves via the container. */
export interface Store {
  tokens: TokensRepo;
  prefs: PrefsRepo;
  commitments: CommitmentsRepo;
  snoozes: SnoozesRepo;
  metrics: MetricsRepo;
  surfaces: SurfacesRepo;
  signals: SignalsRepo;
}

/**
 * Everything Tempo has stored for one user — the shape the web companion's
 * privacy dashboard renders and the data-export endpoint returns.
 *
 * COMPLIANCE: `installedTeam` is token METADATA only (never the decrypted
 * token); `commitments` are `PinnedCommitment`s (structurally no `sourceText`);
 * `metrics` are counts only. There is no RTS message content anywhere here.
 */
export interface UserDataExport {
  userId: string;
  installedTeam?: { teamId: string; installedAt: number };
  prefs?: UserPrefs;
  metrics?: UserMetrics;
  surfaces?: SurfaceHandles;
  commitments: PinnedCommitment[];
  snoozes: Suppression[];
  /** Learned per-sender engagement signals — counts only, no message content. */
  senderSignals: SenderSignal[];
  exportedAt: number;
}
