import { PDFDocument } from "pdf-lib";
import {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  mmToPdfPoints,
} from "@/lib/cheques/chequePageSize";
import {
  captureChequeHtmlToPng,
  openPdfBlobAndPrint,
} from "@/lib/cheques/chequePdfCapture";

/**
 * PDF احتياطي — يلتقط صفحة HTML كاملة على A4.
 */
export async function buildChequePdfNative({
  html,
  title = "cheque",
  pageWidthMm = A4_WIDTH_MM,
  pageHeightMm = A4_HEIGHT_MM,
}) {
  const pageW = mmToPdfPoints(pageWidthMm);
  const pageH = mmToPdfPoints(pageHeightMm);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);

  if (html) {
    const pngBytes = await captureChequeHtmlToPng(html, pageWidthMm, pageHeightMm, {
      hideBackground: false,
      transparentBackground: false,
    });

    if (pngBytes) {
      const pngDoc = await pdfDoc.embedPng(pngBytes);
      page.drawImage(pngDoc, { x: 0, y: 0, width: pageW, height: pageH });
    }
  }

  pdfDoc.setTitle(String(title || "cheque"));
  return pdfDoc.save();
}

export async function runChequePrintPdfNative(options) {
  if (typeof window === "undefined") return false;
  try {
    const pdfBytes = await buildChequePdfNative(options);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    return await openPdfBlobAndPrint(blob);
  } catch (err) {
    console.error("runChequePrintPdfNative:", err);
    return false;
  }
}
