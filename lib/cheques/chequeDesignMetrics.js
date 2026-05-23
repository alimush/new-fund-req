/** مقاييس تصميم القالب — للمحاذاة بين الشاشة والطباعة */

export function getChequeDesignSize(template) {
  const ar = String(template?.aspectRatio || "1024 / 470");
  const parts = ar.split("/").map((s) => parseFloat(s.trim()));
  return {
    designWidth: parts[0] || 1024,
    designHeight: parts[1] || 470,
  };
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

/** mm للطباعة من حقل */
export function fieldFontSizeMm(field, template, printWidthMm) {
  const { designWidth } = getChequeDesignSize(template);
  return designPxToMm(fieldDesignFontPx(field), designWidth, printWidthMm);
}

/** مقياس الشاشة: عرض الحاوية / عرض التصميم */
export function screenScaleFromWidth(containerWidthPx, template) {
  const { designWidth } = getChequeDesignSize(template);
  if (!containerWidthPx || !designWidth) return 1;
  return containerWidthPx / designWidth;
}

/** أبعاد صندوق الحقل بالـ px التصميم */
export function fieldBoxDesignPx(field, template) {
  const { designWidth, designHeight } = getChequeDesignSize(template);
  return {
    widthPx: ((field?.width || 10) / 100) * designWidth,
    heightPx: ((field?.height || 8) / 100) * designHeight,
  };
}
