/** استخراج مفتاح S3 من رابط عام أو موقّع */
export function extractS3KeyFromUrl(input = "") {
  const raw = String(input || "").trim();
  if (!raw) return "";

  try {
    const u = new URL(raw);
    const host = u.hostname || "";

    if (host.includes(".amazonaws.com")) {
      return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    }

    const keyParam = u.searchParams.get("key");
    if (keyParam) return decodeURIComponent(keyParam);
  } catch {
    /* ignore */
  }

  return "";
}

export function resolveAttachmentKey(file) {
  const key = String(file?.key || "").trim();
  if (key) return key;
  return extractS3KeyFromUrl(file?.url);
}

/**
 * رابط دائم داخل التطبيق (يتطلب تسجيل دخول).
 * كل طلب يولّد توقيع S3 جديد — الملف يبقى، والفتح ما ينتهي.
 */
export function attachmentOpenHref(file) {
  const key = resolveAttachmentKey(file);
  if (key) return `/api/download?key=${encodeURIComponent(key)}`;
  const url = String(file?.url || "").trim();
  if (url) return `/api/download?url=${encodeURIComponent(url)}`;
  return "#";
}

export async function getSignedAttachmentUrl(file) {
  const key = resolveAttachmentKey(file);

  if (key) {
    const res = await fetch("/api/files/download-url", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.url) {
      throw new Error(json?.error || `تعذر توقيع رابط الملف (${res.status})`);
    }
    return json.url;
  }

  const href = attachmentOpenHref(file);
  if (!href || href === "#") throw new Error("لا يوجد مفتاح أو رابط للملف");
  return href;
}

export function openSignedAttachment(file) {
  const href = attachmentOpenHref(file);
  if (!href || href === "#") throw new Error("لا يوجد ملف للفتح");
  window.open(href, "_blank", "noopener,noreferrer");
}

export async function downloadSignedAttachment(file) {
  const signedUrl = await getSignedAttachmentUrl(file);
  const res = await fetch(signedUrl, {
    cache: "no-store",
    credentials: signedUrl.startsWith("/") ? "include" : "omit",
  });
  if (!res.ok) throw new Error(`تعذر تحميل الملف (${res.status})`);

  const blob = await res.blob();
  const name =
    String(file?.name || "").trim() ||
    resolveAttachmentKey(file).split("/").pop() ||
    "file";

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
}
