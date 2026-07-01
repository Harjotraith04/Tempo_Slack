/**
 * Live MCP adapters — Tempo acting in the world through a real MCP server.
 *
 * `LiveMcpCalendarClient`/`LiveMcpTaskClient` implement the domain ports by
 * mapping the domain input to an MCP tool call, then normalising the tool's
 * result back to `CalendarResult`/`TaskResult`. They depend only on the
 * `McpSession` seam, so they're fully unit-testable with a fake session and
 * never load the SDK themselves (see connect.ts).
 *
 * Best-effort mapping: MCP servers differ, so we prefer the tool's
 * `structuredContent`, fall back to JSON-parsing its text content, then to a
 * synthesized id. A tool error (`isError`, or a thrown SDK error) propagates —
 * the Focus Guardian response is wrapped by `safely()` upstream.
 */

import type {
  CalendarBlock,
  CalendarClient,
  CalendarResult,
  TaskClient,
  TaskInput,
  TaskResult,
} from "../../ports/mcp.js";
import type { McpSession, McpToolResult } from "./session.js";

function firstText(res: McpToolResult): Record<string, unknown> | undefined {
  const text = res.content?.find((c) => c.type === "text" && c.text)?.text;
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Pull the first present string field out of structuredContent (or parsed text). */
function pick(res: McpToolResult, keys: string[]): string | undefined {
  const sources = [res.structuredContent, firstText(res)];
  for (const src of sources) {
    if (!src) continue;
    for (const k of keys) {
      const v = src[k];
      if (typeof v === "string" && v.length > 0) return v;
      if (typeof v === "number") return String(v);
    }
  }
  return undefined;
}

let synthCounter = 5000;
function synthId(prefix: string): string {
  return `${prefix}_${synthCounter++}`;
}

export function mapCalendarResult(res: McpToolResult, provider: string): CalendarResult {
  if (res.isError) throw new Error(`MCP calendar tool returned an error: ${firstText(res)?.message ?? "unknown"}`);
  const eventId = pick(res, ["eventId", "event_id", "id"]) ?? synthId("evt");
  const htmlLink = pick(res, ["htmlLink", "html_link", "url", "link"]) ?? "";
  return { provider, eventId, htmlLink };
}

export function mapTaskResult(res: McpToolResult, provider: string): TaskResult {
  if (res.isError) throw new Error(`MCP task tool returned an error: ${firstText(res)?.message ?? "unknown"}`);
  const taskId = pick(res, ["taskId", "task_id", "id"]) ?? synthId("task");
  const url = pick(res, ["url", "permalink", "html_url", "link"]) ?? "";
  return { provider, taskId, url };
}

export interface LiveMcpClientOpts {
  session: McpSession;
  tool: string;
  provider: string;
}

export class LiveMcpCalendarClient implements CalendarClient {
  constructor(private readonly opts: LiveMcpClientOpts) {}

  async blockFocus(block: CalendarBlock): Promise<CalendarResult> {
    const res = await this.opts.session.callTool(this.opts.tool, {
      title: block.title,
      summary: block.title,
      // ISO 8601 is the lingua franca across calendar MCP servers.
      start: new Date(block.startTs * 1000).toISOString(),
      end: new Date(block.endTs * 1000).toISOString(),
      description: block.description,
    });
    return mapCalendarResult(res, this.opts.provider);
  }
}

export class LiveMcpTaskClient implements TaskClient {
  constructor(private readonly opts: LiveMcpClientOpts) {}

  async create(task: TaskInput): Promise<TaskResult> {
    const res = await this.opts.session.callTool(this.opts.tool, {
      title: task.title,
      name: task.title,
      due: task.due ? new Date(task.due * 1000).toISOString() : undefined,
      notes: task.notes,
      description: task.notes,
      sourceUrl: task.sourcePermalink,
    });
    return mapTaskResult(res, this.opts.provider);
  }
}
