import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Commitment } from "../../modules/ledger.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-commitments-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

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
  it("syncCommitments renders straight through when there's no local override", async () => {
    const { syncCommitments } = await import("./commitments.js");
    const fresh = [mkCommitment()];
    const result = syncCommitments("U1", fresh);
    expect(result[0]?.status).toBe("overdue");
  });

  it("never persists sourceText", async () => {
    const { syncCommitments, getCommitmentByPermalink } = await import("./commitments.js");
    syncCommitments("U2", [mkCommitment()]);
    const pinned = getCommitmentByPermalink("U2", mkCommitment().permalink);
    expect(pinned).toBeTruthy();
    expect((pinned as any).sourceText).toBeUndefined();
  });

  it("markRenegotiating overrides status across a later syncCommitments call", async () => {
    const { syncCommitments, markRenegotiating } = await import("./commitments.js");
    const fresh = [mkCommitment({ status: "overdue" })];
    syncCommitments("U3", fresh);
    markRenegotiating("U3", fresh[0]!.permalink, "asked for one more week");

    // A later live re-derivation still says "overdue" (RTS truth), but the
    // local override should win until the user's own message changes things.
    const resynced = syncCommitments("U3", [mkCommitment({ status: "overdue" })]);
    expect(resynced[0]?.status).toBe("renegotiating");
  });

  it("markCommitmentDone is preserved the same way", async () => {
    const { syncCommitments, markCommitmentDone } = await import("./commitments.js");
    const fresh = [mkCommitment({ status: "at_risk" })];
    syncCommitments("U4", fresh);
    markCommitmentDone("U4", fresh[0]!.permalink);

    const resynced = syncCommitments("U4", [mkCommitment({ status: "at_risk" })]);
    expect(resynced[0]?.status).toBe("done");
  });

  it("getCommitmentByPermalink returns undefined for an unknown permalink", async () => {
    const { getCommitmentByPermalink } = await import("./commitments.js");
    expect(getCommitmentByPermalink("U5", "https://nope")).toBeUndefined();
  });
});
