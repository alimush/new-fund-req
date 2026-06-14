import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { COMPANIES } from "@/lib/voucher/companies";
import VoucherCounter from "@/models/VoucherCounter";
import { getModelForCompany } from "@/models/Request";
import { buildVoucherDateFromParts } from "@/lib/voucher/voucherDate";
import { sanitizeFieldColorRuns } from "@/lib/voucher/fieldColorRuns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_NAME = "vouchers";
const VOUCHER_COMPANIES = COMPANIES.map((c) => c.key);

const escapeRegex = (s) =>
  String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
      fontSize: normalizeFontSize(src?.fontSize, base.fontSize),
      fontWeight: normalizeFontWeight(src?.fontWeight, base.fontWeight),
      color: normalizeColor(src?.color, base.color),
    };
  }
  return out;
}

function buildBody(body) {
  const globalTextStyle = sanitizeGlobalTextStyle(body.globalTextStyle || {});
  const fieldStyles = sanitizeFieldStyles(body.fieldStyles || {}, globalTextStyle);

  const amountStyle = fieldStyles.amount || DEFAULT_FIELD_STYLES.amount;
  const bankStyle = fieldStyles.bank || DEFAULT_FIELD_STYLES.bank;

  const rawAmount = String(body.vAmount ?? "").replace(/,/g, "");
  const numericAmount = isNaN(Number(rawAmount)) ? 0 : Number(rawAmount);

  const vDateYY = normalize2(body.vDateYY);
  const vDateMM = normalize2(body.vDateMM);
  const vDateDD = normalize2(body.vDateDD);

  const fieldColorRuns = sanitizeFieldColorRuns(
    body.fieldColorRuns || {},
    {
      words: body.vWords,
      desc: body.vDesc,
      bank: body.vBank,
      fxRate: body.vFxRate,
      receivedBy: body.vReceivedBy,
      beneficiary: body.vBeneficiary,
      notes: body.vNotes,
      chequeNo: body.vChequeNo,
      nationalId: body.vNationalId,
      phone: body.vPhone,
      sanadNo: body.vSanadNo,
    },
    fieldStyles,
    globalTextStyle
  );

  return {
    // Date Parts
    dateParts: {
      yy: vDateYY,
      mm: vDateMM,
      dd: vDateDD,
    },

    voucherDate:
      buildVoucherDateFromParts(vDateYY, vDateMM, vDateDD) || undefined,

    // Main Fields (Mapping to original schema)
    amount: numericAmount,
    amountText: String(body.vAmount ?? "").trim(),
    amountWords: String(body.vWords ?? "").trim(),
    description: String(body.vDesc ?? "").trim(),
    currency: body.vCurrency === "USD" ? "USD" : "IQD",

    bank: String(body.vBank ?? "").trim(),
    fxRate: String(body.vFxRate ?? "").trim(),
    receivedBy: String(body.vReceivedBy ?? "").trim(),
    beneficiary: String(body.vBeneficiary ?? "").trim(),
    notes: String(body.vNotes ?? "").trim(),

    chequeNo: String(body.vChequeNo ?? "").trim(),
    nationalId: String(body.vNationalId ?? "").trim(),
    phone: String(body.vPhone ?? "").trim(),
    sanadNo: String(body.vSanadNo ?? "").trim(),

    cbOne: Boolean(body.cbOne),
    cbTwo: Boolean(body.cbTwo),

    globalTextStyle,
    fieldStyles,
    fieldColorRuns,

    // Legacy Support
    fontSizeAmount: String(amountStyle.fontSize),
    fontSizeWords: String(fieldStyles.words?.fontSize || 16),
    fontSizeDesc: String(fieldStyles.desc?.fontSize || 16),
    fontSizeExtra: String(bankStyle.fontSize),

    fontColorMain: amountStyle.color,
    fontColorAccent: bankStyle.color,

    // Keep v-prefixed fields for backward compatibility during transition if needed
    vAmount: String(body.vAmount ?? "").trim(),
    vWords: String(body.vWords ?? "").trim(),
    vDesc: String(body.vDesc ?? "").trim(),
    vCurrency: body.vCurrency === "USD" ? "USD" : "IQD",
    vDateYY,
    vDateMM,
    vDateDD,
  };
}

