import { getA4LandscapeSize } from "@/lib/cheques/printCalib";

const fieldStyles = `
  .cheque-inner { position: absolute; inset: 0; overflow: hidden; }
  .cheque-bg {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: fill; z-index: 0; pointer-events: none; display: block;
  }
  .data-overlay {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    width: 100%; height: 100%; color: #0f172a;
  }
  .data-overlay .field, .data-overlay span { color: #0f172a !important; }
  .field {
    position: absolute; display: flex; align-items: flex-start;
    justify-content: flex-start; overflow: hidden; padding: 0; margin: 0;
    line-height: 1.2; background: transparent !important;
    transform-origin: top left;
  }
  .slash { transform-origin: top left; }
  .field.datePart { align-items: center; justify-content: center; }
  .field.amount { align-items: center; justify-content: flex-start; }
  .field.textarea, .field.text-block { align-items: flex-start; }
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

/** صفحة A4 أفقي — موضع وحجم الصك من إعدادات الطباعة */
export function chequePrintPageCss(calib) {
  const { pageWidthMm, pageHeightMm } = getA4LandscapeSize();
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

  return `
    @page { size: A4 landscape; margin: 0; }
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
      overflow: hidden;
      background: #fff;
    }
    .cheque-sheet {
      position: absolute;
      top: ${pageTopMm}mm;
      left: ${pageLeftMm}mm;
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      overflow: hidden;
      font-family: "Cairo", sans-serif;
      color: #0f172a;
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
      }
    }
    @media screen {
      body { background: #e2e8f0; }
      .page-root {
        margin: 6mm auto;
        outline: 1px dashed #64748b;
        box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      }
      .cheque-sheet { outline: 1px dashed #0ea5e9; }
    }
  `;
}

export function chequePrintReadyScript() {
  return `<script>
    window.onload = () => {
      const go = () => setTimeout(() => { window.focus(); window.print(); }, 450);
      const waitImg = () => new Promise((resolve) => {
        const img = document.querySelector(".cheque-bg");
        if (!img) { resolve(); return; }
        if (img.complete && img.naturalWidth > 0) resolve();
        else { img.onload = () => resolve(); img.onerror = () => resolve(); }
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
