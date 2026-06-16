import { toPng } from "html-to-image";
import html2canvas from "html2canvas";
import { mmToScreenPx } from "@/lib/cheques/chequePageSize";

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

function stripGlobalPrintRules(styleText) {
  let css = stripAtRuleBlocks(stripAtRuleBlocks(String(styleText || ""), "@page"), "@media");
  css = css.replace(/html\s*,\s*body\s*\{[\s\S]*?\}/g, "");
  css = css.replace(/html\s*\{[\s\S]*?\}/g, "");
  css = css.replace(/body\s*\{[\s\S]*?\}/g, "");
  return css;
}

function captureFrameStyles(renderW, renderH, printCss, opts = {}) {
  const { hideBackground = false, fullPageSheet = false } = opts;
  const bgHide = hideBackground
    ? `.cheque-bg { display: none !important; visibility: hidden !important; }`
    : "";

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
    }`
    : `
    .cheque-sheet {
      overflow: visible !important;
      box-sizing: border-box !important;
    }`;

  return `
    ${printCss}
    ${bgHide}
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${renderW}px !important;
      height: ${renderH}px !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    .page-root {
      width: ${renderW}px !important;
      height: ${renderH}px !important;
      position: relative !important;
      overflow: hidden !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    ${sheetOverrides}
    .cheque-inner { overflow: hidden !important; box-sizing: border-box !important; }
    .cheque-sheet, .data-overlay, .field, .field * {
      font-family: "Segoe UI", Tahoma, Arial, sans-serif !important;
    }
  `;
}

function htmlHasChequeImage(parsed) {
  return Boolean(parsed.querySelector(".cheque-bg"));
}

async function waitForIframeLoad(iframe) {
  return new Promise((resolve) => {
    if (iframe.contentDocument?.readyState === "complete") {
      resolve();
      return;
    }
    iframe.addEventListener("load", () => resolve(), { once: true });
    window.setTimeout(resolve, 2000);
  });
}

async function readPageRootFromIframe(iframe) {
  await new Promise((r) => window.setTimeout(r, 100));
  return iframe.contentDocument?.querySelector(".page-root") || null;
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

async function captureToPng(target, width, height, transparentBackground = false) {
  const opts = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: transparentBackground ? undefined : "#ffffff",
    width,
    height,
    skipFonts: true,
    skipAutoScale: true,
    includeQueryParams: false,
  };

  try {
    const dataUrl = await toPng(target, opts);
    return dataUrlToUint8Array(dataUrl);
  } catch (err) {
    console.warn("toPng failed, trying html2canvas:", err);
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: transparentBackground ? null : "#ffffff",
      width,
      height,
      useCORS: true,
      logging: false,
    });
    return dataUrlToUint8Array(canvas.toDataURL("image/png"));
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

async function mountChequeCaptureInIframe(html, renderW, renderH, opts = {}) {
  const cleaned = prepareHtmlForCapture(html);
  const parsed = new DOMParser().parseFromString(cleaned, "text/html");
  const pageRoot = parsed.querySelector(".page-root");
  if (!pageRoot) return null;

  const styleText = Array.from(parsed.querySelectorAll("style"))
    .map((node) => node.textContent || "")
    .join("\n");
  const printCss = stripGlobalPrintRules(styleText);
  const fullPageSheet = htmlHasChequeImage(parsed) && !opts.hideBackground;

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

  const frameHtml = `<!doctype html><html><head><meta charset="utf-8"/><style>${captureFrameStyles(renderW, renderH, printCss, { hideBackground: opts.hideBackground, fullPageSheet })}</style></head><body style="margin:0;padding:0;background:transparent;">${mount.outerHTML}</body></html>`;

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

/** التقاط HTML الصك كـ PNG bytes */
export async function captureChequeHtmlToPng(html, pageWidthMm, pageHeightMm, opts = {}) {
  if (typeof window === "undefined" || !html) return null;

  removeChequeCaptureIframes();
  const renderW = mmToScreenPx(pageWidthMm);
  const renderH = mmToScreenPx(pageHeightMm);
  const mounted = await mountChequeCaptureInIframe(html, renderW, renderH, opts);
  if (!mounted) return null;

  try {
    await waitForCaptureImages(mounted.target);
    return await captureToPng(
      mounted.target,
      mounted.renderW,
      mounted.renderH,
      Boolean(opts.transparentBackground)
    );
  } finally {
    try {
      mounted.iframe?.remove();
    } catch {
      //
    }
    removeChequeCaptureIframes();
  }
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

export function removeChequePrintIframe() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(`iframe[${PRINT_IFRAME_ATTR}]`).forEach((node) => {
    try {
      node.remove();
    } catch {
      //
    }
  });
}

export async function openPdfBlobAndPrint(blob) {
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

export { dataUrlToUint8Array, PRINT_IFRAME_ATTR };
