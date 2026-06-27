import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import PrinterCalibration from "@/models/PrinterCalibration";
import { getChequeTemplate, isValidChequeTemplateKey } from "@/lib/cheques/templates";
import { fieldsFromTemplate, mergeTemplateFields } from "@/lib/cheques/mergeFields";
import ChequeLayout from "@/models/ChequeLayout";
import { filterLayoutForTemplate } from "@/lib/cheques/mergeFields";
import {
  mergePrintCalibs,
  normalizePrintCalib,
  printCalibPayload,
} from "@/lib/cheques/printerCalibration";
import { requireChequeAccess, requireManagePermissions } from "@/lib/cheques/chequeAuth";
import {
  RAFIDAIN_TEMPLATE_KEY,
  REAL_ESTATE_TEMPLATE_KEY,
} from "@/lib/cheques/chequeBranches";
import { resolveChequeLayoutDocument } from "@/lib/cheques/chequeLayoutSource";

export const runtime = "nodejs";

async function mergedFieldsForTemplate(tpl, templateKey) {
  const { doc } = await resolveChequeLayoutDocument(templateKey);
  const data = filterLayoutForTemplate(tpl, doc?.fields || []);
  return data.length > 0 ? mergeTemplateFields(tpl, data) : fieldsFromTemplate(tpl);
}

async function layoutDocForTemplate(templateKey) {
  const { doc } = await resolveChequeLayoutDocument(templateKey);
  return doc;
}

export async function GET(req) {
  try {
    await dbConnect();
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const { searchParams } = new URL(req.url);
    const templateKey = String(searchParams.get("templateKey") || "").trim();
    const printerName = String(searchParams.get("printerName") || "").trim();
    const listAll = searchParams.get("list") === "1";

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json({ success: false, error: "قالب غير صالح" }, { status: 400 });
    }

    if (listAll) {
      const rows = await PrinterCalibration.find({ userId, templateKey })
        .sort({ isDefault: -1, updatedAt: -1 })
        .lean();
      return NextResponse.json({
        success: true,
        templateKey,
        items: rows.map((r) => ({
          _id: r._id,
          printerName: r.printerName,
          isDefault: Boolean(r.isDefault),
          lastCalibratedAt: r.lastCalibratedAt,
          updatedAt: r.updatedAt,
        })),
      });
    }

    const tpl = getChequeTemplate(templateKey);
    const fields = await mergedFieldsForTemplate(tpl, templateKey);
    const layoutDoc = await layoutDocForTemplate(templateKey);
    const layoutCalib = normalizePrintCalib(layoutDoc?.printCalib, tpl, fields);

    let printerDoc = null;
    if (printerName) {
      printerDoc = await PrinterCalibration.findOne({ userId, templateKey, printerName }).lean();
      if (!printerDoc && templateKey === RAFIDAIN_TEMPLATE_KEY) {
        printerDoc = await PrinterCalibration.findOne({
          userId,
          templateKey: REAL_ESTATE_TEMPLATE_KEY,
          printerName,
        }).lean();
      }
    } else {
      printerDoc = await PrinterCalibration.findOne({ userId, templateKey, isDefault: true }).lean();
      if (!printerDoc && templateKey === RAFIDAIN_TEMPLATE_KEY) {
        printerDoc = await PrinterCalibration.findOne({
          userId,
          templateKey: REAL_ESTATE_TEMPLATE_KEY,
          isDefault: true,
        }).lean();
      }
    }

    const printCalib = mergePrintCalibs(
      layoutCalib,
      printerDoc?.printCalib,
      tpl,
      fields
    );

    return NextResponse.json({
      success: true,
      templateKey,
      printerName: printerDoc?.printerName || printerName || "",
      calibrationId: printerDoc?._id || null,
      printCalib,
      layoutCalib,
      printerCalib: printerDoc?.printCalib || null,
    });
  } catch (err) {
    console.error("❌ calibration GET:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireManagePermissions(userId);
    if (!access.ok) return access.res;

    const body = await req.json();
    const templateKey = String(body?.templateKey || "").trim();
    const printerName = String(body?.printerName || "").trim();

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json({ success: false, error: "قالب غير صالح" }, { status: 400 });
    }
    if (!printerName) {
      return NextResponse.json({ success: false, error: "اسم الطابعة مطلوب" }, { status: 400 });
    }

    const tpl = getChequeTemplate(templateKey);
    const fields = await mergedFieldsForTemplate(tpl, templateKey);
    const printCalib = printCalibPayload(body?.printCalib, tpl, fields);
    const isDefault = Boolean(body?.isDefault);
    const fromWizard = Boolean(body?.fromWizard);

    if (isDefault) {
      await PrinterCalibration.updateMany(
        { userId, templateKey },
        { $set: { isDefault: false } }
      );
    }

    const doc = await PrinterCalibration.findOneAndUpdate(
      { userId, templateKey, printerName },
      {
        $set: {
          userId,
          templateKey,
          printerName,
          printCalib,
          isDefault,
          lastCalibratedAt: fromWizard ? new Date() : body?.lastCalibratedAt || new Date(),
          notes: String(body?.notes || "").trim(),
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    return NextResponse.json({
      success: true,
      calibrationId: doc._id,
      printerName: doc.printerName,
      printCalib: normalizePrintCalib(doc.printCalib, tpl, fields),
      isDefault: doc.isDefault,
    });
  } catch (err) {
    console.error("❌ calibration POST:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
