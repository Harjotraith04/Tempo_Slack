/**
 * Postgres implementations of the Store repositories. Each takes the `Db` seam
 * (not the driver), so all SQL + row-mapping is unit-testable against a fake Db.
 * The behavior rules (metrics roll, commitment override merge, suppression
 * activeness) come from ../logic.ts, shared verbatim with the file adapter.
 *
 * COMPLIANCE: no query writes RTS message content; the commitments table has no
 * source_text column (see migrations.ts).
 */

import type { CommitmentDirection, CommitmentStatus } from "../../../modules/ledger.js";
import type {
  CommitmentsRepo,
  InstalledUser,
  MetricsRepo,
  PinnedCommitment,
  PrefsRepo,
  SenderSignal,
  SignalsRepo,
  SnoozesRepo,
  Suppression,
  SurfaceHandles,
  SurfacesRepo,
  TokensRepo,
  UserMetrics,
  UserPrefs,
} from "../../../ports/store.js";
import { encrypt, decrypt } from "../crypto.js";
import {
  addCounts,
  addSignal,
  blankSignal,
  currentWeek,
  isActiveSuppression,
  mergePinned,
  nowSec,
} from "../logic.js";
import type { Db } from "./session.js";

type Row = Record<string, unknown>;

const num = (v: unknown): number => Number(v);
const optNum = (v: unknown): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);
const optStr = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);
const optBool = (v: unknown): boolean | undefined =>
  v === null || v === undefined ? undefined : Boolean(v);
/** `text[]` comes back as a JS array. An empty array means the same as NULL here
 * (no allowlist / nobody muted), so normalise both to undefined. */
const optArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.length ? v.map(String) : undefined;

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapPrefs(r: Row): UserPrefs {
  return {
    userId: String(r.user_id),
    verbosity: optStr(r.verbosity) as UserPrefs["verbosity"],
    readingLevel: optStr(r.reading_level) as UserPrefs["readingLevel"],
    readAloud: optBool(r.read_aloud),
    maxItems: optNum(r.max_items),
    focusDefaultMins: optNum(r.focus_default_mins),
    dndDefaultMins: optNum(r.dnd_default_mins),
    watchedChannels: optArr(r.watched_channels),
    mutedUsers: optArr(r.muted_users),
    lastActiveTs: optNum(r.last_active_ts),
    onboardedAt: optNum(r.onboarded_at),
    updatedAt: num(r.updated_at),
  };
}

function mapCommitment(r: Row): PinnedCommitment {
  return {
    id: String(r.id),
    direction: String(r.direction) as CommitmentDirection,
    counterparty: String(r.counterparty),
    what: String(r.what),
    dueText: optStr(r.due_text),
    dueTs: optNum(r.due_ts),
    status: String(r.status) as CommitmentStatus,
    permalink: String(r.permalink),
    userId: String(r.user_id),
    pinnedAt: num(r.pinned_at),
    updatedAt: num(r.updated_at),
    renegotiationNote: optStr(r.renegotiation_note),
    lastNudgedAt: optNum(r.last_nudged_at),
  };
}

function mapSuppression(r: Row): Suppression {
  return {
    userId: String(r.user_id),
    permalink: String(r.permalink),
    kind: String(r.kind) as Suppression["kind"],
    until: optNum(r.until_ts),
    createdAt: num(r.created_at),
  };
}

function mapMetrics(r: Row): UserMetrics {
  return {
    userId: String(r.user_id),
    messagesTriaged: num(r.messages_triaged),
    obligationsSurfaced: num(r.obligations_surfaced),
    focusMinutesProtected: num(r.focus_minutes_protected),
    itemsRecovered: num(r.items_recovered),
    weekStartTs: num(r.week_start_ts),
    updatedAt: num(r.updated_at),
  };
}

