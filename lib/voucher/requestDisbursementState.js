import { findVoucherForRequest } from "@/lib/voucher/findVoucherForRequest";
import { getModelForCompany } from "@/models/Request";
import { clearWrongStepVoucherFields } from "@/lib/voucher/reconcileRequestVoucher";

function safeString(v) {
  return String(v ?? "").trim();
}

export function isStepDisbursed(step) {
  if (!step) return false;
  if (step.voucherProcessedAt) return true;
  const by = step.voucherProcessedBy;
  if (by == null) return false;
  if (typeof by === "object" && by._id) return true;
  if (typeof by === "string" && by.trim()) return true;
  return false;
}

export async function getRequestDisbursementState({
  requestCompanyKey,
  requestId,
  requestCode = "",
  allowedPerms = [],
  hintCompanyKey = "",
  autoReconcile = true,
}) {
  const company = safeString(requestCompanyKey);
  const rid = safeString(requestId);

  let stepDisbursed = false;

  if (company && rid) {
    if (autoReconcile) {
      await clearWrongStepVoucherFields({
        requestCompanyKey: company,
        requestId: rid,
        requestCode: safeString(requestCode),
      });
    }

    const RequestModel = getModelForCompany(company);
    let doc = await RequestModel.findById(rid).select("workflow.steps requestCode").lean();
    if (!doc) {
      doc = await RequestModel.findOne({ _id: rid, companyKey: company })
        .select("workflow.steps requestCode")
        .lean();
    }
    const steps = doc?.workflow?.steps || [];
    const last = steps[steps.length - 1];
    stepDisbursed = isStepDisbursed(last);
    if (!requestCode) requestCode = safeString(doc?.requestCode);
  }

  const voucher = await findVoucherForRequest({
    requestId: rid,
    requestCode,
    requestCompanyKey: company,
    allowedPerms,
    hintCompanyKey,
  });

  const hasVoucher = Boolean(voucher?._id);
  const isDisbursed = hasVoucher;

  let voucherNo = null;
  if (hasVoucher) {
    voucherNo = voucher?.voucherNo || null;
    if (!voucherNo && voucher?.seq != null) {
      voucherNo = String(voucher.seq).padStart(5, "0");
    }
  }

  return {
    isDisbursed,
    hasVoucher,
    stepDisbursed,
    voucher,
    voucherNo,
    voucherId: voucher?._id ? String(voucher._id) : null,
  };
}
