/**
 * The seeded "Northwind" demo world.
 *
 * One source of truth for: (a) the mock RTS adapter, and (b) the real
 * `scripts/seed-workspace.ts` that posts this same history into a Slack sandbox
 * so live RTS returns the identical narrative. Every planted moment the demo
 * relies on is tagged with `plant:` in a comment.
 *
 * The "you" persona is Sam Rivera, a PM returning on Monday after a week off.
 */

import type { ChannelType, RtsUser } from "../../../ports/rts.js";

/** Fixed reference clock so the mock + tests are deterministic. */
export const DEMO_NOW = Math.floor(new Date("2026-07-06T16:00:00Z").getTime() / 1000); // Mon 09:00 PT
/** Sam was away ~7 days; this is when he was last active. */
export const SAM_LAST_ACTIVE = DEMO_NOW - 7 * 24 * 3600;

export const SUBJECT_USER_ID = "U_SAM";

export const USERS: (RtsUser & { passiveAggressive?: boolean; terse?: boolean })[] = [
  { id: "U_SAM", name: "sam", realName: "Sam Rivera", title: "Product Manager, Atlas", tz: "America/Los_Angeles" },
  { id: "U_PRIYA", name: "priya", realName: "Priya Nair", title: "Engineering Lead", tz: "America/Los_Angeles", terse: true },
  { id: "U_MARCO", name: "marco", realName: "Marco Diaz", title: "Product Designer", tz: "America/New_York", passiveAggressive: true },
  { id: "U_DANA", name: "dana", realName: "Dana Liu", title: "VP Product", tz: "America/Los_Angeles" },
  { id: "U_JORDAN", name: "jordan", realName: "Jordan Park", title: "Product Manager, Billing", tz: "America/Chicago" },
  { id: "U_RAVI", name: "ravi", realName: "Ravi Shah", title: "Software Engineer", tz: "America/Los_Angeles" },
  { id: "U_TINA", name: "tina", realName: "Tina Osei", title: "Office Ops", tz: "America/New_York" },
];

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
}

export const CHANNELS: Channel[] = [
  { id: "C_ATLAS", name: "proj-atlas", type: "public_channel" },
  { id: "C_ENG", name: "eng", type: "public_channel" },
  { id: "C_DESIGN", name: "design", type: "public_channel" },
  { id: "C_LEAD", name: "leadership", type: "private_channel" },
  { id: "C_GEN", name: "general", type: "public_channel" },
  { id: "C_RANDOM", name: "random", type: "public_channel" },
  { id: "D_PRIYA", name: "priya", type: "im" },
  { id: "D_DANA", name: "dana", type: "im" },
  { id: "D_JORDAN", name: "jordan", type: "im" },
];

export interface SeedMessage {
  channelId: string;
  authorId: string;
  text: string;
  /** Minutes before DEMO_NOW. Larger = older. */
  minsAgo: number;
  threadOffsetMins?: number; // if set, this is a threaded reply to a message at (minsAgo + offset)
  mentionsMe?: boolean;
  /** Tag used by the demo/test harness to assert a planted moment surfaced. */
  plant?: string;
}

const DAY = 24 * 60;

