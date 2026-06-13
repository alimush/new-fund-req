import { isCanvasField } from "@/lib/cheques/templates";
import { fieldFontSizeMm } from "@/lib/cheques/chequeDesignMetrics";
import {
  fieldOffsetCss,
  fullPageImagePrintCalib,
  getFieldFontStyle,
  normalizePrintCalib,
} from "@/lib/cheques/printCalib";
import { slashPositionBetween } from "@/lib/cheques/dateUtils";
import { fieldWithTextLayout, layoutFromField } from "@/lib/cheques/textFieldLayout";
import {
  chequePrintPageCss,
  chequePrintReadyScript,
} from "@/lib/cheques/chequePrintPageStyles";

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";

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

function renderFieldValue(f, values, amountWordsStyle, template, printWidthMm, calib) {
  const key = f.key;
  const raw = values?.[key];
  if (raw == null || raw === "") return "";

  const fontStyle = getFieldFontStyle(calib, key, f);
  const baseFsMm = fieldFontSizeMm(f, template, printWidthMm);
  const fsMm = baseFsMm * (fontStyle.fontSizeScale / 100);

  if (key === "amountWords" && amountWordsStyle) {
    const st = amountWordsStyle;
    return `<span class="amount-words" style="font-size:${fsMm || st.fontSizeMm}mm;font-weight:${fontStyle.fontWeight};padding-top:${st.paddingTopMm}mm;color:${st.color}">${esc(raw)}</span>`;
  }

  const fw = `font-weight:${fontStyle.fontWeight};`;
  let valClass = "val-text";
  let extra = "text-align:right;direction:rtl;";
  if (f.type === "amount" || key === "amountNumeric") {
    valClass = "val-amount";
    extra = "";
  } else if (f.type === "datePart") {
    valClass = "val-date";
    extra = "";
  }

  return `<span class="${valClass}" style="font-size:${fsMm}mm;${fw}${extra}">${esc(raw)}</span>`;
}

function slashFontMm(calib, dateField, template, printWidthMm) {
  const fontStyle = getFieldFontStyle(calib, "date", dateField);
  const base = dateField ? fieldFontSizeMm(dateField, template, printWidthMm) : 3.2;
  return base * (fontStyle.fontSizeScale / 100);
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
  amountWordsStyle = null,
  title = "صك",
  imageUrl = null,
  printCalib = null,
}) {
  const list = fields.length ? fields : template?.fields || [];
  const calib = imageUrl
    ? fullPageImagePrintCalib(printCalib, template, list)
    : normalizePrintCalib(printCalib, template, list);
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));

  const staticFields = list.filter((f) => f.key !== TEXT_KEY && isCanvasField(f));

  const dateField = fieldByKey.dateDay;
  const slashFsMm = slashFontMm(calib, dateField, template, calib.widthMm);
  const slashFw = getFieldFontStyle(calib, "date", dateField).fontWeight;

  let slashesHtml = "";
  if (dateShowSlashes) {
    for (let i = 0; i < DATE_ORDER.length - 1; i++) {
      const a = fieldByKey[DATE_ORDER[i]];
      const b = fieldByKey[DATE_ORDER[i + 1]];
      const pos = slashPositionBetween(a, b);
      if (!pos) continue;
      const slashKey = `slash_${i}`;
      slashesHtml += `<div class="slash" style="top:${pos.top}%;left:${pos.left}%;width:${pos.width}%;height:${pos.height}%;font-size:${slashFsMm}mm;font-weight:${slashFw};${fieldOffsetCss(calib, slashKey)}">/</div>`;
    }
  }

  const fieldsHtml = staticFields
    .map((f) => {
      const inner = renderFieldValue(
        f,
        values,
        amountWordsStyle,
        template,
        calib.widthMm,
        calib
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
      fieldFontSizeMm(tf, template, calib.widthMm) * (textFont.fontSizeScale / 100);
    textHtml = `<div class="field text-block" style="${fieldBoxStyle(tf)};${fieldOffsetCss(calib, TEXT_KEY)}"><span style="font-size:${fsMm}mm;font-weight:${textFont.fontWeight};text-align:right;direction:rtl;white-space:pre-wrap;line-height:1.2;">${esc(values[TEXT_KEY])}</span></div>`;
  }

  const safeTitle = esc(title || "صك");
  const safeImageUrl = imageUrl ? esc(imageUrl) : "";
  const bgImgHtml = safeImageUrl
    ? `<img class="cheque-bg" src="${safeImageUrl}" alt="" crossorigin="anonymous" />`
    : "";

  const overlayHtml = `${slashesHtml}${fieldsHtml}${textHtml}`;

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

/** HTML لطباعة صورة القالب فقط — بدون بيانات (للتجربة والمعايرة) */
export function buildChequeImageOnlyPrintHtml({
  template,
  title = "صك",
  imageUrl = null,
  printCalib = null,
  fields = [],
}) {
  const list = fields.length ? fields : template?.fields || [];
  const calib = fullPageImagePrintCalib(printCalib, template, list);
  const safeTitle = esc(title);
  const src = imageUrl || (template?.image ? esc(template.image) : "");
  if (!src) return "";

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${safeTitle}</title>
  <style>
    ${chequePrintPageCss(calib)}
    .cheque-sheet { background: #fff !important; }
  </style>
</head>
<body>
  <div class="page-root">
  <div class="cheque-sheet">
    <div class="cheque-inner">
      <img class="cheque-bg" src="${esc(src)}" alt="" crossorigin="anonymous" />
    </div>
  </div>
  </div>
  ${chequePrintReadyScript()}
</body>
</html>`;
}
