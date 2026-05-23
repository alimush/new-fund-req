import { buildChequePrintHtml } from "@/lib/cheques/buildChequePrintHtml";
import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
import { measureAmountWordsForPrint } from "@/lib/cheques/measureAmountWordsPrint";

/**
 * طباعة البيانات فقط على صك فارغ مسبقاً في الطابعة (بدون صورة القالب).
 */
export async function printChequeData(payload = {}) {
  const {
    template,
    fields = [],
    values = {},
    dateShowSlashes = true,
    textFieldLayout = null,
    title = "صك",
    onStart,
    onEnd,
  } = payload;

  if (!template) return false;

  onStart?.();
  try {
    const dims = getChequePrintDimensions(template);
    const amountField = (fields.length ? fields : template.fields || []).find(
      (f) => f.key === "amountWords"
    );
    const amountWordsStyle = measureAmountWordsForPrint(
      values?.amountWords,
      amountField,
      template,
      dims.widthMm
    );

    const html = buildChequePrintHtml({
      template,
      fields,
      values,
      dateShowSlashes,
      textFieldLayout,
      amountWordsStyle,
      title,
    });

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return false;

    doc.open();
    doc.write(html);
    doc.close();

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
      }, 90000);
    });

    iframe.remove();
    return true;
  } catch (err) {
    console.error("printChequeData:", err);
    return false;
  } finally {
    onEnd?.();
  }
}

/** @deprecated استخدم printChequeData — طباعة بيانات وليس صورة */
export async function printChequeElement(_element, options = {}) {
  return printChequeData(options);
}
