/** شركات تدعم حقل نوع المصروف (مصروف / غير مصروف) */
const EXPENSE_TYPE_COMPANY_KEYS = new Set(["al-rida", "alleanza"]);

/** مفاتيح Mongo كما تُخزَّن في companyKey */
export const APPROVAL_ONLY_COMPANY_KEYS = ["Al-Rida", "alleanza"];

export function supportsExpenseType(companyKey) {
  return EXPENSE_TYPE_COMPANY_KEYS.has(
    String(companyKey || "").trim().toLowerCase()
  );
}

/** الرضا واليانزا: آخر خطوة موافقة/رفض فقط — بدون صرف أو وصولات */
export function isApprovalOnlyCompany(companyKey) {
  return supportsExpenseType(companyKey);
}
