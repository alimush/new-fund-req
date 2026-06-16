import { isCanvasField } from "@/lib/cheques/templates";
import { fieldFontSizeMm } from "@/lib/cheques/chequeDesignMetrics";
import {
  fieldOffsetCss,
  fullPageImagePrintCalib,
  getFieldFontStyle,
  getPrintFontSizeMultiplier,
  normalizePrintCalib,
} from "@/lib/cheques/printCalib";
import { slashPositionBetween } from "@/lib/cheques/dateUtils";
import { fieldWithTextLayout, fieldWithChequePosition, layoutFromField, AMOUNT_WORDS_KEY, AMOUNT_WORDS_LINE2_KEY } from "@/lib/cheques/textFieldLayout";
import {
  chequePrintPageCss,
  chequePrintReadyScript,
  chequeStackedCopiesPageCss,
  chequeStackedCopiesPageCssFromItems,
  normalizeWizardTestCopyCount,
  WIZARD_TEST_COPY_DEFAULT,
} from "@/lib/cheques/chequePrintPageStyles";
import {
  attachWizardCopyLayouts,
  ensureWizardCopyLayouts,
  wizardCopyLayoutsToPrintItems,
} from "@/lib/cheques/wizardCopyLayouts";

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";
const PER_CHEQUE_KEYS = new Set([TEXT_KEY, AMOUNT_WORDS_KEY, AMOUNT_WORDS_LINE2_KEY]);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldBoxStyle(f) {
  return [
    `top:${f.top}%`,
    `left:${f.left}%`,
    `width:${f.width}%`,
    `height:${f.height}%`,
  ].join(";");
}

function renderFieldValue(
  f,
  values,
  amountWordsStyle,
  amountWordsLine2Style,
  template,
  printWidthMm,
  calib,
  layoutFontScale
) {
  const key = f.key;
  const raw = values?.[key];
  if (raw == null || raw === "") return "";

  const fontStyle = getFieldFontStyle(calib, key, f);
  const baseFsMm = fieldFontSizeMm(f, template, printWidthMm, layoutFontScale);
  const fsMm = baseFsMm * getPrintFontSizeMultiplier(calib, fontStyle);

  if (key === "amountWords" && amountWordsStyle) {
    const st = amountWordsStyle;
    const amountFsMm = st.fontSizeMm * getPrintFontSizeMultiplier(calib, fontStyle);
    const color = fontStyle.color || st.color || "#0f172a";
    return `<span class="amount-words" style="font-size:${amountFsMm || fsMm}mm;font-weight:${fontStyle.fontWeight};padding-top:${st.paddingTopMm}mm;color:${color}">${esc(raw)}</span>`;
  }

  if (key === "amountWordsLine2" && amountWordsLine2Style) {
    const st = amountWordsLine2Style;
    const amountFsMm = st.fontSizeMm * getPrintFontSizeMultiplier(calib, fontStyle);
    const color = fontStyle.color || st.color || "#0f172a";
    return `<span class="amount-words" style="font-size:${amountFsMm || fsMm}mm;font-weight:${fontStyle.fontWeight};padding-top:${st.paddingTopMm}mm;color:${color}">${esc(raw)}</span>`;
  }

  const fw = `font-weight:${fontStyle.fontWeight};`;
  const colorStyle = `color:${fontStyle.color};`;
  let valClass = "val-text";
  let extra = "text-align:right;direction:rtl;";
  if (f.type === "amount" || key === "amountNumeric") {
    valClass = "val-amount";
    extra = "";
  } else if (f.type === "datePart") {
    valClass = "val-date";
    extra = "";
  }

  return `<span class="${valClass}" style="font-size:${fsMm}mm;${fw}${colorStyle}${extra}">${esc(raw)}</span>`;
}

function slashFontMm(calib, dateField, template, printWidthMm, layoutFontScale) {
  const fontStyle = getFieldFontStyle(calib, "date", dateField);
  const base = dateField
    ? fieldFontSizeMm(dateField, template, printWidthMm, layoutFontScale)
    : 3.2;
  return base * getPrintFontSizeMultiplier(calib, fontStyle);
}

