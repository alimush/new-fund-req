import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import User from "@/models/User";
import ChequePrintJob from "@/models/ChequePrintJob";
import { getChequeTemplate, isValidChequeTemplateKey } from "@/lib/cheques/templates";
import { requireChequeAccess } from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)));

    const filter = {};
    if (templateKey && isValidChequeTemplateKey(templateKey)) {
      filter.templateKey = templateKey;
    }

    const total = await ChequePrintJob.countDocuments(filter);
    const rows = await ChequePrintJob.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    return NextResponse.json({
      success: true,
      data: rows,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error("❌ prints GET:", err);
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

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const user = await User.findById(userId).select("username").lean();
    const body = await req.json();
    const templateKey = String(body?.templateKey || "").trim();

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json({ success: false, error: "قالب غير صالح" }, { status: 400 });
    }

    const tpl = getChequeTemplate(templateKey);
    const doc = await ChequePrintJob.create({
      userId,
      username: String(user?.username || "").trim(),
      templateKey,
      templateName: tpl?.name || "",
      chequeId: body?.chequeId || null,
      printerName: String(body?.printerName || "").trim(),
      printMode: body?.printMode || "data",
      printMethod: body?.printMethod || "pdf-native",
      status: body?.status === "failed" ? "failed" : "success",
      payee: String(body?.payee || "").trim(),
      amountNumeric: Number(body?.amountNumeric) || 0,
      chequeNumber: String(body?.chequeNumber || "").trim(),
      appliedCalibration: body?.appliedCalibration || null,
    });

    return NextResponse.json({ success: true, id: doc._id });
  } catch (err) {
    console.error("❌ prints POST:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
