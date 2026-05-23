export const PERMISSIONS = {
  RECEIPTS: "RECEIPTS",
  VIEW_REPORTS: "VIEW_REPORTS",
  APPROVE_REQUEST: "APPROVE_REQUEST",
  CREATE_REQUEST: "CREATE_REQUEST",
  EDIT_REQUEST: "EDIT_REQUEST",
  DELETE_REQUEST: "DELETE_REQUEST",
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",

  // EX Forms
  EX_REPLACE_BOOKING_TRANSFER: "EX_REPLACE_BOOKING_TRANSFER",
  EX_WAIVER_RESERVATION: "EX_WAIVER_RESERVATION",
  EX_CANCEL_BOOKING_UNIT: "EX_CANCEL_BOOKING_UNIT",
  EX_UNIT_TRANSFER: "EX_UNIT_TRANSFER",
  EX_EXCEPTIONS: "EX_EXCEPTIONS",
  EX_Create_Request: "EX_Create_Request",

  VIEW_ALL_REPORTS: "VIEW_ALL_REPORTS",
  /** تقارير مجمّعة لفورمات طلبات الحجز (EX) — صفحة /reports/ex */
  EX_REPORTS: "EX_REPORTS",
  VIEW_NEW_OLD_DATA: "VIEW_NEW_OLD_DATA",
  PRINT_REQUEST: "PRINT_REQUEST",
  VOUCHER_DELEGATE: "VOUCHER_DELEGATE",
  EX_ATTACHMENT_ONLY: "EX_ATTACHMENT_ONLY",

  /** أوبريشن EX: رفع مرفق عند إتمام خطوة «تم معاينة المرفق» */
  OPERATION: "OPERATION",

  // Voucher Permissions
  VOUCHERS_AL_GHADEER: "VOUCHERS_AL_GHADEER",
  VOUCHERS_BADUR_BAGHDAD: "VOUCHERS_BADUR_BAGHDAD",
  VOUCHERS_TIBA_AL_NAJAF: "VOUCHERS_TIBA_AL_NAJAF",
  VOUCHERS_GHADEER_KARBALA: "VOUCHERS_GHADEER_KARBALA",
  VOUCHERS_BADUR_AL_NAJAF: "VOUCHERS_BADUR_AL_NAJAF",
  VOUCHERS_GHADEER_INVESTMENTS: "VOUCHERS_GHADEER_INVESTMENTS",
  VOUCHERS_GHADEER_KARBALA_SUB: "VOUCHERS_GHADEER_KARBALA_SUB",
  VOUCHERS_GHADEER_NAJAF_SUB: "VOUCHERS_GHADEER_NAJAF_SUB",
  VOUCHERS_BADUR_BAGHDAD_SAFEBOX_ISTISHAR:
    "VOUCHERS_BADUR_BAGHDAD_SAFEBOX_ISTISHAR",
  TEST: "TEST",
  VOUCHERS_REPORTS_VIEW: "VOUCHERS_REPORTS_VIEW",
  EX: "EX",

  /** نظام الصكوك — دخول كامل (يُخزَّن في المجموعات كمفتاح CHEQUES) */
  CHEQUES: "CHEQUES",
  /** ترتيب حقول الصكوك على القالب */
  CHEQUES_EDITOR: "CHEQUES_EDITOR",
};

/** قيم قديمة في Mongo قبل توحيد المفاتيح */
const PERMISSION_LEGACY_ALIASES = {
  [PERMISSIONS.CHEQUES]: ["صكوك"],
  [PERMISSIONS.CHEQUES_EDITOR]: ["editor صكوك"],
};

export function hasPermission(permissions, permission) {
  if (!Array.isArray(permissions) || !permission) return false;
  if (permissions.includes(permission)) return true;
  const legacy = PERMISSION_LEGACY_ALIASES[permission];
  return Array.isArray(legacy) && legacy.some((p) => permissions.includes(p));
}

export function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  const legacyToCanonical = {
    صكوك: PERMISSIONS.CHEQUES,
    "editor صكوك": PERMISSIONS.CHEQUES_EDITOR,
  };
  return [
    ...new Set(
      permissions.map((p) => String(p || "").trim()).map((p) => legacyToCanonical[p] || p)
    ),
  ];
}

// 🔥 أسماء الصلاحيات التي تظهر في الواجهة
export const PERMISSION_LABELS = {
  [PERMISSIONS.RECEIPTS]: "الوصولات",
  [PERMISSIONS.VIEW_REPORTS]: "عرض التقارير",
  [PERMISSIONS.APPROVE_REQUEST]: "الموافقة على الطلبات",
  [PERMISSIONS.CREATE_REQUEST]: "إنشاء طلب",
  [PERMISSIONS.EDIT_REQUEST]: "تعديل طلب",
  [PERMISSIONS.DELETE_REQUEST]: "حذف طلب",
  [PERMISSIONS.MANAGE_USERS]: "إدارة المستخدمين",
  [PERMISSIONS.MANAGE_PERMISSIONS]: "إدارة الصلاحيات",
  [PERMISSIONS.VIEW_ALL_REPORTS]: "عرض جميع التقارير (مدير)",
  [PERMISSIONS.EX_REPORTS]: "تقارير طلبات الحجز (EX)",
  [PERMISSIONS.VOUCHER_DELEGATE]: "تخويل صرف الوصولات",
  [PERMISSIONS.VOUCHERS_REPORTS_VIEW]: "عرض تقارير الوصولات",
  [PERMISSIONS.EX]: "طلبات الحجز",
  [PERMISSIONS.OPERATION]: "أوبريشن (مرفق معاينة طلبات الحجز)",

  // Vouchers - الربط مع الأسماء العربية
  [PERMISSIONS.VOUCHERS_AL_GHADEER]: "وصولات الغدير",
  [PERMISSIONS.VOUCHERS_BADUR_BAGHDAD]: "وصولات بدور بغداد",
  [PERMISSIONS.VOUCHERS_TIBA_AL_NAJAF]: "وصولات طيبة النجف",
  [PERMISSIONS.VOUCHERS_GHADEER_KARBALA]: "وصولات غدير كربلاء",
  [PERMISSIONS.VOUCHERS_BADUR_AL_NAJAF]: "وصولات بدور النجف",
  [PERMISSIONS.VOUCHERS_GHADEER_INVESTMENTS]: "وصولات غدير للاستثمارات",
  [PERMISSIONS.VOUCHERS_GHADEER_KARBALA_SUB]: "وصولات غدير كربلاء - فرعي",
  [PERMISSIONS.VOUCHERS_GHADEER_NAJAF_SUB]: "وصولات الغدير الفرعي - النجف",
  [PERMISSIONS.VOUCHERS_BADUR_BAGHDAD_SAFEBOX_ISTISHAR]:
    "وصولات بدور بغداد - صندوق امانات مصرف الستشار",
  [PERMISSIONS.TEST]: "testوصولات",

  [PERMISSIONS.CHEQUES]: "صكوك",
  [PERMISSIONS.CHEQUES_EDITOR]: "editor صكوك",
};
