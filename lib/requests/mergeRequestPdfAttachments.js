import { PDFDocument } from "pdf-lib";

const A4_PORTRAIT = [595.28, 841.89];
/** فوق هذا الحجم لا يُدمج الاتاج — يُحمَّل PDF الطلب فقط */
export const MAX_ATTACHMENT_MERGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIM = 2800;

/** جمع مرفقات الطلب + اتاج خطوات الورك فلو بدون تكرار */
export function collectRequestPdfAttachments(request) {
  const seen = new Set();
  const out = [];

  const push = (file) => {
    if (!file) return;
    const url = String(file.url || "").trim();
    const key = String(file.key || "").trim();
    if (!url && !key) return;
    const id = key || url;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      url,
      key,
      name: file.name || "",
      type: file.type || "",
      size: Number(file.size) || 0,
    });
  };

  for (const file of request?.attachments || []) push(file);

  for (const step of request?.workflow?.steps || []) {
    for (const file of step?.tagAttachments || []) push(file);
    if (step?.tag) push(step.tag);
    if (step?.attachment) push(step.attachment);
  }

  return out;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isTooLargeForMerge(file, bytes = null) {
  const metaSize = Number(file?.size) || 0;
  if (metaSize > MAX_ATTACHMENT_MERGE_BYTES) return true;
  if (bytes && bytes.byteLength > MAX_ATTACHMENT_MERGE_BYTES) return true;
  return false;
}

async function fetchAttachmentBytes(file) {
  const url = String(file?.url || "").trim();
  if (!url) throw new Error("Missing attachment url");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`/api/download?url=${encodeURIComponent(url)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return {
      bytes: await res.arrayBuffer(),
      contentType: (file?.type || res.headers.get("content-type") || "").toLowerCase(),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function detectKind(contentType, name) {
  const lowerName = String(name || "").toLowerCase();
  if (contentType.includes("pdf") || lowerName.endsWith(".pdf")) return "pdf";
  if (
    contentType.includes("jpeg") ||
    contentType.includes("jpg") ||
    /\.(jpe?g)$/i.test(lowerName)
  ) {
    return "jpg";
  }
  if (contentType.includes("png") || /\.png$/i.test(lowerName)) return "png";
  if (contentType.startsWith("image/")) return "jpg";
  return "unknown";
}

async function normalizeImageBytes(bytes, contentType) {
  if (typeof window === "undefined") return bytes;
  if (bytes.byteLength <= 4 * 1024 * 1024) return bytes;

  try {
    const blob = new Blob([bytes], { type: contentType || "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const maxSide = Math.max(bitmap.width, bitmap.height);
    if (maxSide <= MAX_IMAGE_DIM && bytes.byteLength <= MAX_ATTACHMENT_MERGE_BYTES) {
      bitmap.close?.();
      return bytes;
    }

    const scale = Math.min(MAX_IMAGE_DIM / bitmap.width, MAX_IMAGE_DIM / bitmap.height, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return bytes;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const outBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88)
    );
    if (!outBlob) return bytes;
    return outBlob.arrayBuffer();
  } catch {
    return bytes;
  }
}

async function drawImageOnA4Pages(pdf, bytes, kind) {
  const normalized = await normalizeImageBytes(
    bytes,
    kind === "png" ? "image/png" : "image/jpeg"
  );
  const img =
    kind === "png"
      ? await pdf.embedPng(normalized)
      : await pdf.embedJpg(normalized);

  const [pageW, pageH] = A4_PORTRAIT;
  const scale = Math.min(pageW / img.width, pageH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;

  const page = pdf.addPage(A4_PORTRAIT);
  page.drawImage(img, {
    x: (pageW - w) / 2,
    y: (pageH - h) / 2,
    width: w,
    height: h,
  });
}

function pushSkippedLarge(list, file, bytes = null) {
  const size = bytes?.byteLength || Number(file?.size) || 0;
  list.push({
    name: file?.name || "اتاج",
    url: file?.url || "",
    size,
    sizeLabel: formatBytes(size),
  });
}

/**
 * يدمج المرفقات الصغيرة فقط.
 * الكبيرة تُتخطى — يُرجع skippedLarge لعرض رسالة للمستخدم.
 */
export async function appendAttachmentsToPdf(pdf, attachments = []) {
  const skippedLarge = [];
  const failed = [];

  for (const file of attachments) {
    const label = file?.name || "اتاج";

    if (isTooLargeForMerge(file)) {
      pushSkippedLarge(skippedLarge, file);
      continue;
    }

    try {
      const { bytes, contentType } = await fetchAttachmentBytes(file);

      if (isTooLargeForMerge(file, bytes)) {
        pushSkippedLarge(skippedLarge, file, bytes);
        continue;
      }

      const kind = detectKind(contentType, file?.name);

      if (kind === "pdf") {
        const attachmentPdf = await PDFDocument.load(bytes, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
        const copiedPages = await pdf.copyPages(
          attachmentPdf,
          attachmentPdf.getPageIndices()
        );
        copiedPages.forEach((p) => pdf.addPage(p));
        continue;
      }

      if (kind === "jpg" || kind === "png") {
        await drawImageOnA4Pages(pdf, bytes, kind);
        continue;
      }

      failed.push({ name: label, reason: `نوع غير مدعوم: ${contentType || "unknown"}` });
    } catch (err) {
      const reason = String(err?.message || "");
      const sizeRelated =
        reason.includes("abort") ||
        reason.includes("memory") ||
        reason.includes("Allocation") ||
        reason.includes("too large");

      if (sizeRelated) {
        pushSkippedLarge(skippedLarge, file);
      } else {
        console.error("Failed to append attachment:", label, err);
        failed.push({ name: label, reason });
      }
    }
  }

  return { skippedLarge, failed };
}

export function buildSkippedAttachmentsMessage(skippedLarge = []) {
  if (!skippedLarge.length) return "";

  const lines = skippedLarge.map(
    (f) => `• ${f.name}${f.sizeLabel ? ` (${f.sizeLabel})` : ""}`
  );

  return [
    "تم تحميل PDF الطلب بنجاح.",
    "",
    "لم يتم دمج الاتاج التالي بسبب حجمِه الكبير:",
    ...lines,
    "",
    "يمكنك تحميل الاتاج على حدة من خطوات الورك فلو (زر عرض/فتح المرفق).",
  ].join("\n");
}
