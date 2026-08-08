import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPresignedDownloadUrl } from "@/lib/s3/attachmentAccess";

export const maxDuration = 300;
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

function extractKeyFromS3Url(url) {
  try {
    const parsed = new URL(String(url || ""));
    if (!String(parsed.hostname || "").includes(".amazonaws.com")) return "";
    return fullyDecodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

/**
 * يوجّه المتصفح مباشرة لرابط S3 موقّع — يدعم المفاتيح العربية
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rawKey = request.nextUrl.searchParams.get("key");
    const url = request.nextUrl.searchParams.get("url");
    const fileName = request.nextUrl.searchParams.get("fileName") || "";

    const key = rawKey
      ? fullyDecodeURIComponent(rawKey)
      : extractKeyFromS3Url(url);

    if (key) {
      const signedUrl = await getPresignedDownloadUrl(key, 7200, fileName);
      return NextResponse.redirect(signedUrl, 302);
    }

    if (!url) {
      return NextResponse.json({ error: "URL or key missing" }, { status: 400 });
    }

    return NextResponse.redirect(url, 302);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
