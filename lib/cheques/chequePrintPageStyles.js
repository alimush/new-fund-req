import { getA4PaperSize, a4PageSizeCss } from "@/lib/cheques/chequePageSize";
import {
  chequeSheetBoundsMm,
  chequeSheetTransformCss,
  normalizeSheetFlip,
  normalizeSheetRotationDeg,
} from "@/lib/cheques/printCalib";

export const WIZARD_TEST_COPY_MIN = 1;
export const WIZARD_TEST_COPY_MAX = 3;
export const WIZARD_TEST_COPY_DEFAULT = 3;

export function normalizeWizardTestCopyCount(val) {
  const n = Math.round(Number(val) || WIZARD_TEST_COPY_DEFAULT);
  return Math.min(WIZARD_TEST_COPY_MAX, Math.max(WIZARD_TEST_COPY_MIN, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function numOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function stackedSheetTransformCss(calib, extraRotationDeg = 0) {
  const rot = normalizeSheetRotationDeg(calib?.sheetRotationDeg) + Number(extraRotationDeg || 0);
  const fh = normalizeSheetFlip(calib?.flipHorizontal) ? -1 : 1;
  const fv = normalizeSheetFlip(calib?.flipVertical) ? -1 : 1;
  const parts = [];
  if (rot) parts.push(`rotate(${rot}deg)`);
  if (fh !== 1 || fv !== 1) parts.push(`scale(${fh}, ${fv})`);
  if (!parts.length) return "";
  return `transform:${parts.join(" ")};transform-origin:top left;`;
}

/** تخطيط نسخ الصك على ورقة A4 واحدة */
export function stackedChequeCopyLayout(calib, copyCount) {
  const copies = normalizeWizardTestCopyCount(copyCount);
  const pageTopMm = numOr(calib?.pageTopMm, 0);
  const pageLeftMm = numOr(calib?.pageLeftMm, 0);
  const widthMm = numOr(calib?.widthMm, 178);
  const heightMm = numOr(calib?.heightMm, 82);

  if (copies === 3) {
    const sideLeftMm = round2(pageLeftMm + widthMm + heightMm);
    return [
      { copy: 1, topMm: round2(pageTopMm), leftMm: round2(pageLeftMm), widthMm, heightMm, extraRotationDeg: 0 },
      { copy: 2, topMm: round2(pageTopMm + heightMm), leftMm: round2(pageLeftMm), widthMm, heightMm, extraRotationDeg: 0 },
      { copy: 3, topMm: round2(pageTopMm), leftMm: sideLeftMm, widthMm, heightMm, extraRotationDeg: 90 },
    ];
  }

  const stepMm = chequeSheetBoundsMm(calib).heightMm;
  return Array.from({ length: copies }, (_, i) => ({
    copy: i + 1,
    topMm: round2(pageTopMm + i * stepMm),
    leftMm: round2(pageLeftMm),
    widthMm,
    heightMm,
    extraRotationDeg: 0,
  }));
}

export function chequeStackedCopiesCss(calib, copyCount) {
  const layout = stackedChequeCopyLayout(calib, copyCount);
  const ruleFor = (item, important = false) => {
    const imp = important ? " !important" : "";
    const transform = stackedSheetTransformCss(calib, item.extraRotationDeg);
    return `
    .cheque-sheet[data-copy="${item.copy}"] {
      top: ${item.topMm}mm${imp};
      left: ${item.leftMm}mm${imp};
      width: ${item.widthMm}mm${imp};
      height: ${item.heightMm}mm${imp};
      ${transform}
    }`;
  };
  return `${layout.map((item) => ruleFor(item, false)).join("")}
    @media print {
      ${layout.map((item) => ruleFor(item, true)).join("")}
    }`;
}

const stackedInnerStyles = `
  .cheque-inner { position: absolute; inset: 0; overflow: visible; }
  .cheque-sheet {
    position: absolute;
    overflow: visible;
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    background: #fff !important;
  }
`;

export function chequeStackedCopiesCssFromItems(items = []) {
  const ruleFor = (item, important = false) => {
    const imp = important ? " !important" : "";
    const transform = stackedSheetTransformCss(
      {
        sheetRotationDeg: item.sheetRotationDeg,
        flipHorizontal: item.flipHorizontal,
        flipVertical: item.flipVertical,
      },
      0
    );
    return `
    .cheque-sheet[data-copy="${item.copy}"] {
      top: ${item.topMm}mm${imp};
      left: ${item.leftMm}mm${imp};
      width: ${item.widthMm}mm${imp};
      height: ${item.heightMm}mm${imp};
      ${transform}
    }`;
  };
  return `${items.map((item) => ruleFor(item, false)).join("")}
    @media print {
      ${items.map((item) => ruleFor(item, true)).join("")}
    }`;
}

/** صفحة A4 مع مواضع نسخ مخصّصة */
export function chequeStackedCopiesPageCssFromItems(items) {
  const { pageWidthMm, pageHeightMm } = getA4PaperSize();
  return `
    @page { size: A4 landscape; margin: 0; }
    @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${pageWidthMm}mm !important;
      height: ${pageHeightMm}mm !important;
      overflow: visible !important;
      background: #fff !important;
    }
    .page-root {
      position: relative;
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      overflow: visible;
      background: #fff;
    }
    .print-hint {
      position: fixed;
      top: 8px;
      left: 8px;
      right: 8px;
      z-index: 9999;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      font: 600 13px/1.5 Tahoma, Arial, sans-serif;
      text-align: center;
    }
    ${stackedInnerStyles}
    ${chequeStackedCopiesCssFromItems(items)}
    @media print {
      .print-hint { display: none !important; }
      html, body {
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        overflow: visible !important;
      }
      .page-root {
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        margin: 0 !important;
      }
    }
  `;
}

/** صفحة A4 مع عدة نسخ صك — للمعايرة وطباعة الصورة */
export function chequeStackedCopiesPageCss(calib, copyCount) {
  const copies = normalizeWizardTestCopyCount(copyCount);
  const { pageWidthMm, pageHeightMm } = getA4PaperSize();
  return `
    @page { size: A4 landscape; margin: 0; }
    @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${pageWidthMm}mm !important;
      height: ${pageHeightMm}mm !important;
      overflow: visible !important;
      background: #fff !important;
    }
    .page-root {
      position: relative;
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      overflow: visible;
      background: #fff;
    }
    .print-hint {
      position: fixed;
      top: 8px;
      left: 8px;
      right: 8px;
      z-index: 9999;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      font: 600 13px/1.5 Tahoma, Arial, sans-serif;
      text-align: center;
    }
    ${stackedInnerStyles}
    ${chequeStackedCopiesCss(calib, copies)}
    @media print {
      .print-hint { display: none !important; }
      html, body {
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        overflow: visible !important;
      }
      .page-root {
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        margin: 0 !important;
      }
    }
  `;
}

export const CHEQUE_PRINT_FONT_FAMILY = '"Cairo", "Segoe UI", Tahoma, Arial, sans-serif';

const fieldStyles = `
  .cheque-inner { position: absolute; inset: 0; overflow: visible; }
  .cheque-bg {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    width: 100% !important; height: 100% !important;
    max-width: none !important; max-height: none !important;
    background-repeat: no-repeat; background-position: center center;
    background-size: 100% 100%; z-index: 0; pointer-events: none;
  }
  .cheque-bg-img {
    position: absolute; top: 0; left: 0; width: 100% !important; height: 100% !important;
    max-width: none !important; max-height: none !important;
    object-fit: fill !important; object-position: center center;
    z-index: 0; pointer-events: none; display: block;
  }
  .data-overlay {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    width: 100%; height: 100%;
  }
  .field {
    position: absolute; display: flex; align-items: flex-start;
    justify-content: flex-start; overflow: visible; padding: 0; margin: 0;
    line-height: 1.2; background: transparent !important;
    transform-origin: top left;
  }
  .slash { transform-origin: top left; }
  .field.datePart { align-items: center; justify-content: center; overflow: hidden; }
  .field.amount { align-items: center; justify-content: flex-start; overflow: hidden; }
  .field.text { align-items: center; justify-content: flex-end; overflow: visible; }
  .field.textarea, .field.text-block { align-items: flex-start; overflow: visible; }
  .field .val-date { display: block; width: 100%; text-align: center; direction: ltr; }
  .field .val-amount { display: block; width: 100%; text-align: left; direction: ltr; }
  .field .val-text { display: block; width: 100%; text-align: right; direction: rtl; }
  .amount-words {
    display: block; width: 100%; white-space: nowrap;
    text-align: right; direction: rtl; line-height: 1.2;
  }
  .slash {
    position: absolute; display: flex; align-items: center;
    justify-content: center; font-weight: 900;
    transform: translate(-50%, 0); pointer-events: none; line-height: 1;
  }
`;

/** صفحة A4 — منطقة الصك موضوعة حسب إعدادات الطباعة (مثل print-cheques.com) */
export function chequePrintPageCss(calib) {
  const { pageWidthMm, pageHeightMm } = getA4PaperSize();
  const {
    pageTopMm,
    pageLeftMm,
    widthMm,
    heightMm,
    offsetXmm,
    offsetYmm,
    scaleX,
    scaleY,
  } = calib;

  const sx = scaleX / 100;
  const sy = scaleY / 100;
  const sheetTransform = chequeSheetTransformCss(calib);

  return `
    @page { size: ${a4PageSizeCss()}; margin: 0; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0 !important; padding: 0 !important;
      width: ${pageWidthMm}mm !important;
      height: ${pageHeightMm}mm !important;
      overflow: hidden !important;
      background: #fff !important;
    }
    .page-root {
      position: relative;
      width: ${pageWidthMm}mm;
      height: ${pageHeightMm}mm;
      overflow: visible;
      background: #fff;
    }
    .cheque-sheet {
      position: absolute;
      top: ${pageTopMm}mm;
      left: ${pageLeftMm}mm;
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      overflow: visible;
      font-family: ${CHEQUE_PRINT_FONT_FAMILY};
      color: #0f172a;
      ${sheetTransform}
    }
    .data-overlay {
      transform: translate(${offsetXmm}mm, ${offsetYmm}mm) scale(${sx}, ${sy});
      transform-origin: top left;
    }
    ${fieldStyles}
    @media print {
      html, body {
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
      }
      .page-root {
        position: relative;
        width: ${pageWidthMm}mm !important;
        height: ${pageHeightMm}mm !important;
        margin: 0 !important;
      }
      .cheque-sheet {
        position: absolute;
        top: ${pageTopMm}mm !important;
        left: ${pageLeftMm}mm !important;
        width: ${widthMm}mm !important;
        height: ${heightMm}mm !important;
        ${sheetTransform}
      }
    }
  `;
}

export function chequePrintReadyScript() {
  return `<script>
    window.onload = () => {
      const go = () => setTimeout(() => { window.focus(); window.print(); }, 450);
      const waitImg = () => new Promise((resolve) => {
        const imgs = document.querySelectorAll(".cheque-inner img");
        if (!imgs.length) { resolve(); return; }
        let pending = imgs.length;
        const done = () => {
          pending -= 1;
          if (pending <= 0) resolve();
        };
        imgs.forEach((img) => {
          if (img.complete && img.naturalWidth > 0) done();
          else {
            img.onload = done;
            img.onerror = done;
          }
        });
      });
      const waitFonts = () =>
        document.fonts && document.fonts.ready
          ? document.fonts.ready.catch(() => {})
          : Promise.resolve();
      Promise.all([waitImg(), waitFonts()]).then(go);
    };
    window.onafterprint = () => {
      try {
        if (window.opener) window.opener.postMessage({ type: "CHEQUE_PRINT_DONE" }, "*");
        else parent.postMessage({ type: "CHEQUE_PRINT_DONE" }, "*");
      } catch (e) {}
      setTimeout(() => { try { window.close(); } catch (e) {} }, 120);
    };
  </script>`;
}
