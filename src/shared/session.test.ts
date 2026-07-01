import { describe, expect, it } from "vitest";
import {
  signSession,
  verifySession,
  serializeSessionCookie,
  clearSessionCookie,
  parseCookies,
  userIdFromCookieHeader,
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  newOAuthState,
  serializeStateCookie,
  clearStateCookie,
  statesMatch,
} from "./session.js";

describe("signed session", () => {
  it("round-trips a userId", () => {
    const now = 1_000_000;
    const token = signSession("U_ABC", 3600, now);
    expect(verifySession(token, now + 10)).toBe("U_ABC");
  });

  it("rejects a tampered token", () => {
    const now = 1_000_000;
    const token = signSession("U_ABC", 3600, now);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifySession(tampered, now + 10)).toBeNull();
  });

  it("rejects a token whose userId was swapped (signature no longer matches)", () => {
    const now = 1_000_000;
    const token = signSession("U_ABC", 3600, now);
    const [, exp, sig] = token.split(".");
    const forged = `${Buffer.from("U_EVIL").toString("base64url")}.${exp}.${sig}`;
    expect(verifySession(forged, now + 10)).toBeNull();
  });

  it("rejects an expired token", () => {
    const now = 1_000_000;
    const token = signSession("U_ABC", 60, now);
    expect(verifySession(token, now + 61)).toBeNull();
  });

  it("returns null for malformed / missing tokens", () => {
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("a.b")).toBeNull();
    expect(verifySession("a.b.c.d")).toBeNull();
  });
});

describe("session cookie helpers", () => {
  it("serializes an HttpOnly, Secure, SameSite=Lax cookie", () => {
    const c = serializeSessionCookie("tok", 100);
    expect(c).toContain(`${SESSION_COOKIE}=tok`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=100");
  });

  it("clear cookie expires immediately", () => {
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("parses a Cookie header and extracts the authenticated user end-to-end", () => {
    const now = 1_000_000;
    const token = signSession("U_XYZ", 3600, now);
    const header = `foo=bar; ${SESSION_COOKIE}=${token}; baz=qux`;
    expect(parseCookies(header)[SESSION_COOKIE]).toBe(token);
    expect(userIdFromCookieHeader(header, now + 5)).toBe("U_XYZ");
    expect(userIdFromCookieHeader("nothing=here", now + 5)).toBeNull();
  });
});

describe("OAuth CSRF state", () => {
  it("mints unique, non-trivial state tokens", () => {
    const a = newOAuthState();
    const b = newOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("statesMatch only accepts an exact, both-present match", () => {
    const s = newOAuthState();
    expect(statesMatch(s, s)).toBe(true);
    expect(statesMatch(s, s + "x")).toBe(false);
    expect(statesMatch(s, newOAuthState())).toBe(false);
    expect(statesMatch(undefined, s)).toBe(false);
    expect(statesMatch(s, undefined)).toBe(false);
    expect(statesMatch(undefined, undefined)).toBe(false);
    expect(statesMatch("", "")).toBe(false); // empty is never a valid match
  });

  it("state cookie is HttpOnly/Secure/Lax and short-lived; clear expires it", () => {
    const c = serializeStateCookie("abc", 600);
    expect(c).toContain(`${OAUTH_STATE_COOKIE}=abc`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=600");
    expect(clearStateCookie()).toContain("Max-Age=0");
  });
});
