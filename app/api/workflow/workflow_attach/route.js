import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";

import dbConnect from "@/lib/mongodb";
import { getModelForCompany } from "@/models/Request";
import User from "@/models/User";

function canEditLastStepAttachment(requestDoc, userId, stepIndex) {
  const steps = requestDoc?.workflow?.steps || [];
  const lastIdx = steps.length - 1;
  const idx = Number(stepIndex);
  if (idx !== lastIdx || lastIdx < 0) return false;

  const step = steps[idx];
  if (!step) return false;
  if (String(requestDoc.status || "").toLowerCase() === "cancelled") return false;
  if (String(requestDoc.status || "") !== "Approved") return false;
  if (String(step.status || "") !== "Approved") return false;

  const actedById = step.actedBy ? String(step.actedBy) : "";
  return !!actedById && actedById === String(userId);
}

function canActOnVoucherStep(requestDoc, userId, stepIndex) {
  if (!requestDoc || !userId) return false;
  const steps = requestDoc?.workflow?.steps || [];
  if (!steps.length) return false;
  const idx = Number(stepIndex);
  const lastIdx = steps.length - 1;
  if (idx !== lastIdx) return false;
  const step = steps[idx];
  if (!step) return false;

  const isFinalApproved =
    String(requestDoc.status || "") === "Approved" &&
    Number(requestDoc.currentStep) === idx &&
    String(step.status || "") === "Approved";
  if (!isFinalApproved) return false;

  const currentId = String(userId);
  const inStep = (step.users || []).some((u) => String(u) === currentId);
  if (!inStep) return false;

  const delegatedTo = step?.voucherDelegateTo ? String(step.voucherDelegateTo) : "";
  if (delegatedTo) return delegatedTo === currentId;
  return true;
}

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { companyKey, requestId, stepIndex, attachments, isVoucherAttachment, isEditCommentAttachment } =
      body;

    if (!companyKey || !requestId || stepIndex === null || stepIndex === undefined) {
      return NextResponse.json(
        { success: false, error: "companyKey, requestId, stepIndex are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(attachments) || attachments.length === 0) {
      return NextResponse.json(
        { success: false, error: "attachments are required" },
        { status: 400 }
      );
    }

    const idx = Number(stepIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid stepIndex" },
        { status: 400 }
      );
    }

    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.S3_REGION;

    if (!bucket || !region) {
      return NextResponse.json(
        { success: false, error: "Missing S3 env" },
        { status: 500 }
      );
    }

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });

    const newAttachments = [];

    for (const att of attachments) {
      const signedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: att.key,
        }),
        { expiresIn: 3600 }
      );

      newAttachments.push({
        key: att.key,
        name: att.name || "",
        type: att.type || "",
        size: att.size || 0,
        url: signedUrl,
      });
    }

    await dbConnect();
    const RequestModel = getModelForCompany(companyKey);

    const requestDoc = await RequestModel.findOne({
      _id: requestId,
      companyKey,
    });

    if (!requestDoc) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    if (!requestDoc.workflow?.steps?.[idx]) {
      return NextResponse.json(
        { success: false, error: "Step not found" },
        { status: 404 }
      );
    }

    const step = requestDoc.workflow?.steps?.[idx];
    const isRegularStepAuthorized =
      String(requestDoc.status || "") !== "Cancelled" &&
      Number(requestDoc.currentStep) === idx &&
      String(step?.status || "") === "Pending" &&
      (step?.users || []).some((u) => String(u) === String(userId));

    if (isVoucherAttachment) {
      if (!canActOnVoucherStep(requestDoc, userId, idx)) {
        return NextResponse.json(
          { success: false, error: "You are not allowed to upload voucher attachment on this step" },
          { status: 403 }
        );
      }
    } else if (isEditCommentAttachment) {
      if (!canEditLastStepAttachment(requestDoc, userId, idx)) {
        return NextResponse.json(
          { success: false, error: "You are not allowed to edit attachments on this step" },
          { status: 403 }
        );
      }
    } else if (!isRegularStepAuthorized) {
      return NextResponse.json(
        { success: false, error: "You are not allowed to upload attachment on this step" },
        { status: 403 }
      );
    }

    const oldAttachments = Array.isArray(requestDoc.workflow.steps[idx].tagAttachments)
      ? requestDoc.workflow.steps[idx].tagAttachments
      : [];

    const mergedAttachments = [...oldAttachments, ...newAttachments];

    requestDoc.workflow.steps[idx].tagAttachments = mergedAttachments;
    requestDoc.workflow.steps[idx].tag = mergedAttachments[0]?.url || "";
    if (isVoucherAttachment) {
      requestDoc.workflow.steps[idx].voucherProcessedBy = userId;
      requestDoc.workflow.steps[idx].voucherProcessedAt = new Date();
      const actor = await User.findById(userId).select("username").lean();
      requestDoc.workflow.steps[idx].voucherProcessedByUsername = String(actor?.username || "");
    }

    await requestDoc.save();

    return NextResponse.json({
      success: true,
      tagAttachments: mergedAttachments,
      tagUrl: mergedAttachments[0]?.url || "",
    });
  } catch (err) {
    console.error("workflow_attach error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// =========================
// PUT → Update / clear step attachments
// =========================
export async function PUT(req) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      companyKey,
      requestId,
      stepIndex,
      clearTag,
      removeAttachmentKey,
      removeAttachmentUrl,
      replaceAttachments,
      isEditCommentAttachment,
    } = body;

    if (!companyKey || !requestId || stepIndex === null || stepIndex === undefined) {
      return NextResponse.json(
        { success: false, error: "companyKey, requestId, stepIndex are required" },
        { status: 400 }
      );
    }

    const idx = Number(stepIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return NextResponse.json({ success: false, error: "Invalid stepIndex" }, { status: 400 });
    }

    const hasAction =
      clearTag ||
      removeAttachmentKey ||
      removeAttachmentUrl ||
      Array.isArray(replaceAttachments);

    if (!hasAction) {
      return NextResponse.json({ success: true, message: "No action" });
    }

    await dbConnect();
    const RequestModel = getModelForCompany(companyKey);
    const requestDoc = await RequestModel.findOne({ _id: requestId, companyKey });

    if (!requestDoc) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    if (!requestDoc.workflow?.steps?.[idx]) {
      return NextResponse.json({ success: false, error: "Step not found" }, { status: 404 });
    }

    const step = requestDoc.workflow.steps[idx];
    const isRegularStepAuthorized =
      String(requestDoc.status || "") !== "Cancelled" &&
      Number(requestDoc.currentStep) === idx &&
      String(step?.status || "") === "Pending" &&
      (step?.users || []).some((u) => String(u) === String(userId));

    const isEditAuthorized =
      isEditCommentAttachment && canEditLastStepAttachment(requestDoc, userId, idx);

    if (!isRegularStepAuthorized && !isEditAuthorized) {
      return NextResponse.json(
        { success: false, error: "You are not allowed to update attachments on this step" },
        { status: 403 }
      );
    }

    const oldAttachments = Array.isArray(step.tagAttachments) ? step.tagAttachments : [];
    let nextAttachments = oldAttachments;

    if (clearTag) {
      nextAttachments = [];
    } else if (removeAttachmentKey || removeAttachmentUrl) {
      const deleteKey = String(removeAttachmentKey || "").trim();
      const deleteUrl = String(removeAttachmentUrl || "").trim();
      nextAttachments = oldAttachments.filter((att) => {
        if (deleteKey && String(att?.key || "") === deleteKey) return false;
        if (deleteUrl && String(att?.url || "") === deleteUrl) return false;
        return true;
      });
    } else if (Array.isArray(replaceAttachments)) {
      nextAttachments = replaceAttachments;
    }

    step.tagAttachments = nextAttachments;
    step.tag = nextAttachments[0]?.url || "";
    requestDoc.markModified(`workflow.steps.${idx}`);

    await requestDoc.save();

    return NextResponse.json({
      success: true,
      tagAttachments: nextAttachments,
      tagUrl: nextAttachments[0]?.url || "",
    });
  } catch (err) {
    console.error("workflow_attach PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
