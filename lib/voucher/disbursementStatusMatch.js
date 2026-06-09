/** مطابقة Mongo: هل آخر خطوة مُعلَّمة كمصروفة (Approve المخوّل أو وصل) */

export function stepNotProcessedOnLastMatch() {
  return {
    $and: [
      {
        $or: [
          { "_step.voucherProcessedAt": null },
          { "_step.voucherProcessedAt": { $exists: false } },
        ],
      },
      {
        $or: [
          { "_step.voucherProcessedBy": null },
          { "_step.voucherProcessedBy": { $exists: false } },
        ],
      },
    ],
  };
}

export function stepProcessedOnLastMatch() {
  return {
    $or: [
      { "_step.voucherProcessedAt": { $ne: null } },
      { "_step.voucherProcessedBy": { $ne: null } },
      {
        $and: [
          { "_step.voucherProcessedByUsername": { $exists: true } },
          { "_step.voucherProcessedByUsername": { $ne: "" } },
        ],
      },
    ],
  };
}

/** غير مصروف = لا وصل ولم يُضغط Approve من المخوّل */
export function notDisbursedRequestMatch(voucherFieldPath = "__v.0") {
  return {
    $and: [{ [voucherFieldPath]: { $exists: false } }, stepNotProcessedOnLastMatch()],
  };
}

/** مصروف = وصل موجود أو Approve المخوّل */
export function disbursedRequestMatch(voucherFieldPath = "__v.0") {
  return {
    $or: [{ [voucherFieldPath]: { $exists: true } }, stepProcessedOnLastMatch()],
  };
}

/** تعبير isDisbursed في $project */
export function isDisbursedProjectExpr() {
  return {
    $cond: [
      {
        $or: [
          { $gt: [{ $size: { $ifNull: ["$__v", []] } }, 0] },
          { $ne: ["$_step.voucherProcessedAt", null] },
          { $ne: ["$_step.voucherProcessedBy", null] },
        ],
      },
      true,
      false,
    ],
  };
}
