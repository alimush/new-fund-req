import { userCanApproveOnLastStep } from "@/lib/workflow/canApproveAtStep";
import { notDisbursedRequestMatch } from "@/lib/voucher/disbursementStatusMatch";
import {
  voucherLookupByRequestPipeline,
  voucherLookupLetFields,
} from "@/lib/voucher/voucherLookupPipeline";

/** نفس منطق tab=pending في disbursement-report */
export function buildPendingDisbursementCountPipeline({
  uid,
  username,
  permissions = [],
}) {
  const uname = String(username || "").trim();
  const userIdStr = String(uid || "");
  const delegateOr = [
    { "_step.voucherDelegateTo": uid },
    { "_step.voucherDelegateTo": userIdStr },
  ];
  if (uname) delegateOr.push({ "_step.voucherDelegateToUsername": uname });

  const visibilityOr = [
    // مخوَّل بالتخويل — مبكر أو بعد الموافقة، طالما التخويل قائم
    { $or: delegateOr },
  ];

  if (userCanApproveOnLastStep(permissions)) {
    visibilityOr.push({
      $and: [
        { status: { $in: ["Approved", "approved"] } },
        { $expr: { $eq: ["$currentStep", "$_lastIdx"] } },
        { "_step.status": { $in: ["Approved", "approved"] } },
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
    {
      $match: {
        status: {
          $nin: ["Cancelled", "cancelled", "Rejected", "rejected"],
        },
      },
    },
    {
      $addFields: {
        _lastIdx: { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] },
      },
    },
    { $match: { $expr: { $gte: ["$_lastIdx", 0] } } },
    { $addFields: { _step: { $arrayElemAt: ["$workflow.steps", "$_lastIdx"] } } },
    { $match: { $or: visibilityOr } },
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