function sanitizeAttachment(att) {
  if (!att?.url) return null;
  const contentType =
    att.contentType || (att.url.endsWith(".pdf") ? "application/pdf" : "image/png");
  const key = String(att.key || "").trim();
  const out = {
    name: att.name || "Attachment",
    url: att.url,
    contentType,
    size: Number(att.size || 0),
    uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date(),
  };
  if (key) out.key = key;
  return out;
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

    const { allowedPerms } = await getUserAccess(userId);

    const hasGeneralAccess = allowedPerms.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) || 
                             allowedPerms.includes(PERMISSIONS.RECEIPTS);

    if (!hasGeneralAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية لمشاهدة هذا الوصل" },
        { status: 403 }
      );
    }

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

    const doc = await col.findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Voucher not found" },
        { status: 404 }
      );
    }

    // ✅ التحقق من الصلاحية الخاصة بالشركة الموجودة داخل الوصل
    const companyConfig = COMPANIES.find(c => String(c.key).toLowerCase() === String(doc.companyKey).toLowerCase());
    const hasSpecificAccess = companyConfig && allowedPerms.includes(companyConfig.permission);

    if (!hasSpecificAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية لمشاهدة وصولات هذه الشركة" },
        { status: 403 }
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
    console.error("Voucher View Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
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

    const body = await req.json();
    const id = body.id;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const { allowedPerms } = await getUserAccess(userId);
    const db = mongoose.connection.db;
    const col = db.collection(COLLECTION_NAME);

    const doc = await col.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // ✅ التحقق من صلاحية التعديل
    const companyConfig = COMPANIES.find(c => String(c.key).toLowerCase() === String(doc.companyKey).toLowerCase());
    const hasSpecificAccess = companyConfig && allowedPerms.includes(companyConfig.permission);

    if (!hasSpecificAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية لتعديل وصولات هذه الشركة" },
        { status: 403 }
      );
    }

    const now = new Date();
    let result;

    // Attachment-only update path (upload from reports page)
    if (body?.attachment) {
      const cleanAttachment = sanitizeAttachment(body.attachment);
      if (!cleanAttachment) {
        return NextResponse.json(
          { success: false, error: "Invalid attachment payload" },
          { status: 400 }
        );
      }

      result = await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $push: { attachments: cleanAttachment },
          $set: { updatedBy: userId, updatedAt: now },
        },
        {
          returnDocument: "after",
          returnOriginal: false, // for older driver compatibility
        }
      );
    } else if (body?.deleteAttachmentKey || body?.deleteAttachmentUrl) {
      const deleteKey = String(body.deleteAttachmentKey || "").trim();
      const deleteUrl = String(body.deleteAttachmentUrl || "").trim();
      if (!deleteKey && !deleteUrl) {
        return NextResponse.json(
          { success: false, error: "معرّف الاتاج غير صالح" },
          { status: 400 }
        );
      }

      const existing = await col.findOne({ _id: new ObjectId(id) });
      if (!existing) {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      }

      const before = Array.isArray(existing.attachments) ? existing.attachments : [];
      const nextAttachments = before.filter((a) => {
        if (deleteKey && String(a?.key || "").trim() === deleteKey) return false;
        if (deleteUrl && String(a?.url || "").trim() === deleteUrl) return false;
        return true;
      });

      if (nextAttachments.length === before.length) {
        return NextResponse.json(
          { success: false, error: "لم يُعثر على الاتاج المطلوب" },
          { status: 404 }
        );
      }

      result = await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            attachments: nextAttachments,
            updatedBy: userId,
            updatedAt: now,
          },
        },
        {
          returnDocument: "after",
          returnOriginal: false,
        }
      );
    } else {
      // Full voucher edit path
      const updateData = {
        ...buildBody(body),
        updatedBy: userId,
        updatedAt: now,
      };

      console.log("📝 Updating voucher ID:", id);
      result = await col.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        {
          returnDocument: "after",
          returnOriginal: false, // for older driver compatibility
        }
      );
    }

    // Handle both old and new driver return formats
    const updatedDoc = result?.value || result;

    if (!updatedDoc) {
      console.error("❌ Update failed: Document not found or result is empty");
      return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }

    console.log("✅ Update successful for ID:", id);

    return NextResponse.json({
      success: true,
      data: {
        ...updatedDoc,
        attachments: Array.isArray(updatedDoc.attachments)
          ? updatedDoc.attachments
          : updatedDoc.attachment
          ? [updatedDoc.attachment]
          : [],
        _id: updatedDoc._id.toString(),
      },
    });
  } catch (err) {
    console.error("Voucher Update Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    const { allowedPerms } = await getUserAccess(userId);
    const db = mongoose.connection.db;
    const col = db.collection(COLLECTION_NAME);

    const doc = await col.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const companyConfig = COMPANIES.find(
      (c) => String(c.key).toLowerCase() === String(doc.companyKey).toLowerCase()
    );
    const hasSpecificAccess =
      companyConfig && allowedPerms.includes(companyConfig.permission);

    if (!hasSpecificAccess) {
      return NextResponse.json(
        { success: false, error: "ليس لديك صلاحية لحذف وصولات هذه الشركة" },
        { status: 403 }
      );
    }

    const companyKey = String(doc.companyKey || "").trim();
    const mode = doc.mode === "receipt" ? "receipt" : "payment";
    const deletedSeq = Number(doc.seq);

    const delResult = await col.deleteOne({ _id: new ObjectId(id) });
    if (!delResult.deletedCount) {
      return NextResponse.json(
        { success: false, error: "فشل الحذف" },
        { status: 500 }
      );
    }

    const ridRaw = doc.requestId != null ? String(doc.requestId).trim() : "";
    if (ridRaw && ObjectId.isValid(ridRaw)) {
      try {
        const otherVouchers = await col.countDocuments({
          $or: [{ requestId: ridRaw }, { requestId: new ObjectId(ridRaw) }],
        });
        if (otherVouchers === 0) {
          const RequestModel = getModelForCompany(companyKey);
          const reqDoc = await RequestModel.findById(ridRaw);
          if (reqDoc?.workflow?.steps?.length) {
            const lastIdx = reqDoc.workflow.steps.length - 1;
            reqDoc.workflow.steps[lastIdx].voucherProcessedBy = null;
            reqDoc.workflow.steps[lastIdx].voucherProcessedAt = null;
            reqDoc.workflow.steps[lastIdx].voucherProcessedByUsername = "";
            reqDoc.workflow.steps[lastIdx].voucherId = "";
            reqDoc.workflow.steps[lastIdx].voucherNo = "";
            reqDoc.markModified(`workflow.steps.${lastIdx}`);
            await reqDoc.save();
          }
        }
      } catch (e) {
        console.error("Clear request voucher state after voucher delete:", e);
      }
    }

    // إرجاع العداد -1 فقط إذا كان هذا الوصل هو آخر رقم صادر (يتطابق مع العداد)
    if (Number.isFinite(deletedSeq) && companyKey) {
      const counterUpdate = await VoucherCounter.findOneAndUpdate(
        { companyKey, mode, seq: deletedSeq },
        { $inc: { seq: -1 } },
        { new: true }
      ).lean();

      if (counterUpdate && counterUpdate.seq < 0) {
        await VoucherCounter.updateOne(
          { companyKey, mode },
          { $set: { seq: 0 } }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Voucher Delete Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}