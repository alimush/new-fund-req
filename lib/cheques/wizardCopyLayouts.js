import { getA4PaperSize } from "@/lib/cheques/chequePageSize";
import {
  chequeSheetBoundsMm,
  normalizeSheetFlip,
  normalizeSheetRotationDeg,
  normalizePrintCalib,
} from "@/lib/cheques/printCalib";
import {
  normalizeWizardTestCopyCount,
  stackedChequeCopyLayout,
  WIZARD_TEST_COPY_DEFAULT,
} from "@/lib/cheques/chequePrintPageStyles";

function round2(n) {
  return Math.round(n * 100) / 100;
}

function numOr(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** عنصر موضع نسخة واحدة — للتحكم الحر */
export function normalizeWizardCopyLayoutItem(raw, baseCalib, template, fields) {
  const base = normalizePrintCalib(baseCalib, template, fields);
  const { pageWidthMm: paperW, pageHeightMm: paperH } = getA4PaperSize();
  const widthMm = round2(clamp(numOr(raw?.widthMm, base.widthMm), 50, 178));
  const heightMm = round2(clamp(numOr(raw?.heightMm, base.heightMm), 30, 82));
  const sheetRotationDeg = normalizeSheetRotationDeg(
    raw?.sheetRotationDeg ?? base.sheetRotationDeg ?? 0
  );
  const flipHorizontal = normalizeSheetFlip(raw?.flipHorizontal ?? base.flipHorizontal);
  const flipVertical = normalizeSheetFlip(raw?.flipVertical ?? base.flipVertical);
  const bounds = chequeSheetBoundsMm({ widthMm, heightMm, sheetRotationDeg });
  const maxTop = Math.max(0, paperH - bounds.heightMm);
  const maxLeft = Math.max(0, paperW - bounds.widthMm);
  return {
    pageTopMm: round2(clamp(numOr(raw?.pageTopMm, base.pageTopMm), 0, maxTop)),
    pageLeftMm: round2(clamp(numOr(raw?.pageLeftMm, base.pageLeftMm), 0, maxLeft)),
    widthMm,
    heightMm,
    sheetRotationDeg,
    flipHorizontal,
    flipVertical,
  };
}

/** يبني/يكمل مواضع النسخ الثلاث — افتراضياً التخطيط التلقائي */
export function ensureWizardCopyLayouts(
  wizardCalib,
  copyCount = WIZARD_TEST_COPY_DEFAULT,
  template,
  fields
) {
  const base = normalizePrintCalib(wizardCalib, template, fields);
  const copies = normalizeWizardTestCopyCount(copyCount);
  const raw =
    wizardCalib?.wizardCopyLayouts && typeof wizardCalib.wizardCopyLayouts === "object"
      ? wizardCalib.wizardCopyLayouts
      : {};
  const auto = stackedChequeCopyLayout(base, copies);
  const out = {};
  for (let i = 1; i <= copies; i++) {
    const key = String(i);
    const autoItem = auto.find((x) => x.copy === i);
    const stored = raw[key];
    if (stored && typeof stored === "object") {
      out[key] = normalizeWizardCopyLayoutItem(stored, base, template, fields);
    } else if (autoItem) {
      out[key] = normalizeWizardCopyLayoutItem(
        {
          pageTopMm: autoItem.topMm,
          pageLeftMm: autoItem.leftMm,
          widthMm: autoItem.widthMm,
          heightMm: autoItem.heightMm,
          sheetRotationDeg:
            normalizeSheetRotationDeg(base.sheetRotationDeg || 0) +
            autoItem.extraRotationDeg,
        },
        base,
        template,
        fields
      );
    }
  }
  return out;
}

export function wizardCopyLayoutsToPrintItems(layouts, copyCount) {
  const copies = normalizeWizardTestCopyCount(copyCount);
  return Array.from({ length: copies }, (_, i) => {
    const key = String(i + 1);
    const item = layouts[key];
    if (!item) return null;
    return {
      copy: i + 1,
      topMm: item.pageTopMm,
      leftMm: item.pageLeftMm,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      sheetRotationDeg: item.sheetRotationDeg,
      flipHorizontal: item.flipHorizontal,
      flipVertical: item.flipVertical,
    };
  }).filter(Boolean);
}

export function attachWizardCopyLayouts(wizardCalib, template, fields, copyCount) {
  const copies = normalizeWizardTestCopyCount(copyCount);
  const normalized = normalizePrintCalib(wizardCalib, template, fields);
  return {
    ...normalized,
    wizardCopyLayouts: ensureWizardCopyLayouts(wizardCalib, copies, template, fields),
  };
}

/** معايرة Wizard كاملة مع مواضع النسخ */
export function normalizeWizardPrintCalib(
  raw,
  template,
  fields,
  copyCount = WIZARD_TEST_COPY_DEFAULT
) {
  return attachWizardCopyLayouts(raw, template, fields, copyCount);
}

export function patchWizardCopyLayout(calib, copyIndex, partial, template, fields, copyCount) {
  const copies = normalizeWizardTestCopyCount(copyCount ?? WIZARD_TEST_COPY_DEFAULT);
  const layouts = ensureWizardCopyLayouts(calib, copies, template, fields);
  const key = String(copyIndex);
  return attachWizardCopyLayouts(
    {
      ...calib,
      wizardCopyLayouts: {
        ...layouts,
        [key]: { ...layouts[key], ...partial },
      },
    },
    template,
    fields,
    copies
  );
}
