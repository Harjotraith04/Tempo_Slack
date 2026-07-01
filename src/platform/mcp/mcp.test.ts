import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LiveMcpCalendarClient,
  LiveMcpTaskClient,
  mapCalendarResult,
  mapTaskResult,
} from "./live.js";
import type { McpSession, McpToolResult } from "./session.js";

/** A fake session that records the last call and returns a canned result. */
function fakeSession(result: McpToolResult | (() => McpToolResult)) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const session: McpSession = {
    async callTool(name, args) {
      calls.push({ name, args });
      return typeof result === "function" ? result() : result;
    },
  };
  return { session, calls };
}

describe("mapCalendarResult", () => {
  it("prefers structuredContent ids", () => {
    expect(mapCalendarResult({ structuredContent: { eventId: "E1", htmlLink: "http://x" } }, "gcal")).toEqual({
      provider: "gcal",
      eventId: "E1",
      htmlLink: "http://x",
    });
  });

  it("accepts snake_case + numeric ids and url aliases", () => {
    expect(mapCalendarResult({ structuredContent: { event_id: 77, url: "http://u" } }, "gcal")).toEqual({
      provider: "gcal",
      eventId: "77",
      htmlLink: "http://u",
    });
  });

  it("falls back to JSON-parsing the first text content", () => {
    const res: McpToolResult = { content: [{ type: "text", text: '{"id":"E2","link":"http://l"}' }] };
    expect(mapCalendarResult(res, "gcal")).toEqual({ provider: "gcal", eventId: "E2", htmlLink: "http://l" });
  });

  it("synthesizes an id when none is present (empty link)", () => {
    const r = mapCalendarResult({ content: [{ type: "text", text: "created" }] }, "gcal");
    expect(r.eventId).toMatch(/^evt_/);
    expect(r.htmlLink).toBe("");
  });

  it("throws on an error result", () => {
    expect(() => mapCalendarResult({ isError: true, content: [{ type: "text", text: '{"message":"nope"}' }] }, "gcal")).toThrow(/nope/);
  });
});

describe("mapTaskResult", () => {
  it("prefers structuredContent taskId + url", () => {
    expect(mapTaskResult({ structuredContent: { taskId: "T1", url: "http://t" } }, "notion")).toEqual({
      provider: "notion",
      taskId: "T1",
      url: "http://t",
    });
  });

  it("throws on an error result", () => {
    expect(() => mapTaskResult({ isError: true }, "notion")).toThrow(/error/i);
  });
});

describe("LiveMcpCalendarClient", () => {
  it("calls the configured tool with ISO start/end and maps the result", async () => {
    const { session, calls } = fakeSession({ structuredContent: { eventId: "E9", htmlLink: "http://e9" } });
    const client = new LiveMcpCalendarClient({ session, tool: "create_event", provider: "gcal" });
    const res = await client.blockFocus({ title: "Focus", startTs: 1_752_000_000, endTs: 1_752_003_600, description: "d" });

    expect(calls[0]!.name).toBe("create_event");
    expect(calls[0]!.args).toMatchObject({
      title: "Focus",
      start: new Date(1_752_000_000 * 1000).toISOString(),
      end: new Date(1_752_003_600 * 1000).toISOString(),
      description: "d",
    });
    expect(res).toEqual({ provider: "gcal", eventId: "E9", htmlLink: "http://e9" });
  });

  it("propagates a tool error (focus response is guarded upstream)", async () => {
    const { session } = fakeSession({ isError: true });
    const client = new LiveMcpCalendarClient({ session, tool: "create_event", provider: "gcal" });
    await expect(client.blockFocus({ title: "x", startTs: 1, endTs: 2 })).rejects.toThrow();
  });
});

describe("LiveMcpTaskClient", () => {
  it("calls the configured tool with title + ISO due and maps the result", async () => {
    const { session, calls } = fakeSession({ structuredContent: { taskId: "T9", url: "http://t9" } });
    const client = new LiveMcpTaskClient({ session, tool: "create_task", provider: "linear" });
    const res = await client.create({ title: "Ship it", due: 1_752_090_000, notes: "n" });

    expect(calls[0]!.name).toBe("create_task");
    expect(calls[0]!.args).toMatchObject({ title: "Ship it", due: new Date(1_752_090_000 * 1000).toISOString(), notes: "n" });
    expect(res).toEqual({ provider: "linear", taskId: "T9", url: "http://t9" });
  });
});

describe("getMcpClients (env-gated, lazy — never connects)", () => {
  const SNAPSHOT = { ...process.env };
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...SNAPSHOT };
  });

  it("resolves the mock adapters by default", async () => {
    process.env.TEMPO_MCP = "mock";
    const { getMcpClients } = await import("./index.js");
    const { MockCalendarClient, MockTaskClient } = await import("./index.js");
    const clients = getMcpClients();
    expect(clients.calendar).toBeInstanceOf(MockCalendarClient);
    expect(clients.tasks).toBeInstanceOf(MockTaskClient);
  });

  it("resolves the LIVE adapters when TEMPO_MCP=live and a URL is set (without connecting)", async () => {
    process.env.TEMPO_MCP = "live";
    process.env.TEMPO_MCP_CALENDAR_URL = "https://mcp.example.com/calendar";
    // tasks URL intentionally unset → tasks stays on mock (independent double-gate)
    delete process.env.TEMPO_MCP_TASKS_URL;
    const { getMcpClients, MockTaskClient } = await import("./index.js");
    const { LiveMcpCalendarClient } = await import("./live.js");
    const clients = getMcpClients();
    expect(clients.calendar).toBeInstanceOf(LiveMcpCalendarClient);
    expect(clients.tasks).toBeInstanceOf(MockTaskClient);
  });

  it("stays on mock when live but no URL is configured", async () => {
    process.env.TEMPO_MCP = "live";
    delete process.env.TEMPO_MCP_CALENDAR_URL;
    delete process.env.TEMPO_MCP_TASKS_URL;
    const { getMcpClients, MockCalendarClient } = await import("./index.js");
    expect(getMcpClients().calendar).toBeInstanceOf(MockCalendarClient);
  });
});
