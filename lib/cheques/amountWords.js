import { cleanAmount, numberToArabicWords } from "@/lib/voucher/utils";

const MAX_CHEQUE_AMOUNT = 999_999_999_999;

/**
 * تحويل المبلغ (رقم + كسور) إلى كلمات عربية للصك — سطر واحد
 */
export function amountToArabicChequeWords(value) {
  const cleaned = cleanAmount(value);
  if (!cleaned) return "";

  const [intPart, decPart = ""] = cleaned.split(".");
  const intNum = Number(intPart);
  if (!Number.isFinite(intNum) || intNum < 0 || intNum > MAX_CHEQUE_AMOUNT) {
    return "";
  }

  let words = numberToArabicWords(Math.floor(intNum));
  const dec = decPart.replace(/0+$/, "");
  if (dec) {
    const decInt = parseInt(dec.padEnd(2, "0").slice(0, 3), 10);
    if (decInt > 0) {
      const decWords = numberToArabicWords(decInt);
      words = words
        ? `${words} و ${decWords} فلس`
        : `${decWords} فلس`;
    }
  }

  if (!words) return "";
  return `${words} دينار عراقي فقط`;
}

/** للتوافق — يُرجع نصاً واحداً فقط */
export function amountNumericToWordsLines(value) {
  const full = amountToArabicChequeWords(value);
  return { line1: full, line2: "" };
}
