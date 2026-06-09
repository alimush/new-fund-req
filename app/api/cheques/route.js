import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import User from "@/models/User";
import Cheque from "@/models/Cheque";
import {
  getChequeTemplate,
  isValidChequeTemplateKey,
} from "@/lib/cheques/templates";
import { requireChequeAccess } from "@/lib/cheques/chequeAuth";

export const runtime = "nodejs";

function parseAmount(v) {
  const cleaned = String(v ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
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
    const templateKey = searchParams.get("templateKey") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10))
    );

    const filter = {};
    if (templateKey && isValidChequeTemplateKey(templateKey)) {
      filter.templateKey = templateKey;
    }

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
    console.error("❌ Cheques GET:", err);
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

    const access = await requireChequeAccess(userId);
    if (!access.ok) return access.res;

    const user = await User.findById(userId).select("username").lean();
    const username = String(user?.username || "").trim();

    const body = await req.json();
    const templateKey = String(body?.templateKey || "").trim();

    if (!isValidChequeTemplateKey(templateKey)) {
      return NextResponse.json(
        { success: false, error: "قالب صك غير صالح" },
        { status: 400 }
      );
    }

    const tpl = getChequeTemplate(templateKey);

    const doc = await Cheque.create({
      templateKey,
      templateName: tpl?.name || "",
      bankName: tpl?.bankName || "",
      bankNameEn: tpl?.bankNameEn || "",
      drawerName: tpl?.drawerName || "",
      branch: String(body?.branch || tpl?.branch || "").trim(),
      chequeNumber: String(body?.chequeNumber || "").trim(),
      accountNumber: String(body?.accountNumber || "").trim(),
      dateParts: {
        dd: String(body?.dateParts?.dd ?? body?.dateDay ?? "").trim(),
        mm: String(body?.dateParts?.mm ?? body?.dateMonth ?? "").trim(),
        yy: String(body?.dateParts?.yy ?? body?.dateYear ?? "").trim(),
      },
      customer: String(body?.customer || "").trim(),
      payee: String(body?.payee || "").trim(),
      governorate: String(body?.governorate || "").trim(),
      amountNumeric: parseAmount(body?.amountNumeric),
      amountWords: String(body?.amountWords || "").trim(),
      text: String(body?.text || "").trim(),
      textFieldLayout: body?.textFieldLayout || undefined,
      currency: String(body?.currency || tpl?.currency || "IQD").trim(),
      bearer: Boolean(body?.bearer),
      status: body?.status === "issued" ? "issued" : "draft",
      createdBy: username,
      createdByUserId: userId,
    });

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("❌ Cheques POST:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
