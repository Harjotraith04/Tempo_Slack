import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { exportUserData, getStore } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = currentUserId();
  if (!userId) return new NextResponse("Not signed in", { status: 401 });

  const data = await exportUserData(getStore(), userId);
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tempo-data.json"',
    },
  });
}
