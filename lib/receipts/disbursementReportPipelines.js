import mongoose from "mongoose";
import { userCanApproveOnLastStep } from "@/lib/workflow/canApproveAtStep";
import {
  voucherLookupByRequestPipeline,
  voucherLookupLetFields,
} from "@/lib/voucher/voucherLookupPipeline";
import {
  disbursedRequestMatch,
  isDisbursedProjectExpr,
  notDisbursedRequestMatch,
} from "@/lib/voucher/disbursementStatusMatch";

export const STATUS_MATCH_APPROVED_NOT_CANCELLED = {
  status: { $in: ["Approved", "approved"], $nin: ["Cancelled", "cancelled"] },
};

function stepApprovedOnLast() {
  return [
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
  ];
}

function voucherLookupStage() {
  return {
    $lookup: {
      from: "vouchers",
      let: voucherLookupLetFields(),
      pipeline: voucherLookupByRequestPipeline(),
      as: "__v",
    },
  };
}

function canActOrForUser(uid, username, permissions) {
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
  return canActOr;
}

function processedByMatch(targetUid, targetIdStr, targetUsername) {
  const uname = String(targetUsername || "").trim();
  const or = [
    { "_step.voucherProcessedBy": targetUid },
    { "_step.voucherProcessedBy": targetIdStr },
  ];
  if (uname) or.push({ "_step.voucherProcessedByUsername": uname });
  return { $or: or };
}

function delegateToMatch(targetUid, targetIdStr, targetUsername) {
  const uname = String(targetUsername || "").trim();
  const or = [
    { "_step.voucherDelegateTo": targetUid },
    { "_step.voucherDelegateTo": targetIdStr },
  ];
  if (uname) or.push({ "_step.voucherDelegateToUsername": uname });
  return { $or: or };
}

function delegateToNotInHoldersMatch(holderIds = [], holderUsernames = []) {
  return excludeDelegateHoldersMatch(holderIds, holderUsernames, "voucherDelegateTo");
}

function excludeDelegateHoldersMatch(
  holderIds = [],
  holderUsernames = [],
  fieldPrefix = "voucherProcessedBy"
) {
  const clauses = [];
  const ids = (holderIds || []).filter(Boolean).map(String);
  const oids = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const byKey = `_step.${fieldPrefix}`;
  const byUserKey = `_step.${fieldPrefix}Username`;

  if (oids.length || ids.length) {
    clauses.push({ [byKey]: { $nin: [...oids, ...ids] } });
  }

  const unames = (holderUsernames || []).map((u) => String(u || "").trim()).filter(Boolean);
  if (unames.length) {
    clauses.push({ [byUserKey]: { $nin: unames } });
  }

  return clauses.length ? { $and: clauses } : {};
}

/** غير مصروف = لا وصل ولم يُعتمد من المخوّل */
function notDisbursedMatch() {
  return notDisbursedRequestMatch("__v.0");
}

/** مصروف = وصل أو اعتماد المخوّل */
function disbursedMatch() {
  return disbursedRequestMatch("__v.0");
}

function wasDelegatedMatch() {
  return {
    $or: [
      { "_step.voucherDelegateTo": { $ne: null } },
      {
        $and: [
          { "_step.voucherDelegateToUsername": { $exists: true } },
          { "_step.voucherDelegateToUsername": { $ne: "" } },
        ],
      },
    ],
  };
}

function projectReportFields() {
  return [
    {
      $addFields: {
        _sortDisburse: {
          $ifNull: [
            "$_step.voucherProcessedAt",
            {
              $let: {
                vars: { d: { $arrayElemAt: ["$__v", 0] } },
                in: "$$d.createdAt",
              },
            },
            "$createdAt",
          ],
        },
        isDisbursed: isDisbursedProjectExpr(),
        wasDelegated: {
          $cond: [
            {
              $or: [
                { $ne: ["$_step.voucherDelegateTo", null] },
                {
                  $and: [
                    { $ne: ["$_step.voucherDelegateToUsername", null] },
                    { $ne: ["$_step.voucherDelegateToUsername", ""] },
                  ],
                },
              ],
            },
            true,
            false,
          ],
        },
      },
    },
    { $sort: { _sortDisburse: -1, createdAt: -1 } },
    {
      $project: {
        _id: 1,
        requestCode: 1,
        companyKey: 1,
        requestType: 1,
        description: 1,
        currency: 1,
        department: 1,
        createdBy: 1,
        createdAt: 1,
        status: 1,
        amount: 1,
        items: 1,
        isDisbursed: 1,
        wasDelegated: 1,
        voucherProcessedAt: {
          $ifNull: [
            "$_step.voucherProcessedAt",
            {
              $let: {
                vars: { d: { $arrayElemAt: ["$__v", 0] } },
                in: "$$d.createdAt",
              },
            },
          ],
        },
        voucherProcessedByUsername: {
          $ifNull: ["$_step.voucherProcessedByUsername", ""],
        },
        voucherDelegateToUsername: {
          $ifNull: ["$_step.voucherDelegateToUsername", ""],
        },
        voucherNo: {
          $let: {
            vars: { d: { $arrayElemAt: ["$__v", 0] } },
            in: "$$d.voucherNo",
          },
        },
        voucherSeq: {
          $let: {
            vars: { d: { $arrayElemAt: ["$__v", 0] } },
            in: "$$d.seq",
          },
        },
      },
    },
  ];
}

