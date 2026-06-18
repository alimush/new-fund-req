import { NextResponse } from "next/server";
import Permissions from "@/models/Permissions";
import {
  canAccessCheques,
  canEditChequeLayout,
  canManageChequePrintSettings,
} from "@/lib/cheques/chequePermissions";

export {
  canAccessCheques,
  canEditChequeLayout,
  canManageChequePrintSettings,
} from "@/lib/cheques/chequePermissions";

export async function getChequeUserPermissions(userId) {
  if (!userId) return [];

  const groups = await Permissions.find({ users: userId })
    .select("permissions")
    .lean();

  const set = new Set();
  for (const g of groups) {
    (g.permissions || []).forEach((p) => set.add(String(p).trim()));
  }
  return Array.from(set);
}

export async function requireChequeAccess(userId) {
  const perms = await getChequeUserPermissions(userId);
  if (!canAccessCheques(perms)) {
    return {
      ok: false,
      perms,
      res: NextResponse.json(
        { success: false, error: "ليس لديك صلاحية صكوك" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, perms };
}

export async function requireChequeFieldLayoutEditor(userId) {
  const perms = await getChequeUserPermissions(userId);
  if (!canEditChequeLayout(perms)) {
    return {
      ok: false,
      perms,
      res: NextResponse.json(
        { success: false, error: "ليس لديك صلاحية ترتيب حقول الصكوك" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, perms };
}

/** @deprecated استخدم requireChequeFieldLayoutEditor */
export async function requireChequeEditor(userId) {
  return requireChequeFieldLayoutEditor(userId);
}

export async function requireManagePermissions(userId) {
  const perms = await getChequeUserPermissions(userId);
  if (!canManageChequePrintSettings(perms)) {
    return {
      ok: false,
      perms,
      res: NextResponse.json(
        { success: false, error: "ليس لديك صلاحية إدارة الصلاحيات" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, perms };
}
