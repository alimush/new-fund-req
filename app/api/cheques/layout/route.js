import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import User from "@/models/User";
import ChequeLayout from "@/models/ChequeLayout";
import {
  getChequeTemplate,
  isValidChequeTemplateKey,
} from "@/lib/cheques/templates";
import {
  fieldsFromTemplate,
  filterLayoutForTemplate,
  layoutPayloadFromFields,
  mergeTemplateFields,
} from "@/lib/cheques/mergeFields";
import {
  normalizePrintCalib,
  printCalibPayload,
} from "@/lib/cheques/printCalib";
import {
  requireChequeAccess,
  requireChequeEditor,
} from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

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

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json(
        { success: false, error: "قالب غير صالح" },
        { status: 400 }
      );
    }

    const tpl = getChequeTemplate(templateKey);
    const doc = await ChequeLayout.findOne({ templateKey }).lean();
    const data = filterLayoutForTemplate(tpl, doc?.fields || []);

    const dateShowSlashes =
      doc && typeof doc.dateShowSlashes === "boolean"
        ? doc.dateShowSlashes
        : tpl?.dateShowSlashesDefault ?? true;

    const mergedFields =
      data.length > 0 ? mergeTemplateFields(tpl, data) : fieldsFromTemplate(tpl);
    const printCalib = normalizePrintCalib(doc?.printCalib, tpl, mergedFields);

    return NextResponse.json({
      success: true,
      templateKey,
      data,
      dateShowSlashes,
      printCalib,
      updatedAt: doc?.updatedAt || null,
    });
  } catch (err) {
    console.error("❌ Cheque layout GET:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
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

    const editor = await requireChequeEditor(userId);
    if (!editor.ok) return editor.res;

    const user = await User.findById(userId).select("username").lean();
    const username = String(user?.username || "").trim();

    const body = await req.json();
    const templateKey = String(body?.templateKey || "").trim();

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json(
        { success: false, error: "قالب غير صالح" },
        { status: 400 }
      );
    }

    const tpl = getChequeTemplate(templateKey);
    const printCalibOnly = Boolean(body?.printCalibOnly);

    if (printCalibOnly) {
      const existing = await ChequeLayout.findOne({ templateKey }).lean();
      const existingLayout = filterLayoutForTemplate(tpl, existing?.fields || []);
      const existingFields =
        existingLayout.length > 0
          ? mergeTemplateFields(tpl, existingLayout)
          : fieldsFromTemplate(tpl);
      const printCalib = printCalibPayload(body?.printCalib, tpl, existingFields);
      const doc = await ChequeLayout.findOneAndUpdate(
        { templateKey },
        {
          $set: {
            templateKey,
            printCalib,
            updatedBy: username,
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      ).lean();

      return NextResponse.json({
        success: true,
        templateKey,
        printCalib: normalizePrintCalib(doc?.printCalib, tpl, existingFields),
      });
    }

    const fields = layoutPayloadFromFields(body?.fields || [], tpl);
    const dateShowSlashes =
      typeof body?.dateShowSlashes === "boolean"
        ? body.dateShowSlashes
        : tpl?.dateShowSlashesDefault ?? true;

    const update = {
      templateKey,
      fields,
      dateShowSlashes,
      updatedBy: username,
    };
    if (body?.printCalib != null) {
      update.printCalib = printCalibPayload(body.printCalib, tpl, fields);
    }

    const doc = await ChequeLayout.findOneAndUpdate(
      { templateKey },
      { $set: update },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    const savedSlashes =
      typeof doc?.dateShowSlashes === "boolean"
        ? doc.dateShowSlashes
        : dateShowSlashes;

    return NextResponse.json({
      success: true,
      templateKey,
      dateShowSlashes: savedSlashes,
      printCalib: normalizePrintCalib(doc?.printCalib, tpl, fields),
      data: { ...doc, fields, dateShowSlashes: savedSlashes },
    });
  } catch (err) {
    console.error("❌ Cheque layout POST:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
