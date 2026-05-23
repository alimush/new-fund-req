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
  filterLayoutForTemplate,
  layoutPayloadFromFields,
} from "@/lib/cheques/mergeFields";
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

    return NextResponse.json({
      success: true,
      templateKey,
      data,
      dateShowSlashes,
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
    const fields = layoutPayloadFromFields(body?.fields || [], tpl);
    const dateShowSlashes =
      typeof body?.dateShowSlashes === "boolean"
        ? body.dateShowSlashes
        : tpl?.dateShowSlashesDefault ?? true;

    const doc = await ChequeLayout.findOneAndUpdate(
      { templateKey },
      {
        $set: {
          templateKey,
          fields,
          dateShowSlashes,
          updatedBy: username,
        },
      },
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
