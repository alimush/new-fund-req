import { buildChequePrintHtml, buildChequeImageOnlyPrintHtml } from "@/lib/cheques/buildChequePrintHtml";
import { fetchChequePrintBundle } from "@/lib/cheques/fetchPrintCalib";
import { measureAmountWordsForPrint } from "@/lib/cheques/measureAmountWordsPrint";
import { normalizePrintCalib } from "@/lib/cheques/printCalib";
import { normalizeWizardTestCopyCount } from "@/lib/cheques/chequePrintPageStyles";
import { readStoredPrinterName } from "@/lib/cheques/printerCalibration";
import { removeChequeCaptureIframes, runChequePrintHtml } from "@/lib/cheques/runChequePrintHtml";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  fieldWithChequePosition,
} from "@/lib/cheques/textFieldLayout";

function resetMainPageLayout() {
  if (typeof document === "undefined") return;
  removeChequeCaptureIframes();
  const html = document.documentElement;
  const body = document.body;
  for (const el of [html, body]) {
    if (!el) continue;
    ["width", "height", "overflow", "margin", "padding", "max-width", "max-height"].forEach(
      (prop) => el.style.removeProperty(prop)
    );
  }
}

function resolveCalib(template, printCalib, fields = []) {
  return normalizePrintCalib(printCalib, template, fields);
}

async function logPrintJob(payload = {}, success = true) {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/cheques/prints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: payload.templateKey,
        chequeId: payload.chequeId || null,
        printerName: payload.printerName || "",
        printMode: payload.printMode || "data",
        printMethod: "html-a4",
        status: success ? "success" : "failed",
        payee: payload.payee || "",
        amountNumeric: payload.amountNumeric || 0,
        chequeNumber: payload.chequeNumber || "",
        appliedCalibration: payload.printCalib || null,
      }),
    });
  } catch {
    //
  }
}

async function preparePrintPayload(payload = {}) {
  const {
    template,
    fields = [],
    printCalib = null,
    templateKey,
    dateShowSlashes,
    printerName = "",
    useProvidedCalib = false,
    ...rest
  } = payload;

  const key = templateKey || template?.key;

  if (useProvidedCalib && printCalib) {
    const list = fields.length ? fields : template?.fields || [];
    const normalized = resolveCalib(template, printCalib, list);
    const isWizardImageJob = payload.printMode === "imageOnly";
    return {
      ...rest,
      template,
      templateKey: key,
      fields: list,
      printCalib: normalized,
      resolvedWizardCalib: isWizardImageJob ? normalized : undefined,
      wizardTestCopyCount: isWizardImageJob
        ? normalizeWizardTestCopyCount(payload.copyCount)
        : undefined,
      dateShowSlashes,
      printerName,
    };
  }

  if (typeof window !== "undefined" && key && template) {
    const resolvedPrinter =
      String(printerName || "").trim() || readStoredPrinterName(key);
    const bundle = await fetchChequePrintBundle(key, template, fields, resolvedPrinter);
    return {
      ...rest,
      template,
      templateKey: key,
      fields: bundle.fields,
      printCalib: bundle.printCalib,
      resolvedWizardCalib: bundle.resolvedWizardCalib,
      wizardTestCopyCount: bundle.wizardTestCopyCount,
      dateShowSlashes: bundle.dateShowSlashes ?? dateShowSlashes,
      printerName: bundle.printerName || printerName,
      calibrationId: bundle.calibrationId,
      layoutFontScale: bundle.globalFontScale ?? rest.layoutFontScale ?? 100,
    };
  }

  const list = fields.length ? fields : template?.fields || [];
  return {
    ...rest,
    template,
    templateKey: key,
    fields: list,
    printCalib: resolveCalib(template, printCalib, list),
    dateShowSlashes,
    printerName,
  };
}

