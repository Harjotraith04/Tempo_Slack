/**
 * The Focus Guardian's outbound MCP calls must be best-effort.
 *
 * `planFocusBlock` calls the calendar MCP server BEFORE it sets Do-Not-Disturb.
 * The mock calendar never throws, so a bare `await` there looked fine forever —
 * but the moment a real MCP server is configured, an unreachable host, a slow
 * one, or a rejected token throws, and the DND/status writes below it never run.
 * The user asks Tempo to protect their focus, gets an error, and their Slack is
 * untouched.
 *
 * DND + status are the substance of a focus block. The calendar event is a
 * garnish. These tests pin that a failing garnish can never take down the meal.
 */

import { describe, expect, it, vi } from "vitest";
import { planFocusBlock } from "./service.js";
import type { McpClients } from "./ports.js";
import type { CalendarClient, TaskClient } from "../../ports/mcp.js";
import { MockSlackActions } from "../../platform/slack/webapi/mock.js";

const NOW = 1_700_000_000;

const deadCalendar: CalendarClient = {
  blockFocus: () => Promise.reject(new Error("ECONNREFUSED: calendar MCP server unreachable")),
};
const deadTasks: TaskClient = {
  create: () => Promise.reject(new Error("401 unauthorized: bad MCP token")),
};
const okCalendar: CalendarClient = {
  blockFocus: async () => ({ provider: "google-calendar", eventId: "evt_1", htmlLink: "https://cal/1" }),
};
const okTasks: TaskClient = {
  create: async () => ({ provider: "notion", taskId: "task_1", url: "https://notion/1" }),
};

const mcp = (calendar: CalendarClient, tasks: TaskClient): McpClients => ({ calendar, tasks });

describe("focus is resilient to a broken MCP server", () => {
  it("still sets DND and status when the calendar server is down", async () => {
    const slack = new MockSlackActions();
    const setDnd = vi.spyOn(slack, "setFocusDnd");
    const setStatus = vi.spyOn(slack, "setFocusStatus");

    const p = await planFocusBlock({
      nowTs: NOW,
      durationMins: 120,
      mcp: mcp(deadCalendar, okTasks),
      slack,
    });

    // The whole point: the block happened anyway.
    expect(setDnd).toHaveBeenCalledWith({ minutes: 120 });
    expect(setStatus).toHaveBeenCalled();
    expect(p.dndApplied).toBe(true);
    expect(p.statusApplied).toBe(true);
    expect(p.endTs - p.startTs).toBe(120 * 60);

    // And it does not claim a calendar hold it never got.
    expect(p.calendar).toBeUndefined();
    expect(p.summary).toContain("Couldn't reach your calendar");
  });

  it("still sets DND when the task server is down", async () => {
    const slack = new MockSlackActions();
    const p = await planFocusBlock({
      nowTs: NOW,
      taskTitle: "Write the Atlas spec",
      mcp: mcp(okCalendar, deadTasks),
      slack,
    });

    expect(p.dndApplied).toBe(true);
    expect(p.task).toBeUndefined();
    expect(p.calendar?.eventId).toBe("evt_1"); // the healthy one still lands
  });

  it("survives BOTH servers being down", async () => {
    const slack = new MockSlackActions();
    const p = await planFocusBlock({
      nowTs: NOW,
      taskTitle: "Write the Atlas spec",
      mcp: mcp(deadCalendar, deadTasks),
      slack,
    });

    expect(p.dndApplied).toBe(true);
    expect(p.statusApplied).toBe(true);
    expect(p.calendar).toBeUndefined();
    expect(p.task).toBeUndefined();
  });

  it("reports the calendar normally when the server is healthy", async () => {
    const p = await planFocusBlock({
      nowTs: NOW,
      mcp: mcp(okCalendar, okTasks),
      slack: new MockSlackActions(),
    });

    expect(p.calendar?.provider).toBe("google-calendar");
    expect(p.summary).not.toContain("Couldn't reach");
  });
});
