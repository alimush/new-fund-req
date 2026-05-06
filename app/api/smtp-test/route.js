import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "This endpoint is disabled for security reasons." },
    { status: 403 }
  );
}