async function buildDataHtml(payload) {
  const prepared = await preparePrintPayload(payload);
  const {
    template,
    fields = [],
    values = {},
    dateShowSlashes = true,
    textFieldLayout = null,
    amountWordsLayout = null,
    amountWordsLine2Layout = null,
    title = "صك",
    imageUrl = null,
    printCalib,
    layoutFontScale = 100,
  } = prepared;

  const calib = printCalib;
  const list = fields.length ? fields : template.fields || [];
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));
  const resolveMeasureField = (key, layout) => {
    const base = fieldByKey[key];
    if (!base) return null;
    const positioned = layout
      ? fieldWithChequePosition(base, layout)
      : base;
    if (layout && (layout.fontSize != null || layout.fontWeight != null)) {
      return {
        ...positioned,
        fontSize: layout.fontSize ?? positioned.fontSize,
        fontWeight: layout.fontWeight ?? positioned.fontWeight,
      };
    }
    return positioned;
  };

  const amountField = resolveMeasureField(AMOUNT_WORDS_KEY, amountWordsLayout);
  const amountFieldLine2 = resolveMeasureField(
    AMOUNT_WORDS_LINE2_KEY,
    amountWordsLine2Layout
  );
  const amountWordsStyle = measureAmountWordsForPrint(
    values?.amountWords,
    amountField,
    template,
    calib.widthMm
  );
  const amountWordsLine2Style = measureAmountWordsForPrint(
    values?.amountWordsLine2,
    amountFieldLine2,
    template,
    calib.widthMm
  );

  return {
    html: buildChequePrintHtml({
      template,
      fields,
      values,
      dateShowSlashes,
      textFieldLayout,
      amountWordsLayout,
      amountWordsLine2Layout,
      amountWordsStyle,
      amountWordsLine2Style,
      title,
      imageUrl,
      printCalib: calib,
      layoutFontScale,
    }),
    prepared,
  };
}

async function executePrint(html, title, prepared, printMode) {
  const ok = await runChequePrintHtml(html, title);
  await logPrintJob(
    {
      templateKey: prepared.templateKey,
      chequeId: prepared.chequeId,
      printerName: prepared.printerName,
      printMode,
      payee: prepared.values?.payee,
      amountNumeric: prepared.values?.amountNumeric,
      chequeNumber: prepared.values?.chequeNumber,
      printCalib: prepared.printCalib,
    },
    ok
  );
  return ok;
}

export async function printChequeData(payload = {}) {
  const { template, onStart, onEnd } = payload;
  if (!template) return false;

  onStart?.();
  try {
    const { html, prepared } = await buildDataHtml({ ...payload, imageUrl: null });
    return await executePrint(html, payload.title || "صك", prepared, "data");
  } catch (err) {
    console.error("printChequeData:", err);
    return false;
  } finally {
    resetMainPageLayout();
    onEnd?.();
  }
}

export async function printChequeWithImage(payload = {}) {
  const { template, onStart, onEnd } = payload;
  if (!template?.image) return false;

  onStart?.();
  try {
    const imageUrl =
      typeof window !== "undefined"
        ? new URL(template.image, window.location.origin).href
        : template.image;

    const { html, prepared } = await buildDataHtml({
      ...payload,
      title: payload.title || "صك",
      imageUrl,
    });
    if (!html) return false;
    return await executePrint(html, payload.title || "صك", prepared, "withImage");
  } catch (err) {
    console.error("printChequeWithImage:", err);
    return false;
  } finally {
    resetMainPageLayout();
    onEnd?.();
  }
}

export async function printChequeImageOnly(payload = {}) {
  const { template, onStart, onEnd } = payload;
  if (!template?.image) return false;

  onStart?.();
  try {
    const prepared = await preparePrintPayload(payload);
    const imageUrl =
      typeof window !== "undefined"
        ? new URL(template.image, window.location.origin).href
        : template.image;

    const copyCount = normalizeWizardTestCopyCount(
      payload.copyCount ?? prepared.wizardTestCopyCount
    );
    const calibForImage = prepared.resolvedWizardCalib ?? prepared.printCalib;

    const html = buildChequeImageOnlyPrintHtml({
      template,
      title: prepared.title || "صك",
      imageUrl,
      printCalib: calibForImage,
      fields: prepared.fields,
      copyCount,
    });
    if (!html) return false;
    return await executePrint(html, prepared.title || "صك", prepared, "imageOnly");
  } catch (err) {
    console.error("printChequeImageOnly:", err);
    return false;
  } finally {
    resetMainPageLayout();
    onEnd?.();
  }
}

export async function printChequeElement(_element, options = {}) {
  return printChequeData(options);
}

export { preparePrintPayload, logPrintJob };
