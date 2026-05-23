import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Cheque from "@/models/Cheque";
import { isValidChequeTemplateKey } from "@/lib/cheques/templates";
import { requireChequeAccess } from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDateEnd(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function GET(req) {
  try {
    await dbConnect();

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const { searchParams } = new URL(req.url);
    const templateKey = String(searchParams.get("templateKey") || "").trim();
    const chequeNumber = String(searchParams.get("chequeNumber") || "").trim();
    const accountNumber = String(searchParams.get("accountNumber") || "").trim();
    const payee = String(searchParams.get("payee") || "").trim();
    const q = String(searchParams.get("q") || "").trim();
    const dateFrom = String(searchParams.get("dateFrom") || "").trim();
    const dateTo = String(searchParams.get("dateTo") || "").trim();
    const amountMin = searchParams.get("amountMin");
    const amountMax = searchParams.get("amountMax");

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    const filter = {};

    if (templateKey && isValidChequeTemplateKey(templateKey)) {
      filter.templateKey = templateKey;
    }

    if (chequeNumber) {
      filter.chequeNumber = new RegExp(`^${escapeRegex(chequeNumber)}$`, "i");
    }

    if (accountNumber) {
      filter.accountNumber = new RegExp(escapeRegex(accountNumber), "i");
    }

    if (payee) {
      filter.payee = new RegExp(escapeRegex(payee), "i");
    }

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { chequeNumber: rx },
        { accountNumber: rx },
        { payee: rx },
        { amountWords: rx },
        { createdBy: rx },
        { bankName: rx },
      ];
    }

    const createdAt = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) createdAt.$gte = d;
    }
    if (dateTo) {
      const d = parseDateEnd(dateTo);
      if (d) createdAt.$lte = d;
    }
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;

    const amountFilter = {};
    if (amountMin !== null && amountMin !== "") {
      const n = Number(amountMin);
      if (Number.isFinite(n)) amountFilter.$gte = n;
    }
    if (amountMax !== null && amountMax !== "") {
      const n = Number(amountMax);
      if (Number.isFinite(n)) amountFilter.$lte = n;
    }
    if (Object.keys(amountFilter).length) filter.amountNumeric = amountFilter;

    const total = await Cheque.countDocuments(filter);
    const data = await Cheque.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: total ? Math.ceil(total / pageSize) : 0,
      },
    });
  } catch (err) {
    console.error("❌ Cheques reports GET:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