/**
 * مستخدم عادي: مخوّل للصرف (غير مصروف) + ما صرفه هو (مصروف)
 */
export function buildRegularUserReportPipeline({
  uid,
  userIdStr,
  username,
  permissions = [],
  from,
  to,
  /** all | pending | disbursed */
  mode = "all",
}) {
  const canActOr = canActOrForUser(uid, username, permissions);
  const processedOr = processedByMatch(uid, userIdStr, username);
  const pendingBranch = { $and: [notDisbursedMatch(), { $or: canActOr }] };
  const disbursedBranch = { $and: [disbursedMatch(), processedOr] };

  let scopeMatch = { $or: [pendingBranch, disbursedBranch] };
  if (mode === "pending") scopeMatch = pendingBranch;
  if (mode === "disbursed") scopeMatch = disbursedBranch;

  const pipeline = [];
  const createdMatch = {};
  if (from) createdMatch.$gte = from;
  if (to) createdMatch.$lte = to;
  if (Object.keys(createdMatch).length) {
    pipeline.push({ $match: { createdAt: createdMatch } });
  }

  pipeline.push(
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
    ...stepApprovedOnLast(),
    voucherLookupStage(),
    { $match: scopeMatch },
    ...projectReportFields()
  );

  return pipeline;
}

/**
 * مستخدم بصلاحية تخويل: غير مصروف (مخوّل بالتخويل) + مصروف (عبر التخويل، باستثناء صرف المخوّلين)
 */
export function buildDelegatedDisbursementPipeline({
  delegateHolderIds = [],
  delegateHolderUsernames = [],
  from,
  to,
  processorUid,
  processorIdStr,
  processorUsername,
  /** all | pending | disbursed */
  mode = "all",
}) {
  const pipeline = [];
  const createdMatch = {};
  if (from) createdMatch.$gte = from;
  if (to) createdMatch.$lte = to;
  if (Object.keys(createdMatch).length) {
    pipeline.push({ $match: { createdAt: createdMatch } });
  }

  const hasProcessor = Boolean(processorUid && processorIdStr);

  const pendingAnd = [notDisbursedMatch(), wasDelegatedMatch()];
  const disbursedAnd = [
    disbursedMatch(),
    wasDelegatedMatch(),
    excludeDelegateHoldersMatch(delegateHolderIds, delegateHolderUsernames),
  ];

  if (hasProcessor) {
    pendingAnd.push(delegateToMatch(processorUid, processorIdStr, processorUsername));
    disbursedAnd.push(processedByMatch(processorUid, processorIdStr, processorUsername));
  } else {
    const notHolderAssignee = delegateToNotInHoldersMatch(
      delegateHolderIds,
      delegateHolderUsernames
    );
    if (Object.keys(notHolderAssignee).length) pendingAnd.push(notHolderAssignee);
  }

  let scopeMatch = { $or: [{ $and: pendingAnd }, { $and: disbursedAnd }] };
  if (mode === "pending") scopeMatch = { $and: pendingAnd };
  if (mode === "disbursed") scopeMatch = { $and: disbursedAnd };

  pipeline.push(
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
    ...stepApprovedOnLast(),
    voucherLookupStage(),
    { $match: scopeMatch }
  );

  if (from || to) {
    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    pipeline.push({
      $match: {
        $or: [
          { createdAt: range },
          { "_step.voucherProcessedAt": range },
          { "__v.0.createdAt": range },
        ],
      },
    });
  }

  pipeline.push(...projectReportFields());
  return pipeline;
}

/**
 * فلتر على مستخدم مخوّل (مُفوَّض إليه): غير مصروف له + ما صرفه
 */
export function buildAuthorizedUserReportPipeline({
  processorUid,
  processorIdStr,
  processorUsername,
  from,
  to,
  /** all | pending | disbursed */
  mode = "all",
}) {
  const pipeline = [];
  const createdMatch = {};
  if (from) createdMatch.$gte = from;
  if (to) createdMatch.$lte = to;
  if (Object.keys(createdMatch).length) {
    pipeline.push({ $match: { createdAt: createdMatch } });
  }

  const targetPending = delegateToMatch(processorUid, processorIdStr, processorUsername);
  const targetDone = processedByMatch(processorUid, processorIdStr, processorUsername);
  const pendingBranch = {
    $and: [notDisbursedMatch(), targetPending, wasDelegatedMatch()],
  };
  const disbursedBranch = { $and: [disbursedMatch(), targetDone] };

  let scopeMatch = { $or: [pendingBranch, disbursedBranch] };
  if (mode === "pending") scopeMatch = pendingBranch;
  if (mode === "disbursed") scopeMatch = disbursedBranch;

  pipeline.push(
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
    ...stepApprovedOnLast(),
    voucherLookupStage(),
    { $match: scopeMatch },
    ...projectReportFields()
  );

  return pipeline;
}

