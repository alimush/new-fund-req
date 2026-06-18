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

/** فيض العرض فقط — لا نُقسّم للسطر الثاني إلا عند امتلاء السطر الأول أفقياً */
function probeWidthOverflow(text, field, template, layoutFontScale, containerWidthPx, boxMetrics) {
  const val = String(text || "").trim();
  if (!val || !field) return false;

  const { widthPx, maxFontPx } = resolveBoxMetrics(
    field,
    template,
    layoutFontScale,
    containerWidthPx,
    boxMetrics
  );
  const weight = Number(field?.fontWeight) || 700;

  const probe = document.createElement("div");
  probe.dir = "rtl";
  probe.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${widthPx}px`,
    "white-space:nowrap",
    "overflow:hidden",
    "font-family:Cairo,sans-serif",
    "line-height:1.2",
    "box-sizing:border-box",
  ].join(";");
  probe.textContent = val;
  probe.style.fontSize = `${maxFontPx}px`;
  probe.style.fontWeight = String(weight);
  document.body.appendChild(probe);

  const overflows = probe.scrollWidth > probe.clientWidth + 1;

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
  return probeWidthOverflow(
    text,
    field,
    template,
    layoutFontScale,
    containerWidthPx,
    boxMetrics
  );
}

function maxWordsFittingLine(words, overflowsAt) {
  if (!words.length) return 0;
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = words.slice(0, mid).join(" ");
    if (!overflowsAt(candidate)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
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

  const fitCount = maxWordsFittingLine(words, overflowsAt);
  if (fitCount <= 0) {
    return { line1: words[0], line2: words.slice(1).join(" ") };
  }
  if (fitCount >= words.length) {
    return { line1: text, line2: "" };
  }

  const line1 = words.slice(0, fitCount).join(" ");
  const line2 = words.slice(fitCount).join(" ");
  return { line1, line2 };
}
