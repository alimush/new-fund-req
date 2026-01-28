import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Workflow from "@/models/Workflow";

/* =========================
   MongoDB Connection
========================= */
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "FundRrq",
  });
  isConnected = true;
  console.log("✅ MongoDB Connected");
};

/* =========================
   Request Schema (WITH WORKFLOW SNAPSHOT)
========================= */
const RequestSchema = new mongoose.Schema(
  {
    company: { type: String, index: true },
    requestType: String,
    description: String,
    currency: String,
    department: String,
    items: [{ desc: String, qty: Number, price: Number }],
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    attachments: [{ key: String, name: String, url: String }],

    // 🟢 Workflow Snapshot (Immutable)
    workflow: {
      name: String,
      steps: [
        {
          users: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
          ],
    
          status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Cancelled"],
            default: "Pending",
          },
    
          actedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
    
          actedAt: {
            type: Date,
            default: null,
          },
    
          // ✅ هذا المهم
          comment: {
            type: String,
            default: "",
            trim: true,
          },
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

/* =========================
   Model per Company
========================= */
function getModelForCompany(company) {
  const collectionName = `requests_${company.toLowerCase()}`;
  return (
    mongoose.models[collectionName] ||
    mongoose.model(collectionName, RequestSchema, collectionName)
  );
}

/* =========================
   POST → Create Request (WITH WORKFLOW SNAPSHOT)
========================= */
export async function POST(req) {
  try {
    await connectDB();
    const formData = await req.formData();

    const company = formData.get("company");
    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    // 🔹 Get workflow of company
    const workflow = await Workflow.findOne({ company })
    .populate("steps.users");
    if (!workflow) {
      return NextResponse.json(
        { success: false, error: "No workflow defined for this company" },
        { status: 400 }
      );
    }

    // 🔹 Snapshot
    const workflowSnapshot = {
      name: workflow.name,
      steps: workflow.steps.map((s) => ({
        users: s.users.map(u => u._id),
        status: "Pending",
        actedAt: null,
      })),
    };

    const Model = getModelForCompany(company);

    const data = {
      company,
      requestType: formData.get("requestType"),
      description: formData.get("description"),
      currency: formData.get("currency"),
      department: formData.get("department"),
      createdBy: formData.get("createdBy"),
      items: formData.get("items")
        ? JSON.parse(formData.get("items"))
        : [],
      attachments: [],

      workflow: workflowSnapshot,
      currentStep: 0,
    };

    /* ---------- Attachments ---------- */
    const files = formData.getAll("attachments");
    if (files.length > 0) {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      for (const file of files) {
        if (!file?.name) continue;

        const buffer = Buffer.from(await file.arrayBuffer());
        const key = `${Date.now()}_${file.name}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: file.type,
          })
        );

        data.attachments.push({ key, name: file.name });
      }
    }

    const newRequest = new Model(data);
    await newRequest.save();

    return NextResponse.json({ success: true, data: newRequest });
  } catch (err) {
    console.error("❌ POST Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/* =========================
   GET → List OR Single
========================= */
export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const id = searchParams.get("id");

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const Model = getModelForCompany(company);

    if (id) {
      const request = await Model.findById(id).populate({
        path: "workflow.steps.users",
        model: "User",
      })

      if (!request) {
        return NextResponse.json(
          { success: false, error: "Request not found" },
          { status: 404 }
        );
      }

      if (Array.isArray(request.attachments)) {
        for (const file of request.attachments) {
          if (!file?.key) continue;
          file.url = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET,
              Key: file.key,
            }),
            { expiresIn: 3600 }
          );
        }
      }

      return NextResponse.json({ success: true, data: request });
    }

    const requests = await Model.find().lean().sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: requests });
  } catch (err) {
    console.error("❌ GET Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/* =========================
   PUT → Update Request (NO WORKFLOW EDIT)
========================= */
export async function PUT(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, company, ...updateData } = body;

    if (!id || !company) {
      return NextResponse.json(
        { success: false, error: "ID & Company required" },
        { status: 400 }
      );
    }

    // 🔒 Prevent workflow mutation
    delete updateData.workflow;
    delete updateData.currentStep;
    delete updateData.approvalHistory;

    const Model = getModelForCompany(company);
    const updated = await Model.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ PUT Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/* =========================
   DELETE → Remove Request
========================= */
export async function DELETE(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const company = searchParams.get("company");

    if (!id || !company) {
      return NextResponse.json(
        { success: false, error: "ID & Company required" },
        { status: 400 }
      );
    }

    const Model = getModelForCompany(company);
    const deleted = await Model.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE Error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}