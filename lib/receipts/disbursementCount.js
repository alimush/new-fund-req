import { userCanApproveOnLastStep } from "@/lib/workflow/canApproveAtStep";
import { notDisbursedRequestMatch } from "@/lib/voucher/disbursementStatusMatch";
import {
  voucherLookupByRequestPipeline,
  voucherLookupLetFields,
} from "@/lib/voucher/voucherLookupPipeline";

const STATUS_MATCH_APPROVED_NOT_CANCELLED = {
  status: { $in: ["Approved", "approved"], $nin: ["Cancelled", "cancelled"] },
};

/** نفس منطق tab=pending في disbursement-report */
export function buildPendingDisbursementCountPipeline({
  uid,
  username,
  permissions = [],
}) {
  const uname = String(username || "").trim();
  const delegateOr = [{ "_step.voucherDelegateTo": uid }];
  if (uname) delegateOr.push({ "_step.voucherDelegateToUsername": uname });

  const canActOr = [...delegateOr];
  if (userCanApproveOnLastStep(permissions)) {
    canActOr.push({
      $and: [
        {
          $or: [
            { "_step.voucherDelegateTo": null },
            { "_step.voucherDelegateTo": { $exists: false } },
          ],
        },
        { "_step.users": { $in: [uid] } },
      ],
    });
  }

  return [
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
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
        $or: canActOr,
      },
    },
    {
      $lookup: {
        from: "vouchers",
        let: voucherLookupLetFields(),
        pipeline: voucherLookupByRequestPipeline(false),
        as: "__vrow",
      },
    },
    {
      $match: notDisbursedRequestMatch("__vrow.0"),
    },
    { $count: "c" },
  ];
}

export async function countPendingDisbursement(Model, ctx) {
  const rows = await Model.aggregate(buildPendingDisbursementCountPipeline(ctx));
  return rows?.[0]?.c || 0;
}
