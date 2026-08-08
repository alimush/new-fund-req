import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export function encodeS3Key(key) {
  return String(key || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export function buildPublicS3Url(key) {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.S3_REGION;
  if (!bucket || !region || !key) return "";
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeS3Key(key)}`;
}

function contentDispositionInline(fileName = "") {
  const name = String(fileName || "").trim() || "file";
  // ASCII fallback + UTF-8 filename* لدعم العربي في اسم الملف عند الفتح/التحميل
  const ascii = name.replace(/[^\x20-\x7E]/g, "_") || "file";
  const encoded = encodeURIComponent(name);
  return `inline; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`;
}

/** رابط تحميل موقّع — للجلب المباشر من S3 بدون حد حجم استجابة Lambda */
export async function getPresignedDownloadUrl(key, expiresIn = 7200, fileName = "") {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket || !key) {
    throw new Error("Missing S3 bucket or file key");
  }

  const cmd = {
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: contentDispositionInline(
      fileName || String(key).split("/").pop() || "file"
    ),
  };

  return getSignedUrl(getS3Client(), new GetObjectCommand(cmd), { expiresIn });
}
