/** حجم منطقة الصك على الورقة — أفقي: 17.80 × 8.20 سم */
export const CHEQUE_PAGE_WIDTH_MM = 178;
export const CHEQUE_PAGE_HEIGHT_MM = 82;

/** ورقة A4 للطباعة — Landscape (عرضي) + Scale Default */
export const A4_WIDTH_MM = 297;
export const A4_HEIGHT_MM = 210;

export function getChequePageSize() {
  return {
    pageWidthMm: CHEQUE_PAGE_WIDTH_MM,
    pageHeightMm: CHEQUE_PAGE_HEIGHT_MM,
  };
}

export function getA4PaperSize() {
  return {
    pageWidthMm: A4_WIDTH_MM,
    pageHeightMm: A4_HEIGHT_MM,
  };
}

export function chequePageSizeCss() {
  return `${CHEQUE_PAGE_WIDTH_MM}mm ${CHEQUE_PAGE_HEIGHT_MM}mm`;
}

export function a4PageSizeCss() {
  return `${A4_WIDTH_MM}mm ${A4_HEIGHT_MM}mm`;
}

/** تحويل مم إلى نقاط PDF (pt) */
export function mmToPdfPoints(mm) {
  return (Number(mm) / 25.4) * 72;
}

/** عرض بالبكسل عند 96dpi — للتصيير قبل التقاط الصورة */
export function mmToScreenPx(mm) {
  return Math.round((Number(mm) / 25.4) * 96);
}
