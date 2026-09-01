export function getIdentityAttachments(doc) {
  if (!doc) return [];

  const fromArray = Array.isArray(doc.attachments)
    ? doc.attachments.filter((item) => item?.url)
    : [];

  if (fromArray.length) return fromArray;

  if (doc.attachment?.url) return [doc.attachment];

  return [];
}

export function formatIdentityRecord(doc) {
  if (!doc) return null;

  const attachments = getIdentityAttachments(doc);
  return {
    personName: doc.personName || "",
    attachments,
    attachmentCount: attachments.length,
  };
}

export function hasIdentityAttachments(doc) {
  return getIdentityAttachments(doc).length > 0;
}
