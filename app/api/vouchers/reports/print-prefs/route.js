import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import VoucherDailyPrintPrefs from "@/models/VoucherDailyPrintPrefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMN_KEYS = [
  "details",
  "amounts",
  "bank",
  "cheque",
  "fx",
  "doctype",
  "vno",
];

const TARGET_KEYS = new Set(["all", ...COLUMN_KEYS]);

function clampFontSize(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 9;
  return Math.min(14, Math.max(7, Math.round(v)));
}

function normalizeFontTarget(raw) {
  const key = String(raw || "all").trim();
  return TARGET_KEYS.has(key) ? key : "all";
}

function defaultFontSizes(size = 9) {
  const s = clampFontSize(size);
  return Object.fromEntries(COLUMN_KEYS.map((k) => [k, s]));
}

function normalizeFontSizes(raw, fallbackSize = 9) {
  const out = defaultFontSizes(fallbackSize);
  if (!raw || typeof raw !== "object") return out;
  for (const k of COLUMN_KEYS) {
    if (raw[k] != null) out[k] = clampFontSize(raw[k]);
  }
  return out;
}

function prefsPayload(doc) {
  const fontSize = clampFontSize(doc?.fontSize ?? 9);
  const fontSizes = normalizeFontSizes(doc?.fontSizes, fontSize);
  return {
    fontSize,
    fontBold: doc?.fontBold !== false,
    fontTarget: normalizeFontTarget(doc?.fontTarget),
    fontSizes,
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
    const fontTarget = normalizeFontTarget(body?.fontTarget);
    const fontSizes = normalizeFontSizes(body?.fontSizes, fontSize);

    const doc = await VoucherDailyPrintPrefs.findOneAndUpdate(
      { userId },
      { $set: { fontSize, fontBold, fontTarget, fontSizes } },
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
