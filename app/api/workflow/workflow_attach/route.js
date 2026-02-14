import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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

    /* ================= Body (JSON) ================= */
    const body = await req.json();
    const { companyKey, requestId, stepIndex, key, name, type, size } = body;

    if (!companyKey || !requestId || stepIndex === null || stepIndex === undefined) {
      return NextResponse.json(
        { success: false, error: "companyKey, requestId, stepIndex are required" },
        { status: 400 }
      );
    }

    if (!key) {
      return NextResponse.json(
        { success: false, error: "S3 key is required" },
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

    /* ================= Generate Signed URL ================= */
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

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 3600 }
    );

    /* ================= Save to DB ================= */
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
    console.error("workflow_attach error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}

// =========================
// PUT → Clear tag for a step (NO FILE)
// =========================
export async function PUT(req) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { companyKey, requestId, stepIndex, clearTag } = body;

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

    if (!clearTag) {
      return NextResponse.json({ success: true, message: "No action" });
    }

    await dbConnect();
    const RequestModel = getModelForCompany(companyKey);

    const updateRes = await RequestModel.updateOne(
      { _id: requestId, companyKey },
      {
        $set: {
          [`workflow.steps.${idx}.tag`]: "",
        },
      }
    );

    if (!updateRes.modifiedCount) {
      return NextResponse.json({ success: false, error: "Tag not cleared" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("workflow_attach PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
