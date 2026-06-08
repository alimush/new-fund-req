function getStepActedById(step) {
  const actedBy = step?.actedBy;
  if (!actedBy) return "";
  if (typeof actedBy === "object" && actedBy._id) return String(actedBy._id);
  return String(actedBy);
}

/** منشئ الطلب (createdById أو createdBy = username) */
export function isExDocCreator(doc, userId, currentUser) {
  if (!doc || !userId) return false;

  const uid = String(userId);
  const createdById = doc?.createdById;

  if (createdById) {
    const cid =
      typeof createdById === "object" && createdById._id
        ? String(createdById._id)
        : String(createdById);
    if (cid && cid === uid) return true;
  }

  const createdBy = String(doc?.createdBy || "").trim();
  if (!createdBy) return false;
  if (createdBy === uid) return true;

  const username = String(currentUser?.username || "").trim();
  const name = String(currentUser?.name || "").trim();
  const email = String(currentUser?.email || "").trim();

  return (
    (username && createdBy === username) ||
    (name && createdBy === name) ||
    (email && createdBy === email)
  );
}

function isUserAssignedToStep(step, userId) {
  const uid = String(userId || "");
  if (!uid) return false;

  return (step?.users || []).some((u) => {
    if (!u) return false;
    if (typeof u === "object" && u._id) return String(u._id) === uid;
    return String(u) === uid;
  });
}

/**
 * هل يحق للمستخدم مشاهدة مرفقات/اتاج خطوة معينة؟
 * — الستيب الحالي (Pending): كل المعيّنين عليه
 * — ستيبات سابقة: من وافق فقط
 * — ستيبات لاحقة: لا أحد
 */
export function canUserViewExStepAttachments(step, stepIdx, userId, currentStepIdx) {
  if (!userId || !step) return false;

  const uid = String(userId);
  const idx = Number(stepIdx);
  const cur = Number(currentStepIdx);
  if (!Number.isFinite(idx) || idx < 0) return false;
  if (!isUserAssignedToStep(step, uid)) return false;

  const status = String(step?.status || "Pending").toLowerCase();

  if (cur === -1) {
    return status === "approved" && getStepActedById(step) === uid;
  }

  if (idx > cur) return false;

  if (idx === cur && status === "pending") return true;

  if (status === "approved" && getStepActedById(step) === uid) return true;

  return false;
}

export function canUserViewExRequestAttachments(
  workflowSteps,
  userId,
  currentStepIdx,
  doc = null,
  currentUser = null
) {
  if (!userId) return false;
  if (doc && isExDocCreator(doc, userId, currentUser)) return true;
  if (!Array.isArray(workflowSteps)) return false;

  return workflowSteps.some((step, idx) =>
    canUserViewExStepAttachments(step, idx, userId, currentStepIdx)
  );
}

export function sanitizeExDocAttachmentsForUser(doc, userId, currentUser = null) {
  if (!doc || typeof doc !== "object") return doc;

  const steps = Array.isArray(doc?.workflow?.steps) ? doc.workflow.steps : [];
  const cur = Number(doc?.currentStep);
  const canViewRequest = canUserViewExRequestAttachments(
    steps,
    userId,
    cur,
    doc,
    currentUser
  );

  const next = { ...doc };

  if (!canViewRequest) {
    next.attachments = [];
  }

  if (steps.length) {
    next.workflow = {
      ...doc.workflow,
      steps: steps.map((step, idx) => {
        if (canUserViewExStepAttachments(step, idx, userId, cur)) return step;
        return {
          ...step,
          tag: "",
          tagAttachments: [],
        };
      }),
    };
  }

  return next;
}
