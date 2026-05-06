/** عدّ طلبات EX اللي حالتها pending والخطوة الحالية تنتظر المستخدم */

export function normExStatus(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function isExRequestPendingWithUser(r, currentUserId) {
  if (!currentUserId) return false;

  const currentStep = Number.isInteger(r?.currentStep) ? r.currentStep : -1;
  if (currentStep < 0) return false;

  if (normExStatus(r?.status) !== "pending") return false;

  const step = r?.workflow?.steps?.[currentStep];
  if (!step) return false;

  if (normExStatus(step?.status || "pending") !== "pending") return false;

  const users = Array.isArray(step?.users) ? step.users : [];

  return users.some((u) => {
    if (!u) return false;
    if (typeof u === "string" || typeof u === "number") {
      return String(u) === String(currentUserId);
    }
    if (typeof u === "object" && u._id) {
      return String(u._id) === String(currentUserId);
    }
    return false;
  });
}

export function countExPendingWithUser(list, currentUserId) {
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((r) => isExRequestPendingWithUser(r, currentUserId)).length;
}
