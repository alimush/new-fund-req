"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function IdleLogoutGuard() {
  const router = useRouter();
  const pathname = usePathname();

  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);
  const loggedOutRef = useRef(false);

  useEffect(() => {
    // ✅ لا تشتغل على صفحة اللوجن
    if (pathname?.startsWith("/login")) return;

   const idleMs = 30 * 60 * 1000; // ⏳ 30 minutes
    loggedOutRef.current = false;

    const touch = () => {
      lastActivityRef.current = Date.now();
      // للتأكد حتى التنقل يعتبر نشاط
      localStorage.setItem("lastActivityAt", String(lastActivityRef.current));
    };

    // ✅ اعتبر تغيير الصفحة نشاط
    touch();

    // ✅ سجل النشاط
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "pointerdown"];
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));

    // ✅ Dev/StrictMode: امنع تكرار interval
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const last = Number(localStorage.getItem("lastActivityAt") || 0) || lastActivityRef.current;
      const idleFor = Date.now() - last;

      if (!loggedOutRef.current && idleFor >= idleMs) {
        loggedOutRef.current = true;

        // مسح بيانات الفرونت
        localStorage.removeItem("userId");
        localStorage.removeItem("username");
        localStorage.removeItem("lastActivityAt");

        // إذا عندك كوكي بالسيرفر (اختياري)
        fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});

        router.replace("/login?reason=idle");
      }
    }, 250);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      events.forEach((ev) => window.removeEventListener(ev, touch));
    };
  }, [router, pathname]);

  return null;
}