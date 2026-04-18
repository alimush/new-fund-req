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

const DEFAULT_GLOBAL_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const DEFAULT_FIELD_STYLES = {
  amount: { fontSize: 16, fontWeight: 800, color: "#111827" },
  words: { fontSize: 16, fontWeight: 700, color: "#111827" },
  desc: { fontSize: 16, fontWeight: 600, color: "#111827" },
  bank: { fontSize: 16, fontWeight: 700, color: "#111827" },
  fxRate: { fontSize: 16, fontWeight: 800, color: "#111827" },
  receivedBy: { fontSize: 16, fontWeight: 600, color: "#111827" },
  beneficiary: { fontSize: 16, fontWeight: 700, color: "#111827" },
  notes: { fontSize: 16, fontWeight: 600, color: "#111827" },
  chequeNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  nationalId: { fontSize: 16, fontWeight: 700, color: "#111827" },
  phone: { fontSize: 16, fontWeight: 700, color: "#111827" },
  sanadNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  date: { fontSize: 16, fontWeight: 800, color: "#111827" },
  voucherNo: { fontSize: 16, fontWeight: 800, color: "#111827" },
  currencyMark: { fontSize: 16, fontWeight: 800, color: "#111827" },
};

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

function normalizeFontSize(v, fallback = 16) {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  return Math.max(8, Math.min(72, Number(n)));
}

function normalizeFontWeight(v, fallback = 700) {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  const num = Number(n);
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  return steps.reduce((prev, curr) =>
    Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
  );
}

