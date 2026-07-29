import { NextResponse } from "next/server";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";
import {
  assertS3Env,
  buildPublicS3Url,
  buildUploadKey,
} from "@/lib/s3/s3Env";

export const runtime = "nodejs";

/** صلاحية طويلة — رفع ملفات كبيرة (حتى غيغات) قد يستغرق ساعات */
const PART_URL_EXPIRES_IN = 60 * 60 * 12; // 12 ساعة

function s3FromEnv(env) {
  return new S3Client({
    region: env.region,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
}

async function requireUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 }) };
  }
  return { userId };
}

export async function POST(req) {
  try {
    const auth = await requireUser();
    if (auth.error) return auth.error;

    const body = await req.json();
    const action = String(body?.action || "").trim().toLowerCase();
    const env = assertS3Env();
    const s3 = s3FromEnv(env);

    if (action === "init") {
      const fileName = body?.fileName;
      if (!fileName) {
        return NextResponse.json(
          { success: false, error: "fileName is required" },
          { status: 400 }
        );
      }

      const key = buildUploadKey(fileName, body?.prefix);
      const contentType = body?.fileType || "application/octet-stream";

      const created = await s3.send(
        new CreateMultipartUploadCommand({
          Bucket: env.bucket,
          Key: key,
          ContentType: contentType,
        })
      );

      return NextResponse.json({
        success: true,
        key,
        uploadId: created.UploadId,
        getUrl: buildPublicS3Url(env.bucket, env.region, key),
      });
    }

    if (action === "sign") {
      const { key, uploadId, partNumber } = body || {};
      const part = Number(partNumber);
      if (!key || !uploadId || !Number.isFinite(part) || part < 1) {
        return NextResponse.json(
          { success: false, error: "key, uploadId, partNumber required" },
          { status: 400 }
        );
      }

      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: env.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: part,
        }),
        { expiresIn: PART_URL_EXPIRES_IN }
      );

      return NextResponse.json({ success: true, url, partNumber: part });
    }

    if (action === "complete") {
      const { key, uploadId, parts } = body || {};
      if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
        return NextResponse.json(
          { success: false, error: "key, uploadId, parts required" },
          { status: 400 }
        );
      }

      const sorted = [...parts]
        .map((p) => ({
          ETag: String(p?.ETag || p?.etag || "").replaceAll('"', ""),
          PartNumber: Number(p?.PartNumber || p?.partNumber),
        }))
        .filter((p) => p.ETag && Number.isFinite(p.PartNumber) && p.PartNumber > 0)
        .sort((a, b) => a.PartNumber - b.PartNumber)
        .map((p) => ({
          ETag: `"${p.ETag.replaceAll('"', "")}"`,
          PartNumber: p.PartNumber,
        }));

      if (!sorted.length) {
        return NextResponse.json(
          { success: false, error: "No valid parts to complete" },
          { status: 400 }
        );
      }

      await s3.send(
        new CompleteMultipartUploadCommand({
          Bucket: env.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: sorted },
        })
      );

      return NextResponse.json({
        success: true,
        key,
        getUrl: buildPublicS3Url(env.bucket, env.region, key),
      });
    }

    if (action === "abort") {
      const { key, uploadId } = body || {};
      if (!key || !uploadId) {
        return NextResponse.json(
          { success: false, error: "key and uploadId required" },
          { status: 400 }
        );
      }

      await s3.send(
        new AbortMultipartUploadCommand({
          Bucket: env.bucket,
          Key: key,
          UploadId: uploadId,
        })
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action. Use init|sign|complete|abort" },
      { status: 400 }
    );
  } catch (err) {
    console.error("multipart upload error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Multipart upload failed",
        ...(err?.details || {}),
      },
      { status: err?.status || 500 }
    );
  }
}
