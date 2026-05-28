/** Case-insensitive company key comparison (URL vs permissions DB). */
export function normCompanyKey(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function companyInList(list, companyKey) {
  const target = normCompanyKey(companyKey);
  if (!target) return false;
  return (
    Array.isArray(list) &&
    list.some((c) => normCompanyKey(c) === target)
  );
}

/** First matching entry from list (preserves DB casing when needed). */
export function resolveCompanyFromList(list, companyKey) {
  const target = normCompanyKey(companyKey);
  if (!target || !Array.isArray(list)) return null;
  return list.find((c) => normCompanyKey(c) === target) ?? null;
}
