/** مطابقة vouchers مع الطلب: requestId (نص/ObjectId) أو requestCode */
export function voucherLookupByRequestPipeline(projectExtra = true) {
  const tail = projectExtra
    ? [{ $project: { voucherNo: 1, seq: 1, createdByUserId: 1, createdAt: 1, requestId: 1, requestCode: 1 } }]
    : [];

  return [
    {
      $match: {
        $expr: {
          $or: [
            { $eq: ["$requestId", "$$rid"] },
            { $eq: [{ $toString: { $ifNull: ["$requestId", ""] } }, "$$rid"] },
            {
              $and: [
                { $ne: ["$$rcode", ""] },
                { $eq: [{ $ifNull: ["$requestCode", ""] }, "$$rcode"] },
              ],
            },
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: 1 },
    ...tail,
  ];
}

export function voucherLookupLetFields() {
  return {
    rid: { $toString: "$_id" },
    rcode: { $ifNull: ["$requestCode", ""] },
  };
}
