// /app/api/ex/[pageKey]/[id]/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { PERMISSIONS } from "@/lib/permission";
import Permissions from "@/models/Permissions";
import ExWorkflow from "@/models/ExWorkflow";
import User from "@/models/User";

import ReplaceBookingTransfer from "@/models/ReplaceBookingTransfer";
import WaiverReservation from "@/models/WaiverReservation";
import CancelBookingUnit from "@/models/CancelBookingUnit";
import UnitTransfer from "@/models/UnitTransfer";
import { sendWorkflowEmail, buildExWorkflowActionEmailHtml } from "@/lib/email/exWorkflowEmail";
import { getExForm } from "@/lib/exForms/registry";
export const runtime = "nodejs";

/* ================= Helpers (مثل payment-plan) ================= */

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
function normalizeEmails(list = []) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map((x) => String(x || "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

async function getFinalApproveEmails(pageKey) {
  const wf = await ExWorkflow.findOne({ pageKey })
    .select("finalApproveEmails")
    .lean();

  return normalizeEmails(wf?.finalApproveEmails || []);
}
function resetStepToPendingClean(st) {
  if (!st) return;
  st.status = "Pending";
  st.actedBy = null;
  st.actedAt = null;
  st.comment = "";

  // ✅ خليتها مثل كودك حتى ما ينكسر UI إذا تستخدمها
  st.tag = "";
  st.tagAttachments = [];
}
function normalizeRequestAttachments(doc) {
  const list = Array.isArray(doc?.attachments) ? doc.attachments : [];

  return list
    .filter(Boolean)
    .map((f) => ({
      key: f?.key || "",
      url: f?.url || "",
      name: f?.name || "Attachment",
      type: f?.type || "",
      size: Number(f?.size || 0),
      uploadedAt: f?.uploadedAt || new Date(),
    }))
    .filter((f) => f.key || f.url);
}

function syncRequestAttachmentsToStep(step, doc) {
  if (!step) return;

  const reqFiles = normalizeRequestAttachments(doc);
  if (!reqFiles.length) return;

  const existing = Array.isArray(step.tagAttachments) ? step.tagAttachments : [];

  const merged = [...existing];

  for (const file of reqFiles) {
    const exists = merged.some(
      (x) =>
        (x?.key && file?.key && String(x.key) === String(file.key)) ||
        (x?.url && file?.url && String(x.url) === String(file.url))
    );

    if (!exists) {
      merged.push(file);
    }
  }

  step.tagAttachments = merged;

  if (!step.tag && reqFiles[0]?.url) {
    step.tag = reqFiles[0].url;
  }
}
/* ======================= Registry ======================= */
function getModelByPageKey(pageKey) {
  switch (pageKey) {
    case "replace-booking-transfer":
      return ReplaceBookingTransfer;
    case "waiver-reservation":
      return WaiverReservation;
    case "cancel-booking-unit":
      return CancelBookingUnit;
      case "unit-transfer":
  return UnitTransfer;
    default:
      return null;
  }
}

/* ======================= Workflow Builder ======================= */
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
async function ensureDocWorkflowStable(doc, forcedKey, fallbackKey) {
  if (!doc) return doc;

  const key =
    String(doc.pageKey || "").trim() ||
    String(forcedKey || "").trim() ||
    String(fallbackKey || "").trim();

  const hasSteps = Array.isArray(doc?.workflow?.steps) && doc.workflow.steps.length > 0;

  if (hasSteps) {
    let changed = false;

    if (!String(doc.pageKey || "").trim()) {
      doc.pageKey = key;
      changed = true;
    }

    if (typeof doc.currentStep !== "number") {
      doc.currentStep = doc.workflow.steps.length ? 0 : -1;
      changed = true;
    }

    if (!String(doc.status || "").trim()) {
      doc.status = "Pending";
      changed = true;
    }

    if (changed) await doc.save();
    return doc;
  }

  const newWorkflow = await buildWorkflowForKey(key);

  doc.workflow = newWorkflow;
  doc.pageKey = key;

  if (!String(doc.status || "").trim()) doc.status = "Pending";
  doc.currentStep = newWorkflow.steps.length ? 0 : -1;

  if (doc.currentStep >= 0 && doc.workflow?.steps?.[doc.currentStep]) {
    syncRequestAttachmentsToStep(doc.workflow.steps[doc.currentStep], doc);
  }

  await doc.save();
  return doc;
}

/* ======================= GET ======================= */
export async function GET(req, ctx) {
  try {
    await dbConnect();

    const params = await awaitMaybe(ctx?.params);
    const pageKey = String(params?.pageKey || "").trim();
    const id = params?.id;

    const Model = getModelByPageKey(pageKey);
    if (!Model) return NextResponse.json({ success: false, error: "Invalid pageKey" }, { status: 404 });

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const keyFromQuery = String(searchParams.get("key") || "").trim();

    const cookieStore = await awaitMaybe(cookies());
    const userId = cookieStore.get("userId")?.value;
    const userIdObj = toObjId(userId);

    if (!userIdObj) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const currentUser = await User.findById(userIdObj).select("_id username name email").lean();
    if (!currentUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });

    let doc = await Model.findById(id);
    if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    doc = await ensureDocWorkflowStable(doc, keyFromQuery, pageKey);

    const doc2 = await Model.findById(id)
      .populate({ path: "workflow.steps.users", model: "User", select: "username name email", strictPopulate: false })
      .populate({ path: "workflow.steps.actedBy", model: "User", select: "username name email", strictPopulate: false })
      .lean();

    return NextResponse.json({
      success: true,
      data: doc2,
      workflow: doc2?.workflow ?? null,
      pageKey: doc2?.pageKey ?? pageKey,
      stepsCount: doc2?.workflow?.steps?.length ?? 0,
      currentUser,
    });
  } catch (err) {
    console.error("❌ ex/[pageKey]/[id] GET error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
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
/* ======================= PUT (approve/reject) ======================= */
export async function PUT(req, ctx) {
  try {
    await dbConnect();

    const params = await awaitMaybe(ctx?.params);
    const pageKeyParam = String(params?.pageKey || "").trim();
    const id = params?.id;

    const Model = getModelByPageKey(pageKeyParam);
    if (!Model) return NextResponse.json({ success: false, error: "Invalid pageKey" }, { status: 404 });

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

    const forcedKey = String(keyFromQuery || keyFromBody || pageKeyParam).trim();

    if (action !== "approve" && action !== "reject" && action !== "operation_submit") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    // ===== Auth =====
    const cookieStore = await awaitMaybe(cookies());
    const userId = cookieStore.get("userId")?.value;
    const userIdObj = toObjId(userId);

    if (!userIdObj) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const currentUser = await User.findById(userIdObj).select("_id username name email").lean();
    if (!currentUser) return NextResponse.json({ success: false, error: "User not found" }, { status: 401 });
    const currentUserPerms = await getUserPermissions(userIdObj);
    const isOperationUser = currentUserPerms.includes(PERMISSIONS.OPERATION);
    // ===== Load doc =====
    let doc = await Model.findById(id);
    if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    doc = await ensureDocWorkflowStable(doc, forcedKey, pageKeyParam);

    if (doc.currentStep === -1) {
      return NextResponse.json({ success: false, error: "Request is closed" }, { status: 400 });
    }

    const stepIndex = doc.currentStep;

    // ✅ 409 stale UI
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
    if (!step) return NextResponse.json({ success: false, error: "Invalid workflow step" }, { status: 400 });
    if (step.status !== "Pending") return NextResponse.json({ success: false, error: "Step already processed" }, { status: 400 });
    syncRequestAttachmentsToStep(step, doc);
    // ✅ Authorization (خليته robust)
    const isAuthorized = (step.users || []).some((u) => getIdStr(u) === String(userIdObj));
    if (!isAuthorized) return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
    if (isOperationUser) {
      if (action === "reject") {
        return NextResponse.json(
          { success: false, error: "Operation user cannot reject" },
          { status: 403 }
        );
      }
    
    
    }
    // ===== creator (مرن) =====
    let creatorUser = null;

    // لو عندك createdById
    if (doc.createdById && Types.ObjectId.isValid(String(doc.createdById))) {
      creatorUser = await User.findById(doc.createdById).select("_id username name email").lean();
    }
    // لو عندك createdBy كـ ObjectId
    else if (doc.createdBy && Types.ObjectId.isValid(String(doc.createdBy))) {
      creatorUser = await User.findById(doc.createdBy).select("_id username name email").lean();
    }
    // لو createdBy username
    else if (doc.createdBy) {
      creatorUser = await User.findOne({ username: String(doc.createdBy) }).select("_id username name email").lean();
    }

    const actorName = currentUser?.username || currentUser?.name || currentUser?.email || "System";
    const baseDomain = process.env.EX_BASE_DOMAIN || "https://funds-gdr.spc-it.com.iq";
    const pageKey = doc.pageKey || forcedKey || pageKeyParam;
    const cfg = getExForm(pageKey);
const docTitle = cfg?.title || pageKey;   // هذا يطلع بدل Document
const docTypeAr = cfg?.title || "المستند";

    const docUrl = `${String(baseDomain).replace(/\/+$/, "")}/ex/${encodeURIComponent(pageKey)}/${encodeURIComponent(
      String(doc._id)
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
          ...(Array.isArray(step.tagAttachments) ? step.tagAttachments : []),
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
    /* ================= APPROVE ================= */
    if (action === "approve" || action === "operation_submit") {
      step.status = "Approved";
      step.actedBy = userIdObj;
      step.actedAt = new Date();
      step.comment = note || "";
      attachToStepIfNeeded();

      const lastIdx = doc.workflow.steps.length - 1;

      // ✅ Final approve
      if (stepIndex === lastIdx) {
        doc.status = "Approved";
        doc.currentStep = -1;

        const extraEmails = await getFinalApproveEmails(pageKey);

        // 1) لصاحب الطلب باسمه الحقيقي
        if (creatorUser?.email) {
          const creatorHtml = buildExWorkflowActionEmailHtml({
            action: "approve",
            planId: String(doc._id),
            pageKey,
            stepFrom: stepIndex,
            stepTo: stepIndex,
            note,
            actorName,
            greetingName: creatorUser?.name || creatorUser?.username || "زميلنا",
            toUserName: "",
            planUrl: docUrl,
            showRoutingLine: false,
            showDetailsButton: false,
            docTitle,
            docTypeAr,
          });
          try {
            await sendWorkflowEmail({
              toEmails: [creatorUser.email],
              subject: `${pageKey} Approved | ${String(doc._id).slice(-6)}`,
              html: creatorHtml,
            });
          } catch (e) {
            console.error("❌ Email send failed (creator final approve):", e?.message || e);
          }
        }
        
        // 2) للإيميلات الإضافية بعبارة "زميلنا"
        if (extraEmails.length > 0) {
          const extraHtml = buildExWorkflowActionEmailHtml({
            action: "approve",
            planId: String(doc._id),
            pageKey,
            stepFrom: stepIndex,
            stepTo: stepIndex,
            note,
            actorName,
            greetingName: "زميلنا",
            toUserName: "",
            planUrl: docUrl,
            showRoutingLine: false,
            docTitle,
            docTypeAr,
          });
        
          try {
            emailResult = await sendWorkflowEmail({
              toEmails: extraEmails,
              subject: `${pageKey} Approved | ${String(doc._id).slice(-6)}`,
              html: extraHtml,
            });
          } catch (e) {
            console.error("❌ Email send failed (extra final approve):", e?.message || e);
            emailResult = { error: e?.message || "email_failed" };
          }
        }
      } else {
        // ✅ Next step
        const nextIndex = stepIndex + 1;
        doc.currentStep = nextIndex;
        resetStepToPendingClean(doc.workflow.steps[nextIndex]);
        doc.status = "Pending";
        syncRequestAttachmentsToStep(doc.workflow.steps[nextIndex], doc);
        const nextStepUsers = doc.workflow.steps[nextIndex]?.users || [];
        const nextUserIds = nextStepUsers.map(getIdStr).filter(Boolean);

        const nextUsers = nextUserIds.length
          ? await User.find({ _id: { $in: nextUserIds } }).select("_id username name email").lean()
          : [];

        const toEmails = nextUsers.map((u) => u.email).filter(Boolean);
        const toUserName = nextUsers?.[0]?.name || nextUsers?.[0]?.username || "";

        const html = buildExWorkflowActionEmailHtml({
          action: "approve",
          planId: String(doc._id),
          pageKey,
          stepFrom: stepIndex,
          stepTo: nextIndex,
          note,
          actorName,
          greetingName: toUserName || "زميلنا",
          toUserName: toUserName || "",
          planUrl: docUrl,
          showRoutingLine: true,
          docTitle,
  docTypeAr,
        });

        try {
          emailResult = await sendWorkflowEmail({
            toEmails,
            subject: `${pageKey} Waiting Your Action | Step ${nextIndex + 1}`,
            html,
          });
        } catch (e) {
          console.error("❌ Email send failed (next step):", e?.message || e);
          emailResult = { error: e?.message || "email_failed" };
        }
      }
    }

    /* ================= REJECT (ينهي) ================= */
    if (action === "reject") {
      step.status = "Rejected";
      step.actedBy = userIdObj;
      step.actedAt = new Date();
      step.comment = note || "";

      doc.status = "Rejected";
      doc.currentStep = -1;

      const extraEmails = await getFinalApproveEmails(pageKey);

      // 1) لصاحب الطلب باسمه الحقيقي
      if (creatorUser?.email) {
        const creatorHtml = buildExWorkflowActionEmailHtml({
          action: "reject",
          planId: String(doc._id),
          pageKey,
          stepFrom: stepIndex,
          stepTo: stepIndex,
          note,
          actorName,
          greetingName: creatorUser?.name || creatorUser?.username || "زميلنا",
          toUserName: "",
          planUrl: docUrl,
          showRoutingLine: false,
          docTitle,
          docTypeAr,
        });
      
        try {
          await sendWorkflowEmail({
            toEmails: [creatorUser.email],
            subject: `${pageKey} Rejected | ${String(doc._id).slice(-6)}`,
            html: creatorHtml,
          });
        } catch (e) {
          console.error("❌ Email send failed (creator reject):", e?.message || e);
        }
      }
      
      // 2) للإيميلات الإضافية بعبارة "زميلنا"
      if (extraEmails.length > 0) {
        const extraHtml = buildExWorkflowActionEmailHtml({
          action: "approve",
          planId: String(doc._id),
          pageKey,
          stepFrom: stepIndex,
          stepTo: stepIndex,
          note,
          actorName,
          greetingName: "زميلنا",
          toUserName: "",
          planUrl: docUrl,
          showRoutingLine: false,
          showDetailsButton: false,
          docTitle,
          docTypeAr,
        });
      
        try {
          emailResult = await sendWorkflowEmail({
            toEmails: extraEmails,
            subject: `${pageKey} Rejected | ${String(doc._id).slice(-6)}`,
            html: extraHtml,
          });
        } catch (e) {
          console.error("❌ Email send failed (extra reject):", e?.message || e);
          emailResult = { error: e?.message || "email_failed" };
        }
      }
    }
// ✅ مهم جداً حتى ينحفظ تعديل الستيب داخل workflow
doc.markModified("workflow");
doc.markModified("workflow.steps");
doc.markModified(`workflow.steps.${stepIndex}`);
    await doc.save();

    const doc2 = await Model.findById(id)
      .populate({ path: "workflow.steps.users", model: "User", select: "username name email", strictPopulate: false })
      .populate({ path: "workflow.steps.actedBy", model: "User", select: "username name email", strictPopulate: false })
      .lean();

    return NextResponse.json({
      success: true,
      data: doc2,
      workflow: doc2?.workflow ?? null,
      pageKey: doc2?.pageKey ?? pageKeyParam,
      currentUser,
      emailResult,
    });
  } catch (err) {
    console.error("❌ ex/[pageKey]/[id] PUT error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}