import {
  voucherLookupByRequestPipeline,
  voucherLookupLetFields,
} from "@/lib/voucher/voucherLookupPipeline";

const STATUS_APPROVED = {
  status: { $in: ["Approved", "approved"], $nin: ["Cancelled", "cancelled"] },
};

/** طلبات معتمدة على آخر خطوة بدون ربط وصل صحيح (DB أو voucherId على الخطوة) */
export function buildRequestsNeedingVoucherLinkPipeline({ requestCode = "" } = {}) {
  const code = String(requestCode || "").trim();

  const pipeline = [
    { $match: STATUS_APPROVED },
    {
      $addFields: {
        _lastIdx: { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] },
      },
    },
    { $match: { $expr: { $gte: ["$_lastIdx", 0] } } },
    { $addFields: { _step: { $arrayElemAt: ["$workflow.steps", "$_lastIdx"] } } },
    {
      $match: {
        $expr: { $eq: ["$currentStep", "$_lastIdx"] },
        "_step.status": { $in: ["Approved", "approved"] },
      },
    },
    {
      $lookup: {
        from: "vouchers",
        let: voucherLookupLetFields(),
        pipeline: voucherLookupByRequestPipeline(),
        as: "__v",
      },
    },
    {
      $addFields: {
        linkedVoucher: { $arrayElemAt: ["$__v", 0] },
        stepVoucherId: { $ifNull: ["$_step.voucherId", ""] },
        stepVoucherNo: { $ifNull: ["$_step.voucherNo", ""] },
        voucherProcessedAt: "$_step.voucherProcessedAt",
      },
    },
    {
      $match: {
        $expr: {
          $or: [
            { $eq: ["$linkedVoucher", null] },
            { $eq: ["$stepVoucherId", ""] },
            {
              $and: [
                { $ne: ["$linkedVoucher", null] },
                {
                  $ne: [
                    { $toString: "$stepVoucherId" },
                    { $toString: "$linkedVoucher._id" },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  ];

  if (code) {
    pipeline.push({
      $match: {
        requestCode: { $regex: code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
      },
    });
  }

  pipeline.push(
    { $sort: { createdAt: -1 } },
    {
      $project: {
        requestCode: 1,
        description: 1,
        companyKey: 1,
        createdAt: 1,
        createdBy: 1,
        currency: 1,
        items: 1,
        totalAmount: 1,
        paymentVoucher: 1,
        voucherProcessedAt: 1,
        stepVoucherId: 1,
        stepVoucherNo: 1,
        linkedVoucherNo: "$linkedVoucher.voucherNo",
        linkedVoucherSeq: "$linkedVoucher.seq",
        linkedVoucherId: "$linkedVoucher._id",
        linkIssue: {
          $switch: {
            branches: [
              {
                case: { $eq: ["$linkedVoucher", null] },
                then: "no_voucher",
              },
              {
                case: { $eq: ["$stepVoucherId", ""] },
                then: "missing_step_id",
              },
            ],
            default: "step_mismatch",
          },
        },
      },
    }
  );

  return pipeline;
}

export function toAdminLinkRequestRow(doc) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  let amount = typeof doc.totalAmount === "number" ? doc.totalAmount : 0;
  if (!amount && items.length) {
    amount = items.reduce((s, it) => {
      const q = Number(it?.qty ?? 1);
      const p = Number(it?.price ?? 0);
      return s + (Number.isFinite(q) ? q : 1) * (Number.isFinite(p) ? p : 0);
    }, 0);
  }
  const seq = doc.linkedVoucherSeq;
  const linkedNo =
    doc.linkedVoucherNo ||
    (seq != null ? String(seq).padStart(5, "0") : "");

  return {
    _id: String(doc._id),
    companyKey: doc.companyKey,
    requestCode: doc.requestCode || "",
    description: doc.description || "",
    createdAt: doc.createdAt,
    createdBy: doc.createdBy || "",
    currency: doc.currency || "IQD",
    amount,
    voucherProcessedAt: doc.voucherProcessedAt || null,
    stepVoucherId: doc.stepVoucherId || "",
    stepVoucherNo: doc.stepVoucherNo || "",
    linkedVoucherId: doc.linkedVoucherId ? String(doc.linkedVoucherId) : "",
    linkedVoucherNo: linkedNo,
    linkIssue: doc.linkIssue || "no_voucher",
  };
}
