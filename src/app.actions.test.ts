import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Commitment } from "./modules/ledger.js";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tempo-app-actions-"));
  process.env.TEMPO_STORE_DIR = dir;
});

afterAll(() => {
  delete process.env.TEMPO_STORE_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const { registerHandlers } = await import("./app.js");
const { isSuppressed } = await import("./db/snoozes.js");
const { syncCommitments, getCommitmentByPermalink } = await import("./db/commitments.js");

/** Minimal stand-in for the slice of the Bolt App surface registerHandlers uses. */
function fakeApp() {
  const actions: Record<string, (args: any) => Promise<void>> = {};
  return {
    assistant: () => {},
    command: () => {},
    event: () => {},
    action: (id: string, fn: (args: any) => Promise<void>) => {
      actions[id] = fn;
    },
    actions,
  };
}

function fakeClient() {
  return {
    chat: {
      postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
      postMessage: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
}

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

let app: ReturnType<typeof fakeApp>;

beforeEach(() => {
  app = fakeApp();
  registerHandlers(app as any);
});

describe("snooze / mark_done", () => {
  it("snooze persists a suppression and confirms ephemerally", async () => {
    const client = fakeClient();
    const body = { actions: [{ value: "https://a/1" }], user: { id: "U1" }, channel: { id: "C1" } };
    await app.actions.snooze!({ ack: vi.fn(), body, client });

    expect(isSuppressed("U1", "https://a/1", Math.floor(Date.now() / 1000))).toBe(true);
    expect(client.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C1", user: "U1", text: expect.stringContaining("Snoozed") }),
    );
  });

  it("mark_done persists an indefinite suppression", async () => {
    const client = fakeClient();
    const body = { actions: [{ value: "https://a/2" }], user: { id: "U2" }, channel: { id: "C1" } };
    await app.actions.mark_done!({ ack: vi.fn(), body, client });

    expect(isSuppressed("U2", "https://a/2", 99_999_999_999)).toBe(true);
    expect(client.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Marked done") }),
    );
  });
});

describe("nudge / renegotiate", () => {
  it("nudge drafts a message and posts it back to the requesting user, never to a third party", async () => {
    const c = mkCommitment({ direction: "owed_to_me", counterparty: "Jordan Park" });
    syncCommitments("U3", [c]);

    const client = fakeClient();
    const body = { actions: [{ value: c.permalink }], user: { id: "U3" }, channel: { id: "C1" } };
    await app.actions.nudge!({ ack: vi.fn(), body, client });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C1", text: expect.stringContaining("review and send it yourself") }),
    );
    expect(client.chat.postEphemeral).not.toHaveBeenCalled();
  });

  it("renegotiate flips the stored status and drafts a push-back message", async () => {
    const c = mkCommitment({ direction: "i_owe" });
    syncCommitments("U4", [c]);

    const client = fakeClient();
    const body = { actions: [{ value: c.permalink }], user: { id: "U4" }, channel: { id: "C1" } };
    await app.actions.renegotiate!({ ack: vi.fn(), body, client });

    expect(getCommitmentByPermalink("U4", c.permalink)?.status).toBe("renegotiating");
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "C1", text: expect.stringContaining("review and send it yourself") }),
    );
  });

  it("nudge/renegotiate ask the user to re-run commitments when nothing is cached", async () => {
    const client = fakeClient();
    const body = { actions: [{ value: "https://unknown" }], user: { id: "U5" }, channel: { id: "C1" } };
    await app.actions.nudge!({ ack: vi.fn(), body, client });

    expect(client.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("/tempo commitments") }),
    );
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });
});
