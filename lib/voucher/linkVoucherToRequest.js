import { Types } from "mongoose";
import Voucher from "@/models/Voucher";
import { getModelForCompany } from "@/models/Request";
import {
  safeString,
  voucherBelongsToRequest,
  requestIdsEqual,
} from "@/lib/voucher/voucherRequestMatch";

function voucherNoLabel(voucher) {
  if (!voucher) return "";
  const n = safeString(voucher.voucherNo);
  if (n) return n;
  const s = Number(voucher.seq);
  return Number.isFinite(s) ? String(s).padStart(5, "0") : "";
}

export async function linkVoucherToRequest({
  requestCompanyKey,
  requestId,
  voucherId,
  userId = null,
  username = "",
}) {
  const company = safeString(requestCompanyKey);
  const rid = safeString(requestId);
  const vid = safeString(voucherId);
  if (!company || !rid || !vid || !Types.ObjectId.isValid(vid) || !Types.ObjectId.isValid(rid)) {
    return { ok: false, reason: "invalid_ids" };
  }

  const voucher = await Voucher.findById(vid);
  if (!voucher) return { ok: false, reason: "voucher_not_found" };

  const RequestModel = getModelForCompany(company);
  let req = await RequestModel.findOne({ _id: rid, companyKey: company });
  if (!req) req = await RequestModel.findById(rid);
  if (!req?.workflow?.steps?.length) return { ok: false, reason: "request_not_found" };

  const rcode = safeString(req.requestCode);
  const existingVid = safeString(voucher.requestId);
  const existingCode = safeString(voucher.requestCode);

  if (existingVid && !requestIdsEqual(existingVid, rid)) {
    return { ok: false, reason: "voucher_linked_to_other_request" };
  }
  if (existingCode && rcode && existingCode !== rcode) {
    return { ok: false, reason: "voucher_linked_to_other_request" };
  }
  if (!voucherBelongsToRequest(voucher, { requestId: rid, requestCode: rcode }) && (existingVid || existingCode)) {
    return { ok: false, reason: "voucher_mismatch" };
  }

  await Voucher.updateOne(
    { _id: voucher._id },
    { $set: { requestId: rid, requestCode: rcode } }
  );

  const lastIdx = req.workflow.steps.length - 1;
  const step = req.workflow.steps[lastIdx];
  const stepVid = safeString(step.voucherId);

  if (stepVid && !requestIdsEqual(stepVid, vid) && Types.ObjectId.isValid(stepVid)) {
    const stepVoucher = await Voucher.findById(stepVid).lean();
    if (stepVoucher && !voucherBelongsToRequest(stepVoucher, { requestId: rid, requestCode: rcode })) {
      step.voucherId = "";
      step.voucherNo = "";
    }
  }

  step.voucherId = String(voucher._id);
  step.voucherNo = voucherNoLabel(voucher);
  if (!step.voucherProcessedAt) {
    step.voucherProcessedAt = new Date();
    if (userId && Types.ObjectId.isValid(String(userId))) {
      step.voucherProcessedBy = new Types.ObjectId(String(userId));
    }
    if (username) step.voucherProcessedByUsername = safeString(username);
  }
  req.markModified(`workflow.steps.${lastIdx}`);
  await req.save();
  return { ok: true, voucherNo: step.voucherNo };
}
