/** طباعة HTML مباشرة — A4 Landscape + Scale Default (مثل print-cheques.com) */
export async function runChequePrintHtml(html, title = "cheque") {
  if (typeof window === "undefined" || !html) return false;

  let targetWin = null;
  let iframeEl = null;

  try {
    targetWin = window.open("", "_blank", "width=1120,height=820,left=40,top=20");
  } catch {
    targetWin = null;
  }

  if (targetWin) {
    targetWin.document.open();
    targetWin.document.write(html);
    targetWin.document.close();
  } else {
    iframeEl = document.createElement("iframe");
    iframeEl.setAttribute("data-cheque-print-html", "1");
    iframeEl.style.cssText =
      "position:fixed;left:0;top:0;width:100%;height:100%;border:0;opacity:0;z-index:99999;";
    document.body.appendChild(iframeEl);
    const doc = iframeEl.contentWindow?.document;
    if (!doc) {
      iframeEl.remove();
      return false;
    }
    doc.open();
    doc.write(html);
    doc.close();
    targetWin = iframeEl.contentWindow;
  }

  await new Promise((resolve) => {
    const onMsg = (ev) => {
      if (ev?.data?.type !== "CHEQUE_PRINT_DONE") return;
      window.removeEventListener("message", onMsg);
      resolve();
    };
    window.addEventListener("message", onMsg);
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve();
    }, 120000);
  });

  if (!iframeEl && targetWin && !targetWin.closed) {
    try {
      targetWin.close();
    } catch {
      //
    }
  }
  iframeEl?.remove();
  return true;
}

export function removeChequePrintIframe() {
  if (typeof document === "undefined") return;
  document.querySelectorAll('iframe[data-cheque-print-html]').forEach((node) => {
    try {
      node.remove();
    } catch {
      //
    }
  });
}

export function removeChequeCaptureIframes() {
  if (typeof document === "undefined") return;
  document.querySelectorAll("iframe[data-cheque-capture-iframe]").forEach((node) => {
    try {
      node.remove();
    } catch {
      //
    }
  });
}
