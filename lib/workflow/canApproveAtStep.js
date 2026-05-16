import { PERMISSIONS } from "@/lib/permission";

/** آخر خطوة: الموافقة فقط لمن عنده تخويل الصرف (أو مدير التقارير) */
export function userCanApproveOnLastStep(userPermissions = []) {
  const perms = new Set((userPermissions || []).map(String));
  return (
    perms.has(PERMISSIONS.VOUCHER_DELEGATE) ||
    perms.has(PERMISSIONS.VIEW_ALL_REPORTS)
  );
}

export function userCanApproveAtStep(userPermissions, stepIndex, totalSteps) {
  const total = Number(totalSteps) || 0;
  const idx = Number(stepIndex);
  if (total <= 0 || idx < 0 || idx >= total) return false;
  if (idx < total - 1) return true;
  return userCanApproveOnLastStep(userPermissions);
}

/** فلتر Mongo: طلبات «قيد الموافقة» التي يقدر المستخدم يوافق عليها فعلاً */
export function pendingApprovalMongoExtraMatch(userPermissions = []) {
  if (userCanApproveOnLastStep(userPermissions)) {
    return {};
  }
  return {
    $expr: {
      $lt: [
        "$currentStep",
        { $subtract: [{ $size: { $ifNull: ["$workflow.steps", []] } }, 1] },
      ],
    },
  };
}
