import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";

/* ======================= SCHEMA ======================= */
const RequestSchema = new mongoose.Schema(
  {
    company: String,
    requestType: String,
    description: String,
    currency: String,
    department: String,
    items: [{ desc: String, qty: Number, price: Number }],
    createdBy: String,
    createdAt: { type: Date, default: Date.now },

    attachments: [
      {
        key: String,
        name: String,
        url: String,
      },
    ],

    workflow: {
      name: String,
      company: String,
      steps: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending",
          },
          actedAt: Date,
        },
      ],
    },

    currentStep: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },

    approvalHistory: [
      {
        user: String,
        action: String,
        note: String,
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { strict: false }
);

/* ======================= MODEL PER COMPANY ======================= */
export const getModelForCompany = (company) => {
  const collectionName = `requests_${company.toLowerCase()}`;
  return (
    mongoose.models[collectionName] ||
    mongoose.model(collectionName, RequestSchema, collectionName)
  );
};

/* ======================= GET ======================= */
export async function GET(req, { params }) {
  try {
    await dbConnect();

    const id = params.id;
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    const Model = getModelForCompany(company);

    const request = await Model.findById(id).populate({
      path: "workflow.steps.user",
      model: "User",
      strictPopulate: false,
    });

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    if (Array.isArray(request.attachments)) {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      for (const file of request.attachments) {
        if (!file?.key) continue;
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: file.key,
        });
        file.url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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
    const { action, note } = body;

    if (!company) company = body.company;
    if (!company)
      return NextResponse.json({ success:false, error:"Company is required"}, {status:400});

    const cookieStore = cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId)
      return NextResponse.json({ success:false, error:"Not authenticated"}, {status:401});

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);
    if (!request)
      return NextResponse.json({ success:false, error:"Request not found"}, {status:404});

    if (action === "cancel") {
      request.status = "Cancelled";
      request.currentStep = -1;
    
      request.workflow.steps.forEach(step => {
        step.status = "Cancelled";
        step.actedAt = new Date();
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

    /* بعد هذا فقط نفحص صلاحية approve/reject */
    const stepIndex = request.currentStep;
    const step = request.workflow?.steps?.[stepIndex];
    if (!step)
      return NextResponse.json({ success:false, error:"Invalid workflow step"}, {status:400});

    if (String(step.user) !== String(userId))
      return NextResponse.json(
        { success:false, error:"You are not authorized to act on this step"},
        {status:403}
      );

    /* 🟢 APPROVE */
    if (action === "approve") {
      step.status = "Approved";
      step.actedAt = new Date();
      if (stepIndex === request.workflow.steps.length - 1) {
        request.status = "Approved";
      } else {
        request.currentStep = stepIndex + 1;
        const next = request.workflow.steps[request.currentStep];
        next.status = "Pending";
        next.actedAt = null;
      }
    }

    /* 🔴 REJECT */
    if (action === "reject") {
      step.status = "Rejected";
      step.actedAt = new Date();
      if (stepIndex > 0) {
        request.currentStep = stepIndex - 1;
        const previous = request.workflow.steps[request.currentStep];
        previous.status = "Pending";
        previous.actedAt = null;
      }
      request.status = "Pending";
    }

    request.approvalHistory.push({
      user: userId,
      action,
      note: note || "",
      date: new Date(),
    });

    await request.save();
    return NextResponse.json({ success: true, data: request });

  } catch(err) {
    console.error("❌ PUT Error:", err);
    return NextResponse.json({ success:false, error:err.message }, {status:500});
  }
}