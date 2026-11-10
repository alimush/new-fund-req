import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import VoucherDailyPrintPrefs from "@/models/VoucherDailyPrintPrefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HARD_DEFAULT = { fontSize: 9, fontBold: true };

function clampFontSize(n, fallback = HARD_DEFAULT.fontSize) {
  const v = Number(n);
  if (!Number.isFinite(v)) return clampFontSize(fallback, 9);
  return Math.min(14, Math.max(7, Math.round(v)));
}

function prefsPayload(doc, fallback = HARD_DEFAULT) {
  const base = fallback || HARD_DEFAULT;
  return {
    fontSize: clampFontSize(doc?.fontSize ?? base.fontSize, base.fontSize),
    fontBold:
      doc?.fontBold !== undefined && doc?.fontBold !== null
        ? doc.fontBold !== false
        : base.fontBold !== false,
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
    // ديفولت عام لكل اليوزر: حجم 9 — إلا إذا عنده إعداد محفوظ لنفسه
    const data = doc ? prefsPayload(doc, HARD_DEFAULT) : HARD_DEFAULT;

    return NextResponse.json({
      success: true,
      data,
      meta: {
        source: doc ? "user" : "hardcoded",
      },
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
