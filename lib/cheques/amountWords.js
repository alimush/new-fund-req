import { cleanAmount, numberToArabicWords } from "@/lib/voucher/utils";
import { splitChequeAmountWordsToFit } from "@/lib/cheques/amountWordsBoxFit";
import { singleLineText } from "@/lib/cheques/singleLineText";

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

/** تقسيم fallback بدون قياس DOM — النص القصير كله بالسطر الأول */
export function splitChequeAmountWords(full) {
  const text = String(full || "").trim();
  if (!text) return { line1: "", line2: "" };

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 8) return { line1: text, line2: "" };

  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(" "),
    line2: words.slice(mid).join(" "),
  };
}

export function amountNumericToWordsLines(
  value,
  line1Field,
  template,
  layoutFontScale = 100,
  containerWidthPx,
  boxMetrics = null
) {
  const full = amountToArabicChequeWords(value);
  if (line1Field && template) {
    const fitted = splitChequeAmountWordsToFit(
      full,
      line1Field,
      template,
      layoutFontScale,
      containerWidthPx,
      boxMetrics
    );
    if (fitted) return fitted;
  }
  return splitChequeAmountWords(full);
}

/** تحديث values بسطري المبلغ كتابة بعد التقسيم حسب عرض الحقل */
export function mergeAmountWordsLines(
  values,
  line1Field,
  template,
  layoutFontScale = 100,
  containerWidthPx,
  boxMetrics = null
) {
  if (!values?.amountNumeric || !template) return values;
  const { line1, line2 } = amountNumericToWordsLines(
    values.amountNumeric,
    line1Field,
    template,
    layoutFontScale,
    containerWidthPx,
    boxMetrics
  );
  const next1 = singleLineText(line1);
  const next2 = singleLineText(line2);
  if (
    next1 === singleLineText(values.amountWords) &&
    next2 === singleLineText(values.amountWordsLine2)
  ) {
    return values;
  }
  return { ...values, amountWords: next1, amountWordsLine2: next2 };
}
