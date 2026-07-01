/**
 * Focus Guardian — domain types + pure logic (slot rounding, clock labels, and
 * the interrupt-budget rule). The external writes (calendar/task via MCP, Slack
 * DND/status/digest) live in service.ts behind the injected ports.
 */

import type { CalendarResult, TaskResult } from "../../ports/mcp.js";
import type { TriageItem } from "../triage/index.js";

export interface FocusPlan {
  title: string;
  startTs: number;
  endTs: number;
  calendar: CalendarResult;
  task?: TaskResult;
  dndUntilTs: number;
  summary: string;
  dndApplied: boolean;
  statusApplied: boolean;
  digestScheduledFor?: number;
}

/** Round up to the next 15-minute boundary. */
export function nextSlot(nowTs: number): number {
  const q = 15 * 60;
  return Math.ceil(nowTs / q) * q;
}

export function clockLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** The interrupt budget: only these would be allowed to break a focus block. */
export function whatBreaksThrough(items: TriageItem[], threshold = 85): TriageItem[] {
  return items.filter(
    (i) => (i.category === "ACT" || i.category === "BLOCKER") && i.urgency >= threshold,
  );
}
