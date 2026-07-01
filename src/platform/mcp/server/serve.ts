/**
 * The ONLY server-side file that touches `@modelcontextprotocol/sdk`.
 *
 * `handleMcpHttp` `await import`s the SDK **lazily on the first request**, builds
 * a stateless `McpServer` + Streamable-HTTP transport, registers the SDK-free
 * `TEMPO_TOOLS`, and serves the request. The demo/tests exercise the tools
 * directly (never through here), so the SDK is never loaded on the
 * zero-credential path — identical isolation to the outbound `mcp/connect.ts`.
 *
 * UNVERIFIED LIVE SEAM: contract-shaped, not run against a real MCP client in CI
 * (`verify:mcp-server` checks it against a real endpoint). The `TempoTool`
 * boundary keeps any SDK API drift contained to this one file.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { TempoContext } from "../../../application/context.js";
import { TEMPO_TOOLS, type TempoTool } from "./tools.js";

export interface McpServeOpts {
  /** Build the per-call context — the tool runs as this (initiating) user. */
  buildContext: () => TempoContext | Promise<TempoContext>;
  tools?: TempoTool[];
  serverName?: string;
  version?: string;
}

export async function handleMcpHttp(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
  opts: McpServeOpts,
): Promise<void> {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const server = new McpServer({ name: opts.serverName ?? "tempo", version: opts.version ?? "3.0.0" });
  for (const tool of opts.tools ?? TEMPO_TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputShape },
      async (args: Record<string, unknown>) => {
        const ctx = await opts.buildContext();
        const { summary, data } = await tool.run(args ?? {}, ctx);
        return { content: [{ type: "text" as const, text: summary }], structuredContent: data };
      },
    );
  }

  // Stateless (a fresh server + transport per request) — the right fit for a
  // serverless function; no session store to keep.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req as never, res as never, body);
}
