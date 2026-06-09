import { shrinkAdjustments } from "@/lib/cheques/amountWordsPrintStyle";
import {
  fieldBoxDesignPx,
  fieldDesignFontPx,
  getChequeFontReferenceWidth,
} from "@/lib/cheques/chequeDesignMetrics";

/**
 * قياس المبلغ كتابة بنفس منطق الشاشة — بوحدات px التصميم ثم تحويل للطباعة.
 */
export function measureAmountWordsForPrint(text, field, template, printWidthMm) {
  const empty = { fontSizePx: 14, fontWeight: 700, paddingTopPx: 0, color: "#0f172a" };

  if (typeof document === "undefined" || !field || !template) {
    return { ...empty, fontSizeMm: 3.8, paddingTopMm: 0 };
  }

  const val = String(text || "").trim();
  if (!val) {
    return { ...empty, fontSizeMm: 0, paddingTopMm: 0 };
  }

  const { widthPx, heightPx } = fieldBoxDesignPx(field, template);
  const max = fieldDesignFontPx(field, 14);
  const min = 7;
  let chosen = min;

  const probe = document.createElement("div");
  probe.dir = "rtl";
  probe.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${widthPx}px`,
    `height:${heightPx}px`,
    "white-space:nowrap",
    "overflow:hidden",
    "font-family:Cairo,sans-serif",
    "line-height:1.2",
    "box-sizing:border-box",
  ].join(";");
  probe.textContent = val;
  document.body.appendChild(probe);

  for (let size = max; size >= min; size -= 0.5) {
    const adj = shrinkAdjustments(size, max, min);
    probe.style.fontSize = `${size}px`;
    probe.style.fontWeight = String(adj.fontWeight);
    probe.style.paddingTop = `${adj.paddingTop}px`;
    probe.style.color = adj.color;
    const overflowsW = probe.scrollWidth > probe.clientWidth + 1;
    const overflowsH = probe.scrollHeight > probe.clientHeight + 1;
    if (!overflowsW && !overflowsH) {
      chosen = size;
      break;
    }
    chosen = size;
  }

  document.body.removeChild(probe);
  const adj = shrinkAdjustments(chosen, max, min);
  const fontRef = getChequeFontReferenceWidth(template);
  const toMm = (px) => (px / fontRef) * printWidthMm;

  return {
    fontSizePx: chosen,
    fontWeight: adj.fontWeight,
    paddingTopPx: adj.paddingTop,
    color: adj.color,
    fontSizeMm: Math.round(toMm(chosen) * 100) / 100,
    paddingTopMm: Math.round(toMm(adj.paddingTop) * 100) / 100,
  };
}
