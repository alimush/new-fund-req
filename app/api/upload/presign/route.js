import { NextResponse } from "next/server";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";

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

    const { fileName, fileType, prefix } = await req.json();

    if (!fileName) {
      return NextResponse.json(
        { success: false, error: "fileName is required" },
        { status: 400 }
      );
    }

    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!bucket || !region) {
      return NextResponse.json(
        { success: false, error: "Missing S3 env", bucket, region },
        { status: 500 }
      );
    }
    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { success: false, error: "Missing S3 credentials" },
        { status: 500 }
      );
    }

    const safeName = String(fileName).replace(/[^\w.\-() ]+/g, "_");
    const folder = prefix || "uploads";
    const key = `${folder}/${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}-${safeName}`;

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    // ✅ Signed PUT (رفع)
    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType || "application/octet-stream",
      }),
      { expiresIn: 600 }
    );

    // ✅ Signed GET (فتح/تحميل) — هذا يحل AccessDenied
    const getUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({ success: true, url: putUrl, key, getUrl });
  } catch (err) {
    console.error("presign error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Presign failed" },
      { status: 500 }
    );
  }
}