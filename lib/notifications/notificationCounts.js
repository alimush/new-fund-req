/** تطبيع استجابة /api/notifications/counts للواجهة */
export function getApprovalCount(counts, companyKey) {
  const raw = counts?.[companyKey];
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  return Number(raw?.approval ?? raw?.pendingApproval ?? 0) || 0;
}

export function getDisbursementCount(counts, companyKey) {
  const raw = counts?.[companyKey];
  if (raw == null) return 0;
  if (typeof raw === "number") return 0;
  return Number(raw?.disbursement ?? raw?.pendingDisbursement ?? 0) || 0;
}

export function sumApprovalCounts(counts, companyKeys = []) {
  return companyKeys.reduce((sum, k) => sum + getApprovalCount(counts, k), 0);
}

export function sumDisbursementCounts(counts, companyKeys = []) {
  return companyKeys.reduce((sum, k) => sum + getDisbursementCount(counts, k), 0);
}

export function sumLegacyCounts(counts, companyKeys = []) {
  return companyKeys.reduce((sum, k) => {
    const raw = counts?.[k];
    if (typeof raw === "number") return sum + raw;
    return sum + getApprovalCount(counts, k) + getDisbursementCount(counts, k);
  }, 0);
}
