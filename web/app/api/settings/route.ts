import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { applySettings, getStore } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = currentUserId();
  if (!userId) return new NextResponse("Not signed in", { status: 401 });

  const form = await req.formData();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };

  await applySettings(getStore(), userId, {
    verbosity: get("verbosity"),
    readingLevel: get("readingLevel"),
    maxItems: get("maxItems"),
    focusDefaultMins: get("focusDefaultMins"),
    dndDefaultMins: get("dndDefaultMins"),
    readAloud: get("readAloud"),
  });

  return NextResponse.redirect(new URL("/settings?saved=1", req.url), { status: 303 });
}
