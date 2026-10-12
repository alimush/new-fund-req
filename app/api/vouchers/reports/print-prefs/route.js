import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import VoucherDailyPrintPrefs from "@/models/VoucherDailyPrintPrefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampFontSize(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 9;
  return Math.min(14, Math.max(7, Math.round(v)));
}

function prefsPayload(doc) {
  return {
    fontSize: clampFontSize(doc?.fontSize ?? 9),
    fontBold: doc?.fontBold !== false,
  };
}

async function requireUserId() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null;
  }
  return userId;
}

export async function GET() {
  try {
    await dbConnect();
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const doc = await VoucherDailyPrintPrefs.findOne({ userId }).lean();
    return NextResponse.json({
      success: true,
      data: prefsPayload(doc),
    });
  } catch (e) {
    console.error("print-prefs GET:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    await dbConnect();
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const fontSize = clampFontSize(body?.fontSize);
    const fontBold = body?.fontBold !== false;

    const doc = await VoucherDailyPrintPrefs.findOneAndUpdate(
      { userId },
      {
        $set: { fontSize, fontBold },
        $unset: { fontTarget: 1, fontSizes: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      data: prefsPayload(doc),
    });
  } catch (e) {
    console.error("print-prefs PUT:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
