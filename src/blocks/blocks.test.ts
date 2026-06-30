import { describe, expect, it } from "vitest";
import {
  triageBlocks,
  ledgerBlocks,
  decodeBlocks,
  draftCheckBlocks,
  focusBlocks,
  reentryBlocks,
  homeDashboardBlocks,
  onboardingBlocks,
  settingsModalView,
} from "./index.js";
import type { TriageItem, TriageResult } from "../modules/triage.js";
import type { Commitment } from "../modules/ledger.js";
import type { ToneDecode, DraftCheck } from "../modules/decoder.js";
import type { FocusPlan } from "../modules/focus.js";
import type { ReentryBrief } from "../modules/reentry.js";

function actionsBlocks(blocks: any[]): any[] {
  return blocks.filter((b) => b.type === "actions");
}

function buttons(blocks: any[]): any[] {
  return actionsBlocks(blocks).flatMap((b) => b.elements);
}

function mkItem(overrides: Partial<TriageItem> = {}): TriageItem {
  return {
    permalink: "https://northwind.slack.com/archives/C1/p1",
    channelName: "atlas-launch",
    channelType: "public_channel",
    authorName: "Priya",
    excerpt: "Need the spec",
    category: "BLOCKER",
    urgency: 90,
    reason: "Eng is blocked",
    suggestedAction: "Send the spec",
    ...overrides,
  };
}

function mkCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: "c_abc123",
    direction: "i_owe",
    counterparty: "Priya Nair",
    what: "Send the Atlas API spec",
    dueText: "Friday",
    dueTs: undefined,
    status: "overdue",
    permalink: "https://northwind.slack.com/archives/C1/p2",
    sourceText: "I'll send the spec by Friday",
    ...overrides,
  };
}

