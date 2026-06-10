import { toPng } from "html-to-image";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import {
  CHEQUE_PAGE_WIDTH_MM,
  CHEQUE_PAGE_HEIGHT_MM,
  mmToPdfPoints,
  mmToScreenPx,
} from "@/lib/cheques/chequePageSize";

const CAPTURE_HOST_ATTR = "data-cheque-capture-host";

function prepareHtmlForCapture(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*>/gi, "");
}

function absolutizeImages(root) {
  root.querySelectorAll("img[src]").forEach((img) => {
    const raw = img.getAttribute("src") || "";
    if (!raw || raw.startsWith("data:") || raw.startsWith("http")) return;
    try {
      img.src = new URL(raw, window.location.origin).href;
    } catch {
      //
    }
  });
}

function mountChequeCapture(html, renderW, renderH) {
  const cleaned = prepareHtmlForCapture(html);
  const parsed = new DOMParser().parseFromString(cleaned, "text/html");
  const pageRoot = parsed.querySelector(".page-root");
  if (!pageRoot) return null;

  const styleText = Array.from(parsed.querySelectorAll("style"))
    .map((node) => node.textContent || "")
    .join("\n");

  const host = document.createElement("div");
  host.setAttribute(CAPTURE_HOST_ATTR, "1");
  host.style.cssText = [
    "position:fixed",
    "left:-20000px",
    "top:0",
    `width:${renderW}px`,
    `height:${renderH}px`,
    "overflow:hidden",
    "background:#fff",
    "pointer-events:none",
  ].join(";");

  const style = document.createElement("style");
  style.textContent = `
    [${CAPTURE_HOST_ATTR}] .page-root {
      width: ${CHEQUE_PAGE_WIDTH_MM}mm;
      height: ${CHEQUE_PAGE_HEIGHT_MM}mm;
      position: relative;
      overflow: hidden;
      background: #fff;
      outline: none !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    [${CAPTURE_HOST_ATTR}] .cheque-sheet {
      outline: none !important;
      box-shadow: none !important;
    }
    [${CAPTURE_HOST_ATTR}] .cheque-sheet,
    [${CAPTURE_HOST_ATTR}] .data-overlay,
    [${CAPTURE_HOST_ATTR}] .field,
    [${CAPTURE_HOST_ATTR}] .field * {
      font-family: "Segoe UI", Tahoma, Arial, sans-serif !important;
    }
    ${styleText}
  `;

  const mount = pageRoot.cloneNode(true);
  absolutizeImages(mount);

  host.appendChild(style);
  host.appendChild(mount);
  document.body.appendChild(host);

  return { host, target: mount };
}

function unmountChequeCapture(host) {
  try {
    host?.remove();
  } catch {
    //
  }
}

async function waitForCaptureImages(root) {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 180));
}

async function captureToPng(target, renderW, renderH) {
  const opts = {
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor: "#ffffff",
    width: renderW,
    height: renderH,
    skipFonts: true,
    skipAutoScale: true,
    includeQueryParams: false,
  };

  try {
    return await toPng(target, opts);
  } catch (err) {
    console.warn("toPng failed, trying html2canvas:", err);
    const canvas = await html2canvas(target, {
      scale: 3,
      backgroundColor: "#ffffff",
      width: renderW,
      height: renderH,
      useCORS: true,
      logging: false,
    });
    return canvas.toDataURL("image/png");
  }
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function buildChequePdfBytes(dataUrl, title) {
  const pngBytes = dataUrlToUint8Array(dataUrl);
  const pdfDoc = await PDFDocument.create();
  const pageW = mmToPdfPoints(CHEQUE_PAGE_WIDTH_MM);
  const pageH = mmToPdfPoints(CHEQUE_PAGE_HEIGHT_MM);
  const page = pdfDoc.addPage([pageW, pageH]);
  const pngImage = await pdfDoc.embedPng(pngBytes);
  page.drawImage(pngImage, { x: 0, y: 0, width: pageW, height: pageH });
  pdfDoc.setTitle(String(title || "cheque"));
  return pdfDoc.save();
}

function openPdfAndPrint(blob) {
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      setTimeout(() => URL.revokeObjectURL(url), 180000);
      resolve(ok);
    };

    const popup = window.open(url, "_blank");
    if (!popup) {
      const link = document.createElement("a");
      link.href = url;
      link.download = "cheque-print.pdf";
      link.click();
      alert("تم تحميل ملف PDF — افتحه واطبعه (Scale 100%).");
      finish(false);
      return;
    }

    const triggerPrint = () => {
      try {
        popup.focus();
        const onAfter = () => {
          try {
            popup.removeEventListener("afterprint", onAfter);
          } catch {
            //
          }
          finish(true);
        };
        popup.addEventListener("afterprint", onAfter);
        popup.print();
      } catch {
        finish(false);
      }
    };

    setTimeout(triggerPrint, 900);
    setTimeout(() => finish(true), 120000);
  });
}

/**
 * HTML الصك → PNG → PDF بمقاس 18.22×9 سم → طباعة من عارض PDF.
 * لا يرجع لطباعة HTML/A4.
 */
export async function runChequePrintPdf(html, title = "cheque") {
  if (typeof window === "undefined" || !html) return false;

  const renderW = mmToScreenPx(CHEQUE_PAGE_WIDTH_MM);
  const renderH = mmToScreenPx(CHEQUE_PAGE_HEIGHT_MM);

  const mounted = mountChequeCapture(html, renderW, renderH);
  if (!mounted) {
    alert("تعذر تجهيز الصك للطباعة.");
    return false;
  }

  const { host, target } = mounted;

  try {
    await waitForCaptureImages(target);
    const dataUrl = await captureToPng(target, renderW, renderH);
    const pdfBytes = await buildChequePdfBytes(dataUrl, title);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    return await openPdfAndPrint(blob);
  } catch (err) {
    console.error("runChequePrintPdf:", err);
    alert("تعذر إنشاء PDF للطباعة. جرّب مرة أخرى أو تواصل مع الدعم.");
    return false;
  } finally {
    unmountChequeCapture(host);
  }
}
