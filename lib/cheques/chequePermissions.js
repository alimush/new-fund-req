import { hasPermission, PERMISSIONS } from "@/lib/permission";

export function canAccessCheques(permissions) {
  return hasPermission(permissions, PERMISSIONS.CHEQUES);
}

export function canEditChequeLayout(permissions) {
  return hasPermission(permissions, PERMISSIONS.CHEQUES_FIELD_LAYOUT);
}

export function canManageChequePrintSettings(permissions) {
  return hasPermission(permissions, PERMISSIONS.MANAGE_PERMISSIONS);
}