function mapSurface(r: Row): SurfaceHandles {
  return {
    userId: String(r.user_id),
    canvasId: optStr(r.canvas_id),
    listId: optStr(r.list_id),
    updatedAt: num(r.updated_at),
  };
}

function mapSignal(r: Row): SenderSignal {
  return {
    userId: String(r.user_id),
    authorId: String(r.author_id),
    engaged: num(r.engaged),
    deprioritized: num(r.deprioritized),
    updatedAt: num(r.updated_at),
  };
}

const first = <T>(rows: T[]): T | undefined => rows[0];

// ── Repositories ──────────────────────────────────────────────────────────────

export function buildPgTokensRepo(db: Db): TokensRepo {
  return {
    async save(userId, teamId, userToken) {
      await db.query(
        `INSERT INTO tempo_tokens (user_id, team_id, enc, installed_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET team_id = $2, enc = $3, installed_at = $4`,
        [userId, teamId, encrypt(userToken), nowSec()],
      );
    },
    async get(userId) {
      const row = first(await db.query<Row>(`SELECT enc FROM tempo_tokens WHERE user_id = $1`, [userId]));
      return row ? decrypt(String(row.enc)) : undefined;
    },
    async list(): Promise<InstalledUser[]> {
      const rows = await db.query<Row>(`SELECT user_id, team_id, installed_at FROM tempo_tokens`);
      return rows.map((r) => ({
        userId: String(r.user_id),
        teamId: String(r.team_id),
        installedAt: num(r.installed_at),
      }));
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_tokens WHERE user_id = $1`, [userId]);
    },
  };
}

export function buildPgPrefsRepo(db: Db): PrefsRepo {
  const get = async (userId: string): Promise<UserPrefs | undefined> => {
    const row = first(await db.query<Row>(`SELECT * FROM tempo_prefs WHERE user_id = $1`, [userId]));
    return row ? mapPrefs(row) : undefined;
  };
  return {
    get,
    async save(userId, patch) {
      const existing = await get(userId);
      const next: UserPrefs = { ...existing, ...patch, userId, updatedAt: nowSec() };
      await db.query(
        `INSERT INTO tempo_prefs
           (user_id, verbosity, reading_level, read_aloud, max_items,
            focus_default_mins, dnd_default_mins, watched_channels, muted_users,
            last_active_ts, onboarded_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (user_id) DO UPDATE SET
           verbosity = $2, reading_level = $3, read_aloud = $4, max_items = $5,
           focus_default_mins = $6, dnd_default_mins = $7, watched_channels = $8,
           muted_users = $9, last_active_ts = $10, onboarded_at = $11, updated_at = $12`,
        [
          userId,
          next.verbosity ?? null,
          next.readingLevel ?? null,
          next.readAloud ?? null,
          next.maxItems ?? null,
          next.focusDefaultMins ?? null,
          next.dndDefaultMins ?? null,
          next.watchedChannels ?? null,
          next.mutedUsers ?? null,
          next.lastActiveTs ?? null,
          next.onboardedAt ?? null,
          next.updatedAt,
        ],
      );
      return next;
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_prefs WHERE user_id = $1`, [userId]);
    },
  };
}

