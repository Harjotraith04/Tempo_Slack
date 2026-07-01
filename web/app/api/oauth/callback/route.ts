import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeCode,
  getStore,
  signSession,
  serializeSessionCookie,
  clearStateCookie,
  statesMatch,
  OAUTH_STATE_COOKIE,
} from "@/lib/domain";
import { oauthRedirectUri } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return new NextResponse("Missing code", { status: 400 });

  // CSRF: the query `state` must match the state cookie we set at /start.
  const cookieState = cookies().get(OAUTH_STATE_COOKIE)?.value;
  if (!statesMatch(url.searchParams.get("state"), cookieState)) {
    return new NextResponse("Invalid OAuth state", { status: 400 });
  }

  try {
    const { userId, teamId, userToken } = await exchangeCode(code, oauthRedirectUri(req.url));
    if (!userId || !userToken) return new NextResponse("OAuth did not return a user token", { status: 400 });

    // Persist the user's token (encrypted) and start a signed browser session.
    await getStore().tokens.save(userId, teamId ?? "", userToken);
    const res = NextResponse.redirect(new URL("/privacy", req.url));
    res.headers.append("Set-Cookie", serializeSessionCookie(signSession(userId)));
    res.headers.append("Set-Cookie", clearStateCookie()); // single-use
    return res;
  } catch (err) {
    console.error("web oauth callback error", err);
    return new NextResponse("OAuth failed", { status: 500 });
  }
}
