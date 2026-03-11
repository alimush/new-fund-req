// /app/api/vouchers/view/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

const COLLECTION_NAME = "vouchers";
const VOUCHER_COMPANIES = ["Al-Ghadeer", "Badur-Baghdad"];

async function getUserAccess(userId) {
  if (!userId) return { allowedCompanies: [], allowedPerms: [] };

  const groups = await Permissions.find({ users: userId })
    .select("companies permissions")
    .lean();

  const companiesSet = new Set();
  const permsSet = new Set();

  for (const g of groups) {
    (g.companies || []).forEach((c) => companiesSet.add(String(c).trim()));
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }

  return {
    allowedCompanies: Array.from(companiesSet).filter(Boolean),
    allowedPerms: Array.from(permsSet).filter(Boolean),
  };
}

function normalize2(v) {
  return String(v || "")
    .replace(/[^\d]/g, "")
    .slice(0, 2);
}

function sanitizeBody(body = {}) {
  return {
    vDateYY: normalize2(body.vDateYY),
    vDateMM: normalize2(body.vDateMM),
    vDateDD: normalize2(body.vDateDD),

    vAmount: String(body.vAmount ?? "").trim(),
    vWords: String(body.vWords ?? "").trim(),
    vDesc: String(body.vDesc ?? "").trim(),
    vCurrency: body.vCurrency === "USD" ? "USD" : "IQD",

    vBank: String(body.vBank ?? "").trim(),
    vFxRate: String(body.vFxRate ?? "").trim(),
    vReceivedBy: String(body.vReceivedBy ?? "").trim(),
    vBeneficiary: String(body.vBeneficiary ?? "").trim(),
    vNotes: String(body.vNotes ?? "").trim(),

    cbOne: Boolean(body.cbOne),
    cbTwo: Boolean(body.cbTwo),
  };
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

    const { allowedCompanies, allowedPerms } = await getUserAccess(userId);

    if (
      !allowedPerms.includes(PERMISSIONS.VIEW_REPORTS) &&
      !allowedPerms.includes(PERMISSIONS.RECEIPTS)
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const finalAllowedCompanies = allowedCompanies.filter((c) =>
      VOUCHER_COMPANIES.includes(String(c))
    );

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const db = mongoose.connection.db;
    const col = db.collection(COLLECTION_NAME);

    const doc = await col.findOne({
      _id: new ObjectId(id),
      companyKey: { $in: finalAllowedCompanies },
    });

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Voucher not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...doc,
        _id: doc._id?.toString?.() || doc._id,
      },
    });
  } catch (err) {
    console.error("❌ Voucher view API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
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

    const { allowedCompanies, allowedPerms } = await getUserAccess(userId);

    if (!allowedPerms.includes(PERMISSIONS.RECEIPTS)) {
      return NextResponse.json(
        { success: false, error: "You do not have edit permission" },
        { status: 403 }
      );
    }

    const finalAllowedCompanies = allowedCompanies.filter((c) =>
      VOUCHER_COMPANIES.includes(String(c))
    );

    const body = await req.json();
    const id = String(body?.id || "").trim();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid id" },
        { status: 400 }
      );
    }

    const db = mongoose.connection.db;
    const col = db.collection(COLLECTION_NAME);

    const existing = await col.findOne({
      _id: new ObjectId(id),
      companyKey: { $in: finalAllowedCompanies },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Voucher not found" },
        { status: 404 }
      );
    }

    const payload = sanitizeBody(body);

    const updateDoc = {
      ...payload,
      amount: payload.vAmount,
      description: payload.vDesc,
      bank: payload.vBank,
      receivedBy: payload.vReceivedBy,
      beneficiary: payload.vBeneficiary,
      notes: payload.vNotes,
      currency: payload.vCurrency,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );

    const updated = await col.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        _id: updated._id?.toString?.() || updated._id,
      },
    });
  } catch (err) {
    console.error("❌ Voucher update API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}