import { PDFDocument } from "pdf-lib";
import {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  mmToPdfPoints,
} from "@/lib/cheques/chequePageSize";
import { runChequePrintPdfNative } from "@/lib/cheques/buildChequePdfNative";
import {
  captureChequeHtmlToPng,
  openPdfBlobAndPrint,
  removeChequeCaptureIframes,
  removeChequePrintIframe,
} from "@/lib/cheques/chequePdfCapture";

export { removeChequeCaptureIframes, removeChequePrintIframe };

async function runChequePrintPdfLegacy(html, title = "cheque") {
  if (typeof window === "undefined" || !html) return false;

  removeChequeCaptureIframes();

  const pngBytes = await captureChequeHtmlToPng(html, A4_WIDTH_MM, A4_HEIGHT_MM, {
    hideBackground: false,
    transparentBackground: false,
  });

  if (!pngBytes) {
    alert("تعذر تجهيز الصك للطباعة.");
    return false;
  }

  const pdfDoc = await PDFDocument.create();
  const pageW = mmToPdfPoints(A4_WIDTH_MM);
  const pageH = mmToPdfPoints(A4_HEIGHT_MM);
  const page = pdfDoc.addPage([pageW, pageH]);
  const pngImage = await pdfDoc.embedPng(pngBytes);
  page.drawImage(pngImage, { x: 0, y: 0, width: pageW, height: pageH });
  pdfDoc.setTitle(String(title || "cheque"));
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  return openPdfBlobAndPrint(blob);
}

/**
 * HTML الصك → PDF A4 → طباعة (مسار احتياطي).
 */
export async function runChequePrintPdf(html, title = "cheque", options = {}) {
  const {
    pageWidthMm = A4_WIDTH_MM,
    pageHeightMm = A4_HEIGHT_MM,
    useNative = true,
  } = options;

  if (typeof window === "undefined" || !html) return false;

  try {
    if (useNative) {
      const ok = await runChequePrintPdfNative({
        html,
        title,
        pageWidthMm,
        pageHeightMm,
      });
      if (ok) return true;
    }
    return await runChequePrintPdfLegacy(html, title);
  } catch (err) {
    console.error("runChequePrintPdf:", err);
    alert("تعذر إنشاء PDF للطباعة. جرّب مرة أخرى أو تواصل مع الدعم.");
    return false;
  } finally {
    removeChequeCaptureIframes();
  }
}
