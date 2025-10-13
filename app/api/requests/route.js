import { NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 📌 MongoDB Connection
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "FundRrq" });
  isConnected = true;
  console.log("✅ MongoDB Connected");
};

// 📦 Schema
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
    attachments: [{ key: String, name: String, url: String }],

    // 🔹 الحالة العامة
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },

    // 🔹 الشخص الحالي اللي بيده الخطوة
    currentApprover: String,

    // 🔹 ترتيب الخطوة الحالية
    currentStep: { type: Number, default: 0 },

    // 🔹 مصفوفة الخطوات (لكل شركة نقدر نضبطها عند الإنشاء)
    workflowSteps: [String], // ["Ali", "Hassan", "Omar"]

    // 🔹 سجل الموافقات الكامل
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

// ✅ الدالة المفقودة — هنا الحل الحقيقي
function getModelForCompany(company) {
  const name = `requests_${company.toLowerCase()}`;
  return (
    mongoose.models[name] ||
    mongoose.model(name, RequestSchema, name)
  );
}

// 🟢 POST → Create request with attachments
export async function POST(req) {
  try {
    await connectDB();
    const formData = await req.formData();

    const company = formData.get("company");
    if (!company)
      return NextResponse.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );

    const Model = getModelForCompany(company);

    const requestType = formData.get("requestType");
    const description = formData.get("description");
    const currency = formData.get("currency");
    const department = formData.get("department");
    const createdBy = formData.get("createdBy");
    const items = formData.get("items")
      ? JSON.parse(formData.get("items"))
      : [];

    // 📎 handle attachments
    const files = formData.getAll("attachments");
    let attachments = [];

    if (files && files.length > 0) {
      const s3 = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      for (const file of files) {
        if (!file || !file.name) continue;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileName = `${Date.now()}_${file.name}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
          })
        );

        attachments.push({
          key: fileName,
          name: file.name,
        });
      }
    }

    const newReq = new Model({
      company,
      requestType,
      description,
      currency,
      department,
      items,
      createdBy,
      attachments,
      workflowSteps: ["Ali", "Hassan", "Omar"], // 🧩 تسلسل اليوزرية
      currentStep: 0,
      currentApprover: "Ali", // أول شخص
      status: "Pending",
    });

    await newReq.save();

    return NextResponse.json({ success: true, data: newReq });
  } catch (err) {
    console.error("❌ POST Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 🔵 GET → List requests (مع status)
export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const companyParam = searchParams.get("company");
    let requests = [];

    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    if (companyParam && companyParam !== "all") {
      const companies = companyParam.split(",");
      for (const company of companies) {
        const Model = getModelForCompany(company);
        const companyRequests = await Model.find()
          .select(
            "company requestType description currency department createdBy createdAt status"
          )
          .sort({ createdAt: -1 });
        requests.push(...companyRequests);
      }
    } else {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      const requestCollections = collections.filter((c) =>
        c.name.startsWith("requests_")
      );

      for (const col of requestCollections) {
        const companyName = col.name.replace("requests_", "");
        const Model = getModelForCompany(companyName);
        const companyRequests = await Model.find()
          .select(
            "company requestType description currency department createdBy createdAt status"
          )
          .sort({ createdAt: -1 });
        requests.push(...companyRequests);
      }
    }

    // 🪣 Attach signed URLs
    for (const r of requests) {
      if (Array.isArray(r.attachments)) {
        for (const file of r.attachments) {
          if (!file?.key) continue;
          const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: file.key,
          });
          file.url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        }
      }
    }

    return NextResponse.json({ success: true, data: requests });
  } catch (err) {
    console.error("❌ GET Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ✏️ PUT → Update request
export async function PUT(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { id, company } = body;

    if (!id || !company)
      return NextResponse.json(
        { success: false, error: "ID & Company required" },
        { status: 400 }
      );

    const Model = getModelForCompany(company);
    const updated = await Model.findByIdAndUpdate(id, body, { new: true });

    if (!updated)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ PUT Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 🗑 DELETE → Remove request
export async function DELETE(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const company = searchParams.get("company");

    if (!id || !company)
      return NextResponse.json(
        { success: false, error: "ID & Company required" },
        { status: 400 }
      );

    const Model = getModelForCompany(company);
    const deleted = await Model.findByIdAndDelete(id);

    if (!deleted)
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );

    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("❌ DELETE Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}