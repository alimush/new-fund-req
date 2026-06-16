import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
import { getPrintFontSizeMultiplier } from "@/lib/cheques/printCalib";

/** أبعاد صورة القالب بالبكسل (من aspectRatio أو imageWidthPx/imageHeightPx) */
export function getChequeImageSize(template) {
  const w = Number(template?.imageWidthPx);
  const h = Number(template?.imageHeightPx);
  if (w > 0 && h > 0) return { width: w, height: h };

  const ar = String(template?.aspectRatio || "1024 / 470");
  const parts = ar.split("/").map((s) => parseFloat(s.trim()));
  return {
    width: parts[0] || 1024,
    height: parts[1] || 470,
  };
}

/** عرض صورة القالب بالبكسل — مرجع لحجم الخط */
export function getChequeFontReferenceWidth(template) {
  return getChequeImageSize(template).width;
}

/**
 * نظام إحداثيات موحّد = أبعاد ورقة الطباعة (×10 للدقة).
 * المواضع % على الشاشة والطباعة تُحسب على نفس النسبة.
 */
export function getChequeDesignSize(template) {
  const dims = getChequePrintDimensions(template);
  return {
    designWidth: Math.round(dims.widthMm * 10),
    designHeight: Math.round(dims.heightMm * 10),
  };
}

/** aspect-ratio CSS مطابق لصورة القالب (لتجنّب تشويه المعاينة) */
export function getChequeAspectRatioCss(template) {
  const { width, height } = getChequeImageSize(template);
  if (width > 0 && height > 0) return `${width} / ${height}`;
  const dims = getChequePrintDimensions(template);
  return `${dims.widthMm} / ${dims.heightMm}`;
}

/** تحويل px التصميم → mm على ورقة الطباعة */
export function designPxToMm(px, designWidth, printWidthMm) {
  const n = Number(px) || 0;
  if (!n || !designWidth || !printWidthMm) return 0;
  return (n / designWidth) * printWidthMm;
}

/** px التصميم من حجم خط الحقل (افتراضي 14) */
export function fieldDesignFontPx(field, fallback = 14) {
  return Number(field?.fontSize) || fallback;
}

/** mm للطباعة من حقل — مرجع الخط = عرض صورة القالب */
export function fieldFontSizeMm(field, template, printWidthMm, layoutFontScale = 100) {
  const fontRef = getChequeFontReferenceWidth(template);
  const scale = clampLayoutFontScale(layoutFontScale) / 100;
  const px = fieldDesignFontPx(field) * scale;
  return designPxToMm(px, fontRef, printWidthMm);
}

export const LAYOUT_FONT_SCALE_MIN = 70;
export const LAYOUT_FONT_SCALE_MAX = 200;
export const LAYOUT_FONT_SCALE_DEFAULT = 100;

export function clampLayoutFontScale(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return LAYOUT_FONT_SCALE_DEFAULT;
  return Math.min(
    LAYOUT_FONT_SCALE_MAX,
    Math.max(LAYOUT_FONT_SCALE_MIN, Math.round(v))
  );
}

/** حقل مع حجم خط مكبّر/مصغّر حسب مقياس القالب */
export function fieldWithLayoutFontScale(field, layoutFontScale = 100) {
  if (!field) return field;
  const base = fieldDesignFontPx(field);
  const scaled = base * (clampLayoutFontScale(layoutFontScale) / 100);
  return {
    ...field,
    fontSize: Math.min(48, Math.max(8, Math.round(scaled))),
  };
}

/** مقياس خط الشاشة: عرض الحاوية / عرض صورة القالب */
export function screenFontScaleFromWidth(containerWidthPx, template) {
  const fontRef = getChequeFontReferenceWidth(template);
  if (!containerWidthPx || !fontRef) return 1;
  return containerWidthPx / fontRef;
}

/** @deprecated استخدم screenFontScaleFromWidth */
export function screenScaleFromWidth(containerWidthPx, template) {
  return screenFontScaleFromWidth(containerWidthPx, template);
}

/** mm للطباعة → px في معاينة ضبط الطباعة (نفس pxPerMm للصفحة) */
export function printFontSizeToPreviewPx(
  field,
  template,
  calib,
  fieldFontStyle,
  pxPerMm,
  fallbackMm = 3.2
) {
  const widthMm = Number(calib?.widthMm) || 0;
  const baseMm = field ? fieldFontSizeMm(field, template, widthMm) : fallbackMm;
  const mm = baseMm * getPrintFontSizeMultiplier(calib, fieldFontStyle);
  return mm * pxPerMm;
}

/** أبعاد صندوق الحقل على الشاشة — نفس مرجع خط الصورة (1024) */
export function fieldBoxScreenPx(field, template, layoutFontScale = 100, containerWidthPx) {
  const { width: imgW, height: imgH } = getChequeImageSize(template);
  const fontRef = imgW || 1024;
  const containerW = Number(containerWidthPx) > 0 ? Number(containerWidthPx) : fontRef;
  const scaledField = fieldWithLayoutFontScale(field, layoutFontScale);
  const containerH = containerW * (imgH / imgW);
  return {
    widthPx: ((scaledField?.width || 10) / 100) * containerW,
    heightPx: ((scaledField?.height || 8) / 100) * containerH,
    screenScale: containerW / fontRef,
  };
}

/** أبعاد صندوق الحقل بالـ px الإحداثيات (نفس نسبة الطباعة) */
export function fieldBoxDesignPx(field, template) {
  const { designWidth, designHeight } = getChequeDesignSize(template);
  return {
    widthPx: ((field?.width || 10) / 100) * designWidth,
    heightPx: ((field?.height || 8) / 100) * designHeight,
  };
}
