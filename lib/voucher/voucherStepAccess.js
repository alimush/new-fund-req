import { PERMISSIONS } from "@/lib/permission";
import { isApprovalOnlyCompany } from "@/lib/companies/expenseTypeCompanies";
import { hasVoucherPermissionForRequest } from "@/lib/voucher/resolveVoucherCompanyKey";

function safeString(v) {
  return String(v ?? "").trim();
}

/** آخر خطوة موافَق عليها والطلب Approved */
export function isFinalApprovedVoucherStep(requestDoc) {
  if (!requestDoc) return false;
  if (safeString(requestDoc.status).toLowerCase() === "cancelled") return false;
  const steps = requestDoc?.workflow?.steps || [];
  if (!steps.length) return false;
  const lastIdx = steps.length - 1;
  const step = steps[lastIdx];
  if (!step) return false;
  return (
    safeString(requestDoc.status) === "Approved" &&
    Number(requestDoc.currentStep) === lastIdx &&
    safeString(step.status) === "Approved"
  );
}

/**
 * مخوّل على آخر خطوة بعد اكتمال الموافقة (إنشاء/رفع وصل).
 * إن وُجد تخويل صرف → فقط المخوَّل له.
 */
export function canActOnVoucherStep(requestDoc, userId, stepIndex = null) {
  if (!requestDoc || !userId) return false;
  const steps = requestDoc?.workflow?.steps || [];
  if (!steps.length) return false;
  const lastIdx = steps.length - 1;
  const idx = stepIndex == null ? lastIdx : Number(stepIndex);
  if (idx !== lastIdx) return false;
  const step = steps[idx];
  if (!step) return false;

  if (!isFinalApprovedVoucherStep(requestDoc)) return false;

  const currentId = String(userId);
  const inStep = (step.users || []).some((u) => String(u) === currentId);
  if (!inStep) return false;

  const delegatedTo = step?.voucherDelegateTo ? String(step.voucherDelegateTo) : "";
  if (delegatedTo) return delegatedTo === currentId;
  return true;
}

/** VOUCHER_DELEGATE: عرض وصل مصروف عبر تخويل */
export function canDelegateViewDisbursedVoucher(requestDoc, allowedPerms = []) {
  if (!Array.isArray(allowedPerms) || !allowedPerms.includes(PERMISSIONS.VOUCHER_DELEGATE)) {
    return false;
  }
  if (!isFinalApprovedVoucherStep(requestDoc)) return false;

  const step = requestDoc.workflow.steps[requestDoc.workflow.steps.length - 1];
  const wasDelegated =
    step?.voucherDelegateTo != null ||
    safeString(step?.voucherDelegateToUsername);
  if (!wasDelegated) return false;

  return Boolean(
    step?.voucherProcessedAt ||
      step?.voucherProcessedBy ||
      step?.voucherNo ||
      step?.voucherId
  );
}

/**
 * الكاشير الرئيسي (VOUCHER_DELEGATE + صلاحية وصولات الشركة):
 * يقدر يصدر وصل صرف ويربطه بالطلب قبل اكتمال الموافقات.
 */
export function canMainCashierEarlyIssuePayment({
  requestDoc,
  requestCompanyKey,
  userId,
  allowedPerms = [],
  mode = "payment",
} = {}) {
  if (safeString(mode) !== "payment") return false;
  if (!requestDoc || !userId) return false;

  const status = safeString(requestDoc.status);
  if (!status || status.toLowerCase() === "cancelled") return false;
  if (status === "Rejected") return false;

  const company = safeString(requestCompanyKey || requestDoc.companyKey);
  if (!company || isApprovalOnlyCompany(company)) return false;

  if (!Array.isArray(allowedPerms) || !allowedPerms.includes(PERMISSIONS.VOUCHER_DELEGATE)) {
    return false;
  }

  return hasVoucherPermissionForRequest(company, allowedPerms);
}

/** إنشاء/ربط وصل صرف من طلب: إما بعد الموافقة النهائية أو صرف مبكر من الكاشير الرئيسي */
export function canIssuePaymentVoucherForRequest({
  requestDoc,
  requestCompanyKey,
  userId,
  allowedPerms = [],
  mode = "payment",
} = {}) {
  if (canActOnVoucherStep(requestDoc, userId)) return true;
  return canMainCashierEarlyIssuePayment({
    requestDoc,
    requestCompanyKey,
    userId,
    allowedPerms,
    mode,
  });
}

/**
 * رفع مرفق وصل على آخر خطوة بعد الموافقة النهائية:
 * مخوّل الخطوة، أو الكاشير الرئيسي (تخويل + صلاحية وصولات).
 */
export function canUploadVoucherAttachment({
  requestDoc,
  requestCompanyKey,
  userId,
  allowedPerms = [],
  stepIndex = null,
} = {}) {
  if (canActOnVoucherStep(requestDoc, userId, stepIndex)) return true;
  if (!isFinalApprovedVoucherStep(requestDoc)) return false;
  return canMainCashierEarlyIssuePayment({
    requestDoc,
    requestCompanyKey,
    userId,
    allowedPerms,
    mode: "payment",
  });
}
