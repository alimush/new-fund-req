import { getChequePageSize } from "@/lib/cheques/chequePageSize";

/** أبعاد ورقة الصك الفارغ في الطابعة (مم) */
export function getChequePrintDimensions(template) {
  const { pageWidthMm, pageHeightMm } = getChequePageSize();

  const widthMm = Number(template?.printWidthMm) || pageWidthMm;
  const explicitHeight = Number(template?.printHeightMm);
  const heightMm = explicitHeight > 0 ? explicitHeight : pageHeightMm;

  return { widthMm, heightMm, ratio: widthMm / heightMm };
}
