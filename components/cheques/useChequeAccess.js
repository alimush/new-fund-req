"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/context/PermissionContext";
import {
  canAccessCheques,
  canEditChequeLayout,
} from "@/lib/cheques/chequePermissions";

/** حماية صفحات الصكوك — يتطلب صلاحية «صكوك» */
export function useChequeAccess() {
  const router = useRouter();
  const { permissions, user } = usePermissions();

  const canUseCheques = useMemo(
    () => canAccessCheques(permissions),
    [permissions]
  );

  const canLayoutEditor = useMemo(
    () => canEditChequeLayout(permissions),
    [permissions]
  );

  const ready = Boolean(user?.id) && Array.isArray(permissions);

  useEffect(() => {
    if (!ready) return;
    if (!canUseCheques) {
      router.replace("/home");
    }
  }, [ready, canUseCheques, router]);

  return { canUseCheques, canLayoutEditor, ready };
}
