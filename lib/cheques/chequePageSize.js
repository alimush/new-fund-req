/** حجم ورقة الصك في الطابعة — أفقي: 18.22 × 9 سم */
export const CHEQUE_PAGE_WIDTH_MM = 182.2;
export const CHEQUE_PAGE_HEIGHT_MM = 90;

export function getChequePageSize() {
  return {
    pageWidthMm: CHEQUE_PAGE_WIDTH_MM,
    pageHeightMm: CHEQUE_PAGE_HEIGHT_MM,
  };
}

export function chequePageSizeCss() {
  return `${CHEQUE_PAGE_WIDTH_MM}mm ${CHEQUE_PAGE_HEIGHT_MM}mm`;
}

/** تحويل مم إلى نقاط PDF (pt) */
export function mmToPdfPoints(mm) {
  return (Number(mm) / 25.4) * 72;
}

/** عرض بالبكسل عند 96dpi — للتصيير قبل التقاط الصورة */
export function mmToScreenPx(mm) {
  return Math.round((Number(mm) / 25.4) * 96);
}