export function buildPgCommitmentsRepo(db: Db): CommitmentsRepo {
  const upsert = (row: PinnedCommitment) =>
    db.query(
      `INSERT INTO tempo_commitments
         (user_id, permalink, id, direction, counterparty, what, due_text, due_ts,
          status, pinned_at, updated_at, renegotiation_note, last_nudged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id, permalink) DO UPDATE SET
         id = $3, direction = $4, counterparty = $5, what = $6, due_text = $7, due_ts = $8,
         status = $9, pinned_at = $10, updated_at = $11, renegotiation_note = $12, last_nudged_at = $13`,
      [
        row.userId,
        row.permalink,
        row.id,
        row.direction,
        row.counterparty,
        row.what,
        row.dueText ?? null,
        row.dueTs ?? null,
        row.status,
        row.pinnedAt,
        row.updatedAt,
        row.renegotiationNote ?? null,
        row.lastNudgedAt ?? null,
      ],
    );

  const getByPermalink = async (userId: string, permalink: string) => {
    const row = first(
      await db.query<Row>(`SELECT * FROM tempo_commitments WHERE user_id = $1 AND permalink = $2`, [
        userId,
        permalink,
      ]),
    );
    return row ? mapCommitment(row) : undefined;
  };

  const patch = async (
    userId: string,
    permalink: string,
    fn: (existing: PinnedCommitment) => PinnedCommitment,
  ): Promise<PinnedCommitment | undefined> => {
    const existing = await getByPermalink(userId, permalink);
    if (!existing) return undefined;
    const next = fn(existing);
    await upsert(next);
    return next;
  };

  return {
    async sync(userId, fresh) {
      if (fresh.length === 0) return [];
      const permalinks = fresh.map((c) => c.permalink);
      const rows = await db.query<Row>(
        `SELECT * FROM tempo_commitments WHERE user_id = $1 AND permalink = ANY($2)`,
        [userId, permalinks],
      );
      const existingByPermalink = new Map(rows.map((r) => [String(r.permalink), mapCommitment(r)]));
      const now = nowSec();
      const result = [];
      for (const c of fresh) {
        const { row, overrideStatus } = mergePinned(userId, c, existingByPermalink.get(c.permalink), now);
        await upsert(row);
        result.push(overrideStatus ? { ...c, status: overrideStatus } : c);
      }
      return result;
    },
    getByPermalink,
    async listForUser(userId) {
      const rows = await db.query<Row>(`SELECT * FROM tempo_commitments WHERE user_id = $1`, [userId]);
      return rows.map(mapCommitment);
    },
    async markRenegotiating(userId, permalink, note) {
      return patch(userId, permalink, (existing) => ({
        ...existing,
        status: "renegotiating",
        renegotiationNote: note ?? existing.renegotiationNote,
        updatedAt: nowSec(),
      }));
    },
    async markDone(userId, permalink) {
      return patch(userId, permalink, (existing) => ({ ...existing, status: "done", updatedAt: nowSec() }));
    },
    async markNudged(userId, permalink) {
      return patch(userId, permalink, (existing) => ({ ...existing, lastNudgedAt: nowSec() }));
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_commitments WHERE user_id = $1`, [userId]);
    },
  };
}

export function buildPgSnoozesRepo(db: Db): SnoozesRepo {
  const put = async (rec: Suppression): Promise<Suppression> => {
    await db.query(
      `INSERT INTO tempo_snoozes (user_id, permalink, kind, until_ts, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, permalink) DO UPDATE SET kind = $3, until_ts = $4, created_at = $5`,
      [rec.userId, rec.permalink, rec.kind, rec.until ?? null, rec.createdAt],
    );
    return rec;
  };
  return {
    async snooze(userId, permalink, untilTs) {
      return put({ userId, permalink, kind: "snooze", until: untilTs, createdAt: nowSec() });
    },
    async markDone(userId, permalink) {
      return put({ userId, permalink, kind: "done", createdAt: nowSec() });
    },
    async isSuppressed(userId, permalink, nowTs) {
      const row = first(
        await db.query<Row>(`SELECT * FROM tempo_snoozes WHERE user_id = $1 AND permalink = $2`, [
          userId,
          permalink,
        ]),
      );
      return row ? isActiveSuppression(mapSuppression(row), nowTs) : false;
    },
    async active(userId, nowTs) {
      const rows = await db.query<Row>(`SELECT * FROM tempo_snoozes WHERE user_id = $1`, [userId]);
      return rows.map(mapSuppression).filter((rec) => isActiveSuppression(rec, nowTs));
    },
    async listForUser(userId) {
      const rows = await db.query<Row>(`SELECT * FROM tempo_snoozes WHERE user_id = $1`, [userId]);
      return rows.map(mapSuppression);
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_snoozes WHERE user_id = $1`, [userId]);
    },
  };
}

