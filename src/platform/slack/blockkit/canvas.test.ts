import { describe, expect, it } from "vitest";
import { buildCanvasMarkdown } from "./canvas.js";
import type { TriageResult } from "../../../modules/triage.js";
import type { Commitment } from "../../../modules/ledger.js";

const NOW = 1_752_000_000;

function mkTriage(n: number): TriageResult {
  return {
    scanned: 40,
    handledQuietly: 30,
    needsYou: Array.from({ length: n }, (_, i) => ({
      permalink: `p${i}`,
      channelName: `chan${i}`,
      channelType: "public_channel" as const,
      authorName: "Someone",
      excerpt: `SECRET_MESSAGE_BODY_${i}`,
      category: "ACT" as const,
      urgency: 90 - i,
      reason: `reason ${i}`,
      suggestedAction: `action ${i}`,
    })),
  };
}

function mkCommitment(o: Partial<Commitment> = {}): Commitment {
  return {
    id: "c1",
    direction: "i_owe",
    counterparty: "Priya",
    what: "Send the Atlas spec",
    dueText: "Friday",
    status: "overdue",
    permalink: "https://s/p",
    sourceText: "RAW_SOURCE_TEXT_DO_NOT_LEAK",
    ...o,
  };
}

describe("buildCanvasMarkdown", () => {
  it("renders headings, the plan, and commitments", () => {
    const md = buildCanvasMarkdown({
      name: "Sam",
      nowTs: NOW,
      triage: mkTriage(2),
      commitments: [mkCommitment(), mkCommitment({ direction: "owed_to_me", counterparty: "Jordan", what: "pricing", status: "open" })],
    });
    expect(md).toContain("# Tempo — Sam");
    expect(md).toContain("## What needs you");
    expect(md).toContain("## Commitments");
    expect(md).toContain("Send the Atlas spec");
    expect(md).toContain("Priya");
    expect(md).toContain("pricing");
  });

  it("caps the needs list to maxItems", () => {
    const md = buildCanvasMarkdown({ name: "Sam", nowTs: NOW, triage: mkTriage(10), commitments: [], maxItems: 3 });
    const actionLines = md.split("\n").filter((l) => l.startsWith("- **action"));
    expect(actionLines).toHaveLength(3);
  });

  it("NEVER includes raw RTS message text (excerpt or sourceText)", () => {
    const md = buildCanvasMarkdown({ name: "Sam", nowTs: NOW, triage: mkTriage(3), commitments: [mkCommitment()] });
    expect(md).not.toContain("SECRET_MESSAGE_BODY");
    expect(md).not.toContain("RAW_SOURCE_TEXT_DO_NOT_LEAK");
  });

  it("shows a calm empty state and a focus CTA when there is nothing", () => {
    const md = buildCanvasMarkdown({ name: "Sam", nowTs: NOW, triage: mkTriage(0), commitments: [] });
    expect(md).toContain("You're all caught up");
    expect(md).toContain("Nothing outstanding");
    expect(md).toContain("protect my focus");
  });
});
