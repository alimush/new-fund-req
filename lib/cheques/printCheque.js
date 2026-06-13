import { buildChequePrintHtml, buildChequeImageOnlyPrintHtml } from "@/lib/cheques/buildChequePrintHtml";
import { fetchChequePrintBundle } from "@/lib/cheques/fetchPrintCalib";
import { measureAmountWordsForPrint } from "@/lib/cheques/measureAmountWordsPrint";
import { normalizePrintCalib } from "@/lib/cheques/printCalib";
import { removeChequeCaptureIframes, runChequePrintPdf } from "@/lib/cheques/runChequePrintPdf";

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

/**
 * يدمج القالب المحفوظ (أبعاد + إزاحات الحقول + تخطيط) قبل الطباعة.
 * useProvidedCalib=true فقط من نافذة الضبط قبل الحفظ.
 */
async function preparePrintPayload(payload = {}) {
  const {
    template,
    fields = [],
    printCalib = null,
    templateKey,
    dateShowSlashes,
    useProvidedCalib = false,
    ...rest
  } = payload;

  const key = templateKey || template?.key;

  if (useProvidedCalib && printCalib) {
    const list = fields.length ? fields : template?.fields || [];
    return {
      ...rest,
      template,
      templateKey: key,
      fields: list,
      printCalib: resolveCalib(template, printCalib, list),
      dateShowSlashes,
    };
  }

  if (typeof window !== "undefined" && key && template) {
    const bundle = await fetchChequePrintBundle(key, template, fields);
    return {
      ...rest,
      template,
      templateKey: key,
      fields: bundle.fields,
      printCalib: bundle.printCalib,
      dateShowSlashes: bundle.dateShowSlashes ?? dateShowSlashes,
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
    title = "صك",
    imageUrl = null,
    printCalib,
  } = prepared;

  const calib = printCalib;
  const amountField = (fields.length ? fields : template.fields || []).find(
    (f) => f.key === "amountWords"
  );
  const amountWordsStyle = measureAmountWordsForPrint(
    values?.amountWords,
    amountField,
    template,
    calib.widthMm
  );

  return buildChequePrintHtml({
    template,
    fields,
    values,
    dateShowSlashes,
    textFieldLayout,
    amountWordsStyle,
    title,
    imageUrl,
    printCalib: calib,
  });
}

/**
 * طباعة الصك — بيانات الحقول فقط على صك فارغ (بدون صورة القالب).
 * يستخدم نفس القالب المحفوظ (أبعاد + إزاحات) كطباعة البيانات.
 */
export async function printChequeData(payload = {}) {
  const { template, onStart, onEnd } = payload;
  if (!template) return false;

  onStart?.();
  try {
    const html = await buildDataHtml({ ...payload, imageUrl: null });
    return await runChequePrintPdf(html, payload.title || "صك");
  } catch (err) {
    console.error("printChequeData:", err);
    return false;
  } finally {
    resetMainPageLayout();
    onEnd?.();
  }
}

/**
 * طباعة صورة الصك مع البيانات — للمعاينة أو طباعة كاملة.
 */
export async function printChequeWithImage(payload = {}) {
  const { template, onStart, onEnd } = payload;
  if (!template?.image) return false;

  onStart?.();
  try {
    const imageUrl =
      typeof window !== "undefined"
        ? new URL(template.image, window.location.origin).href
        : template.image;

    const html = await buildDataHtml({
      ...payload,
      title: payload.title || "صك",
      imageUrl,
    });
    if (!html) return false;
    return await runChequePrintPdf(html, payload.title || "صك");
  } catch (err) {
    console.error("printChequeWithImage:", err);
    return false;
  } finally {
    resetMainPageLayout();
    onEnd?.();
  }
}

/**
 * طباعة صورة القالب فقط — بدون بيانات (للتجربة والمعايرة).
 */
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

    const html = buildChequeImageOnlyPrintHtml({
      template,
      title: prepared.title || "صك",
      imageUrl,
      printCalib: prepared.printCalib,
      fields: prepared.fields,
    });
    if (!html) return false;
    return await runChequePrintPdf(html, prepared.title || "صك");
  } catch (err) {
    console.error("printChequeImageOnly:", err);
    return false;
  } finally {
    resetMainPageLayout();
    onEnd?.();
  }
}

/** @deprecated استخدم printChequeData — طباعة بيانات وليس صورة */
export async function printChequeElement(_element, options = {}) {
  return printChequeData(options);
}
