import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

/** طلبات → وصل رئيسي / فرعي (حسب صلاحية اليوزر) */
const REQUEST_VOUCHER_VARIANTS = {
  "ghadeer-karbala": {
    main: {
      companyKey: "Ghadeer-Karbala",
      permission: PERMISSIONS.VOUCHERS_GHADEER_KARBALA,
    },
    sub: {
      companyKey: "Ghadeer-Karbala-Sub",
      permission: PERMISSIONS.VOUCHERS_GHADEER_KARBALA_SUB,
    },
  },
  "al-ghadeer": {
    main: {
      companyKey: "Al-Ghadeer",
      permission: PERMISSIONS.VOUCHERS_AL_GHADEER,
    },
    sub: {
      companyKey: "Ghadeer-Najaf-Sub",
      permission: PERMISSIONS.VOUCHERS_GHADEER_NAJAF_SUB,
    },
  },
};

function normCompanyKey(key) {
  return String(key || "").trim().toLowerCase();
}

function findCompanyByKey(key) {
  const n = normCompanyKey(key);
  return COMPANIES.find((c) => normCompanyKey(c.key) === n) || null;
}

function resolveFromRequestVariants(requestCompanyKey, permissions = []) {
  const variant = REQUEST_VOUCHER_VARIANTS[normCompanyKey(requestCompanyKey)];
  if (!variant) return null;

  const perms = new Set((permissions || []).map(String));
  const hasMain = perms.has(variant.main.permission);
  const hasSub = perms.has(variant.sub.permission);

  if (hasSub && !hasMain) return variant.sub.companyKey;
  if (hasMain) return variant.main.companyKey;
  if (hasSub) return variant.sub.companyKey;
  return variant.main.companyKey;
}

/**
 * قالب الوصل حسب شركة الطلب + صلاحيات اليوزر (رئيسي / فرعي).
 */
export function resolveVoucherCompanyKeyForUser(requestCompanyKey, permissions = []) {
  const fromVariant = resolveFromRequestVariants(requestCompanyKey, permissions);
  if (fromVariant) return fromVariant;

  const perms = new Set((permissions || []).map(String));

  const cfg = findCompanyByKey(requestCompanyKey);
  if (cfg?.permission && perms.has(cfg.permission)) {
    return cfg.key;
  }

  for (const c of COMPANIES) {
    if (c.permission && perms.has(c.permission)) {
      return c.key;
    }
  }

  return cfg?.key || String(requestCompanyKey || "").trim();
}

/** هل يقدر يصدر وصل لطلب هذه الشركة (حسب صلاحيات الوصولات) */
export function hasVoucherPermissionForRequest(requestCompanyKey, permissions = []) {
  const perms = new Set((permissions || []).map(String));
  if (perms.has(PERMISSIONS.VIEW_ALL_REPORTS)) return true;

  const variant = REQUEST_VOUCHER_VARIANTS[normCompanyKey(requestCompanyKey)];
  if (variant) {
    return (
      perms.has(variant.main.permission) || perms.has(variant.sub.permission)
    );
  }

  const cfg = findCompanyByKey(requestCompanyKey);
  return Boolean(cfg?.permission && perms.has(cfg.permission));
}

/** مفاتيح وصولات مسموحة للبحث — فقط اللي اليوزر عنده صلاحيتها */
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

  const perms = new Set((permissions || []).map(String));
  const reqNorm = normCompanyKey(requestCompanyKey);

  add(resolveVoucherCompanyKeyForUser(requestCompanyKey, permissions));

  const variant = REQUEST_VOUCHER_VARIANTS[reqNorm];
  if (variant) {
    if (perms.has(variant.main.permission)) add(variant.main.companyKey);
    if (perms.has(variant.sub.permission)) add(variant.sub.companyKey);
  } else {
    const cfg = findCompanyByKey(requestCompanyKey);
    if (cfg?.permission && perms.has(cfg.permission)) add(cfg.key);
  }

  if (hintCompanyKey) {
    const hintCfg = findCompanyByKey(hintCompanyKey);
    if (!hintCfg?.permission || perms.has(hintCfg.permission)) {
      add(hintCompanyKey);
    }
  }

  for (const c of COMPANIES) {
    if (c.permission && perms.has(c.permission)) add(c.key);
  }

  return [...set];
}

/** شركات الوصل اللي يشوفها اليوزر في /vouchers */
export function getVoucherCompaniesForUser(permissions = []) {
  const perms = new Set((permissions || []).map(String));
  return COMPANIES.filter((c) => c.permission && perms.has(c.permission));
}

/** إدارة الربط: كل قوالب الوصل المحتملة لشركة الطلب (رئيسي + فرعي) */
export function voucherLookupCompanyKeysForAdmin(requestCompanyKey) {
  const set = new Set();
  const add = (k) => {
    const t = String(k || "").trim();
    if (t) set.add(t);
  };

  const variant = REQUEST_VOUCHER_VARIANTS[normCompanyKey(requestCompanyKey)];
  if (variant) {
    add(variant.main.companyKey);
    add(variant.sub.companyKey);
  }

  const cfg = findCompanyByKey(requestCompanyKey);
  if (cfg) add(cfg.key);

  return [...set];
}
