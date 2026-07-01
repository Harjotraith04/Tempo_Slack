/**
 * Mock non-Slack sources for Attention OS (v4.0) — deterministic, credential-free
 * stand-ins for email / calendar grounded via MCP, so the multi-source
 * abstraction is provable in `npm run demo` and tests. A real deployment swaps
 * these for MCP-backed source adapters; the domain never notices.
 *
 * Each returns already-normalised `RtsMessage`s (tagged with its `source`), so it
 * plugs straight into `MultiSourceRtsClient` alongside the Slack RTS client.
 */

import type { RtsClient, RtsMessage, RtsSearchParams, RtsSearchResult } from "../../ports/rts.js";
import { SUBJECT_USER_ID } from "../slack/rts/fixtures.js";

function result(messages: RtsMessage[], query: string): RtsSearchResult {
  return { messages, users: [], meta: { source: "mock", query, returned: messages.length } };
}

/** A mock email source — a couple of threads that need the user, like Slack triage. */
export class MockEmailSource implements RtsClient {
  readonly subjectUserId = SUBJECT_USER_ID;
  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    return result(
      [
        {
          source: "email",
          permalink: "mailto:thread/atlas-legal",
          channelId: "EMAIL",
          channelName: "inbox",
          channelType: "im",
          authorId: "U_EXT_LEGAL",
          authorName: "legal",
          authorRealName: "Legal (external)",
          text: "Re: Atlas launch — we need your sign-off on the DPA before Friday to keep the date.",
          ts: "1751800000.000000",
          mentionsMe: true,
        },
      ],
      params.query,
    );
  }
}

/** A mock calendar source — an upcoming commitment surfaced as a message. */
export class MockCalendarSource implements RtsClient {
  readonly subjectUserId = SUBJECT_USER_ID;
  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    return result(
      [
        {
          source: "calendar",
          permalink: "https://calendar.example.com/event/atlas-review",
          channelId: "CAL",
          channelName: "calendar",
          channelType: "im",
          authorId: "U_CAL",
          authorName: "calendar",
          authorRealName: "Calendar",
          text: "Upcoming: Atlas launch review at 3:00pm — you're the owner; agenda not sent yet.",
          ts: "1751810000.000000",
          mentionsMe: true,
        },
      ],
      params.query,
    );
  }
}
