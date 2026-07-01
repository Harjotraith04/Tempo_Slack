import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Commitment } from "../../modules/ledger.js";
import { buildFileStore } from "./file/index.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-commitments-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const commitments = buildFileStore().commitments;

function mkCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "c_1",
    direction: "i_owe",
    counterparty: "Priya Nair",
    what: "Send the Atlas API spec",
    dueText: "Friday",
    status: "overdue",
    permalink: "https://northwind.slack.com/archives/C1/p1",
    sourceText: "I'll send the spec by Friday",
    ...overrides,
  };
}

describe("commitments store", () => {
  it("sync renders straight through when there's no local override", async () => {
    const result = await commitments.sync("U1", [mkCommitment()]);
    expect(result[0]?.status).toBe("overdue");
  });

  it("never persists sourceText", async () => {
    await commitments.sync("U2", [mkCommitment()]);
    const pinned = await commitments.getByPermalink("U2", mkCommitment().permalink);
    expect(pinned).toBeTruthy();
    expect((pinned as any).sourceText).toBeUndefined();
  });

  it("markRenegotiating overrides status across a later sync call", async () => {
    const fresh = [mkCommitment({ status: "overdue" })];
    await commitments.sync("U3", fresh);
    await commitments.markRenegotiating("U3", fresh[0]!.permalink, "asked for one more week");

    // A later live re-derivation still says "overdue" (RTS truth), but the
    // local override should win until the user's own message changes things.
    const resynced = await commitments.sync("U3", [mkCommitment({ status: "overdue" })]);
    expect(resynced[0]?.status).toBe("renegotiating");
  });

  it("markDone is preserved the same way", async () => {
    const fresh = [mkCommitment({ status: "at_risk" })];
    await commitments.sync("U4", fresh);
    await commitments.markDone("U4", fresh[0]!.permalink);

    const resynced = await commitments.sync("U4", [mkCommitment({ status: "at_risk" })]);
    expect(resynced[0]?.status).toBe("done");
  });

  it("getByPermalink returns undefined for an unknown permalink", async () => {
    expect(await commitments.getByPermalink("U5", "https://nope")).toBeUndefined();
  });

  it("listForUser returns only that user's pinned commitments; deleteForUser erases them", async () => {
    await commitments.sync("U6", [mkCommitment({ permalink: "https://a/1" }), mkCommitment({ permalink: "https://a/2" })]);
    await commitments.sync("U7", [mkCommitment({ permalink: "https://a/3" })]);
    expect(await commitments.listForUser("U6")).toHaveLength(2);

    await commitments.deleteForUser("U6");
    expect(await commitments.listForUser("U6")).toEqual([]);
    expect(await commitments.listForUser("U7")).toHaveLength(1); // untouched
  });
});
