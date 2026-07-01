import { describe, expect, it } from "vitest";
import type { Commitment } from "../../../modules/ledger.js";
import { buildPgStore } from "./index.js";
import { MIGRATIONS } from "./migrations.js";
import type { Db } from "./session.js";

type Row = Record<string, unknown>;

/** A fake Db that records every (text, params) and returns canned SELECT rows,
 * mirroring how the MCP adapters are tested against a fake McpSession. */
function fakeDb(rowsFor: (text: string, params: unknown[]) => Row[] = () => []) {
  const calls: { text: string; params: unknown[] }[] = [];
  const db: Db = {
    async query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
      calls.push({ text, params });
      return rowsFor(text, params) as T[];
    },
  };
  return { db, calls };
}

const isSelect = (t: string) => /^\s*SELECT/i.test(t);

function mkCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "c_1",
    direction: "i_owe",
    counterparty: "Priya Nair",
    what: "Send the Atlas API spec",
    dueText: "Friday",
    dueTs: 1_700_000_000,
    status: "overdue",
    permalink: "https://northwind.slack.com/archives/C1/p1",
    sourceText: "SECRET RAW MESSAGE — must never be written",
    ...overrides,
  };
}

describe("pg prefs repo", () => {
  it("maps a snake_case row to camelCase UserPrefs", async () => {
    const { db } = fakeDb((t) =>
      isSelect(t)
        ? [{ user_id: "U1", verbosity: "brief", reading_level: "plain", read_aloud: true, max_items: 2, focus_default_mins: 45, dnd_default_mins: null, last_active_ts: null, onboarded_at: null, updated_at: 123 }]
        : [],
    );
    const p = await buildPgStore(db).prefs.get("U1");
    expect(p).toEqual({
      userId: "U1", verbosity: "brief", readingLevel: "plain", readAloud: true,
      maxItems: 2, focusDefaultMins: 45, dndDefaultMins: undefined,
      lastActiveTs: undefined, onboardedAt: undefined, updatedAt: 123,
    });
  });

  it("save merges the patch over the existing row and upserts", async () => {
    const { db, calls } = fakeDb((t) =>
      isSelect(t) ? [{ user_id: "U2", verbosity: "standard", dnd_default_mins: 90, updated_at: 1 }] : [],
    );
    const saved = await buildPgStore(db).prefs.save("U2", { verbosity: "brief" });
    expect(saved.verbosity).toBe("brief");
    expect(saved.dndDefaultMins).toBe(90); // preserved from existing
    const upsert = calls.find((c) => /INSERT INTO tempo_prefs/.test(c.text))!;
    expect(upsert.params[0]).toBe("U2");
  });
});

describe("pg commitments repo", () => {
  it("sync issues a lookup + upsert and NEVER writes sourceText (Invariant 1)", async () => {
    const { db, calls } = fakeDb(() => []); // no existing rows
    const c = mkCommitment();
    const result = await buildPgStore(db).commitments.sync("U1", [c]);

    expect(result[0]?.status).toBe("overdue");
    expect(calls.some((q) => /SELECT \* FROM tempo_commitments/.test(q.text))).toBe(true);
    const upsert = calls.find((q) => /INSERT INTO tempo_commitments/.test(q.text))!;
    expect(upsert).toBeTruthy();
    // The raw message text must appear in NO column of NO write.
    for (const q of calls) {
      expect(q.params).not.toContain(c.sourceText);
    }
    // ...but the derived facts must.
    expect(upsert.params).toContain("Send the Atlas API spec");
    expect(upsert.params).toContain(c.permalink);
  });

  it("preserves a local override (renegotiating) across a live re-sync", async () => {
    const c = mkCommitment({ status: "overdue" });
    const { db } = fakeDb((t) =>
      /SELECT \* FROM tempo_commitments/.test(t)
        ? [{ user_id: "U3", permalink: c.permalink, id: c.id, direction: c.direction, counterparty: c.counterparty, what: c.what, due_text: c.dueText, due_ts: c.dueTs, status: "renegotiating", pinned_at: 1, updated_at: 1, renegotiation_note: "one more week", last_nudged_at: null }]
        : [],
    );
    const result = await buildPgStore(db).commitments.sync("U3", [c]);
    expect(result[0]?.status).toBe("renegotiating");
  });

  it("getByPermalink maps a row to a PinnedCommitment", async () => {
    const { db } = fakeDb((t) =>
      isSelect(t)
        ? [{ user_id: "U4", permalink: "p1", id: "c_9", direction: "owed_to_me", counterparty: "Jordan", what: "pricing", due_text: null, due_ts: null, status: "open", pinned_at: 10, updated_at: 20, renegotiation_note: null, last_nudged_at: null }]
        : [],
    );
    const pinned = await buildPgStore(db).commitments.getByPermalink("U4", "p1");
    expect(pinned).toMatchObject({ userId: "U4", direction: "owed_to_me", what: "pricing", status: "open", pinnedAt: 10 });
    expect((pinned as any).sourceText).toBeUndefined();
  });
});

describe("pg snoozes repo", () => {
  it("snooze writes a row and isSuppressed reads an active 'done'", async () => {
    const { db, calls } = fakeDb((t) =>
      isSelect(t) ? [{ user_id: "U1", permalink: "p", kind: "done", until_ts: null, created_at: 1 }] : [],
    );
    const store = buildPgStore(db);
    await store.snoozes.snooze("U1", "p", 2000);
    expect(calls.some((q) => /INSERT INTO tempo_snoozes/.test(q.text))).toBe(true);
    expect(await store.snoozes.isSuppressed("U1", "p", 999_999)).toBe(true);
  });
});

describe("pg metrics repo", () => {
  it("accumulates onto the existing week", async () => {
    const t = 1_000_000;
    const { db, calls } = fakeDb((q) =>
      isSelect(q)
        ? [{ user_id: "M1", messages_triaged: 10, obligations_surfaced: 0, focus_minutes_protected: 0, items_recovered: 0, week_start_ts: t, updated_at: t }]
        : [],
    );
    const next = await buildPgStore(db).metrics.record("M1", { messagesTriaged: 5 }, t + 100);
    expect(next.messagesTriaged).toBe(15);
    const upsert = calls.find((q) => /INSERT INTO tempo_metrics/.test(q.text))!;
    expect(upsert.params[1]).toBe(15);
  });
});

describe("pg surfaces repo", () => {
  it("reads a canvas id and merges saves", async () => {
    const { db } = fakeDb((t) =>
      isSelect(t) ? [{ user_id: "U1", canvas_id: "F1", list_id: null, updated_at: 1 }] : [],
    );
    expect(await buildPgStore(db).surfaces.getCanvasId("U1")).toBe("F1");
  });
});

describe("schema (Invariant 1: never persist RTS content)", () => {
  it("the commitments table has no message-content column", () => {
    const commitmentsDdl = MIGRATIONS.find((m) => /tempo_commitments/.test(m))!;
    expect(commitmentsDdl).toBeTruthy();
    expect(commitmentsDdl.toLowerCase()).not.toContain("source_text");
    expect(commitmentsDdl.toLowerCase()).not.toContain("content");
    expect(commitmentsDdl.toLowerCase()).not.toContain("message");
  });

  it("no table anywhere declares a source_text / raw-content column", () => {
    for (const ddl of MIGRATIONS) {
      expect(ddl.toLowerCase()).not.toContain("source_text");
    }
  });
});
