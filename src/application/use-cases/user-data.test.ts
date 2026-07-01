import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Commitment } from "../../modules/ledger.js";
import { buildFileStore } from "../../platform/persistence/index.js";
import { exportUserData, deleteUserData } from "./user-data.js";
import { applySettings } from "./settings.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-userdata-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const store = buildFileStore();

function mkCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "c_1",
    direction: "i_owe",
    counterparty: "Priya Nair",
    what: "Send the Atlas API spec",
    dueText: "Friday",
    status: "overdue",
    permalink: "https://northwind.slack.com/archives/C1/p1",
    sourceText: "SECRET RAW MESSAGE — must never be exported",
    ...overrides,
  };
}

/** Seed one user across every store. */
async function seed(userId: string) {
  await store.tokens.save(userId, "T1", "xoxp-super-secret-token");
  await store.prefs.save(userId, { verbosity: "brief", maxItems: 2 });
  await store.metrics.record(userId, { messagesTriaged: 5 }, 1_000_000);
  await store.surfaces.save(userId, { canvasId: "F1", listId: "L1" });
  await store.commitments.sync(userId, [mkCommitment()]);
  await store.snoozes.snooze(userId, "https://a/1", 9_999_999_999);
  await store.signals.record(userId, "U_SENDER", "engaged");
}

describe("exportUserData", () => {
  it("returns every stored category for the user", async () => {
    await seed("U_EXPORT");
    const data = await exportUserData(store, "U_EXPORT", 1_000_100);
    expect(data.userId).toBe("U_EXPORT");
    expect(data.installedTeam).toEqual({ teamId: "T1", installedAt: expect.any(Number) });
    expect(data.prefs?.verbosity).toBe("brief");
    expect(data.metrics?.messagesTriaged).toBe(5);
    expect(data.surfaces?.canvasId).toBe("F1");
    expect(data.commitments).toHaveLength(1);
    expect(data.snoozes).toHaveLength(1);
    expect(data.senderSignals).toHaveLength(1);
    expect(data.senderSignals[0]).toMatchObject({ authorId: "U_SENDER", engaged: 1 });
    expect(data.exportedAt).toBe(1_000_100);
  });

  it("NEVER exports the decrypted token or any RTS content (Invariant 1)", async () => {
    await seed("U_PRIV");
    const data = await exportUserData(store, "U_PRIV");
    const blob = JSON.stringify(data);
    expect(blob).not.toContain("xoxp-super-secret-token");
    expect(blob).not.toContain("SECRET RAW MESSAGE");
    // The commitment is present as derived facts, but structurally without sourceText.
    expect((data.commitments[0] as any).sourceText).toBeUndefined();
    expect(data.commitments[0]?.what).toBe("Send the Atlas API spec");
  });

  it("is empty for a user with nothing stored", async () => {
    const data = await exportUserData(store, "U_NOBODY");
    expect(data.installedTeam).toBeUndefined();
    expect(data.prefs).toBeUndefined();
    expect(data.commitments).toEqual([]);
    expect(data.snoozes).toEqual([]);
  });
});

describe("deleteUserData", () => {
  it("erases everything for the user, leaving other users untouched", async () => {
    await seed("U_DEL");
    await seed("U_KEEP");

    await deleteUserData(store, "U_DEL");

    const gone = await exportUserData(store, "U_DEL");
    expect(gone.installedTeam).toBeUndefined();
    expect(gone.prefs).toBeUndefined();
    expect(gone.metrics).toBeUndefined();
    expect(gone.surfaces).toBeUndefined();
    expect(gone.commitments).toEqual([]);
    expect(gone.snoozes).toEqual([]);
    expect(gone.senderSignals).toEqual([]);
    expect(await store.tokens.get("U_DEL")).toBeUndefined();

    // The other user's data is intact.
    const kept = await exportUserData(store, "U_KEEP");
    expect(kept.prefs?.verbosity).toBe("brief");
    expect(kept.commitments).toHaveLength(1);
  });
});

describe("applySettings (web form → prefs)", () => {
  it("writes the parsed prefs and clears blank numeric fields", async () => {
    await store.prefs.save("U_SET", { focusDefaultMins: 60 });
    const saved = await applySettings(store, "U_SET", {
      verbosity: "brief",
      readingLevel: "plain",
      maxItems: "1",
      focusDefaultMins: "", // blank clears
      readAloud: "on",
    });
    expect(saved).toMatchObject({ verbosity: "brief", readingLevel: "plain", maxItems: 1, readAloud: true });
    expect(saved.focusDefaultMins).toBeUndefined();
  });
});
