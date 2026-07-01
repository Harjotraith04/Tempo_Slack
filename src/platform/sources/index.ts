/**
 * Attention OS source factory (v4.0). Returns the EXTRA (non-Slack) sources to
 * ground across, gated by `flags.attentionOs`. Off by default → no extras →
 * `MultiSourceRtsClient` is never used and Slack is the sole source (the
 * behavior every prior version had). On → the mock email/calendar sources join
 * the search (a real deployment swaps these for MCP-backed adapters).
 */

import { flags } from "../../config.js";
import type { NamedSource } from "./multi.js";
import { MockEmailSource, MockCalendarSource } from "./mock.js";

export { MultiSourceRtsClient, type NamedSource } from "./multi.js";
export { MockEmailSource, MockCalendarSource } from "./mock.js";

export function getExtraSources(): NamedSource[] {
  if (!flags.attentionOs) return [];
  return [
    { name: "email", client: new MockEmailSource() },
    { name: "calendar", client: new MockCalendarSource() },
  ];
}
