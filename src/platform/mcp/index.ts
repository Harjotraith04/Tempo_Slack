/**
 * Outward MCP client adapters — how Tempo *acts* in the world beyond Slack.
 *
 * Tempo is an MCP client: it turns a Slack obligation into a real calendar
 * block (Google Calendar) and a tracked task (Notion / Linear / Todoist). The
 * port interfaces live in `ports/mcp.ts`; these are the adapters behind them.
 *
 * The default implementations are deterministic mocks so the demo runs with no
 * external credentials. The REAL-MCP SEAM is marked below: drop in an
 * `@modelcontextprotocol/sdk` Client connected to a Calendar/Notion MCP server
 * and forward the same calls. Everything upstream is unchanged.
 */

import { config, isLiveMcp } from "../../config.js";
import { connectMcpSession } from "./connect.js";
import { LiveMcpCalendarClient, LiveMcpTaskClient } from "./live.js";
import type {
  CalendarBlock,
  CalendarClient,
  CalendarResult,
  McpClients,
  TaskClient,
  TaskInput,
  TaskResult,
} from "../../ports/mcp.js";

// ── Mock implementations ─────────────────────────────────────────────────────

let counter = 1000;
const nextId = () => `${counter++}`;

export class MockCalendarClient implements CalendarClient {
  async blockFocus(block: CalendarBlock): Promise<CalendarResult> {
    const id = `evt_${nextId()}`;
    return {
      provider: "google-calendar (mock)",
      eventId: id,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${id}`,
    };
  }
}

export class MockTaskClient implements TaskClient {
  async create(task: TaskInput): Promise<TaskResult> {
    const id = `task_${nextId()}`;
    return {
      provider: "notion (mock)",
      taskId: id,
      url: `https://notion.so/${id}`,
    };
  }
}

// ── Factory (double-gated per client) ────────────────────────────────────────
// Each client goes live only when TEMPO_MCP=live AND its own server URL is
// configured — a partial config leaves the other on mock (same double-gate as
// getRtsClient / getSlackActions). The live session connects lazily on first
// use, so building it here never touches the network or the SDK.

export function getMcpClients(): McpClients {
  const live = isLiveMcp();
  const m = config.mcp;

  const calendar: CalendarClient =
    live && m.calendarUrl
      ? new LiveMcpCalendarClient({
          session: connectMcpSession({ url: m.calendarUrl, token: m.calendarToken, name: "tempo-calendar" }),
          tool: m.calendarTool,
          provider: m.calendarProvider,
        })
      : new MockCalendarClient();

  const tasks: TaskClient =
    live && m.tasksUrl
      ? new LiveMcpTaskClient({
          session: connectMcpSession({ url: m.tasksUrl, token: m.tasksToken, name: "tempo-tasks" }),
          tool: m.tasksTool,
          provider: m.tasksProvider,
        })
      : new MockTaskClient();

  return { calendar, tasks };
}
