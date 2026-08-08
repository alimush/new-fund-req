import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPresignedDownloadUrl } from "@/lib/s3/attachmentAccess";

export const runtime = "nodejs";

function fullyDecodeURIComponent(input = "") {
  let cur = String(input || "");
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(cur);
      if (next === cur) break;
      cur = next;
    } catch {
      break;
    }
  }
  return cur;
}

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
    let key = String(body?.key || "").trim();
    const fileName = String(body?.fileName || body?.name || "").trim();

    if (!key && body?.url) {
      try {
        const parsed = new URL(String(body.url));
        if (String(parsed.hostname || "").includes(".amazonaws.com")) {
          key = fullyDecodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
        }
      } catch {
        /* ignore */
      }
    }

    if (key) key = fullyDecodeURIComponent(key);

    if (!key) {
      return NextResponse.json(
        { success: false, error: "key is required" },
        { status: 400 }
      );
    }

    const url = await getPresignedDownloadUrl(key, 7200, fileName);

    return NextResponse.json({ success: true, url });
  } catch (err) {
    console.error("download-url error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to sign download URL" },
      { status: 500 }
    );
  }
}
