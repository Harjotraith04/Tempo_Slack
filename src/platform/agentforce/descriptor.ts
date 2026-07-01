/**
 * Tempo as an Agentforce Employee Agent (v3.2) — the descriptor that packages
 * Tempo's inbound MCP tools + a persona + the trust contract, so an owner can
 * register Tempo in Agentforce (or any MCP-aware agent platform). Pure + derived
 * from `TEMPO_TOOLS`, so the tool list can never drift from what the server
 * actually serves.
 */

import { TEMPO_TOOLS } from "../mcp/server/index.js";

/** The system persona / instructions an agent platform runs Tempo under. */
export const TEMPO_PERSONA = [
  "You are Tempo, an executive-function co-pilot for Slack — assistive technology for human attention and memory.",
  "You help the initiating user by: triaging their Slack down to what actually needs them; remembering the promises they made and were made to them; decoding the implicit tone and real urgency of messages; and protecting their deep-work focus.",
  "Trust rules you MUST honor: you act ONLY as the initiating user, with their permissions; you NEVER store or repeat the raw message content Slack returns — only derived facts; you NEVER send a message or change anything without the user's explicit confirmation.",
  "When a request is outside these four capabilities, say so plainly and hand it back rather than guessing.",
].join(" ");

export interface AgentforceToolRef {
  name: string;
  description: string;
}

export interface AgentforceDescriptor {
  name: string;
  description: string;
  instructions: string;
  trust: {
    actsAsInitiatingUser: true;
    neverStoresRtsContent: true;
    humanInTheLoop: true;
  };
  connection: {
    type: "mcp";
    transport: "streamable-http";
    endpoint: string;
    /** How a caller authenticates — a signed per-user agent token (see auth.ts). */
    auth: "bearer-agent-token";
  };
  tools: AgentforceToolRef[];
}

/** Build the Agentforce/MCP agent descriptor for a given deployed MCP endpoint. */
export function buildAgentforceDescriptor(opts: { endpoint: string }): AgentforceDescriptor {
  return {
    name: "Tempo",
    description:
      "Executive-function co-pilot for Slack — triage, commitments, tone, and focus. Acts as the user; stores nothing it reads.",
    instructions: TEMPO_PERSONA,
    trust: { actsAsInitiatingUser: true, neverStoresRtsContent: true, humanInTheLoop: true },
    connection: {
      type: "mcp",
      transport: "streamable-http",
      endpoint: opts.endpoint,
      auth: "bearer-agent-token",
    },
    tools: TEMPO_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  };
}
