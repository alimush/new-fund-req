import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { S3Client } from "@aws-sdk/client-s3";

import User from "@/models/User";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";
import RequestOldData from "@/models/RequestOldData";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { isRequestCreator } from "@/lib/requests/createdByIdentity";

import {
  buildWorkflowActionEmailHtml,
  buildVoucherDelegationEmailHtml,
  sendWorkflowEmail,
} from "@/lib/email/workflowEmail";
import { getRequestDisbursementState } from "@/lib/voucher/requestDisbursementState";
import { reconcileRequestVoucher } from "@/lib/voucher/reconcileRequestVoucher";
import {
  getAllVoucherCompanyKeysForUser,
  getVoucherCompanyOptionsForDelegation,
  resolveVoucherCompanyKeyForUser,
} from "@/lib/voucher/resolveVoucherCompanyKey";
import { isApprovalOnlyCompany } from "@/lib/companies/expenseTypeCompanies";

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

function buildPublicUrl(key) {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.S3_REGION;

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
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
  st.voucherDelegateTo = null;
  st.voucherDelegatedBy = null;
  st.voucherDelegatedAt = null;
  st.voucherDelegateToUsername = "";
  st.voucherDelegatedByUsername = "";
  st.voucherDelegateCompanyKey = "";
  st.voucherProcessedBy = null;
  st.voucherProcessedAt = null;
  st.voucherProcessedByUsername = "";
}

async function getUserPermissions(userId) {
  if (!userId || !Types.ObjectId.isValid(String(userId))) return [];
  const groups = await Permissions.find({ users: new Types.ObjectId(String(userId)) })
    .select("permissions")
    .lean();
  const set = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => set.add(String(p).trim()));
  }
  return Array.from(set).filter(Boolean);
}

function canUserCreateVoucherForCompany(companyKey, userPerms = []) {
  const companyConfig = COMPANIES.find(
    (c) => String(c.key || "").trim().toLowerCase() === String(companyKey || "").trim().toLowerCase()
  );
  const isTestCompany = String(companyConfig?.key || "").trim() === "010";
  const hasCompanyPermission = Boolean(
    companyConfig?.permission && userPerms.includes(companyConfig.permission)
  );
  if (isTestCompany) return hasCompanyPermission;
  return hasCompanyPermission || userPerms.includes(PERMISSIONS.VIEW_ALL_REPORTS);
}