function normalizeColor(v, fallback = "#111827") {
  const s = String(v || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

function sanitizeGlobalTextStyle(input = {}) {
  return {
    fontSize: normalizeFontSize(input?.fontSize, DEFAULT_GLOBAL_TEXT_STYLE.fontSize),
    fontWeight: normalizeFontWeight(input?.fontWeight, DEFAULT_GLOBAL_TEXT_STYLE.fontWeight),
    color: normalizeColor(input?.color, DEFAULT_GLOBAL_TEXT_STYLE.color),
  };
}

function sanitizeFieldStyles(input = {}, globalStyle = DEFAULT_GLOBAL_TEXT_STYLE) {
  const out = {};
  for (const key of Object.keys(DEFAULT_FIELD_STYLES)) {
    const src = input?.[key] || {};
    const base = DEFAULT_FIELD_STYLES[key];
    out[key] = {
      fontSize: normalizeFontSize(src?.fontSize, base.fontSize ?? globalStyle.fontSize),
      fontWeight: normalizeFontWeight(src?.fontWeight, base.fontWeight ?? globalStyle.fontWeight),
      color: normalizeColor(src?.color, base.color ?? globalStyle.color),
    };
  }
  return out;
}

function sanitizeBody(body = {}) {
  const globalTextStyle = sanitizeGlobalTextStyle(body.globalTextStyle || {});
  const fieldStyles = sanitizeFieldStyles(body.fieldStyles || {}, globalTextStyle);

  const amountStyle = fieldStyles.amount || DEFAULT_FIELD_STYLES.amount;
  const wordsStyle = fieldStyles.words || DEFAULT_FIELD_STYLES.words;
  const descStyle = fieldStyles.desc || DEFAULT_FIELD_STYLES.desc;
  const bankStyle = fieldStyles.bank || DEFAULT_FIELD_STYLES.bank;

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

    vChequeNo: String(body.vChequeNo ?? "").trim(),
    vNationalId: String(body.vNationalId ?? "").trim(),
    vPhone: String(body.vPhone ?? "").trim(),
    vSanadNo: String(body.vSanadNo ?? "").trim(),

    cbOne: Boolean(body.cbOne),
    cbTwo: Boolean(body.cbTwo),

    globalTextStyle,
    fieldStyles,

    // legacy support
    fontSizeAmount: String(amountStyle.fontSize),
    fontSizeWords: String(wordsStyle.fontSize),
    fontSizeDesc: String(descStyle.fontSize),
    fontSizeExtra: String(bankStyle.fontSize),

    fontColorMain: normalizeColor(amountStyle.color, "#111827"),
    fontColorAccent: normalizeColor(bankStyle.color, "#111827"),
  };
}

function sanitizeAttachment(att = {}) {
  if (!att || typeof att !== "object") return null;

  const key = String(att.key || "").trim();
  const name = String(att.name || "").trim();
  const url = String(att.url || "").trim();
  const contentType = String(att.contentType || "").trim();

  if (!key && !url) return null;

  return {
    key,
    name,
    url,
    contentType,
    size: Number(att.size || 0),
    uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date(),
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
        attachments: Array.isArray(doc.attachments)
          ? doc.attachments
          : doc.attachment
          ? [doc.attachment]
          : [],
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
    const deleteAttachmentKey = String(body?.deleteAttachmentKey || "").trim();
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

    if (deleteAttachmentKey) {
      const oldAttachments = Array.isArray(existing.attachments)
        ? existing.attachments
        : existing.attachment
        ? [existing.attachment]
        : [];

      const filteredAttachments = oldAttachments.filter(
        (att) => String(att?.key || "") !== deleteAttachmentKey
      );

      await col.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            attachments: filteredAttachments,
            updatedAt: new Date(),
            updatedBy: userId,
          },
          $unset: {
            attachment: "",
          },
        }
      );

      const updated = await col.findOne({ _id: new ObjectId(id) });

      return NextResponse.json({
        success: true,
        data: {
          ...updated,
          attachments: Array.isArray(updated.attachments)
            ? updated.attachments
            : [],
          _id: updated._id?.toString?.() || updated._id,
        },
      });
    }

    const attachmentOnly =
      body?.attachment &&
      !("vAmount" in body) &&
      !("vWords" in body) &&
      !("vDesc" in body) &&
      !("vBank" in body) &&
      !("vFxRate" in body) &&
      !("vReceivedBy" in body) &&
      !("vBeneficiary" in body) &&
      !("vNotes" in body) &&
      !("vChequeNo" in body) &&
      !("vNationalId" in body) &&
      !("vPhone" in body) &&
      !("vSanadNo" in body) &&
      !("vCurrency" in body) &&
      !("vDateYY" in body) &&
      !("vDateMM" in body) &&
      !("vDateDD" in body) &&
      !("cbOne" in body) &&
      !("cbTwo" in body) &&
      !("globalTextStyle" in body) &&
      !("fieldStyles" in body) &&
      !("fontSizeAmount" in body) &&
      !("fontSizeWords" in body) &&
      !("fontSizeDesc" in body) &&
      !("fontSizeExtra" in body) &&
      !("fontColorMain" in body) &&
      !("fontColorAccent" in body);

    let updateDoc = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (!attachmentOnly) {
      const payload = sanitizeBody(body);

      updateDoc = {
        ...updateDoc,
        ...payload,

        amount: payload.vAmount,
        amountWords: payload.vWords,
        description: payload.vDesc,
        bank: payload.vBank,
        fxRate: payload.vFxRate,
        receivedBy: payload.vReceivedBy,
        beneficiary: payload.vBeneficiary,
        notes: payload.vNotes,
        currency: payload.vCurrency,
        chequeNo: payload.vChequeNo,
        nationalId: payload.vNationalId,
        phone: payload.vPhone,
        sanadNo: payload.vSanadNo,
      };
    }

    const newAttachment = sanitizeAttachment(body.attachment);

    if (newAttachment) {
      const oldAttachments = Array.isArray(existing.attachments)
        ? existing.attachments
        : existing.attachment
        ? [existing.attachment]
        : [];

      const alreadyExists = oldAttachments.some(
        (x) =>
          String(x?.key || "") === String(newAttachment.key || "") &&
          String(x?.name || "") === String(newAttachment.name || "")
      );

      updateDoc.attachments = alreadyExists
        ? oldAttachments
        : [...oldAttachments, newAttachment];
    }

    await col.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updateDoc,
        $unset: {
          attachment: "",
        },
      }
    );

    const updated = await col.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        attachments: Array.isArray(updated.attachments)
          ? updated.attachments
          : updated.attachment
          ? [updated.attachment]
          : [],
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