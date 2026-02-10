"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function useAuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const userId =
      typeof window !== "undefined"
        ? localStorage.getItem("userId")
        : null;

    // صفحة اللوغن دايمًا مسموحة
    if (pathname === "/login") {
      setAllowed(true);
      return;
    }

    // إذا ماكو لوغن → رجّعه للوغن
    if (!userId) {
      router.replace("/login");
      setAllowed(false);
      return;
    }

    // لوغن موجود
    setAllowed(true);
  }, [pathname, router]);

  return allowed;
}