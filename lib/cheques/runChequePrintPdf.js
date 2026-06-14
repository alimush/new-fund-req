import { toPng } from "html-to-image";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import {
  CHEQUE_PAGE_WIDTH_MM,
  CHEQUE_PAGE_HEIGHT_MM,
  mmToPdfPoints,
  mmToScreenPx,
} from "@/lib/cheques/chequePageSize";

const CAPTURE_IFRAME_ATTR = "data-cheque-capture-iframe";
const PRINT_IFRAME_ATTR = "data-cheque-print-pdf";

function prepareHtmlForCapture(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*>/gi, "");
}

function stripAtRuleBlocks(css, atKeyword) {
  let out = String(css || "");
  let idx = 0;
  while ((idx = out.indexOf(atKeyword)) !== -1) {
    const braceStart = out.indexOf("{", idx);
    if (braceStart === -1) break;
    let depth = 1;
    let i = braceStart + 1;
    while (i < out.length && depth > 0) {
      if (out[i] === "{") depth += 1;
      else if (out[i] === "}") depth -= 1;
      i += 1;
    }
    out = out.slice(0, idx) + out.slice(i);
  }
  return out;
}

export function removeChequeCaptureIframes() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(`iframe[${CAPTURE_IFRAME_ATTR}]`).forEach((node) => {
    try {
      node.remove();
    } catch {
      //
    }
  });
}

function removeChequePrintIframe() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(`iframe[${PRINT_IFRAME_ATTR}]`).forEach((node) => {
    try {
      node.remove();
    } catch {
      //
    }
  });
}

function absolutizeImages(root, baseUrl) {
  root.querySelectorAll("img[src]").forEach((img) => {
    const raw = img.getAttribute("src") || "";
    if (!raw || raw.startsWith("data:") || raw.startsWith("http")) return;
    try {
      img.src = new URL(raw, baseUrl).href;
    } catch {
      //
    }
  });
}

function waitForIframeLoad(iframe) {
  return new Promise((resolve) => {
    if (iframe.contentDocument?.readyState === "complete") {
      resolve();
      return;
    }
    iframe.addEventListener("load", () => resolve(), { once: true });
    window.setTimeout(resolve, 2000);
  });
}

function stripGlobalPrintRules(styleText) {
  let css = stripAtRuleBlocks(stripAtRuleBlocks(String(styleText || ""), "@page"), "@media");
  css = css.replace(/html\s*,\s*body\s*\{[\s\S]*?\}/g, "");
  css = css.replace(/html\s*\{[\s\S]*?\}/g, "");
  css = css.replace(/body\s*\{[\s\S]*?\}/g, "");
  return css;
}

function captureFrameStyles(renderW, renderH, printCss, fullPageSheet) {
  const sheetOverrides = fullPageSheet
    ? `
    .cheque-sheet {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: ${renderW}px !important;
      height: ${renderH}px !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .cheque-bg {
      width: 100% !important;
      height: 100% !important;
      object-fit: fill !important;
    }`
    : `
    .cheque-sheet {
      overflow: visible !important;
      box-sizing: border-box !important;
    }`;

  return `
    ${printCss}
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${renderW}px !important;
      height: ${renderH}px !important;
      overflow: hidden !important;
      background: #fff !important;
    }
    .page-root {
      width: ${renderW}px !important;
      height: ${renderH}px !important;
      min-width: ${renderW}px !important;
      min-height: ${renderH}px !important;
      max-width: ${renderW}px !important;
      max-height: ${renderH}px !important;
      position: relative !important;
      overflow: hidden !important;
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    ${sheetOverrides}
    .cheque-inner {
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .cheque-sheet,
    .data-overlay,
    .field,
    .field * {
      font-family: "Segoe UI", Tahoma, Arial, sans-serif !important;
    }
  `;
}

function htmlHasChequeImage(parsed) {
  return Boolean(parsed.querySelector(".cheque-bg"));
}

async function readPageRootFromIframe(iframe) {
  await new Promise((r) => window.setTimeout(r, 100));
  return iframe.contentDocument?.querySelector(".page-root") || null;
}

