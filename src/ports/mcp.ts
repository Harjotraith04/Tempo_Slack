/**
 * MCP outbound ports — the interfaces the domain uses to *act* in the world
 * beyond Slack (calendar blocks, tracked tasks). The domain depends on these;
 * `platform/mcp` provides the adapters (mock today, real `@modelcontextprotocol/sdk`
 * clients later). Dependency rule: modules import ports, never platform.
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

/** The pair of MCP clients Focus Guardian needs, resolved by the container. */
export interface McpClients {
  calendar: CalendarClient;
  tasks: TaskClient;
}
