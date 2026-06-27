import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
import { getA4PaperSize, getChequePageSize } from "@/lib/cheques/chequePageSize";
import { normalizeWizardTestCopyCount } from "@/lib/cheques/chequePrintPageStyles";
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
/** فواصل / / — ضبط مستقل عن أرقام التاريخ */
export const SLASH_GROUP_KEY = "dateSlashes";
/** التاريخ كاملاً — أرقام + فواصل معاً */
export const DATE_ALL_GROUP_KEY = "dateAll";

export function isDateAllGroupKey(key) {
  return String(key || "") === DATE_ALL_GROUP_KEY;
}

export function isDatePrintGroupKey(key) {
  const k = String(key || "");
  return (
    k === DATE_ALL_GROUP_KEY ||
    k === DATE_GROUP_KEY ||
    k === SLASH_GROUP_KEY ||
    isDateSpacingKey(k)
  );
}

/** دليل معايرة Wizard — إحداثيات REF أو إطار أحمر حول الصك */
export const WIZARD_GUIDE_STYLE_COORDINATES = "coordinates";
export const WIZARD_GUIDE_STYLE_FRAME = "frame";
export const WIZARD_GUIDE_STYLE_DEFAULT = WIZARD_GUIDE_STYLE_COORDINATES;

export function normalizeWizardGuideStyle(val) {
  return val === WIZARD_GUIDE_STYLE_FRAME
    ? WIZARD_GUIDE_STYLE_FRAME
    : WIZARD_GUIDE_STYLE_COORDINATES;
}

const DATE_PART_KEYS = ["dateDay", "dateMonth", "dateYear"];
export { DATE_PART_KEYS };
export const DATE_SPACING_KEYS = [...DATE_PART_KEYS, "slash_0", "slash_1"];
const LEGACY_DATE_OFFSET_KEYS = [...DATE_PART_KEYS];
const LEGACY_SLASH_OFFSET_KEYS = ["slash_0", "slash_1"];

const FIELD_OFFSET_MIN_MM = -20;
const FIELD_OFFSET_MAX_MM = 20;

export function defaultFieldOffset() {
  return { offsetXmm: 0, offsetYmm: 0 };
}

export function isDateSpacingKey(key) {
  return DATE_SPACING_KEYS.includes(key);
}

