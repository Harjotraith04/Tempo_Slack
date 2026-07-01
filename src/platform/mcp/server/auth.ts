/**
 * Inbound-MCP caller authentication (v3.2) — resolves *who* an external agent
 * may act as, DEFAULT-DENY.
 *
 * Two paths, in order:
 *  1. a **signed per-user agent token** (`mintAgentToken`, an HMAC-signed session
 *     token) → the caller acts as exactly that user (their own stored Slack token
 *     drives RTS). No ambient authority — each agent presents its own identity.
 *  2. a **shared gate token** — accepted ONLY when both `TEMPO_MCP_SERVER_TOKEN`
 *     and an explicit `TEMPO_MCP_SERVER_USER` are configured, mapping to that one
 *     configured user (never a hardcoded/fixture identity).
 *
 * Anything else — no credential, an invalid/expired token, or a shared token with
 * no configured user — returns `null`, and the endpoint MUST reject (401). There
 * is no open path: enabling the server without any credential configured serves
 * nobody rather than everybody.
 */

import { config } from "../../../config.js";
import { signSession, verifySession, statesMatch } from "../../../shared/session.js";

export type McpAuthVia = "agent-token" | "shared-gate";
export interface McpCaller {
  userId: string;
  via: McpAuthVia;
}

/** Mint a per-user agent token for an external agent to present as `Bearer`. */
export function mintAgentToken(userId: string, ttlSecs: number = 90 * 24 * 3600): string {
  return signSession(userId, ttlSecs);
}

function bearer(authHeader: string | undefined): string | undefined {
  const m = /^Bearer\s+(.+)$/i.exec(authHeader ?? "");
  return m?.[1]?.trim();
}

/** Resolve an inbound MCP caller to the user it may act as, or null (deny). */
export function resolveMcpCaller(authHeader: string | undefined): McpCaller | null {
  const token = bearer(authHeader);
  if (!token) return null;

  // 1. Per-user signed agent token → that user.
  const uid = verifySession(token);
  if (uid) return { userId: uid, via: "agent-token" };

  // 2. Shared gate — only with BOTH a configured token AND a configured user.
  const gate = config.mcp.server.token;
  const gateUser = config.mcp.server.user;
  if (gate && gateUser && statesMatch(token, gate)) return { userId: gateUser, via: "shared-gate" };

  return null;
}
