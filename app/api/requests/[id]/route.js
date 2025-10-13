// File: app/api/requests/[id]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 🔹 Schema محدّث يحتوي على الـ workflow/status
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
        key: String,   // المفتاح داخل S3
        name: String,  // الاسم الأصلي للملف
        url: String,   // يتم توليده دايناميك
      },
    ],
    // 🟢 Workflow fields
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    approver: String,
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

// 🔧 دالة تجيب الموديل حسب الشركة
export const getModelForCompany = (company) => {
  const collectionName = `requests_${company.toLowerCase()}`;
  return (
    mongoose.models[collectionName] ||
    mongoose.model(collectionName, RequestSchema, collectionName)
  );
};

// 🔵 GET → جلب تفاصيل ريكويست واحد
export async function GET(req, context) {
  try {
    await dbConnect();
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");

    if (!company) {
      return NextResponse.json({ success: false, error: "Company is required" }, { status: 400 });
    }

    const Model = getModelForCompany(company);
    const request = await Model.findById(id);

    if (!request) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    // ✨ توليد Signed URLs للمرفقات
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
    console.error("❌ GET [id] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// 🟢 PUT → تحديث ريكويست (يشمل تحديث الحالة)
export async function PUT(req, context) {
  try {
    await dbConnect();
    const { id } = context.params;
    const body = await req.json();
    const { company } = body;

    if (!company) {
      return NextResponse.json({ success: false, error: "Company is required" }, { status: 400 });
    }

    const Model = getModelForCompany(company);
    const updated = await Model.findByIdAndUpdate(id, body, { new: true });

    if (!updated) {
      return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ PUT [id] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}