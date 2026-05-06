import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { success: false, error: "This endpoint is disabled for security reasons." },
    { status: 403 }
  );
}