export const MESSAGES: SeedMessage[] = [
  // ── plant:promise-to-priya — Sam promised a spec, never delivered (8 days ago, just before PTO)
  {
    channelId: "D_PRIYA",
    authorId: "U_SAM",
    text: "Hey Priya — heads up I'm out next week. I'll send you the finalized Atlas API spec by Friday so eng isn't blocked. Promise it'll be in your inbox before I log off.",
    minsAgo: 8 * DAY,
    plant: "promise-to-priya",
  },
  { channelId: "D_PRIYA", authorId: "U_PRIYA", text: "ok. need it to start the migration. thx", minsAgo: 8 * DAY - 20 },

  // ── plant:promise-to-sam — Jordan owes Sam pricing numbers (open, due passed)
  {
    channelId: "D_JORDAN",
    authorId: "U_JORDAN",
    text: "I'll get you the updated pricing numbers by Wednesday so you can finish the launch checklist. On me.",
    minsAgo: 6 * DAY,
    plant: "promise-to-sam",
  },

  // ── Noise: #random banter across the week
  { channelId: "C_RANDOM", authorId: "U_RAVI", text: "the new cold brew tap is unreal ☕️", minsAgo: 5 * DAY },
  { channelId: "C_RANDOM", authorId: "U_TINA", text: "reminder: fire drill Thursday 2pm 🔔", minsAgo: 5 * DAY - 30 },
  { channelId: "C_RANDOM", authorId: "U_MARCO", text: "who left a Figma file named 'final_FINAL_v3_REAL' 😤", minsAgo: 4 * DAY },
  { channelId: "C_GEN", authorId: "U_TINA", text: "All-hands moved to Friday 10am PT. Calendar updated.", minsAgo: 4 * DAY },
  { channelId: "C_GEN", authorId: "U_RAVI", text: "VPN maintenance tonight 9-10pm, expect a blip.", minsAgo: 3 * DAY },

  // ── plant:eng-blocker — implicit blocker on Sam, NO @mention (the hero catch)
  {
    channelId: "C_ENG",
    authorId: "U_PRIYA",
    text: "We're blocked on the Atlas migration — still waiting on the API spec doc before we can size the work. Can't start the sprint without it.",
    minsAgo: 3 * DAY,
    plant: "eng-blocker",
  },
  { channelId: "C_ENG", authorId: "U_RAVI", text: "yeah same, my ticket is parked until that lands", minsAgo: 3 * DAY - 15, plant: "eng-blocker" },

  // ── plant:leadership-decision — made while Sam was away (private channel)
  {
    channelId: "C_LEAD",
    authorId: "U_DANA",
    text: "Decision: we're moving Atlas GA from Aug 1 → Aug 15 to absorb the security review. Owners, please update your launch plans and checklists this week.",
    minsAgo: 2 * DAY + 120,
    plant: "leadership-decision",
  },
  { channelId: "C_LEAD", authorId: "U_JORDAN", text: "ack, billing plan updated", minsAgo: 2 * DAY + 90 },

  // ── plant:marco-passive-aggressive — the tone-decode moment (#design)
  {
    channelId: "C_DESIGN",
    authorId: "U_MARCO",
    text: "No rush on the design review feedback, it's only been a week 🙂 whenever you get a chance I guess. Not like the handoff is waiting on it or anything.",
    minsAgo: 1 * DAY + 200,
    mentionsMe: true,
    plant: "marco-passive-aggressive",
  },

  // ── plant:dana-act — explicit high-priority ask in DM (clear ACT item)
  {
    channelId: "D_DANA",
    authorId: "U_DANA",
    text: "Sam — when you're back, I need the Atlas launch checklist owner confirmed by EOD Monday. It's going in the board deck Tuesday morning. Thanks!",
    minsAgo: 1 * DAY + 60,
    mentionsMe: true,
    plant: "dana-act",
  },

  // ── A genuine FYI thread Sam is part of but doesn't strictly need to act on
  { channelId: "C_ATLAS", authorId: "U_RAVI", text: "Pushed the staging fix for the latency spike, looks healthy now 📈", minsAgo: 1 * DAY },
  { channelId: "C_ATLAS", authorId: "U_PRIYA", text: "nice. closing the incident.", minsAgo: 1 * DAY - 10 },

  // ── More recent noise to make triage non-trivial
  { channelId: "C_RANDOM", authorId: "U_TINA", text: "lost & found: one very sad water bottle by the printer", minsAgo: 600 },
  { channelId: "C_GEN", authorId: "U_RAVI", text: "anyone got the link to the Q3 OKRs doc?", minsAgo: 400 },
  { channelId: "C_ATLAS", authorId: "U_MARCO", text: "uploaded the revised onboarding flow to the design channel fwiw", minsAgo: 300 },
];
