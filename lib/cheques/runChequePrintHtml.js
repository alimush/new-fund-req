/** @deprecated استخدم runChequePrintPdf — فتح نافذة طباعة HTML */
export async function runChequePrintHtml(html) {
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
