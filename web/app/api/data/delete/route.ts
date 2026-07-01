import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { deleteUserData, getStore, clearSessionCookie } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = currentUserId();
  if (!userId) return new NextResponse("Not signed in", { status: 401 });

  await deleteUserData(getStore(), userId);
  // Erased + signed out — send them back to the landing page.
  const res = NextResponse.redirect(new URL("/?deleted=1", req.url), { status: 303 });
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
