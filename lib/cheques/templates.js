/**
 * قوالب الصكوك — لكل صك مواضع X/Y وخط مستقلة (لا تُشارك بين القوالب).
 * التخطيط المحفوظ في DB مربوط بـ templateKey (وثيقة ChequeLayout لكل صك).
 */

export const CHEQUE_TEMPLATE_KEYS = [
  "real_estate_baghdad",
  "mustashar_ghadeer",
];

export const CHEQUE_TEMPLATES = [
  {
    key: "real_estate_baghdad",
    name: "صكوك المصرف العقاري - بغداد",
    subtitle: "REAL ESTATE BANK OF IRAQ",
    image: "/assets/cheques/real_estate_baghdad.png",
    /** مرجع حجم الخط (بكسل صورة القالب) — الإحداثيات % تُحسب من printWidthMm/printHeightMm */
    aspectRatio: "1024 / 470",
    bankName: "المصرف العقاري العراقي",
    bankNameEn: "REAL ESTATE BANK OF IRAQ",
    drawerName: "شركة الغدير للاستثمارات العقارية",
    branch: "الفرع الرئيسي / 821",
    currency: "IQD",
    dateShowSlashesDefault: true,
    /** عرض ورقة الصك الفارغ في الطابعة (مم) */
    printWidthMm: 175,
    fields: [
      {
        key: "chequeNumber",
        label: "رقم الصك",
        type: "text",
        sidebarOnly: true,
        placeholder: "اختياري — للحفظ فقط",
      },
      {
        key: "accountNumber",
        label: "رقم الحساب",
        type: "text",
        sidebarOnly: true,
        placeholder: "اختياري — للحفظ فقط",
      },
      { key: "dateDay", label: "يوم", type: "datePart", top: 10.5, left: 3, width: 5, height: 5.5, maxLength: 2 },
      { key: "dateMonth", label: "شهر", type: "datePart", top: 10.5, left: 10, width: 5, height: 5.5, maxLength: 2 },
      { key: "dateYear", label: "سنة", type: "datePart", top: 10.5, left: 17, width: 9, height: 5.5, maxLength: 4 },
      { key: "payee", label: "إدفعوا لأمر", type: "text", top: 27.5, left: 4, width: 92, height: 6 },
      { key: "amountNumeric", label: "المبلغ (رقم)", type: "amount", top: 35.5, left: 2.5, width: 17, height: 11 },
      { key: "amountWords", label: "المبلغ كتابة", type: "textarea", top: 47, left: 4, width: 92, height: 10 },
      { key: "text", label: "text", type: "textarea", top: 58, left: 4, width: 90, height: 12, multiline: true },
    ],
  },
  {
    key: "mustashar_ghadeer",
    name: "صكوك مصرف المستشار - شركة الغدير",
    subtitle: "ALMUSTASHAR ISLAMIC BANK",
    image: "/assets/cheques/mustashar_ghadeer.png",
    /** مرجع حجم الخط (بكسل صورة القالب) — الإحداثيات % تُحسب من printWidthMm/printHeightMm */
    aspectRatio: "1024 / 474",
    bankName: "مصرف المستشار الإسلامي",
    bankNameEn: "ALMUSTASHAR ISLAMIC",
    drawerName: "شركة الغدير للاستثمارات العقارية والوكالات التجارية",
    branch: "الرئيسي",
    currency: "IQD",
    dateShowSlashesDefault: true,
    /** أبعاد الصك: عرض 18.7 سم × طول 9.2 سم */
    printWidthMm: 187,
    printHeightMm: 92,
    fields: [
      {
        key: "chequeNumber",
        label: "رقم الصك",
        type: "text",
        sidebarOnly: true,
        placeholder: "اختياري — للحفظ فقط",
      },
      {
        key: "accountNumber",
        label: "رقم الحساب",
        type: "text",
        sidebarOnly: true,
        placeholder: "اختياري — للحفظ فقط",
      },
      { key: "dateDay", label: "يوم", type: "datePart", top: 9.5, left: 4, width: 4.5, height: 5.5, maxLength: 2 },
      { key: "dateMonth", label: "شهر", type: "datePart", top: 9.5, left: 10.5, width: 4.5, height: 5.5, maxLength: 2 },
      { key: "dateYear", label: "سنة", type: "datePart", top: 9.5, left: 17, width: 10, height: 5.5, maxLength: 4 },
      {
        key: "governorate",
        label: "المحافظة",
        type: "text",
        top: 16,
        left: 52,
        width: 42,
        height: 5.5,
        placeholder: "مثال: بغداد",
      },
      {
        key: "payee",
        label: "ادفعوا بموجب الأمر",
        type: "text",
        top: 25.5,
        left: 4,
        width: 78,
        height: 6,
      },
      { key: "amountNumeric", label: "المبلغ (رقم)", type: "amount", top: 33.5, left: 1.5, width: 20, height: 12 },
      { key: "amountWords", label: "المبلغ كتابة", type: "textarea", top: 45, left: 10, width: 86, height: 10 },
      { key: "text", label: "text", type: "textarea", top: 56, left: 10, width: 86, height: 12, multiline: true },
    ],
  },
];

export function getChequeTemplate(key) {
  return CHEQUE_TEMPLATES.find((t) => t.key === key) || null;
}

export function isValidChequeTemplateKey(key) {
  return CHEQUE_TEMPLATE_KEYS.includes(String(key || "").trim());
}

export function getTemplateFieldKeys(templateOrKey) {
  const tpl =
    typeof templateOrKey === "string"
      ? getChequeTemplate(templateOrKey)
      : templateOrKey;
  return new Set((tpl?.fields || []).map((f) => f.key));
}

/** حقول تظهر على صورة الصك فقط */
export function isCanvasField(f) {
  return Boolean(f?.key) && !f.sidebarOnly;
}

export function getCanvasFields(templateOrFields) {
  const list = Array.isArray(templateOrFields)
    ? templateOrFields
    : templateOrFields?.fields || [];
  return list.filter(isCanvasField);
}
