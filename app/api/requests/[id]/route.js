import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";

import nodemailer from "nodemailer";
import User from "@/models/User";
import { getModelForCompany } from "@/models/Request";
import Permissions from "@/models/Permissions";

import { Types } from "mongoose";

export const runtime = "nodejs";
/* ======================= EMAIL HELPERS ======================= */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}
async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;

  // ✅ حماية من ID مو صالح
  if (!Types.ObjectId.isValid(userId)) return false;

  const uid = new Types.ObjectId(userId);

  const exists = await Permissions.exists({
    users: uid,
    companies: company,
  });

  return !!exists;
}
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmailHtml({
  action,
  requestId,
  company,
  stepFrom,
  stepTo,
  note,
  actorName,

  requesterName = "",
  toUserName = "",
  requestUrl = "", // اختياري

  // ✅ دومين امبليفاير (ثابت)
  baseDomain = "https://main.d2fatueaza47h3.amplifyapp.com",
}) {
  const actionTxt =
    action === "approve"
      ? "Approved"
      : action === "reject"
      ? "Rejected"
      : String(action);

  // ✅ تحويل step to numbers safely
  const fromIdx = Number.isFinite(Number(stepFrom)) ? Number(stepFrom) : 0;
  const toIdx = Number.isFinite(Number(stepTo)) ? Number(stepTo) : 0;

  // ✅ نبني رابط الطلب تلقائياً إذا ما منطيته
  const computedUrl =
    requestUrl?.trim() ||
    `${String(baseDomain).replace(/\/+$/, "")}/requests/${encodeURIComponent(
      company || ""
    )}/${encodeURIComponent(requestId || "")}`;

  // ✅ المطلوب: “تمت الموافقة/الرفض على الخطوة السابقة”
  // approve/reject دا يصير على stepFrom (الخطوة اللي اتخذت بيها الاكشن)
  const actedStepNum = fromIdx + 1;

  // ✅ المطلوب: “ننتظر الموافقة أو الرفض” للخطوة الحالية للمستلم
  // بعد approve يروح للـ stepTo، وبعد reject يرجع للـ stepTo
  const waitingStepNum = toIdx + 1;

  // ✅ سطر عربي رئيسي (approve/reject على الخطوة السابقة)
  const arabicActionLine =
    action === "approve"
      ? `تمت الموافقة على الخطوة ${actedStepNum} من طلب التمويل الخاص بك بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`
      : action === "reject"
      ? `تم رفض الخطوة ${actedStepNum} من طلب التمويل الخاص بك بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`
      : `تم تحديث طلب التمويل الخاص بك بواسطة <b style="color:#f8fafc">${escapeHtml(
          actorName || "System"
        )}</b>.`;

  // ✅ تحويل/ارجاع + ننتظر موافقتك/رفضك
  const routingLine =
    action === "approve"
      ? toUserName
        ? `تم تحويل الطلب إلى الموظف التالي: <b style="color:#f8fafc">${escapeHtml(
            toUserName
          )}</b>. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
        : `تم تحويل الطلب إلى الموظف التالي. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
      : action === "reject"
      ? toUserName
        ? `تم إرجاع الطلب إلى الموظف السابق: <b style="color:#f8fafc">${escapeHtml(
            toUserName
          )}</b>. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
        : `تم إرجاع الطلب إلى الموظف السابق. <br/>ننتظر الموافقة أو الرفض على الخطوة ${waitingStepNum}.`
      : "";

  return `
  <div style="margin:0;padding:0;background:#0b1220;direction:ltr">
    <div style="max-width:720px;margin:0 auto;padding:22px 14px">

      <!-- ===== Header ===== -->
      <div style="
        position:relative;
        border-radius:22px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.10);
        background:linear-gradient(to bottom,#1f2937,#1f2937 35%,#111827);
        box-shadow:0 14px 34px rgba(0,0,0,.60);
      ">
        <div style="
          position:absolute;inset:0;
          background:rgba(17,24,39,.55);
          backdrop-filter:blur(10px);
        "></div>

        <div style="position:relative;padding:16px 18px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <!-- Left -->
              <td style="width:33%;vertical-align:middle">
                <div style="font-family:Arial,sans-serif;line-height:1.15">
                  <div style="
                    font-weight:900;font-size:22px;letter-spacing:.3px;
                    background:linear-gradient(90deg,#d1d5db,#f3f4f6,#ffffff);
                    -webkit-background-clip:text;background-clip:text;color:transparent;
                  ">SPC</div>

                  <div style="font-size:11px;color:#cbd5e1;margin-top:4px">
                    Developed by SPC team
                  </div>

                  <div style="
                    margin-top:9px;height:2px;width:68px;border-radius:999px;
                    background:linear-gradient(90deg,#6b7280,#9ca3af,#d1d5db);
                    opacity:.9
                  "></div>
                </div>
              </td>

              <!-- Center -->
              <td style="width:34%;text-align:center;vertical-align:middle">
                <div style="
                  font-family:Arial,sans-serif;
                  font-weight:900;
                  font-size:18px;
                  letter-spacing:.2px;
                  background:linear-gradient(90deg,#e5e7eb,#f3f4f6,#ffffff);
                  -webkit-background-clip:text;background-clip:text;color:transparent;
                ">Fund Request</div>

                <div style="font-family:Arial,sans-serif;font-size:11px;color:#cbd5e1;margin-top:5px">
                  Workflow Notification
                </div>
              </td>

              <!-- Right Badge -->
              <td style="width:33%;text-align:right;vertical-align:middle">
                <div style="display:inline-block;text-align:right">
                  <span style="
                    display:inline-block;
                    font-family:Arial,sans-serif;
                    font-size:16px;
                    font-weight:900;
                    letter-spacing:2.2px;
                    padding:12px 18px;
                    border-radius:999px;
                    border:2px solid rgba(255,255,255,.34);
                    background:${
                      action === "approve"
                        ? "linear-gradient(135deg,#22c55e,#16a34a)"
                        : action === "reject"
                        ? "linear-gradient(135deg,#ef4444,#b91c1c)"
                        : "linear-gradient(135deg,#94a3b8,#64748b)"
                    };
                    color:#ffffff;
                    white-space:nowrap;
                    text-transform:uppercase;
                    box-shadow:0 14px 28px rgba(0,0,0,.55);
                  ">
                    ${action === "approve" ? "APPROVE" : action === "reject" ? "REJECT" : escapeHtml(actionTxt)}
                  </span>

                  <div style="
                    margin-top:7px;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                    font-weight:900;
                    color:#e5e7eb;
                    opacity:.95
                  ">
                    ${
                      action === "approve"
                        ? "تم تحويل الطلب إلى الموظف التالي"
                        : action === "reject"
                        ? "تم إرجاع الطلب إلى الموظف السابق"
                        : "تحديث على الطلب"
                    }
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- ===== Main Card ===== -->
      <div style="
        margin-top:14px;
        border-radius:22px;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(15,23,42,.88);
        box-shadow:0 12px 30px rgba(0,0,0,.60);
      ">
        <!-- Section header -->
        <div style="
          padding:14px 16px;
          background:rgba(31,41,55,.78);
          border-bottom:1px solid rgba(255,255,255,.06);
          font-family:Arial,sans-serif;
          color:#f3f4f6;
          font-weight:900;
          font-size:13px;
          text-align:right;
        ">
          إشعار حركة الموافقات على طلب التمويل
        </div>

        <div style="
          height:4px;
          background:${
            action === "approve"
              ? "linear-gradient(90deg, rgba(34,197,94,.0), rgba(34,197,94,.95), rgba(34,197,94,.0))"
              : action === "reject"
              ? "linear-gradient(90deg, rgba(239,68,68,.0), rgba(239,68,68,.95), rgba(239,68,68,.0))"
              : "linear-gradient(90deg, rgba(148,163,184,.0), rgba(148,163,184,.70), rgba(148,163,184,.0))"
          };
          opacity:.95
        "></div>

        <div style="padding:18px">

          <!-- Greeting -->
          <div style="
            text-align:right;
            font-family:Arial,sans-serif;
            font-weight:900;
            font-size:18px;
            color:#e5e7eb;
            margin:6px 2px 10px 2px;
          ">
            👋 عزيزي ${escapeHtml(requesterName || "زميلنا")}
          </div>

          <!-- Main message -->
          <div style="
            text-align:right;
            font-family:Arial,sans-serif;
            font-size:13px;
            color:#cbd5e1;
            line-height:1.95;
            margin:0 2px 14px 2px;
          ">
            ${arabicActionLine}
            <br/>
            ${routingLine}
            <br/>
            يمكنك مراجعة طلب التمويل من خلال الزر التالي:
          </div>

          <!-- Details Button (ONLY, no text link) -->
          <div style="text-align:center;margin:18px 0 8px 0">
            <a href="${escapeHtml(computedUrl || "#")}" style="
              display:inline-block;
              padding:12px 24px;
              border-radius:999px;
              font-family:Arial,sans-serif;
              font-size:15px;
              font-weight:900;
              letter-spacing:.3px;
              background:linear-gradient(to bottom,#1f2937,#1f2937 40%,#111827);
              border:1px solid rgba(255,255,255,.28);
              box-shadow:
                0 14px 28px rgba(0,0,0,.55),
                inset 0 1px 0 rgba(255,255,255,.18);
              text-decoration:none;
            ">
              <span style="
                font-weight:900;
                font-size:15px;
                letter-spacing:.3px;
                background:linear-gradient(90deg,#d1d5db,#f3f4f6,#ffffff);
                -webkit-background-clip:text;
                background-clip:text;
                color:transparent;
                text-shadow:0 1px 2px rgba(0,0,0,.45);
                display:inline-block;
              ">
                📋 عرض التفاصيل
              </span>
            </a>
          </div>

          <!-- Compact info row -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border-collapse:separate;border-spacing:14px 14px;margin-top:10px">
            <tr>
              <td style="vertical-align:top;width:50%">
                <div style="
                  border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:13px 13px;
                  font-family:Arial,sans-serif;
                  box-shadow:0 10px 18px rgba(0,0,0,.35);
                  min-height:64px;
                ">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">Company</div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900;line-height:1.3">
                    ${escapeHtml(company)}
                  </div>
                </div>
              </td>

              <td style="vertical-align:top;width:50%">
                <div style="
                  border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:13px 13px;
                  font-family:Arial,sans-serif;
                  box-shadow:0 10px 18px rgba(0,0,0,.35);
                  min-height:64px;
                ">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:6px">${
                    action === "approve" || action === "reject" ? "Next Action" : "Moved"
                  }</div>
                  <div style="font-size:14px;color:#f8fafc;font-weight:900;line-height:1.3">
                    ${
                      action === "approve" || action === "reject"
                        ? `Awaiting Approval/Reject • Step ${waitingStepNum}`
                        : `Step ${fromIdx + 1} → Step ${toIdx + 1}`
                    }
                  </div>
                </div>
              </td>
            </tr>
          </table>

          <!-- Note -->
          ${
            note
              ? `
                <div style="
                  border:1px solid rgba(255,255,255,.10);
                  background:rgba(31,41,55,.58);
                  border-radius:18px;
                  padding:13px 13px;
                  font-family:Arial,sans-serif;
                  box-shadow:0 10px 18px rgba(0,0,0,.32);
                  margin-top:6px;
                  text-align:right;
                ">
                  <div style="font-size:11px;color:#94a3b8;font-weight:900;margin-bottom:7px">ملاحظة</div>
                  <div style="font-size:13px;color:#e5e7eb;line-height:1.8">
                    ${escapeHtml(note).replaceAll("\n", "<br/>")}
                  </div>
                </div>
              `
              : ""
          }

          <div style="
            margin-top:14px;
            font-family:Arial,sans-serif;
            font-size:11px;
            color:#94a3b8;
            opacity:.95;
            text-align:center;
          ">
            هذا الإيميل مرسل تلقائياً من النظام. الرجاء عدم الرد عليه.
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="
        margin-top:12px;
        text-align:center;
        font-family:Arial,sans-serif;
        color:#94a3b8;
        font-size:11px;
        line-height:1.7;
      ">
        <div style="opacity:.92;font-weight:900">SPC • Workflow System</div>
        <div style="opacity:.75">© ${new Date().getFullYear()} All rights reserved</div>
      </div>

    </div>
  </div>
`;
}

async function sendWorkflowEmail({ toEmails, subject, html }) {
  if (!Array.isArray(toEmails) || toEmails.length === 0) return { skipped: true };

  const transporter = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from,
    to: toEmails.join(","),
    subject,
    html,
  });

  return { skipped: false, messageId: info.messageId };
}

/* ======================= GET ======================= */
export async function GET(req, { params }) {
  try {
    await dbConnect();

    const id = params.id;
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");

    if (!company) {
      return NextResponse.json({ success: false, error: "Company is required" }, { status: 400 });
    }
    
    // ✅ Auth
    const cookieStore = cookies(); // بدون await
    const userId = cookieStore.get("userId")?.value;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }
    
    // ✅ Company access check
    const allowedCompany = await hasCompanyAccess(userId, company);
    if (!allowedCompany) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    const Model = getModelForCompany(company);

    const request = await Model.findById(id)
    .populate({
      path: "workflow.steps.users",
      model: "User",
      strictPopulate: false,
    })
    .populate({
      path: "workflow.steps.actedBy",
      model: "User",
      strictPopulate: false,
    });

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    // ✅ S3 Client (مرة وحدة)
    const s3 = new S3Client({
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });

    // ✅ Generate signed URLs for request attachments
    if (Array.isArray(request.attachments) && request.attachments.length > 0) {
      for (const file of request.attachments) {
        if (!file?.key) continue;
        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: file.key,
        });
        file.url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      }
    }

    // ✅ Generate signed URLs for workflow step attachments
    if (Array.isArray(request?.workflow?.steps) && request.workflow.steps.length > 0) {
      for (const st of request.workflow.steps) {
        if (!st?.attachment?.key) continue;

        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: st.attachment.key,
        });

        // نخلي url حتى الواجهة تعرضه بالـ view
        st.attachment.url = await getSignedUrl(s3, command, { expiresIn: 3600 });
      }
    }

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    console.error("❌ GET Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/* ======================= PUT ======================= */
export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const id = params.id;

    const { searchParams } = new URL(req.url);
    let company = searchParams.get("company");

    const body = await req.json();
    const {
      action,
      note,
      attachmentMeta,
      stepIndex: bodyStepIndex, // نخليه فقط للتأكد/حماية
      clearTag,
    } = body;

    if (!company) company = body.company;
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    
    

    // ✅ Auth
    const cookieStore = cookies();
        const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }
    const allowedCompany = await hasCompanyAccess(userId, company);
    if (!allowedCompany) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }
    /* ================= CANCEL ================= */
    if (action === "cancel") {
      request.status = "Cancelled";
      request.currentStep = -1;

      request.workflow.steps.forEach((st) => {
        st.status = "Cancelled";
        st.actedBy = userId;
        st.actedAt = new Date();
      });

      request.approvalHistory.push({
        user: userId,
        action: "cancel",
        note: note || "",
        date: new Date(),
      });

      await request.save();
      return NextResponse.json({ success: true, data: request });
    }

    /* ================= CURRENT STEP ================= */
    // ✅ مهم جداً: الأكشن دائماً على currentStep الحقيقي بالسيرفر
    const stepIndex = request.currentStep;

    // ✅ حماية: إذا الفرونت مرسل stepIndex مختلف نرفض (اختياري بس مفيد)
    if (Number.isInteger(bodyStepIndex) && bodyStepIndex !== stepIndex) {
      return NextResponse.json(
        {
          success: false,
          error: "Step index mismatch (stale UI). Please refresh.",
          serverStep: stepIndex,
          clientStep: bodyStepIndex,
        },
        { status: 409 }
      );
    }

    const step = request.workflow?.steps?.[stepIndex];

    if (!step) {
      return NextResponse.json(
        { success: false, error: "Invalid workflow step" },
        { status: 400 }
      );
    }

    // إذا الطلب ملغي لا تقبل أكشن
    if (String(request.status || "").toLowerCase() === "cancelled") {
      return NextResponse.json(
        { success: false, error: "Request is cancelled" },
        { status: 400 }
      );
    }

    if (step.status !== "Pending") {
      return NextResponse.json(
        { success: false, error: "Step already processed" },
        { status: 400 }
      );
    }

    // 🔐 Authorization
    const isAuthorized = step.users.some((u) => String(u) === String(userId));
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to act on this step" },
        { status: 403 }
      );
    }

    // ✅ helper: خزّن/امسح المرفق بالستيب الحالي
    const applyStepAttachment = () => {
      if (attachmentMeta?.key) {
        step.attachment = {
          key: attachmentMeta.key,
          name: attachmentMeta.name || "",
          type: attachmentMeta.type || "",
          size: attachmentMeta.size || 0,
        };
      } else if (clearTag) {
        step.attachment = null;
      }
    };

    // ✅ helper: تصفير ستِب (حتى ما تبقى آثار)
    const resetStepToPendingClean = (st) => {
      if (!st) return;
      st.status = "Pending";
      st.actedBy = null;
      st.actedAt = null;
      st.comment = "";
      st.attachment = null;

      if (Array.isArray(st.tagAttachments)) st.tagAttachments = [];
      if (typeof st.tag !== "undefined") st.tag = "";
    };

    const stepFrom = stepIndex;
    let stepTo = null;

    /* ================= APPROVE ================= */
    if (action === "approve") {
      step.status = "Approved";
      step.actedBy = userId;
      step.actedAt = new Date();
      step.comment = note || "";
      applyStepAttachment();

      const lastIdx = request.workflow.steps.length - 1;

      if (stepIndex === lastIdx) {
        // ✅ آخر خطوة => الطلب Approved
        request.status = "Approved";
        stepTo = stepIndex;
      } else {
        // ✅ انتقال للخطوة الجاية + تصفيرها Pending نظيف
        const nextIndex = stepIndex + 1;
        request.currentStep = nextIndex;

        const nextStep = request.workflow.steps[nextIndex];
        resetStepToPendingClean(nextStep);

        // ✅ لأن بعده ما خلص
        request.status = "Pending";
        stepTo = nextIndex;
      }
    }

    /* ================= REJECT ================= */
    if (action === "reject") {
      step.status = "Rejected";
      step.actedBy = userId;
      step.actedAt = new Date();
      step.comment = note || "";
      applyStepAttachment();
    
      if (stepIndex > 0) {
        const backIndex = stepIndex - 1;
        request.currentStep = backIndex;
    
        const backStep = request.workflow.steps[backIndex];
        resetStepToPendingClean(backStep);
    
        request.status = "Rejected";
        stepTo = backIndex;
      } else {
        // ✅ أول خطوة: نخلي الطلب Rejected ونبقى currentStep = 0
        request.status = "Rejected";
        request.currentStep = 0;
        stepTo = 0;
      }
    }

    // ✅ إذا action مو approve/reject/cancel
    if (action !== "approve" && action !== "reject" && action !== "cancel") {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    request.approvalHistory.push({
      user: userId,
      action,
      note: note || "",
      date: new Date(),
    });

    await request.save();

    /* ================= EMAIL NOTIFY (بعد الحفظ) ================= */
    const shouldNotify =
      (action === "approve" && stepFrom < request.workflow.steps.length - 1) ||
      (action === "reject" && stepFrom > 0);

    if (shouldNotify && stepTo !== null && stepTo !== undefined) {
      try {
        const targetUsersIds = request.workflow?.steps?.[stepTo]?.users || [];

        if (Array.isArray(targetUsersIds) && targetUsersIds.length > 0) {
          const users = await User.find({ _id: { $in: targetUsersIds } })
            .select("email username")
            .lean();

          const emails = users.map((u) => u.email).filter(Boolean);

          const actor = await User.findById(userId).select("username").lean();
          const actorName = actor?.username || "";



          const requesterName =
            request?.createdByName ||
            request?.createdByUsername ||
            request?.createdBy?.username ||
            "";

          const toUserName = users.length === 1 ? (users[0]?.username || "") : "";

          const subject = `[Workflow] ${action.toUpperCase()} → Step ${Number(stepTo) + 1} | ${company}`;

          const html = buildEmailHtml({
            action,
            requestId: id,
            company,
            stepFrom,
            stepTo,
            note,
            actorName,
            requesterName,
            toUserName,
            baseDomain: "https://main.d2fatueaza47h3.amplifyapp.com",
          });

          await sendWorkflowEmail({ toEmails: emails, subject, html });
        }
      } catch (e) {
        console.error("❌ Email notify failed:", e.message);
      }
    }

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    console.error("❌ PUT Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
