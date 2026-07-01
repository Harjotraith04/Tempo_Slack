import { describe, expect, it } from "vitest";
import type { UserMetrics } from "../../ports/store.js";
import { aggregateTeamLoad, DEFAULT_MIN_MEMBERS, type TeamMemberData } from "./domain.js";

function member(obligations: number, focus = 0, triaged = 0): TeamMemberData {
  const metrics: UserMetrics = {
    userId: "SHOULD_NOT_LEAK",
    messagesTriaged: triaged,
    obligationsSurfaced: obligations,
    focusMinutesProtected: focus,
    itemsRecovered: 0,
    weekStartTs: 0,
    updatedAt: 0,
  };
  return { metrics, signals: [] };
}

describe("aggregateTeamLoad — k-anonymity guardrail", () => {
  it("REDACTS a team smaller than the k floor (no aggregates leak)", () => {
    const r = aggregateTeamLoad([member(3), member(5)], { minMembers: 3 });
    expect(r.redacted).toBe(true);
    if (r.redacted) {
      expect(r.memberCount).toBe(2);
      expect(r.minMembers).toBe(3);
    }
    // The redacted result carries NO aggregate fields.
    expect(Object.keys(r).sort()).toEqual(["memberCount", "minMembers", "redacted"]);
  });

  it("aggregates a team at/above the k floor", () => {
    const r = aggregateTeamLoad([member(2), member(4), member(6)], { minMembers: 3 });
    expect(r.redacted).toBe(false);
    if (!r.redacted) {
      expect(r.memberCount).toBe(3);
      expect(r.totalObligations).toBe(12);
      expect(r.avgObligations).toBe(4);
    }
  });

  it("NEVER surfaces a user id or any per-person value", () => {
    const r = aggregateTeamLoad([member(1), member(2), member(100)], { minMembers: 3 });
    const blob = JSON.stringify(r);
    expect(blob).not.toContain("SHOULD_NOT_LEAK");
    // No per-member arrays / max / min that could re-identify the outlier.
    expect(blob).not.toContain("100");
    expect(blob).not.toContain("userId");
  });

  it("describes distribution coarsely (balanced vs concentrated), never per-person", () => {
    const even = aggregateTeamLoad([member(4), member(4), member(4)]);
    const skewed = aggregateTeamLoad([member(0), member(0), member(30)]);
    if (!even.redacted) expect(even.responseFairness).toBe("balanced");
    if (!skewed.redacted) expect(skewed.responseFairness).toBe("concentrated");
  });

  it("defaults the k floor to 3", () => {
    expect(DEFAULT_MIN_MEMBERS).toBe(3);
    expect(aggregateTeamLoad([member(1), member(1)]).redacted).toBe(true);
  });
});
