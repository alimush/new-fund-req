import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";

import dbConnect from "@/lib/mongodb";
import { getModelForCompany } from "@/models/Request";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    /* ================= Auth ================= */
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    /* ================= Params from URL ================= */
    const { searchParams } = new URL(req.url);
    const companyKey = searchParams.get("company");
    const requestId = searchParams.get("requestId");
    const stepIndex = searchParams.get("stepIndex");

    if (!companyKey || !requestId || stepIndex === null) {
      return NextResponse.json(
        { success: false, error: "company, requestId, stepIndex are required in URL" },
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

    /* ================= FormData ================= */
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "file is required" },
        { status: 400 }
      );
    }

    /* ================= AWS ================= */
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;

    if (!bucket || !region) {
      return NextResponse.json(
        { success: false, error: "Missing AWS env" },
        { status: 500 }
      );
    }

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    /* ================= Upload ================= */
    const safeName = String(file.name).replace(/[^\w.\-]+/g, "_");
    const key = `workflow/attachments/${Date.now()}_${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    /* ================= Signed URL (مثل المثال مالك) ================= */
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: 3600 }
    );

    /* ================= Save URL in tag ================= */
    await dbConnect();
    const RequestModel = getModelForCompany(companyKey);

    const updateRes = await RequestModel.updateOne(
      { _id: requestId, companyKey },
      {
        $set: {
          [`workflow.steps.${idx}.tag`]: signedUrl,
        },
      }
    );

    if (!updateRes.modifiedCount) {
      return NextResponse.json(
        { success: false, error: "Tag not updated" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tagUrl: signedUrl,
    });
  } catch (err) {
    console.error("❌ workflow_attach error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}