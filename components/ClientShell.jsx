"use client";

import { usePathname } from "next/navigation";

export default function ClientShell({ children }) {
  const pathname = usePathname();

  // ✅ صفحة اللوغن: نخليها بدون Header وبدون padding
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <>{children}</>;
}