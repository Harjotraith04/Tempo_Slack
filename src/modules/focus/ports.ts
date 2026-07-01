/** The outbound contracts the Focus Guardian depends on (see src/ports). */
export type { McpClients, CalendarResult, TaskResult } from "../../ports/mcp.js";
export type { SlackActionsClient } from "../../ports/slack.js";
export type { TriageItem } from "../triage/index.js";
