import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
import { getA4PaperSize, getChequePageSize } from "@/lib/cheques/chequePageSize";
import { getCanvasFields } from "@/lib/cheques/templates";
import { attachWizardCopyLayouts, normalizeWizardPrintCalib } from "@/lib/cheques/wizardCopyLayouts";

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
export const GLOBAL_FONT_SIZE_SCALE_MIN = 70;
export const GLOBAL_FONT_SIZE_SCALE_MAX = 250;
export const GLOBAL_FONT_SIZE_SCALE_DEFAULT = 130;
export const FONT_WEIGHT_MIN = 400;
export const FONT_WEIGHT_MAX = 900;
export const DEFAULT_PRINT_FIELD_COLOR = "#0f172a";
/** زاوية حرة — تُطبَّق عند الطباعة والمعاينة */
export const SHEET_ROTATION_MIN = -180;
export const SHEET_ROTATION_MAX = 180;

/** زاوية دوران منطقة الصك (درجة حرة) */
export function normalizeSheetRotationDeg(deg) {
  let n = Number(deg);
  if (!Number.isFinite(n)) n = 0;
  n = ((n % 360) + 360) % 360;
  if (n > 180) n -= 360;
  return Math.round(n * 10) / 10;
}

export function normalizeSheetFlip(val) {
  return Boolean(val);
}

/** أبعاد الإطار المحيط بعد الدوران (لحساب موضع الصك على A4) */
export function chequeSheetBoundsMm(calib) {
  const w = numOr(calib?.widthMm, 178);
  const h = numOr(calib?.heightMm, 82);
  const rot = normalizeSheetRotationDeg(calib?.sheetRotationDeg);
  if (!rot) return { widthMm: w, heightMm: h };
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    widthMm: round2(w * cos + h * sin),
    heightMm: round2(w * sin + h * cos),
  };
}

/** تحويل CSS لدوران/قلب منطقة الصك بالكامل */
export function chequeSheetTransformStyle(calib) {
  const rot = normalizeSheetRotationDeg(calib?.sheetRotationDeg);
  const fh = normalizeSheetFlip(calib?.flipHorizontal) ? -1 : 1;
  const fv = normalizeSheetFlip(calib?.flipVertical) ? -1 : 1;
  const parts = [];
  if (rot) parts.push(`rotate(${rot}deg)`);
  if (fh !== 1 || fv !== 1) parts.push(`scale(${fh}, ${fv})`);
  if (!parts.length) return {};
  return { transform: parts.join(" "), transformOrigin: "top left" };
}

export function chequeSheetTransformCss(calib) {
  const style = chequeSheetTransformStyle(calib);
  if (!style.transform) return "";
  return `transform:${style.transform};transform-origin:top left;`;
}

