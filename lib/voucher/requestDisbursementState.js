import { findVoucherForRequest } from "@/lib/voucher/findVoucherForRequest";
import {
  findVouchersForRequest,
  summarizeVouchers,
} from "@/lib/voucher/findVouchersForRequest";
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

  let vouchers = await findVouchersForRequest({
    requestId: rid,
    requestCode,
    requestCompanyKey: company,
  });

  // توافق خلفي: إن لم نجد مجموعة، جرّب البحث الفردي القديم (+ legacy)
  if (!vouchers.length) {
    const single = await findVoucherForRequest({
      requestId: rid,
      requestCode,
      requestCompanyKey: company,
      allowedPerms,
      hintCompanyKey,
    });
    if (single) vouchers = [single];
  }

  const summary = summarizeVouchers(vouchers);
  const hasVoucher = summary.hasVoucher;
  const isDisbursed = hasVoucher || stepDisbursed;

  return {
    isDisbursed,
    hasVoucher,
    stepDisbursed,
    voucher: vouchers[0] || null,
    vouchers,
    voucherItems: summary.items,
    voucherNo: summary.voucherNo,
    voucherNos: summary.voucherNos,
    voucherNosLabel: summary.voucherNosLabel,
    voucherId: summary.voucherId,
    voucherIds: summary.voucherIds,
    voucherCount: summary.count,
  };
}