export const FONT_SIZE_SCALE_MIN = 50;
export const FONT_SIZE_SCALE_MAX = 200;
export const GLOBAL_FONT_SIZE_SCALE_MIN = 70;
export const GLOBAL_FONT_SIZE_SCALE_MAX = 250;
export const GLOBAL_FONT_SIZE_SCALE_DEFAULT = 100;
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
  return 700;
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
  const resolved = resolveFieldFontKey(key);
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
  const keys = buildPrintFontKeys(fields, template);
  const list = fields?.length ? fields : template?.fields || [];
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));
  const raw = rawStyles && typeof rawStyles === "object" ? rawStyles : {};
  const out = {};
  for (const key of keys) {
    const field =
      key === DATE_ALL_GROUP_KEY ||
      key === DATE_GROUP_KEY ||
      key === SLASH_GROUP_KEY
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

/** مجموعة الخط — أرقام التاريخ */
export function resolveFieldFontKey(key) {
  if (DATE_PART_KEYS.includes(key)) return DATE_GROUP_KEY;
  if (key === "slash_0" || key === "slash_1") return SLASH_GROUP_KEY;
  return key;
}

/** مجموعة الإزاحة المشتركة — تحريك كل الأرقام أو كل الشرطات معاً */
export function resolveFieldGroupOffsetKey(key) {
  if (DATE_PART_KEYS.includes(key)) return DATE_GROUP_KEY;
  if (key === "slash_0" || key === "slash_1") return SLASH_GROUP_KEY;
  return null;
}

/** @deprecated استخدم resolveFieldFontKey أو المفتاح مباشرة */
export function resolveFieldOffsetKey(key) {
  return key;
}

/** إزاحة محفوظة لمفتاح واحد (مجموعة أو جزء) */
export function getStoredFieldOffset(calib, key) {
  const o = calib?.fieldOffsets?.[key];
  return {
    offsetXmm: numOr(o?.offsetXmm, 0),
    offsetYmm: numOr(o?.offsetYmm, 0),
  };
}

function getDateAllOffset(calib) {
  return getStoredFieldOffset(calib, DATE_ALL_GROUP_KEY);
}

function getGroupOffsetForKey(calib, key) {
  const gk = resolveFieldGroupOffsetKey(key);
  if (!gk) return { offsetXmm: 0, offsetYmm: 0 };
  return getStoredFieldOffset(calib, gk);
}

export function getFieldOffset(calib, key) {
  return getStoredFieldOffset(calib, key);
}

/** إزاحة فعلية عند الطباعة = dateAll + مجموعة + جزء */
export function getEffectiveFieldOffset(calib, key) {
  const dateAll = getDateAllOffset(calib);

  if (key === DATE_ALL_GROUP_KEY) {
    return getStoredFieldOffset(calib, DATE_ALL_GROUP_KEY);
  }

  if (key === DATE_GROUP_KEY || key === SLASH_GROUP_KEY) {
    const own = getStoredFieldOffset(calib, key);
    return {
      offsetXmm: round2(dateAll.offsetXmm + own.offsetXmm),
      offsetYmm: round2(dateAll.offsetYmm + own.offsetYmm),
    };
  }

  if (isDateSpacingKey(key)) {
    const g = getGroupOffsetForKey(calib, key);
    const ind = getStoredFieldOffset(calib, key);
    return {
      offsetXmm: round2(dateAll.offsetXmm + g.offsetXmm + ind.offsetXmm),
      offsetYmm: round2(dateAll.offsetYmm + g.offsetYmm + ind.offsetYmm),
    };
  }

  return getStoredFieldOffset(calib, key);
}

function migrateLegacyDateOffset(raw) {
  if (raw?.[DATE_GROUP_KEY]) return raw[DATE_GROUP_KEY];
  for (const key of LEGACY_DATE_OFFSET_KEYS) {
    const item = raw?.[key];
    if (item && (item.offsetXmm || item.offsetYmm)) return item;
  }
  return null;
}

function migrateLegacySlashOffset(raw, legacyDate) {
  if (raw?.[SLASH_GROUP_KEY]) return raw[SLASH_GROUP_KEY];
  for (const key of LEGACY_SLASH_OFFSET_KEYS) {
    const item = raw?.[key];
    if (item && (item.offsetXmm || item.offsetYmm)) return item;
  }
  return legacyDate || null;
}

function buildPrintFontKeys(fields, template) {
  const list = getCanvasFields(fields?.length ? fields : template);
  const hasDate = list.some((f) => f.type === "datePart");
  const keys = list.filter((f) => f.type !== "datePart").map((f) => f.key);
  if (hasDate) {
    keys.unshift(DATE_ALL_GROUP_KEY);
    keys.unshift(SLASH_GROUP_KEY);
    keys.unshift(DATE_GROUP_KEY);
  }
  return keys;
}

function buildPrintOffsetKeys(fields, template) {
  const keys = buildPrintFontKeys(fields, template);
  if (keys.includes(DATE_GROUP_KEY)) {
    keys.push(...DATE_SPACING_KEYS);
  }
  return keys;
}

export function printDateSpacingKeys(dateShowSlashes = true) {
  if (!dateShowSlashes) return DATE_PART_KEYS;
  return [...DATE_SPACING_KEYS];
}

export function printFieldFontCalibKeys(fields, template) {
  return buildPrintFontKeys(fields, template);
}

export function normalizeFieldOffsets(rawOffsets, template, fields) {
  const keys = buildPrintOffsetKeys(fields, template);
  const raw = rawOffsets && typeof rawOffsets === "object" ? rawOffsets : {};
  const legacyDate = migrateLegacyDateOffset(raw);
  const legacySlash = migrateLegacySlashOffset(raw, legacyDate);
  const out = {};
  for (const key of keys) {
    let item = raw[key];
    if (!item) {
      if (key === DATE_ALL_GROUP_KEY) item = raw[DATE_ALL_GROUP_KEY] || null;
      else if (key === DATE_GROUP_KEY) item = legacyDate;
      else if (key === SLASH_GROUP_KEY) item = legacySlash;
      else if (DATE_PART_KEYS.includes(key)) item = raw[key] || null;
      else if (key === "slash_0" || key === "slash_1") item = raw[key] || null;
    }
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
    wizardGuideStyle: WIZARD_GUIDE_STYLE_DEFAULT,
    imageSheet: null,
  };
}

/** موضع صورة الصك على A4 — مستقل عن منطقة البيانات */
export function defaultImageSheetCalib(dataCalib, template) {
  const { pageWidthMm: chequeW, pageHeightMm: chequeH } = getChequePageSize();
  const dims = getChequePrintDimensions(template);
  const fallbackW = numOr(dims.widthMm, chequeW);
  const fallbackH = numOr(dims.heightMm, chequeH);
  return {
    pageTopMm: numOr(dataCalib?.pageTopMm, 0),
    pageLeftMm: numOr(dataCalib?.pageLeftMm, 0),
    widthMm: numOr(dataCalib?.widthMm, fallbackW),
    heightMm: numOr(dataCalib?.heightMm, fallbackH),
    scaleX: 100,
    scaleY: 100,
    sheetRotationDeg: normalizeSheetRotationDeg(dataCalib?.sheetRotationDeg),
    flipHorizontal: normalizeSheetFlip(dataCalib?.flipHorizontal),
    flipVertical: normalizeSheetFlip(dataCalib?.flipVertical),
  };
}

function normalizeSheetPlacement(raw, dataCalib, template) {
  const { pageWidthMm: paperW, pageHeightMm: paperH } = getA4PaperSize();
  const { pageWidthMm: chequeW, pageHeightMm: chequeH } = getChequePageSize();
  const d = defaultImageSheetCalib(dataCalib, template);
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

  return {
    pageTopMm: round2(clamp(numOr(raw?.pageTopMm, d.pageTopMm), 0, maxPageTop)),
    pageLeftMm: round2(clamp(numOr(raw?.pageLeftMm, d.pageLeftMm), 0, maxPageLeft)),
    widthMm,
    heightMm,
    scaleX: round2(clamp(numOr(raw?.scaleX, d.scaleX), 70, 130)),
    scaleY: round2(clamp(numOr(raw?.scaleY, d.scaleY), 70, 130)),
    sheetRotationDeg,
    flipHorizontal,
    flipVertical,
  };
}

export function normalizeImageSheetCalib(raw, dataCalib, template) {
  if (!raw || typeof raw !== "object") {
    return defaultImageSheetCalib(dataCalib, template);
  }
  return normalizeSheetPlacement(raw, dataCalib, template);
}

export function getImageSheetCalib(calib, template, fields) {
  const dataNorm = normalizePrintCalib(calib, template, fields);
  return dataNorm.imageSheet || defaultImageSheetCalib(dataNorm, template);
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

  const out = {
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
    wizardGuideStyle: normalizeWizardGuideStyle(
      raw?.wizardGuideStyle ?? d.wizardGuideStyle
    ),
  };
  if (raw?.wizardCopyLayouts && typeof raw.wizardCopyLayouts === "object") {
    out.wizardCopyLayouts = raw.wizardCopyLayouts;
  }
  if (raw?.imageSheet && typeof raw.imageSheet === "object") {
    out.imageSheet = normalizeImageSheetCalib(raw.imageSheet, out, template);
  }
  return out;
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

/** معايرة موحّدة — نفس إعدادات ضبط الطباعة وWizard وطباعة الصك */
export function resolveWizardPrintCalib({
  printCalib,
  wizardPrintCalib,
  wizardCalibSource,
  template,
  fields,
  copyCount,
}) {
  const copies = normalizeWizardTestCopyCount(copyCount);
  let base = printCalib || wizardPrintCalib;
  const separate =
    normalizeWizardCalibSource(wizardCalibSource) === WIZARD_CALIB_SOURCE_SEPARATE;
  if (
    separate &&
    wizardPrintCalib &&
    (!printCalib?.wizardCopyLayouts ||
      !Object.keys(printCalib.wizardCopyLayouts || {}).length)
  ) {
    base = { ...(printCalib || {}), ...wizardPrintCalib };
  }
  return attachWizardCopyLayouts(base, template, fields, copies);
}

const SHARED_CALIB_KEYS = [
  "pageTopMm",
  "pageLeftMm",
  "widthMm",
  "heightMm",
  "offsetXmm",
  "offsetYmm",
  "scaleX",
  "scaleY",
  "sheetRotationDeg",
  "flipHorizontal",
  "flipVertical",
  "globalFontSizeScale",
  "globalTextColor",
  "wizardGuideStyle",
];

/** نقل إعدادات المرجع من صك إلى آخر — موضع الورقة والمعايرة المشتركة + الحقول المتطابقة */
export function transferPrintCalibAcrossTemplates(
  sourceCalib,
  sourceTemplate,
  sourceFields,
  targetTemplate,
  targetFields,
  copyCount
) {
  const src = normalizeWizardPrintCalib(
    sourceCalib,
    sourceTemplate,
    sourceFields,
    copyCount
  );
  const targetKeys = new Set(printFieldOffsetKeys(targetFields, targetTemplate));
  const partial = {};

  for (const key of SHARED_CALIB_KEYS) {
    if (src[key] !== undefined && src[key] !== null) {
      partial[key] = src[key];
    }
  }
  if (src.wizardCopyLayouts) partial.wizardCopyLayouts = src.wizardCopyLayouts;
  if (src.imageSheet) partial.imageSheet = src.imageSheet;

  const fieldOffsets = {};
  for (const [key, val] of Object.entries(src.fieldOffsets || {})) {
    if (targetKeys.has(key)) fieldOffsets[key] = val;
  }
  partial.fieldOffsets = fieldOffsets;

  const fieldFontStyles = {};
  for (const [key, val] of Object.entries(src.fieldFontStyles || {})) {
    if (targetKeys.has(key)) fieldFontStyles[key] = val;
  }
  partial.fieldFontStyles = fieldFontStyles;

  const defaults = defaultPrintCalib(targetTemplate, targetFields);
  return normalizeWizardPrintCalib(
    { ...defaults, ...partial },
    targetTemplate,
    targetFields,
    copyCount
  );
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
  const { offsetXmm, offsetYmm } = getEffectiveFieldOffset(calib, key);
  if (!offsetXmm && !offsetYmm) return "";
  return `transform:translate(${offsetXmm}mm,${offsetYmm}mm);`;
}

/** إزاحة الشرطة مع الحفاظ على translate(-50%) للتوسيط */
export function slashTransformCss(calib, key) {
  const { offsetXmm, offsetYmm } = getEffectiveFieldOffset(calib, key);
  return `transform:translate(calc(-50% + ${offsetXmm}mm), ${offsetYmm}mm);`;
}

export const PRINT_FIELD_LABELS = {
  [DATE_ALL_GROUP_KEY]: "التاريخ كامل (أرقام + /)",
  [DATE_GROUP_KEY]: "التاريخ — أرقام (خط + تحريك الكل)",
  [SLASH_GROUP_KEY]: "فواصل التاريخ (خط + تحريك الكل)",
  dateDay: "يوم",
  dateMonth: "شهر",
  dateYear: "سنة",
  slash_0: "فاصل / (بعد اليوم)",
  slash_1: "فاصل / (بعد الشهر)",
  amountWords: "المبلغ كتابة — سطر 1",
  amountWordsLine2: "المبلغ كتابة — سطر 2",
  text: "بموجب الأمر",
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