/* ======================= GET ======================= */
export async function GET(req, { params }) {
  try {
    await dbConnect();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const source = searchParams.get("source") || "new";

    if (!company) {
      return NextResponse.json({ success: false, error: "Company is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const allowedCompany = await hasCompanyAccess(userId, company);
    if (!allowedCompany) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }

    const Model = source === "old" ? RequestOldData : getModelForCompany(company);
    const request = await Model.findById(id)
      .populate({ path: "workflow.steps.users", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.actedBy", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.voucherDelegateTo", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.voucherDelegatedBy", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.voucherProcessedBy", model: "User", strictPopulate: false });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

   

    const s3 = getS3();

    // request attachments
    if (Array.isArray(request.attachments) && request.attachments.length > 0) {
      for (const file of request.attachments) {
        if (!file?.key) continue;
        file.url = buildPublicUrl(file.key);
      }
    }


  // step attachments
  if (Array.isArray(request?.workflow?.steps) && request.workflow.steps.length > 0) {
    for (const st of request.workflow.steps) {
      if (st?.attachment?.key) {
        st.attachment.url = buildPublicUrl(st.attachment.key);
      }
  
      if (Array.isArray(st?.tagAttachments) && st.tagAttachments.length > 0) {
        for (const file of st.tagAttachments) {
          if (!file?.key) continue;
          file.url = buildPublicUrl(file.key);
        }
      }
    }
  }

    const userPerms = await getUserPermissions(userId);
    const plain = request.toObject ? request.toObject() : request;
    const lastStep = plain.workflow?.steps?.[plain.workflow.steps.length - 1];
    const delegateVoucherHint = String(lastStep?.voucherDelegateCompanyKey || "").trim();
    const hintCompanyKey =
      delegateVoucherHint ||
      resolveVoucherCompanyKeyForUser(company, userPerms) ||
      company;

    let delegationVoucherOptionsByUser = {};
    if (userPerms.includes(PERMISSIONS.VOUCHER_DELEGATE)) {
      const stepUsers = lastStep?.users || [];
      for (const u of stepUsers) {
        const uid = String(u?._id || u || "").trim();
        if (!uid || !Types.ObjectId.isValid(uid)) continue;
        const delegatePerms = await getUserPermissions(uid);
        delegationVoucherOptionsByUser[uid] = getVoucherCompanyOptionsForDelegation(
          company,
          delegatePerms
        );
      }
    }

    let disbursement = await getRequestDisbursementState({
      requestCompanyKey: company,
      requestId: id,
      requestCode: plain.requestCode,
      allowedPerms: userPerms,
      hintCompanyKey,
    });

    if (disbursement.hasVoucher && disbursement.voucher) {
      try {
        const actor = await User.findById(userId).select("username").lean();
        const { linked } = await reconcileRequestVoucher({
          requestCompanyKey: company,
          requestId: id,
          requestCode: plain.requestCode,
          voucher: disbursement.voucher,
          userId,
          username: actor?.username || "",
        });
        if (linked) {
          disbursement = {
            ...disbursement,
            stepDisbursed: true,
            isDisbursed: true,
          };
        }
      } catch (e) {
        console.error("reconcile on request GET:", e);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...plain,
        delegationVoucherOptionsByUser,
        disbursement: {
          isDisbursed: disbursement.isDisbursed || disbursement.stepDisbursed,
          hasVoucher: disbursement.hasVoucher,
          stepDisbursed: disbursement.stepDisbursed,
          voucherNo: disbursement.voucherNo,
          voucherId: disbursement.voucherId,
        },
      },
    });
  } catch (err) {
    console.error("❌ GET Error:", err?.message || err);
    return NextResponse.json({ success: false, error: err?.message || "Server error" }, { status: 500 });
  }
}

/* ======================= PUT ======================= */
export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;

    const { searchParams } = new URL(req.url);
    let company = searchParams.get("company");

    const body = await req.json();
    const {
      action,
      note,
      attachmentMeta,
      stepIndex: bodyStepIndex,
      clearTag,
      expenseType,
      description,
      items,
      requestType,
      department,
      currency,
      projectName,
      attachments,
    } = body;

    if (!company) company = body.company;
    if (!company) {
      return NextResponse.json({ success: false, error: "Company is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
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
    
    const currentUser = await User.findById(userId).select("username").lean();
    const currentUsername = currentUser?.username || "";
    const currentUserPerms = await getUserPermissions(userId);
    
    const isOwner = isRequestCreator(request, { userId, username: currentUsername });
    
    const hasAnyApproval =
      Array.isArray(request?.approvalHistory) &&
      request.approvalHistory.some(
        (h) => String(h?.action || "").toLowerCase() === "approve"
      );

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
/* ================= UPDATE REQUEST ================= */
if (action === "update") {
  if (!isOwner) {
    return NextResponse.json(
      { success: false, error: "Only request owner can edit this request" },
      { status: 403 }
    );
  }

  if (String(request.status || "").toLowerCase() !== "pending") {
    return NextResponse.json(
      { success: false, error: "Only pending requests can be edited" },
      { status: 400 }
    );
  }

  if (hasAnyApproval) {
    return NextResponse.json(
      { success: false, error: "Request can no longer be edited because approval already happened" },
      { status: 400 }
    );
  }

  if (typeof description !== "undefined") request.description = description;
  if (typeof requestType !== "undefined") request.requestType = requestType;
  if (typeof department !== "undefined") request.department = department;
  if (typeof currency !== "undefined") request.currency = currency;
  if (typeof projectName !== "undefined") request.projectName = projectName;
  if (typeof expenseType !== "undefined") request.expenseType = expenseType;
  if (Array.isArray(items)) {
    request.items = items;
  }

  if (Array.isArray(attachments)) {
    request.attachments = attachments;
  }

  await request.save();

  return NextResponse.json({ success: true, data: request });
}

    /* ================= EDIT LAST STEP COMMENT ================= */
    if (action === "edit_step_comment") {
      const stepIndex = Number.isInteger(bodyStepIndex) ? bodyStepIndex : -1;
      const lastIdx = (request.workflow?.steps?.length || 0) - 1;

      if (stepIndex !== lastIdx || lastIdx < 0) {
        return NextResponse.json(
          { success: false, error: "Comment edit is allowed only on the final step" },
          { status: 400 }
        );
      }

      const step = request.workflow?.steps?.[stepIndex];
      if (!step) {
        return NextResponse.json({ success: false, error: "Invalid workflow step" }, { status: 400 });
      }

      if (String(request.status || "").toLowerCase() === "cancelled") {
        return NextResponse.json({ success: false, error: "Request is cancelled" }, { status: 400 });
      }

      if (step.status !== "Approved") {
        return NextResponse.json(
          { success: false, error: "Comment can be edited only after final step approval" },
          { status: 400 }
        );
      }

      const actedById = step.actedBy ? String(step.actedBy) : "";
      if (!actedById || actedById !== String(userId)) {
        return NextResponse.json(
          { success: false, error: "Only the user who approved this step can edit the comment" },
          { status: 403 }
        );
      }

      step.comment = String(note || "").trim();
      request.markModified(`workflow.steps.${stepIndex}`);

      request.approvalHistory.push({
        user: userId,
        action: "edit_step_comment",
        note: step.comment,
        date: new Date(),
      });

      await request.save();
      return NextResponse.json({ success: true, data: request });
    }

    /* ================= VALID ACTION ================= */
    if (action !== "approve" && action !== "reject" && action !== "delegate_voucher" && action !== "delegate_disburse_approve") {
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

    if (action !== "delegate_voucher" && action !== "delegate_disburse_approve" && step.status !== "Pending") {
      return NextResponse.json({ success: false, error: "Step already processed" }, { status: 400 });
    }

    if (action === "delegate_disburse_approve") {
      const lastIdx = request.workflow.steps.length - 1;
      const isFinalApprovedStep =
        request.status === "Approved" && stepIndex === lastIdx && step.status === "Approved";

      if (!isFinalApprovedStep) {
        return NextResponse.json(
          { success: false, error: "Approve disbursement is allowed only on final approved step" },
          { status: 400 }
        );
      }

      const currentUserDoc = await User.findById(userId).select("username").lean();
      const currentUsername = String(currentUserDoc?.username || "").trim();
      const delegatedToId = step?.voucherDelegateTo ? String(step.voucherDelegateTo) : "";
      const delegatedUsername = String(step?.voucherDelegateToUsername || "").trim();
      const isDelegatedUser =
        (delegatedToId && delegatedToId === String(userId)) ||
        (delegatedUsername && delegatedUsername === currentUsername);

      if (!isDelegatedUser) {
        return NextResponse.json(
          { success: false, error: "Only the delegated user can approve disbursement" },
          { status: 403 }
        );
      }

      if (step?.voucherProcessedBy || step?.voucherProcessedAt) {
        return NextResponse.json(
          { success: false, error: "Disbursement already approved" },
          { status: 400 }
        );
      }

      step.voucherProcessedBy = userId;
      step.voucherProcessedAt = new Date();
      step.voucherProcessedByUsername = currentUsername;

      request.approvalHistory.push({
        user: userId,
        action: "delegate_disburse_approve",
        note: note || "",
        date: new Date(),
      });

      await request.save();
      return NextResponse.json({ success: true, data: request });
    }

    // authorization (هنا step.users عادة ObjectId)
    const isAuthorized = (step.users || []).some((u) => String(u) === String(userId));

    if (action === "delegate_voucher") {
      let delegateToUserId = String(body?.delegateToUserId || "").trim();
      const delegateToUsername = String(body?.delegateToUsername || "").trim();

      if (!Types.ObjectId.isValid(delegateToUserId)) {
        if (!delegateToUsername) {
          return NextResponse.json(
            { success: false, error: "Invalid delegated user" },
            { status: 400 }
          );
        }
        const byUsername = await User.findOne({ username: delegateToUsername })
          .select("_id username")
          .lean();
        if (!byUsername?._id) {
          return NextResponse.json(
            { success: false, error: "Delegated username not found" },
            { status: 404 }
          );
        }
        delegateToUserId = String(byUsername._id);
      }

      const lastIdx = request.workflow.steps.length - 1;
      const isFinalApprovedStep =
        request.status === "Approved" && stepIndex === lastIdx && step.status === "Approved";

      if (!isFinalApprovedStep) {
        return NextResponse.json(
          { success: false, error: "Delegation is allowed only on final approved step" },
          { status: 400 }
        );
      }

      if (step?.voucherProcessedBy || step?.voucherProcessedAt) {
        return NextResponse.json(
          { success: false, error: "Cannot delegate after voucher has been issued" },
          { status: 400 }
        );
      }

      const canDelegate = currentUserPerms.includes(PERMISSIONS.VOUCHER_DELEGATE);
      if (!canDelegate) {
        return NextResponse.json(
          { success: false, error: "Missing voucher delegation permission" },
          { status: 403 }
        );
      }

      const userInsideStep = (step.users || []).some(
        (u) => String(u) === String(delegateToUserId)
      );
      if (!userInsideStep) {
        return NextResponse.json(
          { success: false, error: "Delegated user must be inside this step users" },
          { status: 400 }
        );
      }

      const delegateUserDoc = await User.findById(delegateToUserId)
        .select("username email")
        .lean();

      const delegatePerms = await getUserPermissions(delegateToUserId);
      const allowedVoucherKeys = getAllVoucherCompanyKeysForUser(delegatePerms);
      const normKey = (k) => String(k || "").trim().toLowerCase();

      let delegateVoucherCompanyKey = String(body?.delegateVoucherCompanyKey || "").trim();
      if (!delegateVoucherCompanyKey) {
        delegateVoucherCompanyKey = resolveVoucherCompanyKeyForUser(company, delegatePerms);
      }

      if (
        !allowedVoucherKeys.some((k) => normKey(k) === normKey(delegateVoucherCompanyKey))
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "المستخدم المختار ليس لديه صلاحية على وصل الشركة المحددة",
          },
          { status: 400 }
        );
      }

      const voucherCfg = COMPANIES.find(
        (c) => normKey(c.key) === normKey(delegateVoucherCompanyKey)
      );
      step.voucherDelegateCompanyKey = String(voucherCfg?.key || delegateVoucherCompanyKey);
      step.voucherDelegateTo = new Types.ObjectId(delegateToUserId);
      step.voucherDelegatedBy = new Types.ObjectId(String(userId));
      step.voucherDelegatedAt = new Date();
      step.voucherDelegateToUsername = String(delegateUserDoc?.username || "").trim();
      step.voucherDelegatedByUsername = String(currentUsername || "").trim();
      request.markModified(`workflow.steps.${stepIndex}`);
      await request.save();

      try {
        const delegateEmail = String(delegateUserDoc?.email || "").trim().toLowerCase();
        if (delegateEmail) {
          const code = String(request.requestCode || request.code || "").trim();
          const subject = `[تخويل صرف] ${code || id} | ${company}`;
          const html = buildVoucherDelegationEmailHtml({
            requestId: id,
            company,
            requestCode: code,
            requestType: String(request.requestType || ""),
            description: String(request.description || ""),
            delegatedByName: currentUsername,
            greetingName: delegateUserDoc?.username || "زميلنا",
            baseDomain: "https://funds-gdr.spc-it.com.iq",
          });
          await sendWorkflowEmail({
            toEmails: [delegateEmail],
            subject,
            html,
          });
        }
      } catch (e) {
        console.error("❌ Delegation email failed:", e?.message || e);
      }

      return NextResponse.json({ success: true, data: request });
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to act on this step" },
        { status: 403 }
      );
    }

    const applyStepAttachment = () => {
      if (attachmentMeta?.key) {
        if (!Array.isArray(step.tagAttachments)) {
          step.tagAttachments = [];
        }
    
        step.tagAttachments.push({
          key: attachmentMeta.key,
          name: attachmentMeta.name || "",
          type: attachmentMeta.type || "",
          size: attachmentMeta.size || 0,
          url: buildPublicUrl(attachmentMeta.key),
        });
      } else if (clearTag) {
        step.tagAttachments = [];
      }
    };

    const stepFrom = stepIndex;
    let stepTo = null;

    /* ================= APPROVE ================= */
    if (action === "approve") {
      const lastIdx = request.workflow.steps.length - 1;
      const isLastStep = stepIndex === lastIdx;
      if (
        isLastStep &&
        !isApprovalOnlyCompany(company) &&
        !currentUserPerms.includes(PERMISSIONS.VOUCHER_DELEGATE)
      ) {
        return NextResponse.json(
          { success: false, error: "Only delegated-permission user can approve final step" },
          { status: 403 }
        );
      }

      step.status = "Approved";
      step.actedBy = userId;
      step.actedAt = new Date();
      step.comment = note || "";
      applyStepAttachment();

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

        const stepEmails = [...new Set(stepUsers.map((u) => u.email).filter(Boolean))];

        const requesterUser = await User.findOne({ username: String(request.createdBy) })
          .select("email username")
          .lean();

        const requesterEmail = requesterUser?.email ? [requesterUser.email] : [];

        const actor = await User.findById(userId).select("username").lean();
        const actorName = actor?.username || "";

        const createdByName =
          request?.createdByName ||
          request?.createdByUsername ||
          request?.createdBy?.username ||
          request?.createdBy ||
          requesterUser?.username ||
          "";

        const stepUserName = stepUsers.length === 1 ? (stepUsers[0]?.username || "") : "";

        const subject = `[Workflow] ${action.toUpperCase()} → Step ${Number(stepTo) + 1} | ${company}`;

        // A) Step Users
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

        // B) Requester
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