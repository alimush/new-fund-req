/** أبعاد ورقة الصك الفارغ في الطابعة (مم) */
export function getChequePrintDimensions(template) {
  const ar = String(template?.aspectRatio || "1024 / 470");
  const parts = ar.split("/").map((s) => parseFloat(s.trim()));
  const w = parts[0] || 1024;
  const h = parts[1] || 470;
  const designRatio = w / h;

  const widthMm = Number(template?.printWidthMm) || 182.2;
  const explicitHeight = Number(template?.printHeightMm);
  const heightMm =
    explicitHeight > 0
      ? explicitHeight
      : Math.round((widthMm / designRatio) * 10) / 10;

  return { widthMm, heightMm, ratio: widthMm / heightMm };
}