async function mountChequeCaptureInIframe(html, renderW, renderH) {
  const cleaned = prepareHtmlForCapture(html);
  const parsed = new DOMParser().parseFromString(cleaned, "text/html");
  const pageRoot = parsed.querySelector(".page-root");
  if (!pageRoot) return null;

  const styleText = Array.from(parsed.querySelectorAll("style"))
    .map((node) => node.textContent || "")
    .join("\n");
  const printCss = stripGlobalPrintRules(styleText);
  const fullPageSheet = htmlHasChequeImage(parsed);

  const iframe = document.createElement("iframe");
  iframe.setAttribute(CAPTURE_IFRAME_ATTR, "1");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "left:-20000px",
    "top:0",
    "border:0",
    "margin:0",
    "padding:0",
    `width:${renderW}px`,
    `height:${renderH}px`,
    "opacity:0",
    "visibility:hidden",
    "pointer-events:none",
  ].join(";");

  const mount = pageRoot.cloneNode(true);
  absolutizeImages(mount, window.location.origin);

  const frameHtml = `<!doctype html><html><head><meta charset="utf-8"/><style>${captureFrameStyles(renderW, renderH, printCss, fullPageSheet)}</style></head><body style="margin:0;padding:0;background:#fff;">${mount.outerHTML}</body></html>`;

  document.body.appendChild(iframe);

  try {
    const blob = new Blob([frameHtml], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
    await waitForIframeLoad(iframe);
    URL.revokeObjectURL(blobUrl);
    const target = await readPageRootFromIframe(iframe);
    if (target) return { iframe, target, renderW, renderH };
  } catch {
    //
  }

  try {
    iframe.src = "about:blank";
    await waitForIframeLoad(iframe);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(frameHtml);
      doc.close();
      await waitForIframeLoad(iframe);
      const target = await readPageRootFromIframe(iframe);
      if (target) return { iframe, target, renderW, renderH };
    }
  } catch {
    //
  }

  iframe.remove();
  return null;
}

function unmountChequeCapture(mounted) {
  try {
    mounted?.iframe?.remove();
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
  await new Promise((r) => setTimeout(r, 200));
}

function measureCaptureSize(renderW, renderH) {
  return { width: renderW, height: renderH };
}

async function captureToPng(target, width, height) {
  const opts = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    width,
    height,
    skipFonts: true,
    skipAutoScale: true,
    includeQueryParams: false,
  };

  try {
    return await toPng(target, opts);
  } catch (err) {
    console.warn("toPng failed, trying html2canvas:", err);
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: "#ffffff",
      width,
      height,
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

function waitForPrintIframeLoad(iframe) {
  return new Promise((resolve) => {
    if (iframe.contentDocument?.readyState === "complete") {
      resolve();
      return;
    }
    iframe.addEventListener("load", () => resolve(), { once: true });
    window.setTimeout(resolve, 5000);
  });
}

function schedulePrintIframeCleanup(iframe, url) {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    try {
      iframe.remove();
    } catch {
      //
    }
    try {
      URL.revokeObjectURL(url);
    } catch {
      //
    }
  };

  window.setTimeout(cleanup, 60000);
  try {
    iframe.contentWindow?.addEventListener("afterprint", cleanup, { once: true });
  } catch {
    //
  }
}

async function openPdfAndPrint(blob) {
  removeChequePrintIframe();

  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.setAttribute(PRINT_IFRAME_ATTR, "1");
  iframe.setAttribute("title", "cheque-print");
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:0",
    "height:0",
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");

  document.body.appendChild(iframe);
  iframe.src = url;
  await waitForPrintIframeLoad(iframe);
  await new Promise((r) => window.setTimeout(r, 150));

  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    schedulePrintIframeCleanup(iframe, url);
    return true;
  } catch (err) {
    console.warn("iframe print failed, opening PDF in new tab:", err);
    try {
      const tab = window.open(url, "_blank");
      if (tab) {
        schedulePrintIframeCleanup(iframe, url);
        return true;
      }
    } catch {
      //
    }
    try {
      URL.revokeObjectURL(url);
    } catch {
      //
    }
    iframe.remove();
    return false;
  }
}

/**
 * HTML الصك → PNG → PDF بمقاس 18.22×9 سم → طباعة من نفس الصفحة.
 */
export async function runChequePrintPdf(html, title = "cheque") {
  if (typeof window === "undefined" || !html) return false;

  removeChequeCaptureIframes();

  const renderW = mmToScreenPx(CHEQUE_PAGE_WIDTH_MM);
  const renderH = mmToScreenPx(CHEQUE_PAGE_HEIGHT_MM);

  const mounted = await mountChequeCaptureInIframe(html, renderW, renderH);
  if (!mounted) {
    alert("تعذر تجهيز الصك للطباعة.");
    return false;
  }

  try {
    await waitForCaptureImages(mounted.target);
    const { width, height } = measureCaptureSize(mounted.renderW, mounted.renderH);
    const dataUrl = await captureToPng(mounted.target, width, height);
    unmountChequeCapture(mounted);
    const pdfBytes = await buildChequePdfBytes(dataUrl, title);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    return await openPdfAndPrint(blob);
  } catch (err) {
    console.error("runChequePrintPdf:", err);
    alert("تعذر إنشاء PDF للطباعة. جرّب مرة أخرى أو تواصل مع الدعم.");
    return false;
  } finally {
    unmountChequeCapture(mounted);
    removeChequeCaptureIframes();
  }
}

export { removeChequePrintIframe };
