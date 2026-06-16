import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** تحويل % → mm على ورقة الصك */
export function percentToMm(valuePercent, totalMm) {
  return round2((Number(valuePercent) / 100) * Number(totalMm));
}

/** mm → % */
export function mmToPercent(valueMm, totalMm) {
  if (!totalMm) return 0;
  return round2((Number(valueMm) / Number(totalMm)) * 100);
}

/** موضع حقل بالمليمتر للعرض في لوحة التحكم */
export function fieldPositionMm(field, template) {
  const { widthMm, heightMm } = getChequePrintDimensions(template);
  return {
    xMm: percentToMm(field?.left, widthMm),
    yMm: percentToMm(field?.top, heightMm),
    widthMm: percentToMm(field?.width, widthMm),
    heightMm: percentToMm(field?.height, heightMm),
    sheetWidthMm: widthMm,
    sheetHeightMm: heightMm,
  };
}

export function formatMm(mm) {
  return round2(Number(mm) || 0).toFixed(2);
}
