import { PDFDocument } from "pdf-lib";

const A4_PORTRAIT = [595.28, 841.89];
const FETCH_TIMEOUT_MS = 300_000;
const MAX_IMAGE_DIM = 3200;
const IMAGE_COMPRESS_THRESHOLD = 4 * 1024 * 1024;

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

async function fetchAttachmentBytes(file) {
  const url = String(file?.url || "").trim();
  if (!url) throw new Error("Missing attachment url");

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

  try {
    const blob = new Blob([bytes], { type: contentType || "image/jpeg" });
    const bitmap = await createImageBitmap(blob);
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const shouldCompress =
      bytes.byteLength > IMAGE_COMPRESS_THRESHOLD || maxSide > MAX_IMAGE_DIM;

    if (!shouldCompress) {
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

    const quality = bytes.byteLength > 15 * 1024 * 1024 ? 0.82 : 0.88;
    const outBlob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
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

/** يدمج كل المرفقات المدعومة بغض النظر عن الحجم */
export async function appendAttachmentsToPdf(pdf, attachments = []) {
  const failed = [];

  for (const file of attachments) {
    const label = file?.name || "اتاج";

    try {
      const { bytes, contentType } = await fetchAttachmentBytes(file);
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
      console.error("Failed to append attachment:", label, err);
      failed.push({ name: label, reason: String(err?.message || "فشل التحميل") });
    }
  }

  return { failed };
}
