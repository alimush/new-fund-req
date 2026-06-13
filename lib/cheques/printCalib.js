import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
import { getChequePageSize } from "@/lib/cheques/chequePageSize";
import { getCanvasFields } from "@/lib/cheques/templates";

function round2(n) {
  return Math.round(n * 100) / 100;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** يعيد fallback إذا القيمة غير رقم صالح (بما فيها NaN) */
function numOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export const DATE_GROUP_KEY = "date";
const DATE_PART_KEYS = ["dateDay", "dateMonth", "dateYear"];
const LEGACY_DATE_OFFSET_KEYS = [...DATE_PART_KEYS, "slash_0", "slash_1"];

const FIELD_OFFSET_MIN_MM = -20;
const FIELD_OFFSET_MAX_MM = 20;

export function defaultFieldOffset() {
  return { offsetXmm: 0, offsetYmm: 0 };
}

export const FONT_SIZE_SCALE_MIN = 50;
export const FONT_SIZE_SCALE_MAX = 200;
export const FONT_WEIGHT_MIN = 400;
export const FONT_WEIGHT_MAX = 900;

export function defaultFieldFontWeight(field) {
  const n = Number(field?.fontWeight);
  if (Number.isFinite(n) && n >= FONT_WEIGHT_MIN) return Math.round(n);
  return field?.key === "text" ? 700 : 800;
}

export function defaultFieldFontStyle(field) {
  return {
    fontSizeScale: 100,
    fontWeight: defaultFieldFontWeight(field),
  };
}

export function getFieldFontStyle(calib, key, field) {
  const resolved = resolveFieldOffsetKey(key);
  const raw = calib?.fieldFontStyles?.[resolved];
  const base = defaultFieldFontStyle(field);
  return {
    fontSizeScale: round2(
      clamp(numOr(raw?.fontSizeScale, 100), FONT_SIZE_SCALE_MIN, FONT_SIZE_SCALE_MAX)
    ),
    fontWeight:
      Math.round(
        clamp(numOr(raw?.fontWeight, base.fontWeight), FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) / 100
      ) * 100,
  };
}

function normalizeOneFontStyle(item, field) {
  const base = defaultFieldFontStyle(field);
  return {
    fontSizeScale: round2(
      clamp(numOr(item?.fontSizeScale, 100), FONT_SIZE_SCALE_MIN, FONT_SIZE_SCALE_MAX)
    ),
    fontWeight:
      Math.round(
        clamp(numOr(item?.fontWeight, base.fontWeight), FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) / 100
      ) * 100,
  };
}

export function normalizeFieldFontStyles(rawStyles, template, fields) {
  const keys = buildPrintOffsetKeys(fields, template);
  const list = fields?.length ? fields : template?.fields || [];
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));
  const raw = rawStyles && typeof rawStyles === "object" ? rawStyles : {};
  const out = {};
  for (const key of keys) {
    const field =
      key === DATE_GROUP_KEY
        ? fieldByKey.dateDay || fieldByKey.dateMonth
        : fieldByKey[key];
    out[key] = normalizeOneFontStyle(raw[key], field);
  }
  return out;
}

function normalizeOneOffset(item) {
  return {
    offsetXmm: round2(
      clamp(numOr(item?.offsetXmm, 0), FIELD_OFFSET_MIN_MM, FIELD_OFFSET_MAX_MM)
    ),
    offsetYmm: round2(
      clamp(numOr(item?.offsetYmm, 0), FIELD_OFFSET_MIN_MM, FIELD_OFFSET_MAX_MM)
    ),
  };
}

/** يوم+شهر+سنة+فواصل / — إزاحة موحّدة */
export function resolveFieldOffsetKey(key) {
  if (DATE_PART_KEYS.includes(key) || key === "slash_0" || key === "slash_1") {
    return DATE_GROUP_KEY;
  }
  return key;
}

export function getFieldOffset(calib, key) {
  const resolved = resolveFieldOffsetKey(key);
  const o = calib?.fieldOffsets?.[resolved];
  return {
    offsetXmm: numOr(o?.offsetXmm, 0),
    offsetYmm: numOr(o?.offsetYmm, 0),
  };
}

function migrateLegacyDateOffset(raw) {
  if (raw?.[DATE_GROUP_KEY]) return raw[DATE_GROUP_KEY];
  for (const key of LEGACY_DATE_OFFSET_KEYS) {
    const item = raw?.[key];
    if (item && (item.offsetXmm || item.offsetYmm)) return item;
  }
  return null;
}

