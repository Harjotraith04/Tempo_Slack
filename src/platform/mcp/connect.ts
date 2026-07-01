/**
 * The ONLY file that touches `@modelcontextprotocol/sdk`.
 *
 * `connectMcpSession` returns a lazily-connecting `McpSession`: the SDK is
 * `await import`ed on the *first* tool call, so the mock / demo / test paths
 * (which never construct a live session) never load it — the zero-credential
 * path can't be broken even by an SDK ESM quirk. The connection (Client +
 * Streamable HTTP transport) is established once and cached for the session's
 * lifetime.
 *
 * UNVERIFIED LIVE SEAM: like `rts/live.ts`, this is contract-shaped but not run
 * against a real MCP server in CI. The `McpSession` boundary means any SDK API
 * drift is contained to this one file.
 */

import type { McpSession, McpToolResult } from "./session.js";

export interface ConnectMcpOpts {
  url: string;
  token?: string;
  /** Client name reported to the server in the MCP handshake. */
  name: string;
}

export function connectMcpSession(opts: ConnectMcpOpts): McpSession {
  // Cached connected client (the SDK `Client`), created on first use.
  let clientPromise: Promise<{ callTool(params: { name: string; arguments: Record<string, unknown> }): Promise<unknown> }> | undefined;

  async function client() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
        const { StreamableHTTPClientTransport } = await import(
          "@modelcontextprotocol/sdk/client/streamableHttp.js"
        );
        const headers = opts.token ? { Authorization: `Bearer ${opts.token}` } : undefined;
        const transport = new StreamableHTTPClientTransport(new URL(opts.url), {
          requestInit: headers ? { headers } : undefined,
        });
        const c = new Client({ name: opts.name, version: "1.0.0" });
        await c.connect(transport);
        return c as unknown as {
          callTool(params: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
        };
      })();
    }
    return clientPromise;
  }

  return {
    async callTool(name, args) {
      const c = await client();
      const res = (await c.callTool({ name, arguments: args })) as McpToolResult;
      return res;
    },
  };
}
