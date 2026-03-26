import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import mongoose, { Types } from "mongoose";

import PaymentPlan from "@/models/PaymentPlan";
import ExWorkflow from "@/models/ExWorkflow";
import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { sendWorkflowEmail, buildExWorkflowActionEmailHtml } from "@/lib/email/exWorkflowEmail";

export const runtime = "nodejs";

/* ================= Helpers ================= */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
      url: cleanStr(a?.url),
    }))
    .filter((a) => a.key && a.name);
}

function getIdStr(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
}

/* ======= Public URL Helpers (بدون Signed URL) ======= */
function encodeS3Key(key) {
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

async function signAttachmentsForDoc(doc) {
  if (!doc) return doc;

  const list = doc.attachments;
  if (!Array.isArray(list) || list.length === 0) return doc;

  const attachments = (doc.attachments || []).map((x) => ({
    ...x,
    url: x?.key ? buildPublicUrl(x.key) : cleanStr(x?.url),
  }));

  return { ...doc, attachments };
}

const toObjId = (v) => {
  if (!v) return null;
  if (v instanceof Types.ObjectId) return v;
  const s = String(v);
  if (!Types.ObjectId.isValid(s)) return null;
  return new Types.ObjectId(s);
};

/* ================= AUTH (Cookie + Permission EX) ================= */

async function requireExPermission() {
  await dbConnect();

  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) return { ok: false, status: 401, message: "Not authenticated" };
  if (!isValidObjectId(userId)) return { ok: false, status: 401, message: "Invalid userId" };

  const user = await User.findById(userId).select("_id username name email").lean();
  if (!user) return { ok: false, status: 401, message: "User not found" };

  const groups = await Permissions.find({ users: user._id }).lean();
  const perms = [...new Set(groups.flatMap((g) => g.permissions || []))];

  if (!perms.includes("EX")) return { ok: false, status: 403, message: "Forbidden" };

  return { ok: true, userId: String(user._id), user, perms };
}

/* ================= Workflow ================= */

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
  const auth = await requireExPermission();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

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
    return NextResponse.json({ success: false, error: e?.message || "GET_FAILED" }, { status: 500 });
  }
}

/* ======================= POST ======================= */

export async function POST(req) {
  const auth = await requireExPermission();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));

    const createdBy = auth.user?.username || auth.user?.name || "";
    const createdByIdObj = toObjId(auth.userId);

    const rows = cleanRows(body?.rows);
    const attachments = cleanAttachments(body?.attachments);

    if (
      !cleanStr(body?.customer) &&
      !cleanStr(body?.unitNo) &&
      rows.length === 0 &&
      attachments.length === 0
    ) {
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
      attachments,

      createdBy,
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

    // ✅ Send email to first step users
    try {
      const firstStepUsers = savedDoc?.workflow?.steps?.[0]?.users || [];
      const firstStepUserIds = firstStepUsers.map(getIdStr).filter(Boolean);

      if (firstStepUserIds.length > 0) {
        const stepUsers = await User.find({ _id: { $in: firstStepUserIds } })
          .select("_id username name email")
          .lean();

        const toEmails = stepUsers.map((u) => u.email).filter(Boolean);
        const toUserName = stepUsers?.[0]?.name || stepUsers?.[0]?.username || "زميلنا";

        if (toEmails.length > 0) {
          const baseDomain =
            process.env.EX_BASE_DOMAIN || "https://funds-gdr.spc-it.com.iq";

          const planUrl = `${String(baseDomain).replace(/\/+$/, "")}/ex/payment-plans/${encodeURIComponent(
            String(doc._id)
          )}?key=${encodeURIComponent(pageKey)}`;

          const html = buildExWorkflowActionEmailHtml({
            action: "created",
            planId: String(doc._id),
            pageKey,
            stepFrom: 0,
            stepTo: 0,
            note: "تم إنشاء طلب جديد بانتظار الإجراء.",
            actorName: auth.user?.username || auth.user?.name || auth.user?.email || "System",
            greetingName: toUserName,
            toUserName,
            planUrl,
            showRoutingLine: true,
            docTitle: "Payment Plan",
            docTypeAr: "الاستثناءات",
          });

          await sendWorkflowEmail({
            toEmails,
            subject: `Payment Plan Waiting Your Action | Step 1`,
            html,
          });
        }
      }
    } catch (emailErr) {
      console.error("❌ Payment Plan create email send failed:", emailErr?.message || emailErr);
    }

    const withPublicUrls = await signAttachmentsForDoc(savedDoc);

    return NextResponse.json({
      success: true,
      id: String(doc._id),
      data: withPublicUrls,
    });
  } catch (e) {
    console.error("❌ POST_FAILED:", e?.message || e);
    return NextResponse.json({ success: false, error: e?.message || "POST_FAILED" }, { status: 500 });
  }
}