/**
 * Inbound MCP endpoint (v3.0) — Tempo as an MCP *server*. External agents
 * (Agentforce / Claude / Cursor / ChatGPT) call `tempo_triage` / `tempo_commitments`
 * / `tempo_decode` / `tempo_focus` here over Streamable HTTP.
 *
 * Off unless `TEMPO_MCP_SERVER=on`; gated by a bearer token when
 * `TEMPO_MCP_SERVER_TOKEN` is set. Acts as the initiating user (their token
 * drives RTS) — honoring the same trust model as the rest of Tempo: acts as the
 * user, stores nothing from RTS.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { config, isMcpServerEnabled, assertVercelRuntime } from "../../src/config.js";
import { buildUserContext } from "../../src/application/context.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { handleMcpHttp } from "../../src/platform/mcp/server/index.js";
import { resolveMcpCaller } from "../../src/platform/mcp/server/auth.js";
import { VERSION } from "../../src/config.js";
import { WebClient } from "@slack/web-api";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const pre = (req as unknown as { body?: unknown }).body;
  if (pre !== undefined) return pre; // Vercel may pre-parse the body
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();
  if (!isMcpServerEnabled()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  // Default-deny: resolve the caller to a specific user it may act as, or reject.
  const caller = resolveMcpCaller(req.headers["authorization"]);
  if (!caller) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  // Act as the resolved user — their own stored token drives RTS. Only the
  // explicitly-configured shared-gate user may fall back to the demo token.
  const stored = await getStore().tokens.get(caller.userId);
  const userToken = stored ?? (caller.via === "shared-gate" ? config.slack.userToken : undefined);

  try {
    const body = await readJson(req);
    await handleMcpHttp(req, res, body, {
      // External agents get the SAME consent scope the user set in Slack. Without
      // this, any MCP caller read the user's entire visible Slack regardless of
      // the channels they'd chosen or the people they'd muted.
      buildContext: () =>
        buildUserContext({
          subjectUserId: caller.userId,
          client: new WebClient(config.slack.botToken),
        }),
      version: VERSION,
    });
  } catch (err) {
    console.error("mcp server error", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("MCP server error");
    }
  }
}
