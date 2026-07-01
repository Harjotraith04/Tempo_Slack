import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/domain";
import { oauthRedirectUri } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return NextResponse.redirect(buildAuthorizeUrl(oauthRedirectUri(req.url)));
}
