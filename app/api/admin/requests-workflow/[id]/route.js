import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import Permissions from "@/models/Permissions";
import { getModelForCompany } from "@/models/Request";
import { PERMISSIONS } from "@/lib/permission";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;
  if (!mongoose.Types.ObjectId.isValid(userId)) return false;
  const uid = new mongoose.Types.ObjectId(String(userId));
  return !!(await Permissions.exists({ users: uid, companies: company }));
}

async function hasManagePermissions(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return false;
  const uid = new mongoose.Types.ObjectId(String(userId));
  const groups = await Permissions.find({ users: uid }).select("permissions").lean();
  const set = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => set.add(String(p).trim()));
  }
  return set.has(PERMISSIONS.MANAGE_PERMISSIONS);
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

async function signAttachmentsIfAny(request) {
  if (!request) return request;
  if (!Array.isArray(request.attachments) || request.attachments.length === 0) {
    return request;
  }
  const s3 = getS3();
  for (const file of request.attachments) {
    if (!file?.key) continue;
    try {
      file.url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: file.key,
        }),
        { expiresIn: 3600 }
      );
    } catch {
      /* ignore */
    }
  }
  return request;
}

function buildPublicUrl(key) {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.S3_REGION;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function mergeWorkflowSteps(oldSteps, incomingSteps) {
  const prev = Array.isArray(oldSteps) ? oldSteps : [];

  return incomingSteps.map((s, idx) => {
    const userIds = (Array.isArray(s.users) ? s.users : [])
      .map((id) => String(id).trim())
      .filter((id) => isValidObjectId(id));

    if (userIds.length === 0) {
      const err = new Error("EMPTY_STEP_USERS");
      err.code = "EMPTY_STEP_USERS";
      throw err;
    }

    const oidUsers = userIds.map((id) => new mongoose.Types.ObjectId(id));
    const old = prev[idx];

    if (old && typeof old.toObject === "function") {
      const o = old.toObject({ flattenMaps: true });
      o.users = oidUsers;
      delete o._id;
      return o;
    }

    if (old) {
      const o = { ...old };
      o.users = oidUsers;
      delete o._id;
      return o;
    }

    return {
      users: oidUsers,
      status: "Pending",
      actedBy: null,
      actedAt: null,
      comment: "",
      tag: "",
      attachment: null,
      tagAttachments: [],
      voucherDelegateTo: null,
      voucherDelegatedBy: null,
      voucherDelegatedAt: null,
      voucherDelegateToUsername: "",
      voucherDelegatedByUsername: "",
      voucherProcessedBy: null,
      voucherProcessedAt: null,
      voucherProcessedByUsername: "",
    };
  });
}

export async function GET(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const company = String(searchParams.get("company") || "").trim();

    if (!company) {
      return NextResponse.json({ success: false, error: "company is required" }, { status: 400 });
    }
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const okPerm = await hasManagePermissions(userId);
    if (!okPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const allowedCo = await hasCompanyAccess(userId, company);
    if (!allowedCo) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }

    const Model = getModelForCompany(company);
    const request = await Model.findById(id)
      .populate({ path: "workflow.steps.users", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.actedBy", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.voucherDelegateTo", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.voucherDelegatedBy", model: "User", strictPopulate: false })
      .populate({ path: "workflow.steps.voucherProcessedBy", model: "User", strictPopulate: false });

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    const doc = request.toObject ? request.toObject() : request;

    if (Array.isArray(doc.attachments) && doc.attachments.length > 0) {
      for (const file of doc.attachments) {
        if (!file?.key) continue;
        file.url = buildPublicUrl(file.key);
      }
    }

    if (Array.isArray(doc?.workflow?.steps) && doc.workflow.steps.length > 0) {
      for (const st of doc.workflow.steps) {
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

    await signAttachmentsIfAny(doc);

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("admin requests-workflow GET:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const company = String(body.company || "").trim();

    if (!company) {
      return NextResponse.json({ success: false, error: "company is required" }, { status: 400 });
    }
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const okPerm = await hasManagePermissions(userId);
    if (!okPerm) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const allowedCo = await hasCompanyAccess(userId, company);
    if (!allowedCo) {
      return NextResponse.json({ success: false, error: "No access to this company" }, { status: 403 });
    }

    const wf = body.workflow;
    if (!wf || !Array.isArray(wf.steps)) {
      return NextResponse.json(
        { success: false, error: "workflow.steps array is required" },
        { status: 400 }
      );
    }

    if (wf.steps.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one workflow step is required" },
        { status: 400 }
      );
    }

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);
    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    let merged;
    try {
      merged = mergeWorkflowSteps(request.workflow?.steps, wf.steps);
    } catch (e) {
      if (e.code === "EMPTY_STEP_USERS") {
        return NextResponse.json(
          { success: false, error: "كل خطوة لازم يكون بها مستخدم واحد على الأقل" },
          { status: 400 }
        );
      }
      throw e;
    }

    request.workflow = request.workflow || {};
    request.workflow.steps = merged;
    if (typeof wf.name === "string") {
      request.workflow.name = wf.name.trim();
    }

    let cs = Number.isInteger(request.currentStep) ? request.currentStep : 0;
    if (merged.length === 0) {
      cs = 0;
    } else if (cs >= merged.length) {
      cs = merged.length - 1;
    } else if (cs < 0) {
      cs = 0;
    }
    request.currentStep = cs;

    request.markModified("workflow");
    await request.save();

    const fresh = await Model.findById(id).populate({
      path: "workflow.steps.users",
      model: "User",
      strictPopulate: false,
    });

    return NextResponse.json({ success: true, data: fresh });
  } catch (err) {
    console.error("admin requests-workflow PUT:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
