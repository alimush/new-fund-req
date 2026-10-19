/**
 * تخطيط حقول الوصولات — افتراضيات من POS/EXTRA + categoryChecklist،
 * وتجاوزات محفوظة في Mongo (VoucherLayout).
 */

import {
  POS_NEW,
  EXTRA_NEW,
  getCompanyCategoryChecklist,
} from "@/lib/voucher/companies";

export const DEFAULT_VOUCHER_NO_POS = { top: 12.9, left: 39.5, width: 18, height: 4 };

export const FIELD_LABELS = {
  date: "التاريخ",
  amountFixed: "المبلغ",
  currencyEURBox: "عملة يورو",
  currencyUSDBox: "عملة دولار",
  currencyIQDBox: "عملة دينار",
  amountWords: "المبلغ كتابة",
  description: "الوصف",
  bank: "البنك",
  fxRate: "سعر الصرف",
  chequeNo: "رقم الصك",
  nationalId: "البطاقة الوطنية",
  phone: "الهاتف",
  sanadNo: "رقم السند",
  receivedBy: "استلمت من / الاسم",
  beneficiary: "المستفيد",
  notes: "الملاحظات",
  cb1: "جيك بوكس نقداً",
  cb2: "جيك بوكس شيك",
  voucherNo: "رقم الوصل",
};

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

export function normalizeLayoutField(f) {
  if (!f?.key) return null;
  return {
    key: String(f.key),
    top: round2(clamp(f.top ?? 0, -20, 120)),
    left: round2(clamp(f.left ?? 0, -40, 120)),
    width: round2(clamp(f.width ?? 10, 1, 100)),
    height: round2(clamp(f.height ?? 5, 1, 40)),
  };
}

export function categoryLayoutKey(key) {
  return `cat:${String(key || "").trim()}`;
}

export function parseCategoryLayoutKey(layoutKey) {
  const s = String(layoutKey || "");
  if (!s.startsWith("cat:")) return null;
  return s.slice(4);
}

/** بناء قائمة الحقول الافتراضية لشركة + POS/EXTRA الحاليين */
export function buildDefaultVoucherLayoutFields({
  company = null,
  POS = POS_NEW,
  EXTRA = EXTRA_NEW,
} = {}) {
  const fields = [];

  const pushPos = (key, p, defaults = {}) => {
    if (!p) return;
    fields.push(
      normalizeLayoutField({
        key,
        top: p.top ?? 0,
        left: p.left ?? 0,
        width: p.width ?? defaults.width ?? 10,
        height: p.height ?? defaults.height ?? 5,
      })
    );
  };

  pushPos("date", POS.date, { width: 22, height: 7 });
  pushPos("amountFixed", POS.amountFixed, { width: 22, height: 6 });
  pushPos("currencyUSDBox", POS.currencyUSDBox, { width: 7, height: 7 });
  pushPos("currencyIQDBox", POS.currencyIQDBox, { width: 7, height: 7 });
  if (POS.currencyEURBox) {
    pushPos("currencyEURBox", POS.currencyEURBox, { width: 7, height: 7 });
  }
  pushPos("amountWords", POS.amountWords, {
    width: POS.amountWords?.width ?? 75,
    height: POS.amountWords?.height ?? 6,
  });
  pushPos("description", POS.description, {
    width: POS.description?.width ?? 74,
    height: POS.description?.height ?? 15,
  });

  const extraKeys = [
    "bank",
    "fxRate",
    "chequeNo",
    "nationalId",
    "phone",
    "sanadNo",
    "receivedBy",
    "beneficiary",
    "notes",
    "cb1",
    "cb2",
  ];
  for (const key of extraKeys) {
    const p = EXTRA?.[key];
    if (!p) continue;
    const isCb = key === "cb1" || key === "cb2";
    pushPos(key, p, {
      width: p.width ?? (isCb ? 3 : 30),
      height: p.height ?? (isCb ? 3 : 6),
    });
  }

  pushPos("voucherNo", DEFAULT_VOUCHER_NO_POS);

  for (const item of getCompanyCategoryChecklist(company)) {
    if (!item?.key) continue;
    fields.push(
      normalizeLayoutField({
        key: categoryLayoutKey(item.key),
        top: item.pos?.top ?? 0,
        left: item.pos?.left ?? 0,
        width: item.hit?.width ?? 10,
        height: item.hit?.height ?? 5,
      })
    );
  }

  return fields.filter(Boolean);
}

/** دمج افتراضيات + حقول محفوظة */
export function mergeVoucherLayoutFields(defaults, saved) {
  const byKey = new Map();
  for (const f of defaults || []) {
    if (f?.key) byKey.set(f.key, f);
  }
  for (const raw of saved || []) {
    const f = normalizeLayoutField(raw);
    if (!f || !byKey.has(f.key)) continue;
    const base = byKey.get(f.key);
    byKey.set(f.key, {
      ...base,
      top: f.top,
      left: f.left,
      width: f.width || base.width,
      height: f.height || base.height,
    });
  }
  return Array.from(byKey.values());
}