describe("triageBlocks", () => {
  it("renders one actions row per item with permalink-valued buttons", () => {
    const r: TriageResult = { needsYou: [mkItem()], scanned: 10, handledQuietly: 5 };
    const blocks = triageBlocks(r);
    const rows = actionsBlocks(blocks);
    expect(rows).toHaveLength(1);

    const ids = rows[0]!.elements.map((e: any) => e.action_id);
    expect(ids).toEqual(["open_link", "draft_reply", "snooze", "mark_done"]);

    for (const id of ["draft_reply", "snooze", "mark_done"]) {
      const btn = rows[0]!.elements.find((e: any) => e.action_id === id);
      expect(btn.value).toBe(mkItem().permalink);
    }
  });

  it("every button has a non-empty label", () => {
    const r: TriageResult = { needsYou: [mkItem()], scanned: 1, handledQuietly: 0 };
    for (const b of buttons(triageBlocks(r))) {
      expect(b.text.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("respects a custom maxItems and shows no 'show the rest' button when everything fits", () => {
    const r: TriageResult = {
      needsYou: [mkItem({ permalink: "https://a/1" }), mkItem({ permalink: "https://a/2" })],
      scanned: 2,
      handledQuietly: 0,
    };
    const blocks = triageBlocks(r, { maxItems: 5 });
    expect(buttons(blocks).some((b) => b.action_id === "show_rest")).toBe(false);
  });

  it("adds a 'Show the rest' button once items exceed maxItems", () => {
    const r: TriageResult = {
      needsYou: [mkItem({ permalink: "https://a/1" }), mkItem({ permalink: "https://a/2" }), mkItem({ permalink: "https://a/3" })],
      scanned: 3,
      handledQuietly: 0,
    };
    const blocks = triageBlocks(r, { maxItems: 1 });
    const rows = actionsBlocks(blocks);
    // 1 per-item row + 1 "show the rest" row.
    expect(rows).toHaveLength(2);
    expect(buttons(blocks).some((b) => b.action_id === "show_rest")).toBe(true);
  });
});

describe("ledgerBlocks", () => {
  it("'I owe' rows wire draft_deliverable/renegotiate to the commitment permalink", () => {
    const mine = mkCommitment({ direction: "i_owe" });
    const blocks = ledgerBlocks([mine]);
    const rows = actionsBlocks(blocks);
    const row = rows.find((r) => r.elements.some((e: any) => e.action_id === "draft_deliverable"))!;
    expect(row).toBeTruthy();

    const draft = row.elements.find((e: any) => e.action_id === "draft_deliverable");
    const renegotiate = row.elements.find((e: any) => e.action_id === "renegotiate");
    expect(draft.value).toBe(mine.permalink);
    expect(renegotiate.value).toBe(mine.permalink);
    // Regression guard: these must never be the opaque hash id.
    expect(draft.value).not.toBe(mine.id);
    expect(renegotiate.value).not.toBe(mine.id);
  });

  it("'Owed to you' rows wire nudge to the commitment permalink and Open as a real link", () => {
    const theirs = mkCommitment({ direction: "owed_to_me", counterparty: "Jordan Park" });
    const blocks = ledgerBlocks([theirs]);
    const rows = actionsBlocks(blocks);
    const row = rows.find((r) => r.elements.some((e: any) => e.action_id === "nudge"))!;
    expect(row).toBeTruthy();

    const nudge = row.elements.find((e: any) => e.action_id === "nudge");
    expect(nudge.value).toBe(theirs.permalink);
    expect(nudge.value).not.toBe(theirs.id);

    const open = row.elements.find((e: any) => e.action_id === "open_link");
    expect(open.url).toBe(theirs.permalink);
  });
});

describe("display-only cards have no interactive elements", () => {
  it("decodeBlocks", () => {
    const d: ToneDecode = {
      literalMeaning: "x",
      impliedMeaning: "y",
      emotionalTone: "neutral",
      urgencyRead: "normal",
      socialExpectation: "reply",
      confidence: 0.6,
      caveat: "I can be wrong",
    };
    expect(actionsBlocks(decodeBlocks(d, "original"))).toHaveLength(0);
  });

  it("focusBlocks", () => {
    const p: FocusPlan = {
      title: "Deep work",
      startTs: 1000,
      endTs: 6400,
      calendar: { eventId: "evt_1", htmlLink: "https://cal", provider: "google-calendar (mock)" },
      dndUntilTs: 6400,
      summary: "Blocked 90 min",
      dndApplied: true,
      statusApplied: true,
    };
    expect(actionsBlocks(focusBlocks(p))).toHaveLength(0);
  });

  it("reentryBlocks", () => {
    const b: ReentryBrief = {
      topThree: ["a"],
      decisions: ["b"],
      changesToYourProjects: ["c"],
      peopleWaiting: ["d"],
      nowExpectedOfYou: ["e"],
      awayDays: 7,
    };
    expect(actionsBlocks(reentryBlocks(b))).toHaveLength(0);
  });
});

describe("homeDashboardBlocks", () => {
  it("includes a settings button and the supplied triage/commitments sections", () => {
    const triage = triageBlocks({ needsYou: [mkItem()], scanned: 1, handledQuietly: 0 });
    const commitments = ledgerBlocks([mkCommitment()]);
    const blocks = homeDashboardBlocks({ triage, commitments });

    const settingsBtn = buttons(blocks).find((b) => b.action_id === "open_settings");
    expect(settingsBtn).toBeTruthy();
    expect(settingsBtn.text.text.trim().length).toBeGreaterThan(0);

    // The supplied section blocks are present verbatim — composition, not transformation.
    expect(blocks).toEqual(expect.arrayContaining(triage));
    expect(blocks).toEqual(expect.arrayContaining(commitments));

    // No live focus block (planning one has side effects — must never run on a passive Home open).
    expect(JSON.stringify(blocks)).not.toContain("Do-Not-Disturb on until");
  });
});

describe("onboardingBlocks", () => {
  it("has exactly one button — the onboarding completion tap", () => {
    const blocks = onboardingBlocks();
    const els = buttons(blocks);
    expect(els).toHaveLength(1);
    expect(els[0]!.action_id).toBe("complete_onboarding");
    expect(els[0]!.text.text.trim().length).toBeGreaterThan(0);
  });
});

describe("settingsModalView", () => {
  it("is a modal pre-filled with the caller's current prefs", () => {
    const view = settingsModalView({ verbosity: "brief", readingLevel: "plain", readAloud: true, maxItems: 2, focusDefaultMins: 45 });
    expect(view.type).toBe("modal");
    expect(view.callback_id).toBe("settings_modal");

    const byBlockId = (id: string) => view.blocks.find((b: any) => b.block_id === id);
    expect(byBlockId("verbosity").element.initial_option.value).toBe("brief");
    expect(byBlockId("reading_level").element.initial_option.value).toBe("plain");
    expect(byBlockId("max_items").element.initial_option.value).toBe("2");
    expect(byBlockId("focus_default_mins").element.initial_value).toBe("45");
    expect(byBlockId("read_aloud").element.initial_options).toHaveLength(1);
  });

  it("falls back to no pre-selection when read-aloud is off and focus minutes are unset", () => {
    const view = settingsModalView({ verbosity: "standard", readingLevel: "standard", readAloud: false, maxItems: 3 });
    const byBlockId = (id: string) => view.blocks.find((b: any) => b.block_id === id);
    expect(byBlockId("read_aloud").element.initial_options).toHaveLength(0);
    expect(byBlockId("focus_default_mins").element.initial_value).toBeUndefined();
  });
});

describe("draftCheckBlocks", () => {
  it("renders use_rewrite (primary) and keep_draft", () => {
    const c: DraftCheck = { risks: ["too curt"], howItLands: "cold", rewrite: "warmer version", plainLanguage: "say no warmly" };
    const blocks = draftCheckBlocks(c);
    const els = buttons(blocks);
    const useRewrite = els.find((e) => e.action_id === "use_rewrite");
    const keepDraft = els.find((e) => e.action_id === "keep_draft");
    expect(useRewrite.style).toBe("primary");
    expect(keepDraft).toBeTruthy();
  });
});
