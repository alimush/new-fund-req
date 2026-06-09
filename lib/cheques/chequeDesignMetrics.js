import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";

/** عرض صورة القالب بالبكسل — مرجع لحجم الخط فقط */
export function getChequeFontReferenceWidth(template) {
  const ar = String(template?.aspectRatio || "1024 / 470");
  const parts = ar.split("/").map((s) => parseFloat(s.trim()));
  return parts[0] || 1024;
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

/** aspect-ratio CSS مطابق لورقة الطباعة */
export function getChequeAspectRatioCss(template) {
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
export function fieldFontSizeMm(field, template, printWidthMm) {
  const fontRef = getChequeFontReferenceWidth(template);
  return designPxToMm(fieldDesignFontPx(field), fontRef, printWidthMm);
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

/** أبعاد صندوق الحقل بالـ px الإحداثيات (نفس نسبة الطباعة) */
export function fieldBoxDesignPx(field, template) {
  const { designWidth, designHeight } = getChequeDesignSize(template);
  return {
    widthPx: ((field?.width || 10) / 100) * designWidth,
    heightPx: ((field?.height || 8) / 100) * designHeight,
  };
}
