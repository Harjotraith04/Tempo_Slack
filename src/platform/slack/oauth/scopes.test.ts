import { describe, expect, it } from "vitest";
import manifest from "../../../../manifest.json" with { type: "json" };
import { SCOPES, USER_SCOPES, BOT_SCOPES } from "./scopes.js";

const sorted = (a: string[]) => [...a].sort();

describe("OAuth scopes — single source of truth (Marketplace least-privilege)", () => {
  it("manifest user scopes exactly match scopes.ts (no drift, no over/under-request)", () => {
    expect(sorted(manifest.oauth_config.scopes.user)).toEqual(sorted(USER_SCOPES));
  });

  it("manifest bot scopes exactly match scopes.ts", () => {
    expect(sorted(manifest.oauth_config.scopes.bot)).toEqual(sorted(BOT_SCOPES));
  });

  it("every declared scope documents its token, justification, and the call that needs it", () => {
    for (const s of SCOPES) {
      expect(["user", "bot"], s.scope).toContain(s.token);
      expect(s.why.trim().length, s.scope).toBeGreaterThan(0);
      expect(s.usedBy.trim().length, s.scope).toBeGreaterThan(0);
    }
  });

  it("declares no duplicate scope", () => {
    const all = SCOPES.map((s) => s.scope);
    expect(new Set(all).size).toBe(all.length);
  });
});
