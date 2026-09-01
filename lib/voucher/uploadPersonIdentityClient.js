import { normalizePersonName } from "@/lib/voucher/normalizePersonName";

async function uploadOnePersonIdentityFile({ personName, file }) {
  const normalizedName = normalizePersonName(personName);
  const safeKey = normalizedName.replace(/[^\w\u0600-\u06FF.-]+/g, "_").slice(0, 80);

  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      prefix: `vouchers/person-identities/${safeKey}`,
    }),
  });

  const presignJson = await presignRes.json();
  if (!presignJson?.success) {
    throw new Error(presignJson?.error || "Failed to create presigned URL");
  }

  const uploadRes = await fetch(presignJson.url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed for ${file.name}`);
  }

  return {
    key: presignJson.key,
    name: file.name,
    url: presignJson.getUrl || "",
    contentType: file.type || "application/octet-stream",
    size: file.size || 0,
    uploadedAt: new Date().toISOString(),
  };
}

async function savePersonIdentityAttachment(personName, attachment) {
  const saveRes = await fetch("/api/vouchers/person-identity", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personName,
      attachment,
    }),
  });

  const saveJson = await saveRes.json();
  if (!saveJson?.success) {
    throw new Error(saveJson?.error || "Failed to save identity");
  }

  return saveJson.data;
}

export async function uploadPersonIdentity({ personName, file }) {
  const normalizedName = normalizePersonName(personName);
  if (!normalizedName || normalizedName.length < 2) {
    throw new Error("أدخل حقل «استلمت من» أولاً (حرفين على الأقل)");
  }
  if (!file) {
    throw new Error("لم يُحدَّد ملف");
  }

  const payload = await uploadOnePersonIdentityFile({ personName: normalizedName, file });
  const saved = await savePersonIdentityAttachment(normalizedName, payload);
  return saved;
}

export async function uploadPersonIdentityFiles({ personName, files }) {
  const normalizedName = normalizePersonName(personName);
  if (!normalizedName || normalizedName.length < 2) {
    throw new Error("أدخل حقل «استلمت من» أولاً (حرفين على الأقل)");
  }

  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) {
    throw new Error("لم يُحدَّد أي ملف");
  }

  let lastSaved = null;
  for (const file of list) {
    const payload = await uploadOnePersonIdentityFile({
      personName: normalizedName,
      file,
    });
    lastSaved = await savePersonIdentityAttachment(normalizedName, payload);
  }

  return lastSaved;
}
