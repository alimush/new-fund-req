/** أبعاد ورقة الصك الفارغ في الطابعة (مم) — حسب نسبة القالب */
export function getChequePrintDimensions(template) {
  const ar = String(template?.aspectRatio || "1024 / 470");
  const parts = ar.split("/").map((s) => parseFloat(s.trim()));
  const w = parts[0] || 1024;
  const h = parts[1] || 470;
  const ratio = w / h;

  const widthMm = Number(template?.printWidthMm) || 175;
  const heightMm = Math.round((widthMm / ratio) * 10) / 10;

  return { widthMm, heightMm, ratio };
}
