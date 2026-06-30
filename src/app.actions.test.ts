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
const { getPrefs } = await import("./db/prefs.js");

/** Minimal stand-in for the slice of the Bolt App surface registerHandlers uses. */
function fakeApp() {
  const actions: Record<string, (args: any) => Promise<void>> = {};
  const views: Record<string, (args: any) => Promise<void>> = {};
  const events: Record<string, (args: any) => Promise<void>> = {};
  return {
    assistant: () => {},
    command: () => {},
    event: (name: string, fn: (args: any) => Promise<void>) => {
      events[name] = fn;
    },
    action: (id: string, fn: (args: any) => Promise<void>) => {
      actions[id] = fn;
    },
    view: (id: string, fn: (args: any) => Promise<void>) => {
      views[id] = fn;
    },
    actions,
    views,
    events,
  };
}

function fakeClient() {
  return {
    chat: {
      postEphemeral: vi.fn().mockResolvedValue({ ok: true }),
      postMessage: vi.fn().mockResolvedValue({ ok: true }),
    },
    views: {
      open: vi.fn().mockResolvedValue({ ok: true }),
      publish: vi.fn().mockResolvedValue({ ok: true }),
    },
    conversations: {
      open: vi.fn().mockResolvedValue({ ok: true, channel: { id: "D1" } }),
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

describe("App Home actions without a channel context fall back to a DM", () => {
  it("snooze still persists and DMs instead of posting an ephemeral when there's no channel", async () => {
    const client = fakeClient();
    // App Home block_actions payloads have no `channel` — only `container: {type: "view", ...}`.
    const body = { actions: [{ value: "https://home/1" }], user: { id: "U6" }, container: { type: "view", view_id: "V1" } };
    await app.actions.snooze!({ ack: vi.fn(), body, client });

    expect(isSuppressed("U6", "https://home/1", Math.floor(Date.now() / 1000))).toBe(true);
    expect(client.chat.postEphemeral).not.toHaveBeenCalled();
    expect(client.conversations.open).toHaveBeenCalledWith({ users: "U6" });
    expect(client.chat.postMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: "D1", text: expect.stringContaining("Snoozed") }));
  });

  it("nudge DMs the draft instead of posting in-channel when there's no channel", async () => {
    const c = mkCommitment({ direction: "owed_to_me", counterparty: "Jordan Park", permalink: "https://home/2" });
    syncCommitments("U7", [c]);

    const client = fakeClient();
    const body = { actions: [{ value: c.permalink }], user: { id: "U7" }, container: { type: "view", view_id: "V2" } };
    await app.actions.nudge!({ ack: vi.fn(), body, client });

    expect(client.conversations.open).toHaveBeenCalledWith({ users: "U7" });
    expect(client.chat.postMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: "D1", text: expect.stringContaining("review and send it yourself") }));
  });
});

describe("show_rest", () => {
  it("posts the full uncapped triage list back to the requesting user", async () => {
    const client = fakeClient();
    const body = { actions: [{ value: "show_rest" }], user: { id: "U8" }, channel: { id: "C1" } };
    await app.actions.show_rest!({ ack: vi.fn(), body, client });

    expect(client.chat.postEphemeral).toHaveBeenCalledTimes(1);
    const call = client.chat.postEphemeral.mock.calls[0]![0];
    expect(call.channel).toBe("C1");
    expect(call.user).toBe("U8");
    expect(Array.isArray(call.blocks)).toBe(true);
    // No "show_rest" button on the full list — there's nothing further to show.
    const buttons = call.blocks.filter((b: any) => b.type === "actions").flatMap((b: any) => b.elements);
    expect(buttons.some((b: any) => b.action_id === "show_rest")).toBe(false);
  });
});

describe("settings: open_settings + settings_modal submission", () => {
  it("open_settings opens a modal pre-filled with the user's current prefs", async () => {
    const { savePrefs } = await import("./db/prefs.js");
    savePrefs("U9", { verbosity: "brief", maxItems: 2 });

    const client = fakeClient();
    const body = { user: { id: "U9" }, trigger_id: "T1" };
    await app.actions.open_settings!({ ack: vi.fn(), body, client });

    expect(client.views.open).toHaveBeenCalledTimes(1);
    const call = client.views.open.mock.calls[0]![0];
    expect(call.trigger_id).toBe("T1");
    expect(call.view.callback_id).toBe("settings_modal");
    const verbosityBlock = call.view.blocks.find((b: any) => b.block_id === "verbosity");
    expect(verbosityBlock.element.initial_option.value).toBe("brief");
  });

  it("open_settings is a no-op without a trigger_id (never crashes the handler)", async () => {
    const client = fakeClient();
    const body = { user: { id: "U9" } };
    await app.actions.open_settings!({ ack: vi.fn(), body, client });
    expect(client.views.open).not.toHaveBeenCalled();
  });

  it("submitting the settings modal persists the chosen values to db/prefs.ts", async () => {
    const client = fakeClient();
    const body = { user: { id: "U10" } };
    const view = {
      state: {
        values: {
          verbosity: { value: { selected_option: { value: "brief" } } },
          reading_level: { value: { selected_option: { value: "plain" } } },
          max_items: { value: { selected_option: { value: "1" } } },
          focus_default_mins: { value: { value: "45" } },
          read_aloud: { value: { selected_options: [{ value: "on" }] } },
        },
      },
    };
    await app.views.settings_modal!({ ack: vi.fn(), body, view });

    const saved = getPrefs("U10");
    expect(saved).toMatchObject({
      verbosity: "brief",
      readingLevel: "plain",
      maxItems: 1,
      focusDefaultMins: 45,
      readAloud: true,
    });
  });

  it("leaving the focus-minutes field blank clears the saved default", async () => {
    const { savePrefs } = await import("./db/prefs.js");
    savePrefs("U11", { focusDefaultMins: 60 });

    const client = fakeClient();
    const body = { user: { id: "U11" } };
    const view = {
      state: {
        values: {
          verbosity: { value: { selected_option: { value: "standard" } } },
          reading_level: { value: { selected_option: { value: "standard" } } },
          max_items: { value: { selected_option: { value: "3" } } },
          focus_default_mins: { value: { value: "" } },
          read_aloud: { value: { selected_options: [] } },
        },
      },
    };
    await app.views.settings_modal!({ ack: vi.fn(), body, view });

    expect(getPrefs("U11")?.focusDefaultMins).toBeUndefined();
  });
});

describe("app_home_opened", () => {
  it("publishes a live dashboard with a settings button", async () => {
    const client = fakeClient();
    const event = { user: "U12" };
    await app.events.app_home_opened!({ event, client });

    expect(client.views.publish).toHaveBeenCalledTimes(1);
    const call = client.views.publish.mock.calls[0]![0];
    expect(call.user_id).toBe("U12");
    expect(call.view.type).toBe("home");
    const buttons = call.view.blocks.filter((b: any) => b.type === "actions").flatMap((b: any) => b.elements);
    expect(buttons.some((b: any) => b.action_id === "open_settings")).toBe(true);
  });
});
