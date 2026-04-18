import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Voucher from "@/models/Voucher";
import VoucherCounter from "@/models/VoucherCounter";

export const runtime = "nodejs";

const DEFAULT_GLOBAL_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const DEFAULT_FIELD_STYLES = {
  date: { fontSize: 18, fontWeight: 800, color: "#ffffff" },
  amount: { fontSize: 16, fontWeight: 800, color: "#111827" },
  words: { fontSize: 16, fontWeight: 700, color: "#111827" },
  desc: { fontSize: 16, fontWeight: 600, color: "#111827" },
  bank: { fontSize: 16, fontWeight: 700, color: "#111827" },
  fxRate: { fontSize: 16, fontWeight: 700, color: "#111827" },
  receivedBy: { fontSize: 16, fontWeight: 700, color: "#111827" },
  notes: { fontSize: 16, fontWeight: 600, color: "#111827" },
  chequeNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  nationalId: { fontSize: 16, fontWeight: 700, color: "#111827" },
  phone: { fontSize: 16, fontWeight: 700, color: "#111827" },
};

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const companyKey = searchParams.get("companyKey");
    const requestId = searchParams.get("requestId");
    const mode = searchParams.get("mode") || "payment";

    if (!companyKey || !requestId) {
      return NextResponse.json(
        { success: false, error: "companyKey and requestId are required" },
        { status: 400 }
      );
    }

    const doc = await Voucher.findOne({
      companyKey,
      requestId,
      mode,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: doc || null,
    });
  } catch (err) {
    console.error("Voucher GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}

function safeString(v) {
  return String(v ?? "").trim();
}

function toNumber(v, def = 0) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

function buildVoucherDate(yy, mm, dd) {
  const y = safeString(yy);
  const m = safeString(mm);
  const d = safeString(dd);

  if (!y || !m || !d) return new Date();

  const fullYear = Number(y) >= 50 ? `19${y}` : `20${y}`;
  const iso = `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`;

  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeColor(value, fallback = "#111827") {
  const v = String(value || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function sanitizeGlobalTextStyle(input = {}) {
  return {
    fontSize: clampNumber(input.fontSize, 8, 72, DEFAULT_GLOBAL_TEXT_STYLE.fontSize),
    fontWeight: clampNumber(input.fontWeight, 100, 900, DEFAULT_GLOBAL_TEXT_STYLE.fontWeight),
    color: safeColor(input.color, DEFAULT_GLOBAL_TEXT_STYLE.color),
  };
}

function sanitizeFieldStyles(input = {}) {
  const result = {};

  Object.keys(DEFAULT_FIELD_STYLES).forEach((key) => {
    const incoming = input?.[key] || {};
    const base = DEFAULT_FIELD_STYLES[key];

    result[key] = {
      fontSize: clampNumber(incoming.fontSize, 8, 72, base.fontSize),
      fontWeight: clampNumber(incoming.fontWeight, 100, 900, base.fontWeight),
      color: safeColor(incoming.color, base.color),
    };
  });

  return result;
}

export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value || "";
    const createdByName = cookieStore.get("username")?.value || "";

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      companyKey,
      companyName,
      mode,
      requestId = null,
      requestCode = "",

      vDateYY,
      vDateMM,
      vDateDD,

      vAmount,
      vWords,
      vDesc,
      vCurrency,

      vBank,
      vFxRate,
      vReceivedBy,
      vBeneficiary,
      vNotes,

      vChequeNo,
      vNationalId,
      vPhone,
      vSanadNo,

      cbOne,
      cbTwo,

      globalTextStyle,
      fieldStyles,
    } = body || {};

    if (!companyKey || !mode) {
      return NextResponse.json(
        { success: false, error: "companyKey and mode are required" },
        { status: 400 }
      );
    }

    if (!["payment", "receipt"].includes(mode)) {
      return NextResponse.json(
        { success: false, error: "Invalid mode" },
        { status: 400 }
      );
    }

    const counter = await VoucherCounter.findOneAndUpdate(
      { companyKey, mode },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    const seq = counter.seq;
    const voucherNo = String(seq).padStart(5, "0");

    const doc = await Voucher.create({
      companyKey: safeString(companyKey),
      companyName: safeString(companyName),
      mode,
      seq,
      voucherNo,

      requestId: requestId ? safeString(requestId) : null,
      requestCode: safeString(requestCode),

      voucherDate: buildVoucherDate(vDateYY, vDateMM, vDateDD),

      dateParts: {
        yy: safeString(vDateYY),
        mm: safeString(vDateMM),
        dd: safeString(vDateDD),
      },

      amount: toNumber(vAmount, 0),
      amountText: safeString(vAmount),
      amountWords: safeString(vWords),
      currency: safeString(vCurrency || "IQD").toUpperCase(),

      description: safeString(vDesc),
      bank: safeString(vBank),
      fxRate: safeString(vFxRate),
      receivedBy: safeString(vReceivedBy),
      beneficiary: safeString(vBeneficiary),
      notes: safeString(vNotes),

      chequeNo: safeString(vChequeNo),
      nationalId: safeString(vNationalId),
      phone: safeString(vPhone),
      sanadNo: safeString(vSanadNo),

      cbOne: Boolean(cbOne),
      cbTwo: Boolean(cbTwo),

      globalTextStyle: sanitizeGlobalTextStyle(globalTextStyle),
      fieldStyles: sanitizeFieldStyles(fieldStyles),

      createdByUserId: userId,
      createdByName,
    });

    return NextResponse.json({
      success: true,
      message: "Voucher created successfully",
      data: doc,
    });
  } catch (err) {
    console.error("❌ Create Voucher Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}