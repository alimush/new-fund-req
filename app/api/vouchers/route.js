import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Voucher from "@/models/Voucher";
import VoucherCounter from "@/models/VoucherCounter";

export const runtime = "nodejs";

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

export async function POST(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value || "";

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

      cbOne,
      cbTwo,
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

    // 1) جيب الرقم التالي
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

    // 2) خزّن الوصل
    const doc = await Voucher.create({
      companyKey: safeString(companyKey),
      companyName: safeString(companyName),
      mode,
      seq,
      voucherNo,
      requestId: requestId || null,

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

      cbOne: Boolean(cbOne),
      cbTwo: Boolean(cbTwo),

      createdByUserId: userId,
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