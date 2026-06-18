import {
  fieldsFromTemplate,
  mergeTemplateFields,
} from "@/lib/cheques/mergeFields";
import {
  defaultPrintCalib,
  normalizePrintCalib,
  normalizeWizardCalibSource,
  resolveWizardPrintCalib,
} from "@/lib/cheques/printCalib";
import { normalizeWizardPrintCalib } from "@/lib/cheques/wizardCopyLayouts";
import { normalizeWizardTestCopyCount } from "@/lib/cheques/chequePrintPageStyles";
import { mergePrintCalibs, readStoredPrinterName } from "@/lib/cheques/printerCalibration";
import {
  LAYOUT_FONT_SCALE_DEFAULT,
  clampLayoutFontScale,
} from "@/lib/cheques/chequeDesignMetrics";

function mergedFieldsFromLayout(template, layoutData, fallbackFields = []) {
  if (Array.isArray(layoutData) && layoutData.length) {
    return mergeTemplateFields(template, layoutData);
  }
  if (fallbackFields?.length) return fallbackFields;
  return fieldsFromTemplate(template);
}

/**
 * تحميل إعدادات الطباعة — القالب + معايرة الطابعة (إن وُجدت).
 */
export async function fetchChequePrintBundle(
  templateKey,
  template,
  fields = [],
  printerName = ""
) {
  const fallbackSlashes = template?.dateShowSlashesDefault ?? true;
  const fallbackFields = mergedFieldsFromLayout(template, [], fields);

  if (!templateKey || !template) {
    return {
      fields: fallbackFields,
      printCalib: defaultPrintCalib(template, fallbackFields),
      resolvedWizardCalib: defaultPrintCalib(template, fallbackFields),
      wizardTestCopyCount: normalizeWizardTestCopyCount(),
      dateShowSlashes: fallbackSlashes,
      printerName: "",
      calibrationId: null,
      globalFontScale: LAYOUT_FONT_SCALE_DEFAULT,
    };
  }

  try {
    const layoutRes = await fetch(
      `/api/cheques/layout?templateKey=${encodeURIComponent(templateKey)}`,
      { cache: "no-store" }
    );
    const layoutJson = await layoutRes.json();

    let layoutFields = fallbackFields;
    let layoutCalib = defaultPrintCalib(template, fallbackFields);
    let dateShowSlashes = fallbackSlashes;
    let globalFontScale = LAYOUT_FONT_SCALE_DEFAULT;
    let wizardTestCopyCount = normalizeWizardTestCopyCount();
    let wizardCalibSource = normalizeWizardCalibSource();
    let wizardPrintCalib = null;
    let resolvedWizardCalib = layoutCalib;

    if (layoutJson?.success) {
      layoutFields = mergedFieldsFromLayout(template, layoutJson.data, fields);
      layoutCalib = normalizePrintCalib(layoutJson.printCalib, template, layoutFields);
      dateShowSlashes =
        typeof layoutJson.dateShowSlashes === "boolean"
          ? layoutJson.dateShowSlashes
          : fallbackSlashes;
      globalFontScale = clampLayoutFontScale(layoutJson.globalFontScale ?? 100);

      wizardCalibSource = normalizeWizardCalibSource(layoutJson.wizardCalibSource);
      wizardTestCopyCount = normalizeWizardTestCopyCount(layoutJson.wizardTestCopyCount);
      wizardPrintCalib = normalizeWizardPrintCalib(
        layoutJson.wizardPrintCalib,
        template,
        layoutFields,
        wizardTestCopyCount
      );
    }

    let printerCalib = null;
    let calibrationId = null;
    let resolvedPrinter = String(printerName || "").trim();

    if (resolvedPrinter) {
      const calRes = await fetch(
        `/api/cheques/calibration?templateKey=${encodeURIComponent(templateKey)}&printerName=${encodeURIComponent(resolvedPrinter)}`,
        { cache: "no-store" }
      );
      const calJson = await calRes.json();
      if (calJson?.success) {
        printerCalib = calJson.printerCalib;
        calibrationId = calJson.calibrationId;
        resolvedPrinter = calJson.printerName || resolvedPrinter;
      }
    } else {
      const calRes = await fetch(
        `/api/cheques/calibration?templateKey=${encodeURIComponent(templateKey)}`,
        { cache: "no-store" }
      );
      const calJson = await calRes.json();
      if (calJson?.success && calJson.printerName) {
        printerCalib = calJson.printerCalib;
        calibrationId = calJson.calibrationId;
        resolvedPrinter = calJson.printerName;
      }
    }

    const printCalib = normalizeWizardPrintCalib(
      mergePrintCalibs(layoutCalib, printerCalib, template, layoutFields),
      template,
      layoutFields,
      wizardTestCopyCount
    );
    resolvedWizardCalib = resolveWizardPrintCalib({
      printCalib,
      wizardPrintCalib,
      wizardCalibSource,
      template,
      fields: layoutFields,
      copyCount: wizardTestCopyCount,
    });

    return {
      fields: layoutFields,
      printCalib,
      layoutCalib,
      printerCalib,
      resolvedWizardCalib,
      wizardPrintCalib,
      wizardCalibSource,
      wizardTestCopyCount,
      dateShowSlashes,
      printerName: resolvedPrinter,
      calibrationId,
      globalFontScale,
    };
  } catch {
    //
  }

  const fallbackCalib = defaultPrintCalib(template, fallbackFields);
  return {
    fields: fallbackFields,
    printCalib: fallbackCalib,
    resolvedWizardCalib: fallbackCalib,
    wizardTestCopyCount: normalizeWizardTestCopyCount(),
    dateShowSlashes: fallbackSlashes,
    printerName: "",
    calibrationId: null,
    globalFontScale: LAYOUT_FONT_SCALE_DEFAULT,
  };
}

export async function fetchPrintCalib(templateKey, template, fields = [], printerName = "") {
  const bundle = await fetchChequePrintBundle(templateKey, template, fields, printerName);
  return bundle.printCalib;
}

export async function fetchPrinterCalibrationList(templateKey) {
  if (!templateKey) return [];
  try {
    const res = await fetch(
      `/api/cheques/calibration?templateKey=${encodeURIComponent(templateKey)}&list=1`,
      { cache: "no-store" }
    );
    const json = await res.json();
    return json?.success ? json.items || [] : [];
  } catch {
    return [];
  }
}
