import { describe, expect, it } from "vitest";
import { emptyStateBlocks, errorBlocks, metricsBlocks } from "./index.js";
import type { UserMetrics } from "../../../platform/persistence/metrics.js";

function text(blocks: any[]): string {
  return blocks
    .map((b) => (b.type === "header" ? b.text.text : b.type === "section" ? b.text.text : b.type === "context" ? b.elements.map((e: any) => e.text).join(" ") : ""))
    .join("\n");
}

describe("empty / error / metrics blocks", () => {
  it("empty-state cards are calm, non-empty, and reassuring per intent", () => {
    for (const intent of ["triage", "commitments", "catchup"] as const) {
      const blocks = emptyStateBlocks(intent);
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0]!.type).toBe("header");
      expect(text(blocks).length).toBeGreaterThan(10);
    }
  });

  it("error card promises nothing was changed", () => {
    expect(text(errorBlocks()).toLowerCase()).toContain("nothing was changed");
  });

  it("metrics show a gentle placeholder before any activity", () => {
    expect(text(metricsBlocks(undefined)).toLowerCase()).toContain("your week with tempo");
    const zero: UserMetrics = {
      userId: "U",
      messagesTriaged: 0,
      obligationsSurfaced: 0,
      focusMinutesProtected: 0,
      itemsRecovered: 0,
      weekStartTs: 1,
      updatedAt: 1,
    };
    expect(text(metricsBlocks(zero)).toLowerCase()).toContain("your week with tempo");
  });

  it("metrics render the real counts once there's activity, counts only", () => {
    const m: UserMetrics = {
      userId: "U",
      messagesTriaged: 137,
      obligationsSurfaced: 4,
      focusMinutesProtected: 90,
      itemsRecovered: 2,
      weekStartTs: 1,
      updatedAt: 2,
    };
    const rendered = text(metricsBlocks(m));
    expect(rendered).toContain("137");
    expect(rendered).toContain("90");
    expect(rendered.toLowerCase()).toContain("never stores");
  });
});
