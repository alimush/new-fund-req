import ChequeLayout from "@/models/ChequeLayout";
import { getChequeTemplate } from "@/lib/cheques/templates";
import { filterLayoutForTemplate } from "@/lib/cheques/mergeFields";
import {
  RAFIDAIN_TEMPLATE_KEY,
  REAL_ESTATE_TEMPLATE_KEY,
} from "@/lib/cheques/chequeBranches";

function hasMeaningfulPrintCalib(printCalib) {
  if (!printCalib || typeof printCalib !== "object") return false;
  if (printCalib.offsetXmm || printCalib.offsetYmm) return true;
  if (printCalib.pageTopMm || printCalib.pageLeftMm) return true;
  const offsets = printCalib.fieldOffsets;
  if (!offsets || typeof offsets !== "object") return false;
  return Object.values(offsets).some(
    (item) => item && (Number(item.offsetXmm) || Number(item.offsetYmm))
  );
}

/** هل صك الرافدين ما زال يعتمد على تخطيط العقاري؟ */
export function shouldRafidainInheritRealEstateLayout(ownDoc) {
  if (!ownDoc) return true;
  const tpl = getChequeTemplate(RAFIDAIN_TEMPLATE_KEY);
  const ownFields = filterLayoutForTemplate(tpl, ownDoc?.fields || []);
  if (!ownFields.length) return true;
  if (!hasMeaningfulPrintCalib(ownDoc.printCalib) && !hasMeaningfulPrintCalib(ownDoc.wizardPrintCalib)) {
    return true;
  }
  return false;
}

/**
 * يجلب وثيقة التخطيط — الرافدين يرث العقاري حتى يُحفظ تخطيط مستقل.
 * @returns {{ doc: object|null, inheritedFrom: string|null }}
 */
export async function resolveChequeLayoutDocument(templateKey) {
  const ownDoc = await ChequeLayout.findOne({ templateKey }).lean();

  if (templateKey !== RAFIDAIN_TEMPLATE_KEY) {
    return { doc: ownDoc, inheritedFrom: null };
  }

  const reDoc = await ChequeLayout.findOne({
    templateKey: REAL_ESTATE_TEMPLATE_KEY,
  }).lean();

  if (!shouldRafidainInheritRealEstateLayout(ownDoc)) {
    return { doc: ownDoc, inheritedFrom: null };
  }

  if (!reDoc) {
    return { doc: ownDoc, inheritedFrom: null };
  }

  return {
    doc: {
      ...reDoc,
      ...(ownDoc || {}),
      templateKey: RAFIDAIN_TEMPLATE_KEY,
      fields: (() => {
        const tpl = getChequeTemplate(RAFIDAIN_TEMPLATE_KEY);
        const ownFields = filterLayoutForTemplate(tpl, ownDoc?.fields || []);
        return ownFields.length ? ownDoc.fields : reDoc.fields;
      })(),
      printCalib: ownDoc?.printCalib && hasMeaningfulPrintCalib(ownDoc.printCalib)
        ? ownDoc.printCalib
        : reDoc.printCalib,
      wizardPrintCalib:
        ownDoc?.wizardPrintCalib && hasMeaningfulPrintCalib(ownDoc.wizardPrintCalib)
          ? ownDoc.wizardPrintCalib
          : reDoc.wizardPrintCalib || reDoc.printCalib,
      wizardCalibSource: ownDoc?.wizardCalibSource ?? reDoc.wizardCalibSource,
      wizardTestCopyCount: ownDoc?.wizardTestCopyCount ?? reDoc.wizardTestCopyCount,
      globalFontScale: ownDoc?.globalFontScale ?? reDoc.globalFontScale,
      dateShowSlashes:
        typeof ownDoc?.dateShowSlashes === "boolean"
          ? ownDoc.dateShowSlashes
          : reDoc.dateShowSlashes,
      printCalibBaseline: reDoc.printCalibBaseline,
      printCalibBaselineLabel: reDoc.printCalibBaselineLabel,
    },
    inheritedFrom: REAL_ESTATE_TEMPLATE_KEY,
  };
}
