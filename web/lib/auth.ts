import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./domain";

/** The authenticated Slack user id from the signed session cookie, or null. */
export function currentUserId(): string | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** The absolute OAuth redirect URI for this deployment (must match manifest). */
export function oauthRedirectUri(requestUrl: string): string {
  const origin = process.env.PUBLIC_URL || new URL(requestUrl).origin;
  return `${origin}/api/oauth/callback`;
}
