import { normalizePrintCalib } from "@/lib/cheques/printCalib";
import {
  chequePrintPageCss,
  chequePrintReadyScript,
  chequeStackedCopiesPageCss,
  chequeStackedCopiesPageCssFromItems,
  normalizeWizardTestCopyCount,
  WIZARD_TEST_COPY_DEFAULT,
} from "@/lib/cheques/chequePrintPageStyles";
import { getChequePageSize } from "@/lib/cheques/chequePageSize";
import {
  attachWizardCopyLayouts,
  ensureWizardCopyLayouts,
  wizardCopyLayoutsToPrintItems,
} from "@/lib/cheques/wizardCopyLayouts";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const crosshairCss = `
  .calib-cross {
    position: absolute; pointer-events: none; z-index: 5;
  }
  .calib-cross-h {
    height: 0; border-top: 0.3mm solid #dc2626; left: 0; right: 0;
  }
  .calib-cross-v {
    width: 0; border-left: 0.3mm solid #dc2626; top: 0; bottom: 0;
  }
  .calib-mark {
    position: absolute; z-index: 6; font-size: 2.8mm; font-weight: 800;
    color: #dc2626; background: rgba(255,255,255,0.85); padding: 0.5mm 1mm;
    border: 0.2mm solid #dc2626; white-space: nowrap;
  }
  .calib-corner {
    position: absolute; width: 8mm; height: 8mm; border: 0.4mm solid #2563eb;
    z-index: 4; pointer-events: none;
  }
  .cheque-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    width: 100% !important; height: 100% !important;
    background-repeat: no-repeat; background-position: center center;
    background-size: 100% 100%; z-index: 0; pointer-events: none;
  }
`;

function buildCalibSheetInnerHtml({ w, h, imageUrl, copyIndex, copyCount }) {
  const marks = [
    { x: 5, y: 5, label: "REF 5,5" },
    { x: w / 2, y: h / 2, label: `REF ${(w / 2).toFixed(1)},${(h / 2).toFixed(1)}` },
    { x: w - 5, y: h - 5, label: `REF ${(w - 5).toFixed(1)},${(h - 5).toFixed(1)}` },
    { x: 50, y: 20, label: "REF 50,20" },
  ];

  const corners = [
    { top: 0, left: 0, borderWidth: "0.4mm 0 0 0.4mm" },
    { top: 0, right: 0, borderWidth: "0.4mm 0.4mm 0 0" },
    { bottom: 0, left: 0, borderWidth: "0 0 0.4mm 0.4mm" },
    { bottom: 0, right: 0, borderWidth: "0 0.4mm 0.4mm 0" },
  ];

  const cornerHtml = corners
    .map(
      (c) =>
        `<div class="calib-corner" style="top:${c.top ?? "auto"};left:${c.left ?? "auto"};right:${c.right ?? "auto"};bottom:${c.bottom ?? "auto"};border-style:solid;border-color:#2563eb;border-width:${c.borderWidth};"></div>`
    )
    .join("");

  const markHtml = marks
    .map(
      (m) =>
        `<div class="calib-mark" style="left:${m.x}mm;top:${m.y}mm;transform:translate(-50%,-50%);">${esc(m.label)}</div>`
    )
    .join("");

  const safeImageUrl = imageUrl ? esc(imageUrl) : "";
  const bgHtml = safeImageUrl
    ? `<div class="cheque-bg" style="background-image:url('${safeImageUrl}');"></div>${
        copyCount > 1
          ? `<img src="${safeImageUrl}" alt="" crossorigin="anonymous" style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;" aria-hidden="true" />`
          : ""
      }`
    : "";

  const copyLabel =
    copyCount > 1
      ? `<div class="calib-mark" style="left:${Math.max(2, w - 28)}mm;top:2mm;font-size:2.4mm;">نسخة ${copyIndex}</div>`
      : "";

  return `
        ${bgHtml}
        <div class="calib-cross calib-cross-h" style="top:50%;"></div>
        <div class="calib-cross calib-cross-v" style="left:50%;"></div>
        ${cornerHtml}
        ${markHtml}
        ${copyLabel}
        <div class="calib-mark" style="left:2mm;top:${h - 3}mm;font-size:2.2mm;">
          معايرة A4 — ${w.toFixed(1)}×${h.toFixed(1)} mm — Scale 100%
        </div>`;
}

/** PDF/HTML تجريبي للمعايرة — خطوط متقاطعة وعلامات REF */
export function buildCalibTestPrintHtml({
  template,
  printCalib = null,
  fields = [],
  imageUrl = null,
  title = "معايرة الطابعة",
  copyCount = WIZARD_TEST_COPY_DEFAULT,
}) {
  const list = fields.length ? fields : template?.fields || [];
  const copies = normalizeWizardTestCopyCount(copyCount);
  const calibWithLayouts = attachWizardCopyLayouts(printCalib, template, list, copies);
  const calib = normalizePrintCalib(calibWithLayouts, template, list);
  const { pageWidthMm, pageHeightMm } = getChequePageSize();
  const layouts = ensureWizardCopyLayouts(calibWithLayouts, copies, template, list);
  const items = wizardCopyLayoutsToPrintItems(layouts, copies);

  const sheetsHtml = Array.from({ length: copies }, (_, i) => {
    const copyIndex = i + 1;
    const layout = layouts[String(copyIndex)];
    const w = layout?.widthMm || calib.widthMm || pageWidthMm;
    const h = layout?.heightMm || calib.heightMm || pageHeightMm;
    const copyAttr = copies > 1 ? ` data-copy="${copyIndex}"` : "";
    return `
    <div class="cheque-sheet"${copyAttr}>
      <div class="cheque-inner">
        ${buildCalibSheetInnerHtml({ w, h, imageUrl, copyIndex, copyCount: copies })}
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
      ? `<div class="print-hint">معايرة Wizard — <strong>${copies} نسخ</strong> — مواضعك المحفوظة — <strong>A4 أفقي</strong> و<strong>مقياس 100%</strong></div>`
      : "";

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)}</title>
  <style>
    ${pageCss}
    ${crosshairCss}
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
