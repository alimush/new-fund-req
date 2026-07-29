/**
 * رفع مباشر إلى S3 من المتصفح بدون حد حجم عملي.
 * — ملفات ≤ 80MB: PUT واحد (رابط موقّع طويل الصلاحية)
 * — أكبر من ذلك: multipart (أجزاء 32MB) حتى غيغات
 */

const SIMPLE_PUT_MAX_BYTES = 80 * 1024 * 1024; // 80MB
const PART_SIZE = 32 * 1024 * 1024; // 32MB (حد أدنى لـ AWS 5MB ما عدا الجزء الأخير)
const MAX_PARALLEL_PARTS = 3;

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || `Upload API failed (${res.status})`);
  }
  return json;
}

function normalizeEtag(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.replaceAll('"', "");
}

async function uploadSimplePut(file, prefix) {
  const fileType = file.type || "application/octet-stream";
  const json = await postJson("/api/upload/presign", {
    fileName: file.name,
    fileType,
    prefix,
    fileSize: file.size || 0,
  });

  if (!json?.url || !json?.key) {
    throw new Error(json?.error || "Failed to get upload URL");
  }

  const uploadRes = await fetch(json.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": fileType },
  });

  if (!uploadRes.ok) {
    throw new Error(`Failed to upload file (${uploadRes.status})`);
  }

  return {
    key: json.key,
    url: json.getUrl || "",
    name: file.name || "",
    type: fileType,
    size: file.size || 0,
  };
}

async function uploadPart(file, start, end, signUrl) {
  const blob = file.slice(start, end);
  const res = await fetch(signUrl, {
    method: "PUT",
    body: blob,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload part (${res.status})`);
  }

  const etag = normalizeEtag(res.headers.get("ETag") || res.headers.get("etag"));
  if (!etag) {
    throw new Error(
      "تعذر قراءة ETag من S3. تأكد أن CORS للـ bucket يعرض ExposeHeaders: ETag"
    );
  }

  return etag;
}

async function uploadMultipart(file, prefix) {
  const fileType = file.type || "application/octet-stream";
  const size = Number(file.size) || 0;

  const init = await postJson("/api/upload/multipart", {
    action: "init",
    fileName: file.name,
    fileType,
    prefix,
    fileSize: size,
  });

  const { key, uploadId, getUrl } = init;
  if (!key || !uploadId) {
    throw new Error("Failed to init multipart upload");
  }

  const partCount = Math.max(1, Math.ceil(size / PART_SIZE));
  const parts = new Array(partCount);

  try {
    let nextPart = 1;

    async function worker() {
      while (nextPart <= partCount) {
        const partNumber = nextPart++;
        const start = (partNumber - 1) * PART_SIZE;
        const end = Math.min(start + PART_SIZE, size);

        const signed = await postJson("/api/upload/multipart", {
          action: "sign",
          key,
          uploadId,
          partNumber,
        });

        const etag = await uploadPart(file, start, end, signed.url);
        parts[partNumber - 1] = { ETag: etag, PartNumber: partNumber };
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_PARALLEL_PARTS, partCount) },
      () => worker()
    );
    await Promise.all(workers);

    const completed = await postJson("/api/upload/multipart", {
      action: "complete",
      key,
      uploadId,
      parts: parts.filter(Boolean),
    });

    return {
      key,
      url: completed.getUrl || getUrl || "",
      name: file.name || "",
      type: fileType,
      size,
    };
  } catch (err) {
    try {
      await postJson("/api/upload/multipart", {
        action: "abort",
        key,
        uploadId,
      });
    } catch {
      /* ignore abort errors */
    }
    throw err;
  }
}

/** يرفع ملفاً إلى S3 ويعيد { key, url, name, type, size } — بدون حد حجم */
export async function uploadFileToS3(file, { prefix } = {}) {
  if (!file) throw new Error("No file to upload");

  const size = Number(file.size) || 0;
  if (size === 0 || size <= SIMPLE_PUT_MAX_BYTES) {
    return uploadSimplePut(file, prefix);
  }

  try {
    return await uploadMultipart(file, prefix);
  } catch (err) {
    // إن فشل multipart (مثلاً CORS بدون ETag) وما زال الملف ضمن حد PUT الواحد (5GB)
    const FIVE_GB = 5 * 1024 * 1024 * 1024;
    if (size <= FIVE_GB) {
      console.warn(
        "multipart upload failed, falling back to single PUT:",
        err?.message || err
      );
      return uploadSimplePut(file, prefix);
    }
    throw err;
  }
}
