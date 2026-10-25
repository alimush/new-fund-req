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

function normalizeIdList(arr) {
  const out = [];
  const seen = new Set();
  for (const x of Array.isArray(arr) ? arr : []) {
    const id = safeString(x);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * ربط وصل بطلب صرف.
 * يدعم طلب واحد ← عدة وصولات (يُحدَّث requestId على الوصل ويُضاف لـ step.voucherIds).
 */
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
  if (
    !voucherBelongsToRequest(voucher, { requestId: rid, requestCode: rcode }) &&
    (existingVid || existingCode)
  ) {
    return { ok: false, reason: "voucher_mismatch" };
  }

  await Voucher.updateOne(
    { _id: voucher._id },
    { $set: { requestId: rid, requestCode: rcode, requestCompanyKey: company } }
  );

  const lastIdx = req.workflow.steps.length - 1;
  const step = req.workflow.steps[lastIdx];
  const stepVid = safeString(step.voucherId);
  let ids = normalizeIdList(step.voucherIds);

  if (stepVid && !ids.includes(stepVid)) {
    // وصل قديم على الخطوة لكنه يخص طلباً آخر → تجاهله
    if (Types.ObjectId.isValid(stepVid)) {
      const stepVoucher = await Voucher.findById(stepVid).lean();
      if (
        stepVoucher &&
        !voucherBelongsToRequest(stepVoucher, { requestId: rid, requestCode: rcode })
      ) {
        step.voucherId = "";
        step.voucherNo = "";
      } else if (stepVoucher) {
        ids = [stepVid, ...ids.filter((x) => x !== stepVid)];
      }
    }
  }

  if (!ids.includes(vid)) ids.push(vid);
  step.voucherIds = ids;

  // الأساسي = أول وصل مربوط (لا نستبدل عند إضافة وصل إضافي)
  if (!safeString(step.voucherId)) {
    step.voucherId = String(voucher._id);
    step.voucherNo = voucherNoLabel(voucher);
  } else if (requestIdsEqual(step.voucherId, vid)) {
    step.voucherNo = voucherNoLabel(voucher);
  } else if (ids.length > 1) {
    const nos = [];
    for (const id of ids.slice(0, 5)) {
      if (!Types.ObjectId.isValid(id)) continue;
      const v = await Voucher.findById(id).select("voucherNo seq").lean();
      const label = voucherNoLabel(v);
      if (label) nos.push(label);
    }
    if (nos.length) step.voucherNo = nos.join(" · ");
  }

  if (!step.voucherProcessedAt) {
    step.voucherProcessedAt = new Date();
    if (userId && Types.ObjectId.isValid(String(userId))) {
      step.voucherProcessedBy = new Types.ObjectId(String(userId));
    }
    if (username) step.voucherProcessedByUsername = safeString(username);
  }

  req.markModified(`workflow.steps.${lastIdx}`);
  await req.save();
  return {
    ok: true,
    voucherNo: voucherNoLabel(voucher),
    voucherIds: ids,
    linkedCount: ids.length,
  };
}
