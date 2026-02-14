import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Workflow from "@/models/Workflow";
import { getModelForCompany } from "@/models/Request";
import User from "@/models/User";
import Permissions from "@/models/Permissions"; // ✅ اضفناها
import mongoose from "mongoose";

export const runtime = "nodejs";

const CounterSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

// =========================
// ✅ helpers للحماية
// =========================
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

async function hasCompanyAccess(userId, company) {
  if (!userId || !company) return false;
  if (!isValidObjectId(userId)) return false;

  const exists = await Permissions.exists({
    users: new mongoose.Types.ObjectId(userId),
    companies: company,
  });

  return !!exists;
}

async function requireCompanyAccess(req, company) {
  await dbConnect();

  const userId = req.headers.get("x-user-id"); // ✅ جاي من localStorage بالفرونت

  if (!userId) {
    return { ok: false, status: 401, error: "Missing x-user-id" };
  }
  if (!isValidObjectId(userId)) {
    return { ok: false, status: 401, error: "Invalid userId" };
  }
  if (!company) {
    return { ok: false, status: 400, error: "Company is required" };
  }

  const allowed = await hasCompanyAccess(userId, company);
  if (!allowed) {
    return { ok: false, status: 403, error: "No access to this company" };
  }

  return { ok: true, userId };
}

/* =========================
   POST → Create Request (WITH WORKFLOW SNAPSHOT)
   (اختياري تحميه لاحقاً، هسه خليته مثل ما هو)
========================= */
export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const company = String(body.company || "").trim();

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    const workflow = await Workflow.findOne({ company }).populate("steps.users");
    if (!workflow) {
      return NextResponse.json(
        { success: false, error: "No workflow defined for this company" },
        { status: 400 }
      );
    }

    const workflowSnapshot = {
      name: workflow.name,
      steps: workflow.steps.map((s) => ({
        users: s.users.map((u) => u._id),
        status: "Pending",
        actedBy: null,
        actedAt: null,
        comment: "",
      })),
    };

    const Model = getModelForCompany(company);

    const baseData = {
      companyKey: company,
      company,
      requestType: body.requestType,
      description: body.description,
      currency: body.currency,
      department: body.department,
      createdBy: body.createdBy,
      items: Array.isArray(body.items) ? body.items : [],
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      workflow: workflowSnapshot,
      currentStep: 0,
      status: "Pending",
    };

    const companyText = company
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    const counterKey = `REQ_${companyText}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const counter = await Counter.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const serial = String(counter.seq).padStart(5, "0");
      const requestCode = `REQ-${companyText}-${serial}`;

      try {
        const newRequest = new Model({ ...baseData, requestCode });
        await newRequest.save();
        return NextResponse.json({ success: true, data: newRequest });
      } catch (e) {
        if (e?.code === 11000 && e?.message?.includes("requestCode")) continue;
        throw e;
      }
    }

    return NextResponse.json(
      { success: false, error: "Could not generate unique requestCode, try again." },
      { status: 409 }
    );
  } catch (err) {
    console.error("❌ POST Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "POST failed" },
      { status: 500 }
    );
  }
}

/* =========================
   ✅ GET → List OR Single (PROTECTED)
========================= */
export async function GET(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const id = searchParams.get("id");

    // ✅ حماية الشركة + الهيدر
    const auth = await requireCompanyAccess(req, company);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const Model = getModelForCompany(company);

    // ✅ Single request
    if (id) {
      if (!isValidObjectId(id)) {
        return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
      }

      const request = await Model.findById(id).populate({
        path: "workflow.steps.users",
        model: "User",
        strictPopulate: false,
      });

      if (!request) {
        return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
      }

      // ✅ Signed URLs for attachments
      if (Array.isArray(request.attachments) && request.attachments.length > 0) {
        const s3 = new S3Client({
          region: process.env.S3_REGION,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          },
        });

        for (const file of request.attachments) {
          if (!file?.key) continue;
          file.url = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: file.key,
            }),
            { expiresIn: 3600 }
          );
        }
      }

      return NextResponse.json({ success: true, data: request });
    }

    // ✅ List
    const requests = await Model.find().lean().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: requests });
  } catch (err) {
    console.error("❌ GET Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/* =========================
   PUT → Update Request (NO WORKFLOW EDIT)
   (ممكن تحميه نفس GET لاحقاً)
========================= */
export async function PUT(req) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, company, ...updateData } = body;

    if (!id || !company) {
      return NextResponse.json({ success: false, error: "ID & Company required" }, { status: 400 });
    }

    delete updateData.workflow;
    delete updateData.currentStep;
    delete updateData.approvalHistory;

    updateData.companyKey = company;
    updateData.company = company;

    const Model = getModelForCompany(company);
    const updated = await Model.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ PUT Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/* =========================
   DELETE → Remove Request
   (ممكن تحميه نفس GET لاحقاً)
========================= */
export async function DELETE(req) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const company = searchParams.get("company");

    if (!id || !company) {
      return NextResponse.json({ success: false, error: "ID & Company required" }, { status: 400 });
    }

    const Model = getModelForCompany(company);
    const deleted = await Model.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
