import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPresignedDownloadUrl } from "@/lib/s3/attachmentAccess";

export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * يوجّه المتصفح مباشرة لرابط S3 موقّع — بدون تحميل الملف في الذاكرة
 * (يدعم ملفات كبيرة حتى غيغات بدون حد استجابة Lambda)
 */
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const key = request.nextUrl.searchParams.get("key");
    const url = request.nextUrl.searchParams.get("url");

    if (key) {
      const signedUrl = await getPresignedDownloadUrl(key, 7200);
      return NextResponse.redirect(signedUrl, 302);
    }

    if (!url) {
      return NextResponse.json({ error: "URL or key missing" }, { status: 400 });
    }

    // إن أمكن استخراج المفتاح من رابط S3 نوقّع تحميلاً آمناً
    try {
      const parsed = new URL(url);
      const host = parsed.hostname || "";
      if (host.includes(".amazonaws.com")) {
        const pathKey = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
        if (pathKey) {
          const signedUrl = await getPresignedDownloadUrl(pathKey, 7200);
          return NextResponse.redirect(signedUrl, 302);
        }
      }
    } catch {
      /* fall through */
    }

    return NextResponse.redirect(url, 302);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