/**
 * HTML للطباعة — نفس نسب المواضع % ونفس مقياس الخط كالشاشة (بيانات فقط).
 */
export function buildChequePrintHtml({
  template,
  fields = [],
  values = {},
  dateShowSlashes = true,
  textFieldLayout = null,
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  amountWordsStyle = null,
  amountWordsLine2Style = null,
  title = "صك",
  imageUrl = null,
  printCalib = null,
  layoutFontScale = 100,
}) {
  const list = fields.length ? fields : template?.fields || [];
  const calib = imageUrl
    ? fullPageImagePrintCalib(printCalib, template, list)
    : normalizePrintCalib(printCalib, template, list);
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));

  const staticFields = list.filter((f) => !PER_CHEQUE_KEYS.has(f.key) && isCanvasField(f));

  const dateField = fieldByKey.dateDay;
  const slashFsMm = slashFontMm(calib, dateField, template, calib.widthMm, layoutFontScale);
  const slashStyle = getFieldFontStyle(calib, "date", dateField);
  const slashFw = slashStyle.fontWeight;
  const slashColor = slashStyle.color;

  let slashesHtml = "";
  if (dateShowSlashes) {
    for (let i = 0; i < DATE_ORDER.length - 1; i++) {
      const a = fieldByKey[DATE_ORDER[i]];
      const b = fieldByKey[DATE_ORDER[i + 1]];
      const pos = slashPositionBetween(a, b);
      if (!pos) continue;
      const slashKey = `slash_${i}`;
      slashesHtml += `<div class="slash" style="top:${pos.top}%;left:${pos.left}%;width:${pos.width}%;height:${pos.height}%;font-size:${slashFsMm}mm;font-weight:${slashFw};color:${slashColor};${fieldOffsetCss(calib, slashKey)}">/</div>`;
    }
  }

  const fieldsHtml = staticFields
    .map((f) => {
      const inner = renderFieldValue(
        f,
        values,
        amountWordsStyle,
        amountWordsLine2Style,
        template,
        calib.widthMm,
        calib,
        layoutFontScale
      );
      if (!inner) return "";
      return `<div class="field ${f.type || "text"}" style="${fieldBoxStyle(f)};${fieldOffsetCss(calib, f.key)}">${inner}</div>`;
    })
    .join("");

  const textBase = fieldByKey[TEXT_KEY];
  let textHtml = "";
  if (textBase && values?.[TEXT_KEY]) {
    const tf = fieldWithTextLayout(textBase, textFieldLayout || layoutFromField(textBase));
    const textFont = getFieldFontStyle(calib, TEXT_KEY, tf);
    const fsMm =
      fieldFontSizeMm(tf, template, calib.widthMm, layoutFontScale) *
      getPrintFontSizeMultiplier(calib, textFont);
    textHtml = `<div class="field text-block" style="${fieldBoxStyle(tf)};${fieldOffsetCss(calib, TEXT_KEY)}"><span style="font-size:${fsMm}mm;font-weight:${textFont.fontWeight};color:${textFont.color};text-align:right;direction:rtl;white-space:pre-wrap;line-height:1.2;">${esc(values[TEXT_KEY])}</span></div>`;
  }

  function resolveAmountWordsPrintField(fieldBase, layout) {
    if (!fieldBase) return null;
    const base = layout
      ? fieldWithChequePosition(fieldBase, layout)
      : fieldBase;
    if (layout && (layout.fontSize != null || layout.fontWeight != null)) {
      return {
        ...base,
        fontSize: layout.fontSize ?? base.fontSize,
        fontWeight: layout.fontWeight ?? base.fontWeight,
      };
    }
    return base;
  }

  function renderPerChequeLineHtml(fieldBase, layout, value, key) {
    if (!fieldBase || !value) return "";
    const f = resolveAmountWordsPrintField(fieldBase, layout);
    const inner = renderFieldValue(
      f,
      { ...values, [key]: value },
      amountWordsStyle,
      amountWordsLine2Style,
      template,
      calib.widthMm,
      calib,
      layoutFontScale
    );
    if (!inner) return "";
    return `<div class="field ${f.type || "text"}" style="${fieldBoxStyle(f)};${fieldOffsetCss(calib, key)}">${inner}</div>`;
  }

  const amountWordsHtml = renderPerChequeLineHtml(
    fieldByKey[AMOUNT_WORDS_KEY],
    amountWordsLayout,
    values?.amountWords,
    AMOUNT_WORDS_KEY
  );
  const amountWordsLine2Html = renderPerChequeLineHtml(
    fieldByKey[AMOUNT_WORDS_LINE2_KEY],
    amountWordsLine2Layout,
    values?.amountWordsLine2,
    AMOUNT_WORDS_LINE2_KEY
  );

  const safeTitle = esc(title || "صك");
  const safeImageUrl = imageUrl ? esc(imageUrl) : "";
  const bgImgHtml = safeImageUrl
    ? `<div class="cheque-bg" style="background-image:url('${safeImageUrl}');"></div><img src="${safeImageUrl}" alt="" crossorigin="anonymous" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;" aria-hidden="true" />`
    : "";

  const overlayHtml = `${slashesHtml}${fieldsHtml}${amountWordsHtml}${amountWordsLine2Html}${textHtml}`;

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${safeTitle}</title>
  <style>${chequePrintPageCss(calib)}</style>
