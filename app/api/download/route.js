import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL missing" }, { status: 400 });
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