function notDisbursedQuickMatch() {
  return notDisbursedRequestMatch("__v.0");
}

function disbursedQuickMatch() {
  return disbursedRequestMatch("__v.0");
}

const QUICK_SUGGEST_PROJECT = {
  $project: {
    _id: 1,
    requestCode: 1,
    companyKey: 1,
    description: 1,
    requestType: 1,
    voucherNo: {
      $let: {
        vars: { d: { $arrayElemAt: ["$__v", 0] } },
        in: { $ifNull: ["$$d.voucherNo", ""] },
      },
    },
    voucherSeq: {
      $let: {
        vars: { d: { $arrayElemAt: ["$__v", 0] } },
        in: "$$d.seq",
      },
    },
    isDisbursed: isDisbursedProjectExpr(),
    voucherProcessedAt: {
      $ifNull: [
        "$_step.voucherProcessedAt",
        {
          $let: {
            vars: { d: { $arrayElemAt: ["$__v", 0] } },
            in: "$$d.createdAt",
          },
        },
      ],
    },
  },
};

/** اقتراحات سريعة مع ربط vouchers */
export function buildQuickSuggestPipeline({
  uid,
  userIdStr,
  username,
  permissions = [],
  canDelegateView,
  delegateHolderIds = [],
  delegateHolderUsernames = [],
  processorTarget,
  from,
  to,
  /** all | pending | disbursed */
  mode = "all",
}) {
  const pipeline = [];
  const createdMatch = {};
  if (from) createdMatch.$gte = from;
  if (to) createdMatch.$lte = to;
  if (Object.keys(createdMatch).length) {
    pipeline.push({ $match: { createdAt: createdMatch } });
  }

  let scopeMatch;

  if (canDelegateView) {
    const pendingAnd = [notDisbursedQuickMatch(), wasDelegatedMatch()];
    const disbursedAnd = [
      disbursedQuickMatch(),
      wasDelegatedMatch(),
      excludeDelegateHoldersMatch(delegateHolderIds, delegateHolderUsernames),
    ];
    if (processorTarget?.uid && processorTarget?.userIdStr) {
      pendingAnd.push(
        delegateToMatch(
          processorTarget.uid,
          processorTarget.userIdStr,
          processorTarget.username
        )
      );
      disbursedAnd.push(
        processedByMatch(
          processorTarget.uid,
          processorTarget.userIdStr,
          processorTarget.username
        )
      );
    } else {
      const nh = delegateToNotInHoldersMatch(delegateHolderIds, delegateHolderUsernames);
      if (Object.keys(nh).length) pendingAnd.push(nh);
    }
    if (mode === "pending") scopeMatch = { $and: pendingAnd };
    else if (mode === "disbursed") scopeMatch = { $and: disbursedAnd };
    else scopeMatch = { $or: [{ $and: pendingAnd }, { $and: disbursedAnd }] };
  } else if (processorTarget && !processorTarget.isSelf) {
    const pendingBranch = {
      $and: [
        notDisbursedQuickMatch(),
        delegateToMatch(
          processorTarget.uid,
          processorTarget.userIdStr,
          processorTarget.username
        ),
        wasDelegatedMatch(),
      ],
    };
    const disbursedBranch = {
      $and: [
        disbursedQuickMatch(),
        processedByMatch(
          processorTarget.uid,
          processorTarget.userIdStr,
          processorTarget.username
        ),
      ],
    };
    if (mode === "pending") scopeMatch = pendingBranch;
    else if (mode === "disbursed") scopeMatch = disbursedBranch;
    else scopeMatch = { $or: [pendingBranch, disbursedBranch] };
  } else {
    const canActOr = canActOrForUser(uid, username, permissions);
    const processedOr = processedByMatch(uid, userIdStr, username);
    const pendingBranch = { $and: [notDisbursedQuickMatch(), { $or: canActOr }] };
    const disbursedBranch = { $and: [disbursedQuickMatch(), processedOr] };
    if (mode === "pending") scopeMatch = pendingBranch;
    else if (mode === "disbursed") scopeMatch = disbursedBranch;
    else scopeMatch = { $or: [pendingBranch, disbursedBranch] };
  }

  pipeline.push(
    { $match: STATUS_MATCH_APPROVED_NOT_CANCELLED },
    ...stepApprovedOnLast(),
    voucherLookupStage(),
    { $match: scopeMatch },
    { $limit: 28 },
    QUICK_SUGGEST_PROJECT
  );

  return pipeline;
}
