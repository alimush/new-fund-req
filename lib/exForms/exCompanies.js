import { PERMISSIONS } from "@/lib/permission";

/** شركات طلبات الحجز (EX) — كل شركة لها قائمة فورمات مستقلة */
export const DEFAULT_EX_BOOKING_COMPANY = "Badur-Baghdad";

export const EX_BOOKING_COMPANIES = [
  {
    key: "Badur-Baghdad",
    name: "بدور بغداد",
    logo: "/بدور_بغداد.png",
    formKeys: [
      "replace-booking-transfer",
      "waiver-reservation",
      "cancel-booking-unit",
      "unit-transfer",
      "exceptions",
      "attachment-only",
    ],
  },
  // أضف شركات لاحقاً بنفس الشكل، مع formKeys الخاصة بها فقط
];

/** كتالوج الفورمات (بدون أيقونات — للاستخدام من السيرفر والعميل) */
export const EX_BOOKING_FORMS_CATALOG = [
  {
    key: "replace-booking-transfer",
    name: "استبدال حجز وتحويل مبالغ",
    desc: "إجراء تحويل/استبدال حجز لوحدة سكنية حسب الضوابط.",
    permission: PERMISSIONS.EX_REPLACE_BOOKING_TRANSFER,
    listPath: "replace-booking-transfer",
  },
  {
    key: "waiver-reservation",
    name: "التنازل عن حجز وحدة سكنية ومبالغ مالية للأقارب فقط",
    desc: "طلب تنازل أو نقل الحجز لشخص آخر مع المتطلبات.",
    permission: PERMISSIONS.EX_WAIVER_RESERVATION,
    listPath: "waiver-reservation",
  },
  {
    key: "cancel-booking-unit",
    name: "طلب الغاء حجز وحدة مجمع بدور",
    desc: "تقديم طلب إلغاء الحجز ومتابعة موافقات الإجراء.",
    permission: PERMISSIONS.EX_CANCEL_BOOKING_UNIT,
    listPath: "cancel-booking-unit",
  },
  {
    key: "unit-transfer",
    name: "تحويل وحدة",
    desc: "تحويل وحدة سكنية بين المستفيدين حسب الضوابط المعتمدة.",
    permission: PERMISSIONS.EX_UNIT_TRANSFER,
    listPath: "unit-transfer",
  },
  {
    key: "exceptions",
    name: "الاستثناءات",
    desc: "نماذج وخطط الدفع الخاصة بالاستثناءات والمتابعة.",
    permission: PERMISSIONS.EX_EXCEPTIONS,
    listPath: "payment-plan",
    isPaymentPlan: true,
  },
  {
    key: "attachment-only",
    name: "معامله الزبون",
    desc: "رفع مرفق وإرساله للموافقة حسب الورك فلو.",
    permission: PERMISSIONS.EX_ATTACHMENT_ONLY,
    listPath: "attachment-only",
  },
];

export function getExBookingCompanyDef(companyKey) {
  const k = String(companyKey || "").trim();
  return EX_BOOKING_COMPANIES.find((c) => c.key === k) || null;
}

export function isPageKeyAllowedForExCompany(companyKey, pageKey) {
  const def = getExBookingCompanyDef(companyKey);
  if (!def || !Array.isArray(def.formKeys)) return false;
  return def.formKeys.includes(String(pageKey || "").trim());
}

export function getBookingFormsMetaForCompany(companyKey) {
  const def = getExBookingCompanyDef(companyKey);
  if (!def?.formKeys?.length) return [];
  const allowed = new Set(def.formKeys);
  return EX_BOOKING_FORMS_CATALOG.filter((f) => allowed.has(f.key));
}

/**
 * الشركات الظاهرة للمستخدم ضمن EX حسب مجموعات الصلاحيات (companies).
 * - إذا كانت الشركات تشمل مفتاح شركة من EX_BOOKING_COMPANIES → يظهر ذلك السطر فقط.
 * - Legacy: إذا فقط "EX" أو يوجد "EX" بدون أي مفتاح حجز مطابق → افتراض بدور بغداد.
 */
export function resolveExBookingCompaniesForUser(userCompanies = []) {
  const normalized = userCompanies.map((c) => String(c || "").trim()).filter(Boolean);
  const configured = EX_BOOKING_COMPANIES.filter(
    (c) => Array.isArray(c.formKeys) && c.formKeys.length > 0
  );

  const matched = configured.filter((c) => normalized.includes(c.key));
  if (matched.length > 0) return matched;

  const onlyEX = normalized.length === 1 && normalized[0] === "EX";
  if (onlyEX || normalized.includes("EX")) {
    const def = configured.find((c) => c.key === DEFAULT_EX_BOOKING_COMPANY);
    return def ? [def] : [];
  }

  return [];
}

/** فلتر Mongo للطلبات حسب شركة الحجز — الطلبات القديمة بدون حقل تُحسب ضمن بدور بغداد */
export function exCompanyMongoFilter(companyKey) {
  const key = String(companyKey || "").trim();
  if (!key) return {};

  if (key === DEFAULT_EX_BOOKING_COMPANY) {
    return {
      $or: [
        { exCompanyKey: key },
        { exCompanyKey: { $exists: false } },
        { exCompanyKey: null },
        { exCompanyKey: "" },
      ],
    };
  }

  return { exCompanyKey: key };
}

export function documentMatchesExCompany(doc, companyKey) {
  const key = String(companyKey || "").trim();
  const raw = doc?.exCompanyKey;
  const docKey = raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";

  if (key === DEFAULT_EX_BOOKING_COMPANY) {
    return !docKey || docKey === DEFAULT_EX_BOOKING_COMPANY;
  }
  return docKey === key;
}
