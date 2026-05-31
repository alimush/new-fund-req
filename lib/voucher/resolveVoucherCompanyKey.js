import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

/**
 * طلبات لها وصل رئيسي + فرعي (أو أكثر من فرعي).
 * المنطق:
 * - صلاحية رئيسي فقط → وصل رئيسي
 * - صلاحية فرعي فقط → وصل فرعي (أول صلاحية فرعية مطابقة)
 * - رئيسي + فرعي → وصل رئيسي
 */
const REQUEST_VOUCHER_VARIANTS = {
  "ghadeer-karbala": {
    main: {
      companyKey: "Ghadeer-Karbala",
      permission: PERMISSIONS.VOUCHERS_GHADEER_KARBALA,
    },
    subs: [
      {
        companyKey: "Ghadeer-Karbala-Sub",
        permission: PERMISSIONS.VOUCHERS_GHADEER_KARBALA_SUB,
      },
      {
        companyKey: "Ghadeer-Investments",
        permission: PERMISSIONS.VOUCHERS_GHADEER_INVESTMENTS,
      },
    ],
  },
  "al-ghadeer": {
    main: {
      companyKey: "Al-Ghadeer",
      permission: PERMISSIONS.VOUCHERS_AL_GHADEER,
    },
    subs: [
      {
        companyKey: "Ghadeer-Najaf-Sub",
        permission: PERMISSIONS.VOUCHERS_GHADEER_NAJAF_SUB,
      },
    ],
  },
};

function normCompanyKey(key) {
  return String(key || "").trim().toLowerCase();
}

function findCompanyByKey(key) {
  const n = normCompanyKey(key);
  return COMPANIES.find((c) => normCompanyKey(c.key) === n) || null;
}

function getVariantSubs(variant) {
  if (!variant) return [];
  if (Array.isArray(variant.subs)) return variant.subs;
  if (variant.sub) return [variant.sub];
  return [];
}

function resolveFromRequestVariants(requestCompanyKey, permissions = []) {
  const variant = REQUEST_VOUCHER_VARIANTS[normCompanyKey(requestCompanyKey)];
  if (!variant) return null;

  const perms = new Set((permissions || []).map(String));
  const hasMain = perms.has(variant.main.permission);

  if (hasMain) return variant.main.companyKey;

  const subs = getVariantSubs(variant);
  for (const sub of subs) {
    if (sub?.permission && perms.has(sub.permission)) {
      return sub.companyKey;
    }
  }

  return null;
}

/**
 * قالب الوصل حسب شركة الطلب + صلاحيات اليوزر (رئيسي / فرعي).
 * لا يُستخدم وصل شركة أخرى (مثلاً فرعي الغدير لطلب طيبة النجف).
 */
export function resolveVoucherCompanyKeyForUser(requestCompanyKey, permissions = []) {
  const fromVariant = resolveFromRequestVariants(requestCompanyKey, permissions);
  if (fromVariant) return fromVariant;

  const cfg = findCompanyByKey(requestCompanyKey);
  if (cfg?.key) return cfg.key;

  return String(requestCompanyKey || "").trim();
}

/** هل يقدر يصدر وصل لطلب هذه الشركة (حسب صلاحيات الوصولات) */
export function hasVoucherPermissionForRequest(requestCompanyKey, permissions = []) {
  const perms = new Set((permissions || []).map(String));
  if (perms.has(PERMISSIONS.VIEW_ALL_REPORTS)) return true;

  const variant = REQUEST_VOUCHER_VARIANTS[normCompanyKey(requestCompanyKey)];
  if (variant) {
    if (perms.has(variant.main.permission)) return true;
    return getVariantSubs(variant).some(
      (sub) => sub?.permission && perms.has(sub.permission)
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
    for (const sub of getVariantSubs(variant)) {
      if (sub?.permission && perms.has(sub.permission)) add(sub.companyKey);
    }
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
    for (const sub of getVariantSubs(variant)) {
      add(sub.companyKey);
    }
  }

  const cfg = findCompanyByKey(requestCompanyKey);
  if (cfg) add(cfg.key);

  return [...set];
}
