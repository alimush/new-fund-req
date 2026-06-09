import { formatAmount } from "@/lib/voucher/utils";
import { singleLineText } from "@/lib/cheques/singleLineText";

/** تحويل مستند Mongo إلى قيم نموذج الصك */
export function chequeDocToValues(doc) {
  if (!doc) return {};
  const amount =
    doc.amountNumeric != null && Number(doc.amountNumeric) > 0
      ? formatAmount(String(doc.amountNumeric))
      : "";

  return {
    dateDay: doc.dateParts?.dd || "",
    dateMonth: doc.dateParts?.mm || "",
    dateYear: doc.dateParts?.yy || "",
    payee: doc.payee || "",
    governorate: doc.governorate || "",
    amountNumeric: amount,
    amountWords: singleLineText(doc.amountWords || ""),
    text: doc.text || "",
    chequeNumber: doc.chequeNumber || "",
    accountNumber: doc.accountNumber || "",
  };
}
