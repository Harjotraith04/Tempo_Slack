/**
 * The MCP session seam — a tiny interface the live adapters depend on instead of
 * the `@modelcontextprotocol/sdk` types directly. This keeps the SDK confined to
 * `connect.ts` (dynamic-imported), and lets the mapping logic be unit-tested and
 * demoed with a fake in-memory session (no server, no credentials).
 */

/** The normalised shape of an MCP `tools/call` result (subset we consume). */
export interface McpToolResult {
  content?: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface McpSession {
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
}
