import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPresignedDownloadUrl } from "@/lib/s3/attachmentAccess";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const key = String(body?.key || "").trim();

    if (!key) {
      return NextResponse.json(
        { success: false, error: "key is required" },
        { status: 400 }
      );
    }

    const url = await getPresignedDownloadUrl(key, 7200);

    return NextResponse.json({ success: true, url });
  } catch (err) {
    console.error("download-url error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to sign download URL" },
      { status: 500 }
    );
  }
}
