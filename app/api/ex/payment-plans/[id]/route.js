import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { PERMISSIONS } from "@/lib/permission";
import Permissions from "@/models/Permissions";

import PaymentPlan from "@/models/PaymentPlan";
import ExWorkflow from "@/models/ExWorkflow";
import User from "@/models/User";

import { sendWorkflowEmail, buildExWorkflowActionEmailHtml } from "@/lib/email/exWorkflowEmail";

export const runtime = "nodejs";

/* ================= Helpers ================= */

const awaitMaybe = async (v) => (v && typeof v.then === "function" ? await v : v);

const toObjId = (v) => {
  if (!v) return null;
  if (v instanceof Types.ObjectId) return v;
  if (typeof v === "object" && v._id) v = v._id;
  const s = String(v);
  if (!Types.ObjectId.isValid(s)) return null;
  return new Types.ObjectId(s);
};

const getIdStr = (v) => {
  if (!v) return "";
  if (v instanceof Types.ObjectId) return String(v);
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
};

function resetStepToPendingClean(st) {
  if (!st) return;
  st.status = "Pending";
  st.actedBy = null;
  st.actedAt = null;
  st.comment = "";
  st.tag = "";
  st.tagAttachments = [];
}

function mapRequestAttachmentsToStepFiles(attachments = []) {
  return (attachments || [])
    .filter(Boolean)
    .map((f) => ({
      key: f.key || "",
      url: f.url || "",
      name: f.name || "Attachment",
      type: f.type || "",
      size: Number(f.size || 0),
      uploadedAt: f.uploadedAt || new Date(),
    }));
}




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
        tag: "",
        tagAttachments: [],
      };
    }),
  };
}

/**
 * لا تعيد بناء workflow إذا موجود
 * فقط ابنِ workflow إذا ما موجود/فارغ
 */
async function ensurePlanWorkflowStable(plan, forcedKey) {
  if (!plan) return plan;

  const key =
    String(plan.pageKey || "").trim() ||
    String(forcedKey || "").trim() ||
    "exceptions";

  const hasSteps = Array.isArray(plan?.workflow?.steps) && plan.workflow.steps.length > 0;

  if (hasSteps) {
    let changed = false;

    if (!String(plan.pageKey || "").trim()) {
      plan.pageKey = key;
      changed = true;
    }

    if (typeof plan.currentStep !== "number") {
      plan.currentStep = plan.workflow.steps.length ? 0 : -1;
      changed = true;
    }

    if (!String(plan.status || "").trim()) {
      plan.status = "Pending";
      changed = true;
    }

    // ✅ خلي مرفقات الطلب الأصلي تروح للستيب الأول إذا بعده ما بيه مرفقات
    const firstStep = plan.workflow?.steps?.[0];
    const isFirstStepLast = plan.workflow?.steps?.length === 1;

    if (
      firstStep &&
      !isFirstStepLast &&
      Array.isArray(plan.attachments) &&
      plan.attachments.length > 0 &&
      (!Array.isArray(firstStep.tagAttachments) || firstStep.tagAttachments.length === 0) &&
      !firstStep.tag
    ) {
      const requestFiles = mapRequestAttachmentsToStepFiles(plan.attachments);

      firstStep.tagAttachments = requestFiles;
      firstStep.tag = requestFiles[0]?.url || "";
      changed = true;
    }

    if (changed) {
      plan.markModified("workflow");
      plan.markModified("workflow.steps");
      await plan.save();
    }

    return plan;
  }

  const newWorkflow = await buildWorkflowForKey(key);

  // ✅ من البداية ابنِ الستيب الأول ومعاه مرفقات الطلب
  if (
    Array.isArray(newWorkflow.steps) &&
    newWorkflow.steps.length > 0 &&
    newWorkflow.steps.length > 1 &&
    Array.isArray(plan.attachments) &&
    plan.attachments.length > 0
  ) {
    const requestFiles = mapRequestAttachmentsToStepFiles(plan.attachments);
    newWorkflow.steps[0].tagAttachments = requestFiles;
    newWorkflow.steps[0].tag = requestFiles[0]?.url || "";
  }

  plan.workflow = newWorkflow;
  plan.pageKey = key;

  if (!String(plan.status || "").trim()) plan.status = "Pending";
  plan.currentStep = newWorkflow.steps.length ? 0 : -1;

  plan.markModified("workflow");
  plan.markModified("workflow.steps");
  await plan.save();

  return plan;
}