function buildPrintOffsetKeys(fields, template) {
  const list = getCanvasFields(fields?.length ? fields : template);
  const hasDate = list.some((f) => f.type === "datePart");
  const keys = list.filter((f) => f.type !== "datePart").map((f) => f.key);
  if (hasDate) keys.unshift(DATE_GROUP_KEY);
  return keys;
}

export function normalizeFieldOffsets(rawOffsets, template, fields) {
  const keys = buildPrintOffsetKeys(fields, template);
  const raw = rawOffsets && typeof rawOffsets === "object" ? rawOffsets : {};
  const legacyDate = migrateLegacyDateOffset(raw);
  const out = {};
  for (const key of keys) {
    const item = key === DATE_GROUP_KEY ? raw[key] || legacyDate : raw[key];
    out[key] = normalizeOneOffset(item);
  }
  return out;
}

export function printFieldOffsetKeys(fields, template) {
  return buildPrintOffsetKeys(fields, template);
}

export function defaultPrintCalib(template, fields) {
  const { pageWidthMm, pageHeightMm } = getChequePageSize();
  const dims = getChequePrintDimensions(template);
  const widthMm = numOr(dims.widthMm, pageWidthMm);
  const heightMm = numOr(dims.heightMm, pageHeightMm);
  return {
    pageTopMm: 0,
    pageLeftMm: 0,
    widthMm,
    heightMm,
    offsetXmm: 0,
    offsetYmm: 0,
    scaleX: 100,
    scaleY: 100,
    fieldOffsets: normalizeFieldOffsets({}, template, fields),
    fieldFontStyles: normalizeFieldFontStyles({}, template, fields),
  };
}

export function normalizePrintCalib(raw, template, fields) {
  const d = defaultPrintCalib(template, fields);
  const { pageWidthMm, pageHeightMm } = getChequePageSize();
  return {
    pageTopMm: round2(clamp(numOr(raw?.pageTopMm, d.pageTopMm), -10, 10)),
    pageLeftMm: round2(clamp(numOr(raw?.pageLeftMm, d.pageLeftMm), -10, 10)),
    widthMm: round2(clamp(numOr(raw?.widthMm, d.widthMm), 50, pageWidthMm)),
    heightMm: round2(clamp(numOr(raw?.heightMm, d.heightMm), 30, pageHeightMm)),
    offsetXmm: round2(clamp(numOr(raw?.offsetXmm, 0), -30, 30)),
    offsetYmm: round2(clamp(numOr(raw?.offsetYmm, 0), -30, 30)),
    scaleX: round2(clamp(numOr(raw?.scaleX, 100), 70, 130)),
    scaleY: round2(clamp(numOr(raw?.scaleY, 100), 70, 130)),
    fieldOffsets: normalizeFieldOffsets(raw?.fieldOffsets, template, fields),
    fieldFontStyles: normalizeFieldFontStyles(raw?.fieldFontStyles, template, fields),
  };
}

export function printCalibPayload(calib, template, fields) {
  return normalizePrintCalib(calib, template, fields);
}

/** صورة الصك تملأ ورقة 18.22×9 سم بالضبط — مع الإبقاء على إزاحات الحقول */
export function fullPageImagePrintCalib(printCalib, template, fields) {
  const { pageWidthMm, pageHeightMm } = getChequePageSize();
  return normalizePrintCalib(
    {
      ...printCalib,
      pageTopMm: 0,
      pageLeftMm: 0,
      widthMm: pageWidthMm,
      heightMm: pageHeightMm,
    },
    template,
    fields
  );
}

/** أنماط CSS لإزاحة حقل واحد عند الطباعة */
export function fieldOffsetCss(calib, key) {
  const { offsetXmm, offsetYmm } = getFieldOffset(calib, key);
  if (!offsetXmm && !offsetYmm) return "";
  return `transform:translate(${offsetXmm}mm,${offsetYmm}mm);`;
}

export const PRINT_FIELD_LABELS = {
  [DATE_GROUP_KEY]: "التاريخ (يوم / شهر / سنة)",
};

/** @deprecated استخدم getChequePageSize */
export function getA4LandscapeSize() {
  return getChequePageSize();
}

export { getChequePageSize };

/** تحويل مم ↔ سم للواجهة */
export function mmToCm(mm) {
  return round2(numOr(mm, 0) / 10);
}

export function cmToMm(cm) {
  return round2(numOr(cm, 0) * 10);
}

export function formatCmFromMm(mm) {
  return mmToCm(mm).toFixed(2);
}

export function parseCmInput(raw) {
  const normalized = String(raw ?? "")
    .trim()
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}
