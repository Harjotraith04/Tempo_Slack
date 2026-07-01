/**
 * Composition container — the single place the application layer resolves every
 * outbound adapter (RTS · AI · Slack write-actions · MCP) from config's
 * mock/live seams. The domain modules only ever see the ports; this is where a
 * concrete adapter gets chosen and injected.
 *
 * The container is created once and threaded onto every TempoContext, so a
 * single turn shares one set of resolved clients. Tests build a container with
 * mock adapters (or override individual clients via buildContext).
 */

import { getRtsClient, type GetRtsOpts } from "../platform/slack/rts/index.js";
import { getLlm } from "../platform/ai/index.js";
import { getSlackActions, type GetSlackActionsOpts } from "../platform/slack/webapi/index.js";
import { getMcpClients } from "../platform/mcp/index.js";
import type { RtsClient } from "../ports/rts.js";
import type { LlmPort } from "../ports/ai.js";
import type { SlackActionsClient } from "../ports/slack.js";
import type { McpClients } from "../ports/mcp.js";

export interface Container {
  /** Raw RTS client for a subject/token (buildContext wraps it in the cache). */
  rts(opts?: GetRtsOpts): RtsClient;
  llm(): LlmPort;
  slackActions(opts?: GetSlackActionsOpts): SlackActionsClient;
  mcp(): McpClients;
}

/** Wire the concrete adapters. Each factory already resolves mock vs live by
 * config, so this stays a thin, testable seam rather than a framework. */
export function createContainer(): Container {
  return {
    rts: (opts = {}) => getRtsClient(opts),
    llm: () => getLlm(),
    slackActions: (opts = {}) => getSlackActions(opts),
    mcp: () => getMcpClients(),
  };
}
