export function sanitizeAttachment(att) {
  if (!att?.url) return null;

  const contentType =
    att.contentType || (att.url.endsWith(".pdf") ? "application/pdf" : "image/png");
  const key = String(att.key || "").trim();

  const out = {
    name: att.name || "Attachment",
    url: att.url,
    contentType,
    size: Number(att.size || 0),
    uploadedAt: att.uploadedAt ? new Date(att.uploadedAt) : new Date(),
  };

  if (key) out.key = key;
  return out;
}