async function getUserPermissions(userId) {
  if (!userId) return [];

  const groups = await Permissions.find({ users: userId })
    .select("permissions")
    .lean();

  const perms = new Set();

  for (const g of groups) {
    (g.permissions || []).forEach((p) => perms.add(String(p).trim()));
  }

  return Array.from(perms);
}

/* ======================= GET ======================= */
export async function GET(req, ctx) {
  try {
    await dbConnect();

    const params = await awaitMaybe(ctx?.params);
    const id = params?.id;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const key = String(searchParams.get("key") || "").trim();

    const cookieStore = await awaitMaybe(cookies());
    const userId = cookieStore.get("userId")?.value;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const currentUser = await User.findById(userId)
      .select("_id username name email")
      .lean();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    }

    let plan = await PaymentPlan.findById(id);
    if (!plan) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    plan = await ensurePlanWorkflowStable(plan, key);

    const plan2 = await PaymentPlan.findById(id)
      .populate({
        path: "workflow.steps.users",
        model: "User",
        select: "username name email",
        strictPopulate: false,
      })
      .populate({
        path: "workflow.steps.actedBy",
        model: "User",
        select: "username name email",
        strictPopulate: false,
      })
      .lean();

    return NextResponse.json({
      success: true,
      data: plan2,
      workflow: plan2?.workflow ?? null,
      pageKey: plan2?.pageKey ?? "",
      stepsCount: plan2?.workflow?.steps?.length ?? 0,
      currentUser,
    });
  } catch (err) {
    console.error("❌ payment-plans/[id] GET error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

/* ======================= PUT ======================= */
export async function PUT(req, ctx) {
  try {
    await dbConnect();

    const params = await awaitMaybe(ctx?.params);
    const id = params?.id;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const keyFromQuery = String(searchParams.get("key") || "").trim();

    const body = await req.json().catch(() => ({}));
    const {
      action,
      note,
      stepIndex: bodyStepIndex,
      key: keyFromBody,
      attachmentMeta = null,
      clearTag = false,
    } = body;

    const forcedKey = String(keyFromQuery || keyFromBody || "").trim();

    if (action !== "approve" && action !== "reject" && action !== "operation_submit") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const cookieStore = await awaitMaybe(cookies());
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const userIdObj = toObjId(userId);
    if (!userIdObj) {
      return NextResponse.json({ success: false, error: "Invalid userId" }, { status: 401 });
    }

    const currentUser = await User.findById(userIdObj)
      .select("_id username name email")
      .lean();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    }

    const currentUserPerms = await getUserPermissions(userIdObj);
    const isOperationUser = currentUserPerms.includes(PERMISSIONS.OPERATION);

    let plan = await PaymentPlan.findById(id);
    if (!plan) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    plan = await ensurePlanWorkflowStable(plan, forcedKey);

    if (plan.currentStep === -1) {
      return NextResponse.json({ success: false, error: "Request is closed" }, { status: 400 });
    }

    const stepIndex = plan.currentStep;

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

    const step = plan.workflow?.steps?.[stepIndex];
    if (!step) {
      return NextResponse.json({ success: false, error: "Invalid workflow step" }, { status: 400 });
    }

    if (step.status !== "Pending") {
      return NextResponse.json({ success: false, error: "Step already processed" }, { status: 400 });
    }

    const isAuthorized = (step.users || []).some((u) => getIdStr(u) === String(userIdObj));
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    }

    if (isOperationUser) {
      if (action === "reject") {
        return NextResponse.json(
          { success: false, error: "Operation user cannot reject" },
          { status: 403 }
        );
      }
    }

    if (isOperationUser && action === "operation_submit" && !attachmentMeta?.key) {
      return NextResponse.json(
        { success: false, error: "Operation attachment is required" },
        { status: 400 }
      );
    }

    let creatorUser = null;
    if (plan.createdBy && Types.ObjectId.isValid(String(plan.createdBy))) {
      creatorUser = await User.findById(plan.createdBy).select("_id username name email").lean();
    } else if (plan.createdBy) {
      creatorUser = await User.findOne({ username: String(plan.createdBy) })
        .select("_id username name email")
        .lean();
    }

    const actorName = currentUser?.username || currentUser?.name || currentUser?.email || "System";
    const baseDomain = process.env.EX_BASE_DOMAIN || "https://funds-gdr.spc-it.com.iq";
    const pageKey = plan.pageKey || forcedKey || "exceptions";

    const planUrl = `${String(baseDomain).replace(/\/+$/, "")}/ex/payment-plans/${encodeURIComponent(
      String(plan._id)
    )}?key=${encodeURIComponent(pageKey)}`;

    let emailResult = null;

    const attachToStepIfNeeded = () => {
      if (clearTag) {
        step.tag = "";
        step.tagAttachments = [];
      }
    
      if (attachmentMeta?.key) {
        step.tag = attachmentMeta.url || attachmentMeta.key || "";
        step.tagAttachments = [
          {
            key: attachmentMeta.key,
            url: attachmentMeta.url || "",
            name: attachmentMeta.name || "",
            type: attachmentMeta.type || "",
            size: attachmentMeta.size || 0,
            uploadedAt: new Date(),
          },
        ];
      }
    };

    /* ================= APPROVE / OPERATION SUBMIT ================= */
    if (action === "approve" || action === "operation_submit") {
      step.status = "Approved";
      step.actedBy = userIdObj;
      step.actedAt = new Date();
      step.comment = note || "";
    
      // approve العادي: خلي المرفق على نفس الستيب إذا موجود
      if (action === "approve") {
        if (clearTag) {
          step.tag = "";
          step.tagAttachments = [];
        }
    
        if (attachmentMeta?.key) {
          step.tag = attachmentMeta.url || attachmentMeta.key || "";
          step.tagAttachments = [
            {
              key: attachmentMeta.key,
              url: attachmentMeta.url || "",
              name: attachmentMeta.name || "",
              type: attachmentMeta.type || "",
              size: attachmentMeta.size || 0,
              uploadedAt: new Date(),
            },
          ];
        }
      }
    
      // operation_submit: لا تخلي المرفق على نفس الستيب
      if (action === "operation_submit") {
        step.tag = "";
        step.tagAttachments = [];
      }
    
      const lastIdx = plan.workflow.steps.length - 1;
    
      if (stepIndex === lastIdx) {
        plan.status = "Approved";
        plan.currentStep = -1;
    
        const toEmails = creatorUser?.email ? [creatorUser.email] : [];
        const greetingName = creatorUser?.name || creatorUser?.username || "زميلنا";
    
        const html = buildExWorkflowActionEmailHtml({
          action: "approve",
          planId: String(plan._id),
          pageKey,
          stepFrom: stepIndex,
          stepTo: stepIndex,
          note,
          actorName,
          greetingName,
          toUserName: "",
          planUrl,
          showRoutingLine: false,
        });
    
        try {
          emailResult = await sendWorkflowEmail({
            toEmails,
            subject: `Payment Plan Approved | ${String(plan._id).slice(-6)}`,
            html,
          });
        } catch (e) {
          console.error("❌ Email send failed (final approve):", e?.message || e);
          emailResult = { error: e?.message || "email_failed" };
        }
      } else {
        const nextIndex = stepIndex + 1;
        const isNextStepLast = nextIndex === lastIdx;
        plan.currentStep = nextIndex;
        resetStepToPendingClean(plan.workflow.steps[nextIndex]);
        plan.status = "Pending";
    
        // ✅ هنا المهم: مرفق الأوبريشن يروح مباشرة للستيب الجاي
        if (action === "operation_submit" && attachmentMeta?.key) {
          plan.workflow.steps[nextIndex].tag = attachmentMeta.url || attachmentMeta.key || "";
          plan.workflow.steps[nextIndex].tagAttachments = [
            {
              key: attachmentMeta.key,
              url: attachmentMeta.url || "",
              name: attachmentMeta.name || "",
              type: attachmentMeta.type || "",
              size: attachmentMeta.size || 0,
              uploadedAt: new Date(),
            },
          ];
        } else {
          plan.workflow.steps[nextIndex].tag = "";
          plan.workflow.steps[nextIndex].tagAttachments = [];
        }

        // ✅ مرفقات الريكويست الأصلي تمشي مع الوركفلو لكن ما توصل للستيب الأخير
// ✅ مرفقات الريكويست الأصلي تمشي مع الوركفلو لكن ما توصل للستيب الأخير
if (!isNextStepLast && Array.isArray(plan.attachments) && plan.attachments.length > 0) {
  const requestFiles = plan.attachments.map((f) => ({
    key: f.key || "",
    url: f.url || "",
    name: f.name || "",
    type: f.type || "",
    size: f.size || 0,
    uploadedAt: f.uploadedAt || new Date(),
  }));

  const existing = Array.isArray(plan.workflow.steps[nextIndex].tagAttachments)
    ? plan.workflow.steps[nextIndex].tagAttachments
    : [];

  const merged = [...existing];

  for (const rf of requestFiles) {
    const alreadyExists = merged.some(
      (x) =>
        String(x.key || "") === String(rf.key || "") &&
        String(x.name || "") === String(rf.name || "")
    );

    if (!alreadyExists) {
      merged.push(rf);
    }
  }

  plan.workflow.steps[nextIndex].tagAttachments = merged;

  if (!plan.workflow.steps[nextIndex].tag && merged[0]?.url) {
    plan.workflow.steps[nextIndex].tag = merged[0].url;
  }
}
    
        const nextStepUsers = plan.workflow.steps[nextIndex]?.users || [];
        const nextUserIds = nextStepUsers.map(getIdStr).filter(Boolean);
    
        const nextUsers = nextUserIds.length
          ? await User.find({ _id: { $in: nextUserIds } }).select("_id username name email").lean()
          : [];
    
        const toEmails = nextUsers.map((u) => u.email).filter(Boolean);
        const toUserName = nextUsers?.[0]?.name || nextUsers?.[0]?.username || "";
    
        const html = buildExWorkflowActionEmailHtml({
          action: "approve",
          planId: String(plan._id),
          pageKey,
          stepFrom: stepIndex,
          stepTo: nextIndex,
          note,
          actorName,
          greetingName: toUserName || "زميلنا",
          toUserName: toUserName || "",
          planUrl,
          showRoutingLine: true,
        });
    
        try {
          emailResult = await sendWorkflowEmail({
            toEmails,
            subject: `Payment Plan Waiting Your Action | Step ${nextIndex + 1}`,
            html,
          });
        } catch (e) {
          console.error("❌ Email send failed (next step):", e?.message || e);
          emailResult = { error: e?.message || "email_failed" };
        }
      }
    }

    /* ================= REJECT ================= */
    if (action === "reject") {
      step.status = "Rejected";
      step.actedBy = userIdObj;
      step.actedAt = new Date();
      step.comment = note || "";

      plan.status = "Rejected";
      plan.currentStep = -1;

      const toEmails = creatorUser?.email ? [creatorUser.email] : [];
      const greetingName = creatorUser?.name || creatorUser?.username || "زميلنا";

      const html = buildExWorkflowActionEmailHtml({
        action: "reject",
        planId: String(plan._id),
        pageKey,
        stepFrom: stepIndex,
        stepTo: stepIndex,
        note,
        actorName,
        greetingName,
        toUserName: "",
        planUrl,
        showRoutingLine: false,
      });

      try {
        emailResult = await sendWorkflowEmail({
          toEmails,
          subject: `Payment Plan Rejected | ${String(plan._id).slice(-6)}`,
          html,
        });
      } catch (e) {
        console.error("❌ Email send failed (reject):", e?.message || e);
        emailResult = { error: e?.message || "email_failed" };
      }
    }

    plan.markModified("workflow");
    plan.markModified("workflow.steps");
    plan.markModified(`workflow.steps.${stepIndex}`);
    await plan.save();

    const plan2 = await PaymentPlan.findById(id)
      .populate({
        path: "workflow.steps.users",
        model: "User",
        select: "username name email",
        strictPopulate: false,
      })
      .populate({
        path: "workflow.steps.actedBy",
        model: "User",
        select: "username name email",
        strictPopulate: false,
      })
      .lean();

    return NextResponse.json({
      success: true,
      data: plan2,
      workflow: plan2?.workflow ?? null,
      pageKey: plan2?.pageKey ?? "",
      currentUser,
      emailResult,
    });
  } catch (err) {
    console.error("❌ payment-plans/[id] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}