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
import { config, isMcpServerEnabled } from "../../src/config.js";
import { buildContext } from "../../src/application/context.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { handleMcpHttp } from "../../src/platform/mcp/server/index.js";
import { SUBJECT_USER_ID } from "../../src/platform/slack/rts/fixtures.js";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const pre = (req as unknown as { body?: unknown }).body;
  if (pre !== undefined) return pre; // Vercel may pre-parse the body
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!isMcpServerEnabled()) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const token = config.mcp.server.token;
  if (token && req.headers["authorization"] !== `Bearer ${token}`) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  // Acts as the initiating user. For now a single configured identity; a future
  // phase maps the authenticated caller to a specific user's stored token.
  const userId = SUBJECT_USER_ID;
  const userToken = (await getStore().tokens.get(userId)) ?? config.slack.userToken;

  try {
    const body = await readJson(req);
    await handleMcpHttp(req, res, body, {
      buildContext: () => buildContext({ subjectUserId: userId, userToken }),
      version: "3.0.0",
    });
  } catch (err) {
    console.error("mcp server error", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("MCP server error");
    }
  }
}
