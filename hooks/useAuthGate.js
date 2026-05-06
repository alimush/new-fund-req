"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function useAuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setAllowed(true);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/user-permissions", { cache: "no-store" });
        if (!res.ok) {
          router.replace("/login");
          setAllowed(false);
          return;
        }
        const data = await res.json();
        if (!data?.success || !data?.user?.id) {
          router.replace("/login");
          setAllowed(false);
          return;
        }
        setAllowed(true);
      } catch {
        router.replace("/login");
        setAllowed(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  return allowed;
}