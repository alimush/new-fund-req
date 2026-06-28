"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePermissions } from "@/context/PermissionContext";

export default function AuthGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { permissionsLoaded, user } = usePermissions();

  useEffect(() => {
    if (isLoginPage || !permissionsLoaded) return;
    if (!user) router.replace("/login");
  }, [isLoginPage, permissionsLoaded, user, router]);

  if (isLoginPage) return children;

  return children;
}
