import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PaymentPlan from "@/models/PaymentPlan";
import ExWorkflow from "@/models/ExWorkflow";
import { Types } from "mongoose";

export const runtime = "nodejs";

/* ================= Helpers ================= */

function cleanStr(v) {
  return String(v ?? "").trim();
}

function cleanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      payType: cleanStr(r?.payType),
      amount: cleanStr(r?.amount),
      payDateYMD: cleanStr(r?.payDateYMD),
    }))
    .filter((r) => r.payType || r.amount || r.payDateYMD);
}

const toObjId = (v) => {
  if (!v) return null;
  if (v instanceof Types.ObjectId) return v;
  const s = String(v);
  if (!Types.ObjectId.isValid(s)) return null;
  return new Types.ObjectId(s);
};

async function buildWorkflowForKey(key) {
  const wf = await ExWorkflow.findOne({ pageKey: key }).lean();
  if (!wf) return { key, name: "", steps: [] };

  const steps = Array.isArray(wf?.steps) ? wf.steps : [];

  return {
    key,
    name: wf?.name || "",
    steps: steps.map((s) => {
      const rawUsers = Array.isArray(s?.users) ? s.users : [];
      const users = rawUsers.map(toObjId).filter(Boolean);

      return {
        users,
        status: "Pending",
        actedBy: null,
        actedAt: null,
        comment: "",
      };
    }),
  };
}

/* ======================= GET ======================= */
export async function GET() {
  try {
    await dbConnect();

    // ✅ حاول populate
    try {
      const data = await PaymentPlan.find()
        .sort({ createdAt: -1 })
        .populate({
          path: "createdById",
          model: "User",          // ✅ أهم تعديل
          select: "username email",
          strictPopulate: false,
        })
        .lean();

      return NextResponse.json({ success: true, data });
    } catch (popErr) {
      // ✅ fallback: رجّع بدون populate حتى ما ينكسر الـ GET
      console.error("⚠️ populate failed, fallback:", popErr?.message || popErr);

      const data = await PaymentPlan.find().sort({ createdAt: -1 }).lean();
      return NextResponse.json({
        success: true,
        data,
        warn: "POPULATE_FAILED_FALLBACK",
      });
    }
  } catch (e) {
    console.error("❌ GET_FAILED:", e?.message || e);
    return NextResponse.json(
      { success: false, error: e?.message || "GET_FAILED" },
      { status: 500 }
    );
  }
}

/* ======================= POST ======================= */
export async function POST(req) {
  try {
    await dbConnect();
    const body = await req.json();

    const createdBy = cleanStr(body?.createdBy);
    const createdByIdObj = toObjId(body?.createdById);

    const rows = cleanRows(body?.rows);

    if (!cleanStr(body?.customer) && !cleanStr(body?.unitNo) && rows.length === 0) {
      return NextResponse.json({ success: false, error: "EMPTY_PAYLOAD" }, { status: 400 });
    }

    const pageKey = cleanStr(body?.pageKey) || "exceptions";
    const workflow = await buildWorkflowForKey(pageKey);

    const docBody = {
      salesEmp: cleanStr(body?.salesEmp),
      customer: cleanStr(body?.customer),
      unitNo: cleanStr(body?.unitNo),
      dateDMY: cleanStr(body?.dateDMY),
      discount: cleanStr(body?.discount),
      signature: cleanStr(body?.signature),
      rows,

      createdBy: createdBy || "",
      createdById: createdByIdObj || null,

      pageKey,
      workflow,
      status: "Pending",
      currentStep: workflow?.steps?.length ? 0 : -1,
    };

    const doc = await PaymentPlan.create(docBody);

    // ✅ اختياري: رجّع populated (وإذا فشل رجّع عادي)
    let doc2 = null;
    try {
      doc2 = await PaymentPlan.findById(doc._id)
        .populate({
          path: "createdById",
          model: "User",
          select: "username email",
          strictPopulate: false,
        })
        .lean();
    } catch {}

    return NextResponse.json({
      success: true,
      id: String(doc._id),
      data: doc2 || doc.toObject?.() || doc,
    });
  } catch (e) {
    console.error("❌ POST_FAILED:", e?.message || e);
    return NextResponse.json(
      { success: false, error: e?.message || "POST_FAILED" },
      { status: 500 }
    );
  }
}