import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { Types } from "mongoose";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";

import {
  buildWorkflowActionEmailHtml,
  sendWorkflowEmail,
} from "@/lib/email/workflowEmail";

/* ======================= HELPERS ======================= */
async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;
  if (!Types.ObjectId.isValid(userId)) return false;

  const uid = new Types.ObjectId(userId);
  const exists = await Permissions.exists({ users: uid, companies: company });
  return !!exists;
}

function getS3() {
  return new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function signS3Url(s3, key) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

function resetStepToPendingClean(st) {
  if (!st) return;
  st.status = "Pending";
  st.actedBy = null;
  st.actedAt = null;
  st.comment = "";
  st.attachment = null;

  if (Array.isArray(st.tagAttachments)) st.tagAttachments = [];
  if (typeof st.tag !== "undefined") st.tag = "";
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

    const cookieStore = cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const allowedCompany = await hasCompanyAccess(userId, company);
    if (!allowedCompany) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }

    const Model = getModelForCompany(company);

    const request = await Model.findById(id)
      .populate({ path: "workflow.steps.users", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.actedBy", model: "User", strictPopulate: false });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const s3 = getS3();

    // request attachments
    if (Array.isArray(request.attachments) && request.attachments.length > 0) {
      for (const file of request.attachments) {
        if (!file?.key) continue;
        file.url = await signS3Url(s3, file.key);
      }
    }

    // step attachments
    if (Array.isArray(request?.workflow?.steps) && request.workflow.steps.length > 0) {
      for (const st of request.workflow.steps) {
        if (!st?.attachment?.key) continue;
        st.attachment.url = await signS3Url(s3, st.attachment.key);
      }
    }

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    console.error("❌ GET Error:", err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
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
    const { action, note, attachmentMeta, stepIndex: bodyStepIndex, clearTag } = body;

    if (!company) company = body.company;
    if (!company) {
      return NextResponse.json({ success: false, error: "Company is required" }, { status: 400 });
    }

    const cookieStore = cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const allowedCompany = await hasCompanyAccess(userId, company);
    if (!allowedCompany) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
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

    /* ================= VALID ACTION ================= */
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    // ✅ الأكشن دائماً على currentStep الحقيقي بالسيرفر
    const stepIndex = request.currentStep;

    // حماية stale UI
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
      return NextResponse.json({ success: false, error: "Invalid workflow step" }, { status: 400 });
    }

    if (String(request.status || "").toLowerCase() === "cancelled") {
      return NextResponse.json({ success: false, error: "Request is cancelled" }, { status: 400 });
    }

    if (step.status !== "Pending") {
      return NextResponse.json({ success: false, error: "Step already processed" }, { status: 400 });
    }

    // authorization
    const isAuthorized = step.users.some((u) => String(u) === String(userId));
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to act on this step" },
        { status: 403 }
      );
    }

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
        request.status = "Approved";
        stepTo = stepIndex;
      } else {
        const nextIndex = stepIndex + 1;
        request.currentStep = nextIndex;

        const nextStep = request.workflow.steps[nextIndex];
        resetStepToPendingClean(nextStep);

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
        request.status = "Rejected";
        request.currentStep = 0;
        stepTo = 0;
      }
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

        let stepUsers = [];
        if (Array.isArray(targetUsersIds) && targetUsersIds.length > 0) {
          stepUsers = await User.find({ _id: { $in: targetUsersIds } })
            .select("email username")
            .lean();
        }
        
        // ✅ ايميلات الستيب
        const stepEmails = [...new Set(stepUsers.map((u) => u.email).filter(Boolean))];
        
        // ✅ صاحب الطلب (createdBy = username)
        const requesterUser = await User.findOne({ username: String(request.createdBy) })
          .select("email username")
          .lean();
        
        const requesterEmail = requesterUser?.email ? [requesterUser.email] : [];
        
        // ✅ اسم الاكتر
        const actor = await User.findById(userId).select("username").lean();
        const actorName = actor?.username || "";
        
        // ✅ اسم صاحب الطلب للـ greeting
        const createdByName =
          request?.createdByName ||
          request?.createdByUsername ||
          request?.createdBy?.username ||
          request?.createdBy ||
          requesterUser?.username ||
          "";
        
        // ✅ اسم الستيب يوزر (اذا واحد)
        const stepUserName = stepUsers.length === 1 ? (stepUsers[0]?.username || "") : "";
        
        const subject = `[Workflow] ${action.toUpperCase()} → Step ${Number(stepTo) + 1} | ${company}`;
        
        // =========================================================
        // A) ايميل للـ Step Users (يظهر routingLine)
        // =========================================================
        if (stepEmails.length > 0) {
          const htmlStep = buildWorkflowActionEmailHtml({
            action,
            requestId: id,
            company,
            stepFrom,
            stepTo,
            note,
            actorName,
        
            greetingName: stepUserName || "زميلنا",
            toUserName: stepUserName || "",
            showRoutingLine: true,
        
            baseDomain: "https://funds-gdr.spc-it.com.iq",
          });
        
          await sendWorkflowEmail({ toEmails: stepEmails, subject, html: htmlStep });
        }
        
        // =========================================================
        // B) ايميل للـ Requester (createdBy) (بدون routingLine)
        // =========================================================
        if (requesterEmail.length > 0) {
          const htmlRequester = buildWorkflowActionEmailHtml({
            action,
            requestId: id,
            company,
            stepFrom,
            stepTo,
            note,
            actorName,
        
            greetingName: createdByName || "زميلنا",
            toUserName: stepUserName || "",
            showRoutingLine: false,
        
            baseDomain: "https://funds-gdr.spc-it.com.iq",
          });
        
          await sendWorkflowEmail({ toEmails: requesterEmail, subject, html: htmlRequester });
        }
      } catch (e) {
        console.error("❌ Email notify failed:", e?.message || e);
      }
    }

    return NextResponse.json({ success: true, data: request });
  } catch (err) {
    console.error("❌ PUT Error:", err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}