/**
 * The SQL session seam — a tiny interface the Postgres repos depend on instead
 * of the `@neondatabase/serverless` driver types directly. This keeps the driver
 * confined to `connect.ts` (dynamic-imported), and lets every repo's SQL be
 * unit-tested and demoed against a fake in-memory `Db` (no server, no creds) —
 * exactly the posture the MCP `McpSession` seam gives the live MCP adapters.
 */

/** A parameterized SQL runner. Returns the result rows (objects keyed by column). */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}
