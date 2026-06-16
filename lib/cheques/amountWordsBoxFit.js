import { shrinkAdjustments } from "@/lib/cheques/amountWordsPrintStyle";
import {
  fieldBoxScreenPx,
  fieldDesignFontPx,
  fieldWithLayoutFontScale,
} from "@/lib/cheques/chequeDesignMetrics";

/** مقاييس صندوق الإدخال الفعلي على الشاشة (من ref الحقل) */
export function readAmountWordsBoxMetrics(element, field, fontScale = 1) {
  if (!element || element.clientWidth <= 0) return null;
  return {
    widthPx: element.clientWidth,
    heightPx: element.clientHeight,
    maxFontPx: fieldDesignFontPx(field, 14) * fontScale,
  };
}

function resolveBoxMetrics(field, template, layoutFontScale, containerWidthPx, boxMetrics) {
  if (boxMetrics?.widthPx > 0) {
    return {
      widthPx: boxMetrics.widthPx,
      heightPx: Math.max(boxMetrics.heightPx || 0, 8),
      maxFontPx: boxMetrics.maxFontPx || fieldDesignFontPx(field, 14),
    };
  }

  const scaledField = fieldWithLayoutFontScale(field, layoutFontScale);
  const { widthPx, heightPx, screenScale } = fieldBoxScreenPx(
    scaledField,
    template,
    layoutFontScale,
    containerWidthPx
  );
  return {
    widthPx,
    heightPx,
    maxFontPx: fieldDesignFontPx(scaledField, 14) * screenScale,
  };
}

function probeOverflow(text, field, template, layoutFontScale, containerWidthPx, boxMetrics) {
  const val = String(text || "").trim();
  if (!val || !field) return false;

  const { widthPx, heightPx, maxFontPx } = resolveBoxMetrics(
    field,
    template,
    layoutFontScale,
    containerWidthPx,
    boxMetrics
  );
  const max = maxFontPx;
  const min = Math.max(7, max * 0.35);
  const adj = shrinkAdjustments(max, max, min);

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
  probe.style.fontSize = `${max}px`;
  probe.style.fontWeight = String(adj.fontWeight);
  probe.style.paddingTop = `${adj.paddingTop}px`;
  document.body.appendChild(probe);

  const overflows =
    probe.scrollWidth > probe.clientWidth + 1 ||
    probe.scrollHeight > probe.clientHeight + 1;

  document.body.removeChild(probe);
  return overflows;
}

/** هل النص يفيض صندوق السطر الأول عند أقصى حجم خط */
export function amountWordsOverflowsAtMaxFont(
  text,
  field,
  template,
  layoutFontScale = 100,
  containerWidthPx,
  boxMetrics = null
) {
  if (typeof document === "undefined" || !field || !template) return false;
  return probeOverflow(
    text,
    field,
    template,
    layoutFontScale,
    containerWidthPx,
    boxMetrics
  );
}

/**
 * يملأ السطر الأول كلمة كلمة حتى يمتلئ صندوق الإدخال، ثم ينقل الباقي للسطر الثاني.
 */
export function splitChequeAmountWordsToFit(
  full,
  line1Field,
  template,
  layoutFontScale = 100,
  containerWidthPx,
  boxMetrics = null
) {
  const text = String(full || "").trim();
  if (!text) return { line1: "", line2: "" };

  if (typeof document === "undefined" || !line1Field || !template) {
    return null;
  }

  const overflowOpts = {
    field: line1Field,
    template,
    layoutFontScale,
    containerWidthPx,
    boxMetrics,
  };

  const overflowsAt = (candidate) =>
    amountWordsOverflowsAtMaxFont(
      candidate,
      overflowOpts.field,
      overflowOpts.template,
      overflowOpts.layoutFontScale,
      overflowOpts.containerWidthPx,
      overflowOpts.boxMetrics
    );

  if (!overflowsAt(text)) {
    return { line1: text, line2: "" };
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { line1: text, line2: "" };
  }

  const line1Words = [];
  for (const word of words) {
    const candidate = line1Words.length ? `${line1Words.join(" ")} ${word}` : word;
    if (line1Words.length === 0 || !overflowsAt(candidate)) {
      line1Words.push(word);
      continue;
    }
    break;
  }

  const line1 = line1Words.join(" ");
  const line2 = words.slice(line1Words.length).join(" ");
  return { line1, line2 };
}
