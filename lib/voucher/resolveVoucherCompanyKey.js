import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

const KARBALA_REQUEST = "ghadeer-karbala";

function normCompanyKey(key) {
  return String(key || "").trim().toLowerCase();
}

function findCompanyByKey(key) {
  const n = normCompanyKey(key);
  return COMPANIES.find((c) => normCompanyKey(c.key) === n) || null;
}

/**
 * طلبات غدير كربلاء (Ghadeer-Karbala): قالب الوصل حسب صلاحية الوصولات فقط.
 * - VOUCHERS_GHADEER_KARBALA → وصل رئيسي
 * - VOUCHERS_GHADEER_KARBALA_SUB (بدون الرئيسي) → وصل فرعي
 */
export function resolveVoucherCompanyKeyForUser(requestCompanyKey, permissions = []) {
  const reqNorm = normCompanyKey(requestCompanyKey);
  const perms = new Set((permissions || []).map(String));

  if (reqNorm === KARBALA_REQUEST) {
    const hasMain = perms.has(PERMISSIONS.VOUCHERS_GHADEER_KARBALA);
    const hasSub = perms.has(PERMISSIONS.VOUCHERS_GHADEER_KARBALA_SUB);
    if (hasMain) return "Ghadeer-Karbala";
    if (hasSub) return "Ghadeer-Karbala-Sub";
    return "Ghadeer-Karbala";
  }

  const cfg = findCompanyByKey(requestCompanyKey);
  return cfg?.key || String(requestCompanyKey || "").trim();
}

/** هل يقدر يصدر وصل لطلب هذه الشركة (حسب صلاحيات الوصولات) */
export function hasVoucherPermissionForRequest(requestCompanyKey, permissions = []) {
  const perms = new Set((permissions || []).map(String));
  if (perms.has(PERMISSIONS.VIEW_ALL_REPORTS)) return true;

  const reqNorm = normCompanyKey(requestCompanyKey);
  if (reqNorm === KARBALA_REQUEST) {
    return (
      perms.has(PERMISSIONS.VOUCHERS_GHADEER_KARBALA_SUB) ||
      perms.has(PERMISSIONS.VOUCHERS_GHADEER_KARBALA)
    );
  }

  const cfg = findCompanyByKey(requestCompanyKey);
  return Boolean(cfg?.permission && perms.has(cfg.permission));
}