</head>
<body>
  <div class="page-root">
  <div class="cheque-sheet">
    <div class="cheque-inner">
      ${bgImgHtml}
      <div class="data-overlay">
        ${overlayHtml}
      </div>
    </div>
  </div>
  </div>
  ${chequePrintReadyScript()}
</body>
</html>`;
}

/** HTML لطباعة صورة القالب فقط — بدون بيانات (نفس مواضع معايرة Wizard بدون علامات REF) */
export function buildChequeImageOnlyPrintHtml({
  template,
  title = "صك",
  imageUrl = null,
  printCalib = null,
  fields = [],
  copyCount = WIZARD_TEST_COPY_DEFAULT,
}) {
  const list = fields.length ? fields : template?.fields || [];
  const copies = normalizeWizardTestCopyCount(copyCount);
  const calibWithLayouts = attachWizardCopyLayouts(printCalib, template, list, copies);
  const calib = normalizePrintCalib(calibWithLayouts, template, list);
  const layouts = ensureWizardCopyLayouts(calibWithLayouts, copies, template, list);
  const items = wizardCopyLayoutsToPrintItems(layouts, copies);
  const safeTitle = esc(title);
  const src = imageUrl || (template?.image ? esc(template.image) : "");
  if (!src) return "";

  const sheetsHtml = Array.from({ length: copies }, (_, i) => {
    const copyIndex = i + 1;
    const copyAttr = copies > 1 ? ` data-copy="${copyIndex}"` : "";
    const preloadImg = `<img src="${esc(src)}" alt="" crossorigin="anonymous" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;" aria-hidden="true" />`;
    return `
    <div class="cheque-sheet"${copyAttr}>
      <div class="cheque-inner">
        <div class="cheque-bg" style="background-image:url('${esc(src)}');"></div>
        ${preloadImg}
      </div>
    </div>`;
  }).join("");

  const pageCss =
    copies > 1 && items.length
      ? chequeStackedCopiesPageCssFromItems(items)
      : copies > 1
      ? chequeStackedCopiesPageCss(calib, copies)
      : chequePrintPageCss(calib);

  const printHint =
    copies > 1
      ? `<div class="print-hint">طباعة الصك — <strong>${copies} نسخ</strong> — <strong>A4 أفقي</strong> و<strong>مقياس 100%</strong></div>`
      : "";

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${safeTitle}</title>
  <style>
    ${pageCss}
    .cheque-sheet { background: #fff !important; }
    .cheque-bg {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      width: 100% !important; height: 100% !important;
      background-repeat: no-repeat; background-position: center center;
      background-size: 100% 100%; z-index: 0; pointer-events: none;
    }
  </style>
</head>
<body>
  ${printHint}
  <div class="page-root">
    ${sheetsHtml}
  </div>
  ${chequePrintReadyScript()}
</body>
</html>`;
}
