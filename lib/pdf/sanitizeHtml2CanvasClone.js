const UNSUPPORTED_COLOR_RE =
  /\b(?:lab|oklch|oklab|lch|color-mix)\([^)]*\)/gi;

const SKIP_INLINE_PROPS = new Set([
  "visibility",
  "opacity",
  "pointer-events",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-delay",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-delay",
  "content",
  "caret-color",
  "cursor",
]);

export function stripUnsupportedCssColors(cssText = "") {
  let css = String(cssText);
  let prev = "";
  while (css !== prev) {
    prev = css;
    css = css.replace(UNSUPPORTED_COLOR_RE, "transparent");
  }
  return css;
}

function inlineComputedStyles(originalEl, cloneEl) {
  const cs = window.getComputedStyle(originalEl);
  for (let i = 0; i < cs.length; i += 1) {
    const prop = cs[i];
    if (SKIP_INLINE_PROPS.has(prop)) continue;
    const val = cs.getPropertyValue(prop);
    if (!val || val === "none" || val === "auto" || val === "normal") continue;
    try {
      if (/\b(?:lab|oklch|oklab|lch|color-mix)\(/i.test(val)) continue;
      cloneEl.style.setProperty(prop, val, cs.getPropertyPriority(prop));
    } catch {
      // ignore unsupported properties
    }
  }
  cloneEl.style.visibility = "visible";
  cloneEl.style.opacity = "1";
}

function walkAndInline(originalEl, cloneEl) {
  inlineComputedStyles(originalEl, cloneEl);
  const oKids = originalEl.children;
  const cKids = cloneEl.children;
  const len = Math.min(oKids.length, cKids.length);
  for (let i = 0; i < len; i += 1) {
    walkAndInline(oKids[i], cKids[i]);
  }
}

async function waitForImages(root) {
  const imgs = root.querySelectorAll("img");
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = resolve;
            img.onerror = resolve;
          }
        })
    )
  );
}

export function preparePrintRootForCapture(root) {
  const prev = {
    position: root.style.position,
    top: root.style.top,
    left: root.style.left,
    visibility: root.style.visibility,
    opacity: root.style.opacity,
    zIndex: root.style.zIndex,
    pointerEvents: root.style.pointerEvents,
  };

  root.style.position = "absolute";
  root.style.top = "-10000px";
  root.style.left = "0";
  root.style.visibility = "visible";
  root.style.opacity = "1";
  root.style.zIndex = "-1";
  root.style.pointerEvents = "none";

  return prev;
}

export function restorePrintRoot(root, prev) {
  if (!root || !prev) return;
  root.style.position = prev.position;
  root.style.top = prev.top;
  root.style.left = prev.left;
  root.style.visibility = prev.visibility;
  root.style.opacity = prev.opacity;
  root.style.zIndex = prev.zIndex;
  root.style.pointerEvents = prev.pointerEvents;
}

/**
 * يلتقط قالب الطلب للـ PDF — نفس أسلوب html2canvas السابق مع تجاوز ألوان lab.
 */
export async function captureRequestPrintCanvas(root, html2canvas, options = {}) {
  if (!root || typeof html2canvas !== "function") {
    throw new Error("captureRequestPrintCanvas: invalid arguments");
  }

  const prev = preparePrintRootForCapture(root);

  try {
    await waitForImages(root);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 200));

    const width = Math.max(root.scrollWidth, 1);
    const height = Math.max(root.scrollHeight, 1);

    return await html2canvas(root, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      foreignObjectRendering: false,
      logging: false,
      imageTimeout: 20000,
      scrollX: 0,
      scrollY: 0,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      ignoreElements: (node) =>
        node.tagName === "IFRAME" || node.tagName === "VIDEO",
      onclone: (clonedDoc, clonedRoot) => {
        clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
          if (node.tagName === "STYLE") {
            node.textContent = stripUnsupportedCssColors(node.textContent || "");
            if (!node.textContent.trim()) node.remove();
          } else {
            node.remove();
          }
        });

        clonedRoot.style.position = "static";
        clonedRoot.style.top = "auto";
        clonedRoot.style.left = "auto";
        clonedRoot.style.visibility = "visible";
        clonedRoot.style.opacity = "1";

        walkAndInline(root, clonedRoot);
      },
      ...options,
    });
  } finally {
    restorePrintRoot(root, prev);
  }
}
