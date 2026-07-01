import { NextResponse } from "next/server";
import { buildAuthorizeUrl, newOAuthState, serializeStateCookie } from "@/lib/domain";
import { oauthRedirectUri } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  // CSRF protection: mint a random state, remember it in a short-lived cookie,
  // and pass it to Slack so the callback can verify the round-trip is ours.
  const state = newOAuthState();
  const res = NextResponse.redirect(buildAuthorizeUrl(oauthRedirectUri(req.url), state));
  res.headers.append("Set-Cookie", serializeStateCookie(state));
  return res;
}
