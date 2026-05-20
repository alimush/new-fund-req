import { Types } from "mongoose";
import Voucher from "@/models/Voucher";
import { getModelForCompany } from "@/models/Request";
import { safeString, voucherBelongsToRequest } from "@/lib/voucher/voucherRequestMatch";
import { linkVoucherToRequest } from "@/lib/voucher/linkVoucherToRequest";

/** يزيل voucherId/voucherNo الخاطئ من آخر خطوة (نسخ جماعي لـ 195 مثلاً) */
export async function clearWrongStepVoucherFields({
  requestCompanyKey,
  requestId,
  requestCode = "",
}) {
  const company = safeString(requestCompanyKey);
  const rid = safeString(requestId);
  if (!company || !rid) return { cleared: false };

  const RequestModel = getModelForCompany(company);
  let req = await RequestModel.findOne({ _id: rid, companyKey: company });
  if (!req) req = await RequestModel.findById(rid);
  if (!req?.workflow?.steps?.length) return { cleared: false };

  const rcode = safeString(requestCode) || safeString(req.requestCode);
  const ctx = { requestId: rid, requestCode: rcode };
  const lastIdx = req.workflow.steps.length - 1;
  const step = req.workflow.steps[lastIdx];
  let dirty = false;

  const stepVid = safeString(step.voucherId);
  if (stepVid && Types.ObjectId.isValid(stepVid)) {
    const v = await Voucher.findById(stepVid).lean();
    if (!voucherBelongsToRequest(v, ctx)) {
      step.voucherId = "";
      step.voucherNo = "";
      dirty = true;
    }
  } else if (safeString(step.voucherNo)) {
    step.voucherNo = "";
    dirty = true;
  }

  if (dirty) {
    req.markModified(`workflow.steps.${lastIdx}`);
    await req.save();
  }
  return { cleared: dirty };
}

export async function reconcileRequestVoucher({
  requestCompanyKey,
  requestId,
  requestCode = "",
  voucher,
  userId = null,
  username = "",
}) {
  await clearWrongStepVoucherFields({ requestCompanyKey, requestId, requestCode });

  if (!voucher?._id) return { linked: false };

  const linked = await linkVoucherToRequest({
    requestCompanyKey,
    requestId,
    voucherId: String(voucher._id),
    userId,
    username,
  });
  return { linked: Boolean(linked?.ok), reason: linked?.reason };
}