export function fieldsToMap(fields) {
  const map = {};
  for (const f of fields || []) {
    if (f?.key) map[f.key] = f;
  }
  return map;
}

/** تطبيق خريطة التخطيط على كائنات POS / EXTRA */
export function applyLayoutToPosExtra(POS, EXTRA, fieldsMap) {
  const nextPos = { ...POS };
  const nextExtra = { ...EXTRA };

  for (const key of Object.keys(POS || {})) {
    const f = fieldsMap[key];
    if (!f) continue;
    nextPos[key] = {
      ...POS[key],
      top: f.top,
      left: f.left,
      ...(POS[key]?.width != null || f.width != null
        ? { width: f.width ?? POS[key]?.width }
        : {}),
      ...(POS[key]?.height != null || f.height != null
        ? { height: f.height ?? POS[key]?.height }
        : {}),
    };
  }

  for (const key of Object.keys(EXTRA || {})) {
    const f = fieldsMap[key];
    if (!f) continue;
    nextExtra[key] = {
      ...EXTRA[key],
      top: f.top,
      left: f.left,
      ...(EXTRA[key]?.width != null || f.width != null
        ? { width: f.width ?? EXTRA[key]?.width }
        : {}),
      ...(EXTRA[key]?.height != null || f.height != null
        ? { height: f.height ?? EXTRA[key]?.height }
        : {}),
    };
  }

  return { POS: nextPos, EXTRA: nextExtra };
}

export function applyLayoutToCategoryChecklist(checklist, fieldsMap) {
  if (!Array.isArray(checklist) || !checklist.length) return checklist || [];
  return checklist.map((item) => {
    const f = fieldsMap[categoryLayoutKey(item.key)];
    if (!f) return item;
    return {
      ...item,
      pos: { top: f.top, left: f.left },
      hit: {
        width: f.width ?? item.hit?.width ?? 3,
        height: f.height ?? item.hit?.height ?? 3,
      },
    };
  });
}

export function isCategoryLayoutField(key) {
  return String(key || "").startsWith("cat:");
}

export function splitLayoutFields(fields = []) {
  const main = [];
  const category = [];
  for (const f of fields || []) {
    if (!f?.key) continue;
    if (isCategoryLayoutField(f.key)) category.push(f);
    else main.push(f);
  }
  return { main, category };
}

/** حقول الفئة فقط من افتراضيات الشركة */
export function buildDefaultCategoryLayoutFields(company) {
  const fields = [];
  for (const item of getCompanyCategoryChecklist(company)) {
    if (!item?.key) continue;
    fields.push(
      normalizeLayoutField({
        key: categoryLayoutKey(item.key),
        top: item.pos?.top ?? 0,
        left: item.pos?.left ?? 0,
        width: item.hit?.width ?? 10,
        height: item.hit?.height ?? 5,
      })
    );
  }
  return fields.filter(Boolean);
}

/** تسميات الجيك بوكس المختارة من categoryChecks للتقارير */
export function formatCategoryChecksLabels(categoryChecks, company = null) {
  const checklist = getCompanyCategoryChecklist(company);
  if (!checklist.length) {
    // fallback labels
    const FALLBACK = {
      prestigeVilla: "Prestige Villa",
      prime: "Prime",
      selectPlus: "Select Plus",
      select: "Select",
    };
    return Object.entries(categoryChecks || {})
      .filter(([, v]) => Boolean(v))
      .map(([k]) => FALLBACK[k] || k)
      .filter(Boolean);
  }
  return checklist
    .filter((item) => Boolean(categoryChecks?.[item.key]))
    .map((item) => item.label || item.key);
}

export function formatCategoryChecksText(categoryChecks, company = null) {
  const labels = formatCategoryChecksLabels(categoryChecks, company);
  return labels.length ? labels.join(" · ") : "";
}

export function getFieldLabel(key, company = null) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const cat = parseCategoryLayoutKey(key);
  if (cat) {
    const item = getCompanyCategoryChecklist(company).find((x) => x.key === cat);
    if (item?.label) return item.label;
    return cat;
  }
  return key;
}

/** دمج حقول الفئة المحفوظة مع باقي تخطيط الشركة عند الحفظ */
export function mergeCategoryFieldsIntoLayout(allFields, categoryFields) {
  const byKey = new Map();
  for (const f of allFields || []) {
    if (f?.key) byKey.set(f.key, f);
  }
  for (const f of categoryFields || []) {
    const n = normalizeLayoutField(f);
    if (n && isCategoryLayoutField(n.key)) byKey.set(n.key, n);
  }
  return Array.from(byKey.values());
}
