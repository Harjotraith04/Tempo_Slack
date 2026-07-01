/**
 * Signed browser session for the web companion — a stateless, HMAC-signed,
 * expiring token that ties a browser to a Slack user id. Set as an HttpOnly
 * cookie at the web OAuth callback and verified by the privacy/settings/data
 * routes, so "delete all my data" can only ever target the authenticated user.
 *
 * The signing key reuses the exact derivation the token store uses
 * (`SHA-256(config.runtime.encryptionKey)`), so no new secret is introduced;
 * `assertSecretsHardened()` already blocks the insecure default in any live
 * posture. No RTS content is involved — the payload is just `userId.exp`.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

export const SESSION_COOKIE = "tempo_session";
export const OAUTH_STATE_COOKIE = "tempo_oauth_state";
const DEFAULT_TTL_SECS = 30 * 24 * 3600; // 30 days
const STATE_TTL_SECS = 600; // 10 minutes — an OAuth round-trip is seconds

function key(): Buffer {
  return createHash("sha256").update(config.runtime.encryptionKey).digest();
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function mac(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

/** Sign a session token: `<userId>.<exp>.<hmac>` (userId base64url-encoded). */
export function signSession(
  userId: string,
  ttlSecs: number = DEFAULT_TTL_SECS,
  nowTs: number = Math.floor(Date.now() / 1000),
): string {
  const exp = nowTs + ttlSecs;
  const payload = `${b64url(userId)}.${exp}`;
  return `${payload}.${mac(payload)}`;
}

/** Verify a token; returns the userId, or null if malformed / tampered / expired. */
export function verifySession(
  token: string | undefined,
  nowTs: number = Math.floor(Date.now() / 1000),
): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encUser, expStr, sig] = parts as [string, string, string];
  const payload = `${encUser}.${expStr}`;
  const expected = mac(payload);
  // Constant-time compare; lengths must match for timingSafeEqual.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= nowTs) return null;
  try {
    return unb64url(encUser);
  } catch {
    return null;
  }
}

/** `Set-Cookie` value that stores the session token (HttpOnly, Secure, Lax). */
export function serializeSessionCookie(
  token: string,
  ttlSecs: number = DEFAULT_TTL_SECS,
): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSecs}`;
}

/** `Set-Cookie` value that clears the session (used after delete / sign-out). */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Parse a raw `Cookie` header into a name→value map. */
export function parseCookies(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (name) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

/** Convenience: pull the authenticated userId straight from a Cookie header. */
export function userIdFromCookieHeader(
  header: string | undefined | null,
  nowTs?: number,
): string | null {
  return verifySession(parseCookies(header)[SESSION_COOKIE], nowTs);
}

// ── OAuth CSRF `state` ────────────────────────────────────────────────────────
// A random, single-use value set as a short-lived cookie when the OAuth flow
// starts and echoed back by the provider; the callback rejects the request
// unless the query `state` matches the cookie. Prevents login CSRF (an attacker
// completing the flow in a victim's browser).

/** A fresh, cryptographically-random state token. */
export function newOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

/** `Set-Cookie` value that stores the OAuth state (HttpOnly, Secure, Lax, short-lived). */
export function serializeStateCookie(state: string, ttlSecs: number = STATE_TTL_SECS): string {
  return `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSecs}`;
}

/** `Set-Cookie` value that clears the state cookie (consumed on success). */
export function clearStateCookie(): string {
  return `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/** Constant-time equality for the query state vs the cookie state. */
export function statesMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
