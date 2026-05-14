import mongoose from "mongoose";
import Permissions from "@/models/Permissions";
import { PERMISSIONS } from "@/lib/permission";

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/** صلاحية MANAGE_PERMISSIONS + شركات المستخدم */
export async function getAdminWorkflowAccess(userId) {
  if (!userId) return { allowedCompanies: [], hasManage: false };

  const groups = await Permissions.find({ users: userId })
    .select("companies permissions")
    .lean();

  const companiesSet = new Set();
  const permsSet = new Set();

  for (const g of groups) {
    (g.companies || []).forEach((c) => companiesSet.add(String(c).trim()));
    (g.permissions || []).forEach((p) => permsSet.add(String(p).trim()));
  }

  return {
    allowedCompanies: Array.from(companiesSet).filter(Boolean),
    hasManage: permsSet.has(PERMISSIONS.MANAGE_PERMISSIONS),
  };
}

/** آخر خطوة عليها تاريخ صرف وصل = طلب «مصروف» في سياق الإدارة */
function lastStepVoucherProcessedExpr() {
  return {
    $let: {
      vars: {
        lst: {
          $arrayElemAt: [
            "$workflow.steps",
            { $max: [0, { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] }] },
          ],
        },
      },
      in: {
        $and: [
          { $ne: ["$$lst", null] },
          { $ne: [{ $ifNull: ["$$lst.voucherProcessedAt", null] }, null] },
        ],
      },
    },
  };
}

/** فلتر: آخر خطوة فيها مستخدم واحد فقط وهو userId المحدد */
function matchLastStepSoleUser(lastStepUserOid, idStr) {
  return {
    $expr: {
      $let: {
        vars: {
          lastStep: {
            $arrayElemAt: [
              "$workflow.steps",
              { $max: [0, { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] }] },
            ],
          },
        },
        in: {
          $and: [
            { $ne: ["$$lastStep", null] },
            { $eq: [{ $size: { $ifNull: ["$$lastStep.users", []] } }, 1] },
            {
              $or: [
                { $eq: [{ $arrayElemAt: ["$$lastStep.users", 0] }, lastStepUserOid] },
                { $eq: [{ $toString: { $arrayElemAt: ["$$lastStep.users", 0] } }, idStr] },
              ],
            },
          ],
        },
      },
    },
  };
}

export function buildAdminWorkflowListQuery({ codeQ, disbursed, lastStepUserId }) {
  const parts = [
    /** لا تُعرض الطلبات الملغاة في إدارة الوورك فلو */
    { status: { $nin: ["Cancelled", "cancelled", "CANCELLED"] } },
  ];

  const cq = String(codeQ || "").trim();
  if (cq) {
    parts.push({ requestCode: { $regex: escapeRegex(cq), $options: "i" } });
  }

  const d = String(disbursed || "").trim().toLowerCase();
  if (d === "yes") {
    parts.push({ $expr: lastStepVoucherProcessedExpr() });
  } else if (d === "no") {
    parts.push({ $expr: { $not: [lastStepVoucherProcessedExpr()] } });
  }

  const ls = String(lastStepUserId || "").trim();
  if (ls && isValidObjectId(ls)) {
    parts.push(matchLastStepSoleUser(new mongoose.Types.ObjectId(ls), ls));
  }

  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

/** بصمة ثابتة لمسار الموافقين (عدد الخطوات + المستخدمون بكل خطوة) */
export function workflowStepsSignature(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return "0:";
  const parts = steps.map((s, i) => {
    const u = (Array.isArray(s.users) ? s.users : [])
      .map((id) => String(id))
      .filter(Boolean)
      .sort()
      .join(",");
    return `${i}:${u}`;
  });
  return `${steps.length}|${parts.join("|")}`;
}

/** بصمة آخر خطوة فقط: عدد موافقيها + معرفاتهم (للتعديل الجماعي دون اشتراط تطابق عدد الخطوات) */
export function lastStepUsersSignature(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return "none";
  const last = steps[steps.length - 1];
  const u = (Array.isArray(last?.users) ? last.users : [])
    .map((id) => stepUserIdString(id))
    .filter(Boolean)
    .sort()
    .join(",");
  const n = Array.isArray(last?.users) ? last.users.length : 0;
  return `${n}|${u}`;
}

function stepUserIdString(u) {
  if (u == null) return "";
  if (typeof u === "object" && u._id != null) return String(u._id);
  return String(u);
}

/**
 * يبني مصفوفة steps بكامل طول الطلب الحالي: كل الخطوات عدا الأخيرة تُمرَّر كما هي (users الحالية)،
 * والخطوة الأخيرة تأخذ التعديل القادم من واجهة التعديل الجماعي (عنصر واحد فقط).
 */
export function buildIncomingStepsForLastStepOnlyMerge(oldSteps, lastStepPatch) {
  const prev = Array.isArray(oldSteps) ? oldSteps : [];
  if (prev.length === 0) {
    const err = new Error("NO_WORKFLOW_STEPS");
    err.code = "NO_WORKFLOW_STEPS";
    throw err;
  }
  return prev.map((s, i) => {
    if (i < prev.length - 1) {
      return {
        users: (Array.isArray(s.users) ? s.users : []).map((u) => stepUserIdString(u)).filter(Boolean),
      };
    }
    return lastStepPatch;
  });
}

export function mergeAdminWorkflowSteps(oldSteps, incomingSteps) {
  const prev = Array.isArray(oldSteps) ? oldSteps : [];

  return incomingSteps.map((s, idx) => {
    const userIds = (Array.isArray(s.users) ? s.users : [])
      .map((id) => String(id).trim())
      .filter((id) => isValidObjectId(id));

    if (userIds.length === 0) {
      const err = new Error("EMPTY_STEP_USERS");
      err.code = "EMPTY_STEP_USERS";
      throw err;
    }

    const oidUsers = userIds.map((id) => new mongoose.Types.ObjectId(id));
    const old = prev[idx];

    if (old && typeof old.toObject === "function") {
      const o = old.toObject({ flattenMaps: true });
      o.users = oidUsers;
      delete o._id;
      return o;
    }

    if (old) {
      const o = { ...old };
      o.users = oidUsers;
      delete o._id;
      return o;
    }

    return {
      users: oidUsers,
      status: "Pending",
      actedBy: null,
      actedAt: null,
      comment: "",
      tag: "",
      attachment: null,
      tagAttachments: [],
      voucherDelegateTo: null,
      voucherDelegatedBy: null,
      voucherDelegatedAt: null,
      voucherDelegateToUsername: "",
      voucherDelegatedByUsername: "",
      voucherProcessedBy: null,
      voucherProcessedAt: null,
      voucherProcessedByUsername: "",
    };
  });
}
