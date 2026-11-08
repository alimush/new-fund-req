/** حقول الوصل اللازمة لإعادة بناء تقرير الطباعة اليومي */

const KEYS = [
  "_id",
  "companyKey",
  "companyName",
  "mode",
  "seq",
  "voucherNo",
  "voucherDate",
  "dateParts",
  "amount",
  "amountText",
  "currency",
  "description",
  "bank",
  "fxRate",
  "chequeNo",
  "receivedBy",
  "beneficiary",
  "categoryChecks",
  // نقداً / شيك — بدونها إعادة الطباعة تصنّف الكل مصرفي
  "cbOne",
  "cbTwo",
  "vAmount",
  "vCurrency",
  "vDesc",
  "vDateYY",
  "vDateMM",
  "vDateDD",
];

export function leanVoucherForDailyReport(v) {
  if (!v || typeof v !== "object") return null;
  const out = {};
  for (const k of KEYS) {
    if (v[k] !== undefined) out[k] = v[k];
  }
  if (v._id != null) out._id = String(v._id);
  return out;
}

export function leanVouchersForDailyReport(list) {
  return (Array.isArray(list) ? list : [])
    .map(leanVoucherForDailyReport)
    .filter(Boolean);
}
