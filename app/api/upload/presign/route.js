import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
console.log("S3_BUCKET_NAME:", bucket);
console.log("S3_REGION:", region); 
    if (!bucket || !region) {
      return NextResponse.json(
        { success: false, error: "Missing S3 env" },
        { status: 500 }
      );
    }

    const safeName = String(fileName).replace(/[^\w.\-() ]+/g, "_");
    const folder = prefix || "uploads";
    const key = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType || "application/octet-stream",
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 600 });

    return NextResponse.json({ success: true, url, key });
  } catch (err) {
    console.error("presign error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Presign failed" },
      { status: 500 }
    );
  }
}
