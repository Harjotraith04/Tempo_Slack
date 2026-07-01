import { describe, expect, it } from "vitest";
import { MockRtsClient } from "../platform/slack/rts/mock.js";
import { DEMO_NOW, SAM_LAST_ACTIVE } from "../platform/slack/rts/fixtures.js";
import { getMcpClients } from "../platform/mcp/index.js";
import { getSlackActions } from "../platform/slack/webapi/index.js";
import { runLedger } from "./ledger.js";
import { decodeMessage, checkDraft } from "./decoder.js";
import { runReentry } from "./reentry.js";
import { planFocusBlock, whatBreaksThrough } from "./focus.js";
import { runTriage } from "./triage.js";
import { isFirstRun, welcomeMessage } from "./onboarding.js";
import type { UserPrefs } from "../platform/persistence/prefs.js";

const rts = new MockRtsClient();
const afterTs = `${SAM_LAST_ACTIVE}.000000`;

describe("ledger", () => {
  it("finds the overdue promise Sam made and the one owed to him", async () => {
    const c = await runLedger(rts, { nowTs: DEMO_NOW });
    const mine = c.find((x) => x.direction === "i_owe" && x.what.includes("Atlas API spec"));
    const theirs = c.find((x) => x.direction === "owed_to_me" && x.what.includes("pricing"));
    expect(mine).toBeTruthy();
    expect(mine?.status).toBe("overdue"); // "by Friday" of last week
    expect(theirs).toBeTruthy();
  });
});

describe("decoder", () => {
  it("reads the passive-aggressive subtext under 'no rush'", async () => {
    const d = await decodeMessage("No rush 🙂 whenever you get a chance I guess.", { authorName: "Marco" });
    expect(d.impliedMeaning.toLowerCase()).toContain("frustrat");
    expect(d.confidence).toBeGreaterThan(0);
    expect(d.caveat.length).toBeGreaterThan(0);
  });

  it("softens a curt draft", async () => {
    const r = await checkDraft("No.");
    expect(r.risks.length).toBeGreaterThan(0);
    expect(r.rewrite.length).toBeGreaterThan("No.".length);
  });
});

describe("reentry", () => {
  it("builds a plain-language brief with the key decision and obligations", async () => {
    const b = await runReentry(rts, { afterTs, awayDays: 7 });
    expect(b.topThree.length).toBeGreaterThan(0);
    expect(b.decisions.join(" ")).toMatch(/Aug 15/);
    expect(b.nowExpectedOfYou.join(" ").toLowerCase()).toContain("spec");
  });
});

describe("focus", () => {
  it("plans a focus block and creates a task via MCP", async () => {
    const p = await planFocusBlock({ nowTs: DEMO_NOW, durationMins: 90, title: "Write Atlas spec", taskTitle: "Atlas API spec", mcp: getMcpClients(), slack: getSlackActions({}) });
    expect(p.endTs - p.startTs).toBe(90 * 60);
    expect(p.calendar.eventId).toMatch(/^evt_/);
    expect(p.task?.taskId).toMatch(/^task_/);
  });

  it("only lets true blockers break through the interrupt budget", async () => {
    const { needsYou } = await runTriage(rts, { afterTs });
    const breaking = whatBreaksThrough(needsYou);
    expect(breaking.every((i) => i.urgency >= 85)).toBe(true);
  });
});

describe("onboarding", () => {
  it("treats a user with no stored prefs, or prefs with no onboardedAt, as a first run", () => {
    expect(isFirstRun(undefined)).toBe(true);
    const noOnboarding: UserPrefs = { userId: "U1", updatedAt: DEMO_NOW };
    expect(isFirstRun(noOnboarding)).toBe(true);
  });

  it("is no longer a first run once onboardedAt is set", () => {
    const onboarded: UserPrefs = { userId: "U1", updatedAt: DEMO_NOW, onboardedAt: DEMO_NOW };
    expect(isFirstRun(onboarded)).toBe(false);
  });

  it("gives a first-time user a fuller welcome than a returning user", () => {
    const first = welcomeMessage(true);
    const returning = welcomeMessage(false);
    expect(first.text).not.toBe(returning.text);
    expect(first.text.length).toBeGreaterThan(returning.text.length);
    expect(first.text.toLowerCase()).toContain("welcome");
    expect(first.prompts.length).toBeGreaterThan(0);
    expect(returning.prompts).toEqual(first.prompts);
  });
});