export function buildPgMetricsRepo(db: Db): MetricsRepo {
  const read = async (userId: string): Promise<UserMetrics | undefined> => {
    const row = first(await db.query<Row>(`SELECT * FROM tempo_metrics WHERE user_id = $1`, [userId]));
    return row ? mapMetrics(row) : undefined;
  };
  return {
    async record(userId, patch, nowTs = nowSec()) {
      const cur = currentWeek(userId, nowTs, await read(userId));
      const next = addCounts(cur, patch, nowTs);
      await db.query(
        `INSERT INTO tempo_metrics
           (user_id, messages_triaged, obligations_surfaced, focus_minutes_protected,
            items_recovered, week_start_ts, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (user_id) DO UPDATE SET
           messages_triaged = $2, obligations_surfaced = $3, focus_minutes_protected = $4,
           items_recovered = $5, week_start_ts = $6, updated_at = $7`,
        [
          userId,
          next.messagesTriaged,
          next.obligationsSurfaced,
          next.focusMinutesProtected,
          next.itemsRecovered,
          next.weekStartTs,
          next.updatedAt,
        ],
      );
      return next;
    },
    async get(userId, nowTs = nowSec()) {
      const rec = await read(userId);
      if (!rec) return undefined;
      return currentWeek(userId, nowTs, rec);
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_metrics WHERE user_id = $1`, [userId]);
    },
  };
}

export function buildPgSurfacesRepo(db: Db): SurfacesRepo {
  const getHandles = async (userId: string): Promise<SurfaceHandles | undefined> => {
    const row = first(await db.query<Row>(`SELECT * FROM tempo_surfaces WHERE user_id = $1`, [userId]));
    return row ? mapSurface(row) : undefined;
  };
  return {
    getHandles,
    async getCanvasId(userId) {
      return (await getHandles(userId))?.canvasId;
    },
    async getListId(userId) {
      return (await getHandles(userId))?.listId;
    },
    async save(userId, patch) {
      const existing = await getHandles(userId);
      const next: SurfaceHandles = { ...existing, ...patch, userId, updatedAt: nowSec() };
      await db.query(
        `INSERT INTO tempo_surfaces (user_id, canvas_id, list_id, updated_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET canvas_id = $2, list_id = $3, updated_at = $4`,
        [userId, next.canvasId ?? null, next.listId ?? null, next.updatedAt],
      );
      return next;
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_surfaces WHERE user_id = $1`, [userId]);
    },
  };
}

export function buildPgSignalsRepo(db: Db): SignalsRepo {
  const read = async (userId: string, authorId: string): Promise<SenderSignal | undefined> => {
    const row = first(
      await db.query<Row>(`SELECT * FROM tempo_sender_signals WHERE user_id = $1 AND author_id = $2`, [
        userId,
        authorId,
      ]),
    );
    return row ? mapSignal(row) : undefined;
  };
  return {
    async record(userId, authorId, kind, nowTs = nowSec()) {
      const cur = (await read(userId, authorId)) ?? blankSignal(userId, authorId, nowTs);
      const next = addSignal(cur, kind, nowTs);
      await db.query(
        `INSERT INTO tempo_sender_signals (user_id, author_id, engaged, deprioritized, updated_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, author_id) DO UPDATE SET
           engaged = $3, deprioritized = $4, updated_at = $5`,
        [userId, authorId, next.engaged, next.deprioritized, next.updatedAt],
      );
      return next;
    },
    async forUser(userId) {
      const rows = await db.query<Row>(`SELECT * FROM tempo_sender_signals WHERE user_id = $1`, [userId]);
      return rows.map(mapSignal);
    },
    async deleteForUser(userId) {
      await db.query(`DELETE FROM tempo_sender_signals WHERE user_id = $1`, [userId]);
    },
  };
}
