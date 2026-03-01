import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PaymentPlan from "@/models/PaymentPlan";
import ExWorkflow from "@/models/ExWorkflow";
import { Types } from "mongoose";
import User from "@/models/User";

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

function cleanAttachments(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => ({
      key: cleanStr(a?.key),
      name: cleanStr(a?.name),
      type: cleanStr(a?.type),
      size: Number(a?.size) || 0,
      url: cleanStr(a?.url), // نخزن الرابط
    }))
    .filter((a) => a.key && a.name);
}

/* ======= Public URL Helpers (بدون Signed URL) ======= */
function encodeS3Key(key) {
  // مهم حتى المسافات/العربي يطلع مضبوط
  return String(key || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function buildPublicUrl(key) {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.S3_REGION;
  if (!bucket || !region || !key) return "";
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeS3Key(key)}`;
}

/**
 * ✅ بدل التوقيع: نبني URL ثابت
 * ملاحظة: هذا يفتح "طبيعي" فقط إذا عندك Bucket Policy يسمح GetObject.
 */
async function signAttachmentsForDoc(doc) {
  if (!doc) return doc;

  const list = doc.attachments;
  if (!Array.isArray(list) || list.length === 0) return doc;

  const attachments = (doc.attachments || []).map((x) => ({
    ...x,
    url: x?.key ? buildPublicUrl(x.key) : cleanStr(x?.url),
  }));

  return {
    ...doc,
    attachments,
  };
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

    const data = await PaymentPlan.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "createdById",
        model: "User",
        select: "username email",
        strictPopulate: false,
      })
      .lean();

    const withPublicUrls = await Promise.all((data || []).map(signAttachmentsForDoc));

    return NextResponse.json({ success: true, data: withPublicUrls });
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
    const attachments = cleanAttachments(body?.attachments);

    if (
      !cleanStr(body?.customer) &&
      !cleanStr(body?.unitNo) &&
      rows.length === 0 &&
      attachments.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "EMPTY_PAYLOAD" },
        { status: 400 }
      );
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
      attachments,
      createdBy: createdBy || "",
      createdById: createdByIdObj || null,
      pageKey,
      workflow,
      status: "Pending",
      currentStep: workflow?.steps?.length ? 0 : -1,
    };

    const doc = await PaymentPlan.create(docBody);

    const savedDoc = await PaymentPlan.findById(doc._id)
      .populate({
        path: "createdById",
        model: "User",
        select: "username email",
        strictPopulate: false,
      })
      .lean();

    const withPublicUrls = await signAttachmentsForDoc(savedDoc);

    return NextResponse.json({
      success: true,
      id: String(doc._id),
      data: withPublicUrls,
    });
  } catch (e) {
    console.error("❌ POST_FAILED:", e?.message || e);
    return NextResponse.json(
      { success: false, error: e?.message || "POST_FAILED" },
      { status: 500 }
    );
  }
}