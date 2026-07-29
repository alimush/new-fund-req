export function getS3Env() {
  const bucket = process.env.S3_BUCKET_NAME;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  return { bucket, region, accessKeyId, secretAccessKey };
}

export function assertS3Env() {
  const env = getS3Env();
  if (!env.bucket || !env.region) {
    const err = new Error("Missing S3 env");
    err.status = 500;
    err.details = { bucket: env.bucket, region: env.region };
    throw err;
  }
  if (!env.accessKeyId || !env.secretAccessKey) {
    const err = new Error("Missing S3 credentials");
    err.status = 500;
    throw err;
  }
  return env;
}

export function buildUploadKey(fileName, prefix = "uploads") {
  const safeName = String(fileName || "file").replace(/[^\w.\-() ]+/g, "_");
  const folder = String(prefix || "uploads").replace(/^\/+|\/+$/g, "") || "uploads";
  return `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
}

export function buildPublicS3Url(bucket, region, key) {
  if (!bucket || !region || !key) return "";
  const encoded = String(key)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encoded}`;
}