/** لون hex آمن للطباعة */
export function sanitizePrintFieldColor(raw, fallback = DEFAULT_PRINT_FIELD_COLOR) {
  const s = String(raw ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const [, r, g, b] = s.match(/^#(.)(.)(.)$/) || [];
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function defaultFieldFontWeight(field) {
  const n = Number(field?.fontWeight);
  if (Number.isFinite(n) && n >= FONT_WEIGHT_MIN) return Math.round(n);
  return field?.key === "text" ? 700 : 800;
}

export function defaultFieldFontStyle(field) {
  return {
    fontSizeScale: 100,
    fontWeight: defaultFieldFontWeight(field),
    color: DEFAULT_PRINT_FIELD_COLOR,
  };
}

/** عند تغيير اللون العام — يُحدَّث لون كل الحقول (المعاينة والطباعة والحفظ) */
export function applyGlobalTextColorToCalib(calib, color, template, fields = []) {
  const safeColor = sanitizePrintFieldColor(color, DEFAULT_PRINT_FIELD_COLOR);
  const keys = buildPrintOffsetKeys(fields, template);
  const fieldFontStyles = { ...(calib?.fieldFontStyles || {}) };
  for (const key of keys) {
    fieldFontStyles[key] = { ...(fieldFontStyles[key] || {}), color: safeColor };
  }
  return normalizePrintCalib(
    { ...calib, globalTextColor: safeColor, fieldFontStyles },
    template,
    fields
  );
}

export function getFieldFontStyle(calib, key, field) {
  const resolved = resolveFieldOffsetKey(key);
  const raw = calib?.fieldFontStyles?.[resolved];
  const base = defaultFieldFontStyle(field);
  const globalColor = sanitizePrintFieldColor(
    calib?.globalTextColor,
    DEFAULT_PRINT_FIELD_COLOR
  );
  return {
    fontSizeScale: round2(
      clamp(numOr(raw?.fontSizeScale, 100), FONT_SIZE_SCALE_MIN, FONT_SIZE_SCALE_MAX)
    ),
    fontWeight:
      Math.round(
        clamp(numOr(raw?.fontWeight, base.fontWeight), FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) / 100
      ) * 100,
    color: sanitizePrintFieldColor(raw?.color ?? globalColor, globalColor),
  };
}

/** مضاعف حجم الخط عند الطباعة = عام × حقل */
export function getPrintFontSizeMultiplier(calib, fieldFontStyle) {
  const globalScale =
    numOr(calib?.globalFontSizeScale, GLOBAL_FONT_SIZE_SCALE_DEFAULT) / 100;
  const fieldScale = numOr(fieldFontStyle?.fontSizeScale, 100) / 100;
  return globalScale * fieldScale;
}

function normalizeOneFontStyle(item, field, globalTextColor = DEFAULT_PRINT_FIELD_COLOR) {
  const base = defaultFieldFontStyle(field);
  const globalColor = sanitizePrintFieldColor(globalTextColor, DEFAULT_PRINT_FIELD_COLOR);
  return {
    fontSizeScale: round2(
      clamp(numOr(item?.fontSizeScale, 100), FONT_SIZE_SCALE_MIN, FONT_SIZE_SCALE_MAX)
    ),
    fontWeight:
      Math.round(
        clamp(numOr(item?.fontWeight, base.fontWeight), FONT_WEIGHT_MIN, FONT_WEIGHT_MAX) / 100
      ) * 100,
    color: sanitizePrintFieldColor(item?.color ?? globalColor, globalColor),
  };
}

export function normalizeFieldFontStyles(
  rawStyles,
  template,
  fields,
  globalTextColor = DEFAULT_PRINT_FIELD_COLOR
) {
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
    out[key] = normalizeOneFontStyle(raw[key], field, globalTextColor);
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
  const { pageWidthMm: chequeW, pageHeightMm: chequeH } = getChequePageSize();
  const dims = getChequePrintDimensions(template);
  const widthMm = numOr(dims.widthMm, chequeW);
  const heightMm = numOr(dims.heightMm, chequeH);
  return {
    pageTopMm: 0,
    pageLeftMm: 0,
    widthMm,
    heightMm,
    offsetXmm: 0,
    offsetYmm: 0,
    scaleX: 100,
    scaleY: 100,
    sheetRotationDeg: 0,
    flipHorizontal: false,
    flipVertical: false,
    globalFontSizeScale: GLOBAL_FONT_SIZE_SCALE_DEFAULT,
    globalTextColor: DEFAULT_PRINT_FIELD_COLOR,
    fieldOffsets: normalizeFieldOffsets({}, template, fields),
    fieldFontStyles: normalizeFieldFontStyles({}, template, fields, DEFAULT_PRINT_FIELD_COLOR),
  };
}

export function normalizePrintCalib(raw, template, fields) {
  const d = defaultPrintCalib(template, fields);
  const { pageWidthMm: paperW, pageHeightMm: paperH } = getA4PaperSize();
  const { pageWidthMm: chequeW, pageHeightMm: chequeH } = getChequePageSize();
  const widthMm = round2(clamp(numOr(raw?.widthMm, d.widthMm), 50, chequeW));
  const heightMm = round2(clamp(numOr(raw?.heightMm, d.heightMm), 30, chequeH));
  const sheetRotationDeg = normalizeSheetRotationDeg(
    raw?.sheetRotationDeg ?? d.sheetRotationDeg
  );
  const flipHorizontal = normalizeSheetFlip(raw?.flipHorizontal ?? d.flipHorizontal);
  const flipVertical = normalizeSheetFlip(raw?.flipVertical ?? d.flipVertical);
  const sheetBounds = chequeSheetBoundsMm({
    widthMm,
    heightMm,
    sheetRotationDeg,
  });
  const maxPageTop = Math.max(0, paperH - sheetBounds.heightMm);
  const maxPageLeft = Math.max(0, paperW - sheetBounds.widthMm);

  const pageTopMm = round2(clamp(numOr(raw?.pageTopMm, d.pageTopMm), 0, maxPageTop));
  const pageLeftMm = round2(clamp(numOr(raw?.pageLeftMm, d.pageLeftMm), 0, maxPageLeft));

  const globalTextColor = sanitizePrintFieldColor(
    raw?.globalTextColor,
    d.globalTextColor
  );

  return {
    pageTopMm,
    pageLeftMm,
    widthMm,
    heightMm,
    offsetXmm: round2(clamp(numOr(raw?.offsetXmm, 0), -30, 30)),
    offsetYmm: round2(clamp(numOr(raw?.offsetYmm, 0), -30, 30)),
    scaleX: round2(clamp(numOr(raw?.scaleX, 100), 70, 130)),
    scaleY: round2(clamp(numOr(raw?.scaleY, 100), 70, 130)),
    sheetRotationDeg,
    flipHorizontal,
    flipVertical,
    globalFontSizeScale: round2(
      clamp(
        numOr(raw?.globalFontSizeScale, d.globalFontSizeScale),
        GLOBAL_FONT_SIZE_SCALE_MIN,
        GLOBAL_FONT_SIZE_SCALE_MAX
      )
    ),
    globalTextColor,
    fieldOffsets: normalizeFieldOffsets(raw?.fieldOffsets, template, fields),
    fieldFontStyles: normalizeFieldFontStyles(
      raw?.fieldFontStyles,
      template,
      fields,
      globalTextColor
    ),
  };
}

export function printCalibPayload(calib, template, fields) {
  return normalizePrintCalib(calib, template, fields);
}

/** حفظ معايرة Wizard مع مواضع النسخ (wizardCopyLayouts) */
export function wizardPrintCalibPayload(calib, template, fields, copyCount) {
  return normalizeWizardPrintCalib(calib, template, fields, copyCount);
}

export const WIZARD_CALIB_SOURCE_SHARED = "shared";
export const WIZARD_CALIB_SOURCE_SEPARATE = "separate";

export function normalizeWizardCalibSource(val) {
  return val === WIZARD_CALIB_SOURCE_SEPARATE
    ? WIZARD_CALIB_SOURCE_SEPARATE
    : WIZARD_CALIB_SOURCE_SHARED;
}

/** أي معايرة يستخدمها Wizard لطباعة صفحة الاختبار */
export function resolveWizardPrintCalib({
  printCalib,
  wizardPrintCalib,
  wizardCalibSource,
  template,
  fields,
  copyCount,
}) {
  const source = normalizeWizardCalibSource(wizardCalibSource);
  if (source === WIZARD_CALIB_SOURCE_SEPARATE) {
    return attachWizardCopyLayouts(wizardPrintCalib, template, fields, copyCount);
  }
  return normalizePrintCalib(printCalib, template, fields);
}

/** صورة الصك تملأ ورقة 17.80×8.20 سم بالضبط — مع الإبقاء على إزاحات الحقول */
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

/** @deprecated استخدم getA4PaperSize */
export function getA4LandscapeSize() {
  return getA4PaperSize();
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
