import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, error: "This endpoint is disabled for security reasons." },
    { status: 403 }
  );
}