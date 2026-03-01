import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { Types } from "mongoose";

import User from "@/models/User";



import {
  buildWorkflowActionEmailHtml,
  sendWorkflowEmail,
} from "@/lib/email/workflowEmail";

/* ======================= HELPERS ======================= */
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

function isFinalStatus(reqDoc) {
  const s = String(reqDoc?.status || "").toLowerCase();
  return s === "approved" || s === "rejected" || s === "cancelled";
}

function isRejectedOrApproved(reqDoc) {
  const s = String(reqDoc?.status || "").toLowerCase();
  return s === "approved" || s === "rejected";
}

/* ======================= GET ======================= */
export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { id } = params;

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const doc = await ExPaymentPlan.findById(id)
      .populate({ path: "workflow.steps.users", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.actedBy", model: "User", strictPopulate: false });

    if (!doc) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("❌ EX WF GET Error:", err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}

/* ======================= PUT ======================= */
export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const { id } = params;

    const body = await req.json();
    const { action, note, attachmentMeta, stepIndex: bodyStepIndex, clearTag } = body;

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    // ✅ فقط approve / reject
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const doc = await ExPaymentPlan.findById(id);

    if (!doc) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // ✅ ممنوع أي أكشن إذا منتهي (Approved/Rejected)
    if (isRejectedOrApproved(doc)) {
      return NextResponse.json(
        { success: false, error: "Request already finalized" },
        { status: 400 }
      );
    }

    // ✅ الأكشن دائماً على currentStep الحقيقي بالسيرفر
    const stepIndex = doc.currentStep;

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

    const step = doc.workflow?.steps?.[stepIndex];
    if (!step) {
      return NextResponse.json({ success: false, error: "Invalid workflow step" }, { status: 400 });
    }

    if (step.status !== "Pending") {
      return NextResponse.json({ success: false, error: "Step already processed" }, { status: 400 });
    }

    // authorization
    const isAuthorized = (step.users || []).some((u) => String(u) === String(userId));
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

      const lastIdx = doc.workflow.steps.length - 1;

      if (stepIndex === lastIdx) {
        // ✅ آخر ستب => الطلب Approved
        doc.status = "Approved";
        doc.currentStep = -1;
        stepTo = null;
      } else {
        // ✅ يروح للستب الجاية
        const nextIndex = stepIndex + 1;
        doc.currentStep = nextIndex;

        const nextStep = doc.workflow.steps[nextIndex];
        resetStepToPendingClean(nextStep);

        doc.status = "Pending";
        stepTo = nextIndex;
      }
    }

    /* ================= REJECT (✅ ينهي الطلب) ================= */
    if (action === "reject") {
      step.status = "Rejected";
      step.actedBy = userId;
      step.actedAt = new Date();
      step.comment = note || "";
      applyStepAttachment();

      // ✅ ينهي الطلب مباشرة
      doc.status = "Rejected";
      doc.currentStep = -1;

      // (اختياري) تخلي بقية الستبس Pending مثل ما هي، أو تكتبها "Blocked"
      // هنا نخليها Pending بدون تغيير حتى تبقى نظيفة
      stepTo = null;
    }

    // ✅ history
    doc.approvalHistory = doc.approvalHistory || [];
    doc.approvalHistory.push({
      user: userId,
      action,
      note: note || "",
      date: new Date(),
    });

    await doc.save();

    /* ================= EMAIL NOTIFY (بعد الحفظ) ================= */
    try {
      // actor
      const actor = await User.findById(userId).select("username").lean();
      const actorName = actor?.username || "";

      // createdBy (نفس منطقك القديم)
      const requesterUser = await User.findOne({ username: String(doc.createdBy) })
        .select("email username")
        .lean();

      const requesterEmail = requesterUser?.email ? [requesterUser.email] : [];

      const createdByName =
        doc?.createdByName ||
        doc?.createdByUsername ||
        doc?.createdBy?.username ||
        doc?.createdBy ||
        requesterUser?.username ||
        "";

      // A) إذا approve وانتقل لستب جديد => نرسل ليوزرز الستب الجاية + للريكوستر
      if (action === "approve" && stepTo !== null) {
        const targetUsersIds = doc.workflow?.steps?.[stepTo]?.users || [];
        let stepUsers = [];

        if (Array.isArray(targetUsersIds) && targetUsersIds.length > 0) {
          stepUsers = await User.find({ _id: { $in: targetUsersIds } })
            .select("email username")
            .lean();
        }

        const stepEmails = [...new Set(stepUsers.map((u) => u.email).filter(Boolean))];
        const stepUserName = stepUsers.length === 1 ? (stepUsers[0]?.username || "") : "";

        const subject = `[EX Workflow] APPROVED → Step ${Number(stepTo) + 1}`;

        if (stepEmails.length > 0) {
          const htmlStep = buildWorkflowActionEmailHtml({
            action,
            requestId: id,
            company: "EX", // حتى لا نكسر التمبلت
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

        if (requesterEmail.length > 0) {
          const htmlRequester = buildWorkflowActionEmailHtml({
            action,
            requestId: id,
            company: "EX",
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
      }

      // B) إذا reject => بما انه ينهي الطلب، نرسل للريكوستر فقط
      if (action === "reject") {
        const subject = `[EX Workflow] REJECTED (Final)`;

        if (requesterEmail.length > 0) {
          const htmlRequester = buildWorkflowActionEmailHtml({
            action,
            requestId: id,
            company: "EX",
            stepFrom,
            stepTo: null,
            note,
            actorName,

            greetingName: createdByName || "زميلنا",
            toUserName: "",
            showRoutingLine: false,

            baseDomain: "https://funds-gdr.spc-it.com.iq",
          });

          await sendWorkflowEmail({ toEmails: requesterEmail, subject, html: htmlRequester });
        }
      }
    } catch (e) {
      console.error("❌ EX WF Email notify failed:", e?.message || e);
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("❌ EX WF PUT Error:", err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}