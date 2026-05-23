import { isCanvasField } from "@/lib/cheques/templates";
import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
import {
  fieldFontSizeMm,
  getChequeDesignSize,
} from "@/lib/cheques/chequeDesignMetrics";
import { slashPositionBetween } from "@/lib/cheques/dateUtils";
import { fieldWithTextLayout, layoutFromField } from "@/lib/cheques/textFieldLayout";

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

function renderFieldValue(f, values, amountWordsStyle, template, printWidthMm) {
  const key = f.key;
  const raw = values?.[key];
  if (raw == null || raw === "") return "";

  if (key === "amountWords" && amountWordsStyle) {
    const st = amountWordsStyle;
    return `<span class="amount-words" style="font-size:${st.fontSizeMm}mm;font-weight:${st.fontWeight};padding-top:${st.paddingTopMm}mm;color:${st.color}">${esc(raw)}</span>`;
  }

  const fsMm = fieldFontSizeMm(f, template, printWidthMm);
  const fw = `font-weight:${f.fontWeight || 800};`;
  const align =
    f.type === "amount" || key === "amountNumeric"
      ? "text-align:left;direction:ltr;"
      : "text-align:right;direction:rtl;";

  return `<span style="font-size:${fsMm}mm;${fw}${align}">${esc(raw)}</span>`;
}

/**
 * HTML للطباعة — نفس نسب المواضع % ونفس مقياس الخط كالشاشة (بدون صورة).
 */
export function buildChequePrintHtml({
  template,
  fields = [],
  values = {},
  dateShowSlashes = true,
  textFieldLayout = null,
  amountWordsStyle = null,
  title = "صك",
}) {
  const dims = getChequePrintDimensions(template);
  const { designWidth, designHeight } = getChequeDesignSize(template);
  const list = fields.length ? fields : template?.fields || [];
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));

  const staticFields = list.filter((f) => f.key !== TEXT_KEY && isCanvasField(f));

  const dateField = fieldByKey.dateDay;
  const slashFontMm = dateField
    ? fieldFontSizeMm(dateField, template, dims.widthMm)
    : 3.2;

  let slashesHtml = "";
  if (dateShowSlashes) {
    for (let i = 0; i < DATE_ORDER.length - 1; i++) {
      const a = fieldByKey[DATE_ORDER[i]];
      const b = fieldByKey[DATE_ORDER[i + 1]];
      const pos = slashPositionBetween(a, b);
      if (!pos) continue;
      slashesHtml += `<div class="slash" style="top:${pos.top}%;left:${pos.left}%;width:${pos.width}%;height:${pos.height}%;font-size:${slashFontMm}mm;">/</div>`;
    }
  }

  const fieldsHtml = staticFields
    .map((f) => {
      const inner = renderFieldValue(f, values, amountWordsStyle, template, dims.widthMm);
      if (!inner) return "";
      return `<div class="field ${f.type || "text"}" style="${fieldBoxStyle(f)}">${inner}</div>`;
    })
    .join("");

  const textBase = fieldByKey[TEXT_KEY];
  let textHtml = "";
  if (textBase && values?.[TEXT_KEY]) {
    const tf = fieldWithTextLayout(textBase, textFieldLayout || layoutFromField(textBase));
    const fsMm = fieldFontSizeMm(tf, template, dims.widthMm);
    textHtml = `<div class="field text-block" style="${fieldBoxStyle(tf)}"><span style="font-size:${fsMm}mm;font-weight:${tf.fontWeight || 700};text-align:right;direction:rtl;white-space:pre-wrap;line-height:1.2;">${esc(values[TEXT_KEY])}</span></div>`;
  }

  const safeTitle = esc(title);

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${safeTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    @page {
      size: ${dims.widthMm}mm ${dims.heightMm}mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: ${dims.widthMm}mm;
      height: ${dims.heightMm}mm;
      background: transparent !important;
    }
    .cheque-sheet {
      position: relative;
      width: ${dims.widthMm}mm;
      height: ${dims.heightMm}mm;
      aspect-ratio: ${designWidth} / ${designHeight};
      overflow: hidden;
      background: transparent !important;
      font-family: "Cairo", sans-serif;
      color: #0f172a;
    }
    .field {
      position: absolute;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      overflow: hidden;
      padding: 0;
      margin: 0;
      line-height: 1.2;
      background: transparent !important;
    }
    .field.datePart {
      align-items: center;
      justify-content: center;
    }
    .field.amount {
      align-items: center;
      justify-content: flex-start;
    }
    .field.textarea, .field.text-block {
      align-items: flex-start;
    }
    .amount-words {
      display: block;
      width: 100%;
      white-space: nowrap;
      text-align: right;
      direction: rtl;
      line-height: 1.2;
    }
    .slash {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      transform: translateX(-50%);
      pointer-events: none;
      line-height: 1;
    }
    @media screen {
      body { background: #f8fafc; }
      .cheque-sheet {
        margin: 12mm auto;
        outline: 1px dashed #94a3b8;
      }
    }
  </style>
</head>
<body>
  <div class="cheque-sheet">
    ${slashesHtml}
    ${fieldsHtml}
    ${textHtml}
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => { window.focus(); window.print(); }, 200);
    };
    window.onafterprint = () => {
      try { parent.postMessage({ type: "CHEQUE_PRINT_DONE" }, "*"); } catch (e) {}
    };
  </script>
</body>
</html>`;
}
