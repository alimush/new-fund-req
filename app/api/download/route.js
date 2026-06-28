import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPresignedDownloadUrl } from "@/lib/s3/attachmentAccess";

export const maxDuration = 300;
export const runtime = "nodejs";

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
      const res = await fetch(signedUrl);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch file: ${res.status}` },
          { status: 400 }
        );
      }
      const buffer = await res.arrayBuffer();
      const filename = decodeURIComponent(key.split("/").pop() || "file");
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type":
            res.headers.get("content-type") || "application/octet-stream",
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    if (!url) {
      return NextResponse.json({ error: "URL or key missing" }, { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch file: ${res.status}` },
        { status: 400 }
      );
    }

    const buffer = await res.arrayBuffer();
    const filename = decodeURIComponent(url.split("/").pop() || "file");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          res.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}