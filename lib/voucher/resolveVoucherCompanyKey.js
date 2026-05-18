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

/** مفاتيح شركات الوصل المحتملة عند البحث عن وصل طلب (رئيسي/فرعي كربلاء وغيرها) */
export function voucherLookupCompanyKeys(
  requestCompanyKey,
  permissions = [],
  hintCompanyKey = ""
) {
  const set = new Set();
  const add = (k) => {
    const t = String(k || "").trim();
    if (t) set.add(t);
  };

  add(hintCompanyKey);
  add(resolveVoucherCompanyKeyForUser(requestCompanyKey, permissions));

  const reqNorm = normCompanyKey(requestCompanyKey);
  if (reqNorm === KARBALA_REQUEST) {
    add("Ghadeer-Karbala");
    add("Ghadeer-Karbala-Sub");
  }

  const cfg = findCompanyByKey(requestCompanyKey);
  if (cfg) add(cfg.key);

  const perms = new Set((permissions || []).map(String));
  for (const c of COMPANIES) {
    if (c.permission && perms.has(c.permission)) add(c.key);
  }

  return [...set];
}
