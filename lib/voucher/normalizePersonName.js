export function normalizePersonName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function personNameKey(value) {
  const normalized = normalizePersonName(value);
  return normalized ? normalized.toLowerCase() : "";
}
