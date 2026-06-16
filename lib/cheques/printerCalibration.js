import { normalizePrintCalib, printCalibPayload } from "@/lib/cheques/printCalib";

export function printerStorageKey(templateKey) {
  return `cheque-printer-name:${templateKey}`;
}

export function readStoredPrinterName(templateKey) {
  if (typeof window === "undefined" || !templateKey) return "";
  try {
    return String(localStorage.getItem(printerStorageKey(templateKey)) || "").trim();
  } catch {
    return "";
  }
}

export function writeStoredPrinterName(templateKey, printerName) {
  if (typeof window === "undefined" || !templateKey) return;
  try {
    const name = String(printerName || "").trim();
    if (name) localStorage.setItem(printerStorageKey(templateKey), name);
    else localStorage.removeItem(printerStorageKey(templateKey));
  } catch {
    //
  }
}

/** دمج معايرة القالب + معايرة الطابعة (الطابعة تتجاوز القالب) */
export function mergePrintCalibs(layoutCalib, printerCalib, template, fields) {
  const base = normalizePrintCalib(layoutCalib, template, fields);
  if (!printerCalib) return base;
  return normalizePrintCalib({ ...base, ...printerCalib }, template, fields);
}

export function printCalibFromPrinterDoc(doc) {
  if (!doc?.printCalib) return null;
  return doc.printCalib;
}

export { printCalibPayload, normalizePrintCalib };
