import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";
import {
  assertS3Env,
  buildPublicS3Url,
  buildUploadKey,
} from "@/lib/s3/s3Env";

export const runtime = "nodejs";

/** صلاحية طويلة لدعم رفع ملفات كبيرة (حتى غيغات) */
const PUT_URL_EXPIRES_IN = 60 * 60 * 12; // 12 ساعة

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

    const env = assertS3Env();
    const key = buildUploadKey(fileName, prefix);

    const s3 = new S3Client({
      region: env.region,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });

    const putUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: key,
        ContentType: fileType || "application/octet-stream",
      }),
      { expiresIn: PUT_URL_EXPIRES_IN }
    );

    const getUrl = buildPublicS3Url(env.bucket, env.region, key);

    return NextResponse.json({ success: true, url: putUrl, key, getUrl });
  } catch (err) {
    console.error("presign error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Presign failed",
        ...(err?.details || {}),
      },
      { status: err?.status || 500 }
    );
  }
}
