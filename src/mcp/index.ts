/**
 * Outward MCP clients — how Tempo *acts* in the world beyond Slack.
 *
 * Tempo is an MCP client: it turns a Slack obligation into a real calendar
 * block (Google Calendar) and a tracked task (Notion / Linear / Todoist). These
 * are exposed through small interfaces so the agent calls `calendar.blockFocus`
 * / `tasks.create` without caring which server is behind them.
 *
 * The default implementations are deterministic mocks so the demo runs with no
 * external credentials. The REAL-MCP SEAM is marked below: drop in an
 * `@modelcontextprotocol/sdk` Client connected to a Calendar/Notion MCP server
 * and forward the same calls. Everything upstream is unchanged.
 */

export interface CalendarBlock {
  title: string;
  startTs: number; // unix seconds
  endTs: number;
  description?: string;
}

export interface CalendarResult {
  provider: string;
  eventId: string;
  htmlLink: string;
}

export interface TaskInput {
  title: string;
  due?: number; // unix seconds
  notes?: string;
  sourcePermalink?: string;
}

export interface TaskResult {
  provider: string;
  taskId: string;
  url: string;
}

export interface CalendarClient {
  blockFocus(block: CalendarBlock): Promise<CalendarResult>;
}

export interface TaskClient {
  create(task: TaskInput): Promise<TaskResult>;
}

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

// ── REAL-MCP SEAM ────────────────────────────────────────────────────────────
// export class McpCalendarClient implements CalendarClient {
//   constructor(private client: import("@modelcontextprotocol/sdk/client").Client) {}
//   async blockFocus(b: CalendarBlock): Promise<CalendarResult> {
//     const res = await this.client.callTool({ name: "create_event", arguments: {...} });
//     return mapToCalendarResult(res);
//   }
// }

export function getMcpClients(): { calendar: CalendarClient; tasks: TaskClient } {
  // When real MCP servers are configured, branch here on env and return the
  // McpCalendarClient / McpTaskClient instead.
  return { calendar: new MockCalendarClient(), tasks: new MockTaskClient() };
}
