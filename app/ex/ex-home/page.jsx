"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiGrid, FiLayers } from "react-icons/fi";

import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import {
  DEFAULT_EX_BOOKING_COMPANY,
  getBookingFormsMetaForCompany,
  resolveExBookingCompaniesForUser,
} from "@/lib/exForms/exCompanies";
import { countExPendingWithUser } from "@/lib/exForms/exPendingClient";
import { ExBadgeInlineSpinner } from "@/components/ex/ExBadgeInlineSpinner";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 18, scale: 0.97, opacity: 0 },
  show: {
    y: 0,
    scale: 1,
    opacity: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

async function fetchTotalPendingForCompany(companyKey, permissionSet, userId) {
  const metaList = getBookingFormsMetaForCompany(companyKey);
  const forms = metaList.filter((m) => permissionSet.has(m.permission));

  const parts = await Promise.all(
    forms.map(async (meta) => {
      try {
        const url =
          meta.key === "exceptions"
            ? `/api/ex/payment-plans?company=${encodeURIComponent(companyKey)}`
            : `/api/ex/${encodeURIComponent(meta.listPath)}?company=${encodeURIComponent(companyKey)}`;

        const res = await fetch(url, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        const list =
          res.ok && data?.success && Array.isArray(data?.data) ? data.data : [];
        return countExPendingWithUser(list, userId);
      } catch {
        return 0;
      }
    })
  );

  return parts.reduce((a, b) => a + b, 0);
}

export default function ExCompaniesHomePage() {
  const router = useRouter();
  const { permissions, user, companies } = usePermissions();

  const permissionsReady = Boolean(user?.id);

  const hasGeneralEX = useMemo(() => {
    const perms = Array.isArray(permissions) ? permissions : [];
    return perms.includes(PERMISSIONS.EX);
  }, [permissions]);

  const canOpenExReportsPage = useMemo(() => {
    const perms = Array.isArray(permissions) ? permissions : [];
    return (
      perms.includes(PERMISSIONS.EX_REPORTS) ||
      perms.includes(PERMISSIONS.VIEW_REPORTS) ||
      perms.includes(PERMISSIONS.VIEW_ALL_REPORTS)
    );
  }, [permissions]);

  /** حالياً: عرض بدور بغداد فقط ضمن شاشة الشركات */
  const visibleCompanies = useMemo(() => {
    if (!permissionsReady || !Array.isArray(companies)) return [];
    const resolved = resolveExBookingCompaniesForUser(companies);
    return resolved.filter((c) => c.key === DEFAULT_EX_BOOKING_COMPANY);
  }, [permissionsReady, companies]);

  const permissionSet = useMemo(() => new Set(Array.isArray(permissions) ? permissions : []), [
    permissions,
  ]);

  const [companyCounts, setCompanyCounts] = useState({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const totalPendingAll = useMemo(() => {
    return visibleCompanies.reduce((sum, c) => sum + Number(companyCounts[c.key] || 0), 0);
  }, [visibleCompanies, companyCounts]);

  useEffect(() => {
    if (!permissionsReady) return;
    if (!hasGeneralEX) {
      router.replace("/home");
      return;
    }
    if (visibleCompanies.length === 0) {
      router.replace("/home");
    }
  }, [permissionsReady, hasGeneralEX, visibleCompanies.length, router]);

  useEffect(() => {
    if (!permissionsReady || !hasGeneralEX || visibleCompanies.length === 0) return;

    const userId = user?.id || "";
    if (!userId) {
      setCompanyCounts({});
      setCountsLoaded(true);
      return;
    }

    let alive = true;

    const run = async () => {
      try {
        const pairs = await Promise.all(
          visibleCompanies.map(async (c) => {
            const n = await fetchTotalPendingForCompany(c.key, permissionSet, userId);
            return [c.key, n];
          })
        );
        if (!alive) return;
        setCompanyCounts(Object.fromEntries(pairs));
      } catch {
        if (!alive) return;
        setCompanyCounts({});
      } finally {
        if (alive) setCountsLoaded(true);
      }
    };

    run();
    const t = setInterval(run, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [permissionsReady, hasGeneralEX, visibleCompanies, permissionSet, user?.id]);

  if (!permissionsReady || !hasGeneralEX || visibleCompanies.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600"
          aria-hidden
        />
        <p className="text-sm font-semibold text-slate-600">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pb-10 pt-8">
      <div className="mx-auto mb-5 max-w-6xl rounded-3xl border border-slate-200/70 bg-slate-100/70 px-4 py-4 shadow-xl backdrop-blur">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center text-xl font-extrabold md:text-2xl bg-gradient-to-r from-gray-400 via-gray-600 to-slate-800 text-transparent bg-clip-text"
        >
          طلبات الحجز
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="mt-1 text-center text-xs md:text-sm bg-gradient-to-r from-gray-500 via-gray-600 to-gray-800 text-transparent bg-clip-text"
        >
          اختر الشركة ثم النموذج — حالياً متاحة بدور بغداد
        </motion.p>

        {canOpenExReportsPage ? (
          <div className="mt-4 flex justify-center">
            <Link
              href="/reports/ex"
              className="group inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 shadow-sm ring-1 ring-slate-200/90 transition hover:bg-slate-50 hover:ring-slate-300"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 transition group-hover:bg-white">
                <FiLayers className="text-lg" />
              </span>
              التقارير
            </Link>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">المستخدم</p>
            <p className="mt-1 truncate text-sm font-extrabold text-gray-900">{user?.username || "User"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">شركات الحجز</p>
            <p className="mt-1 text-sm font-extrabold text-gray-900">{visibleCompanies.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">إجمالي بانتظارك</p>
            <div className="mt-1 flex items-center justify-center">
              <span
                className="
                  inline-flex min-h-[28px] min-w-[34px] items-center justify-center
                  rounded-full px-2.5
                  bg-gradient-to-r from-rose-600 to-red-600 text-white
                  text-xs font-black tracking-wide tabular-nums
                  shadow-[0_10px_22px_-10px_rgba(220,38,38,0.9)]
                  ring-2 ring-white/75
                "
              >
                {!countsLoaded ? (
                  <ExBadgeInlineSpinner />
                ) : totalPendingAll > 99 ? (
                  "99+"
                ) : (
                  totalPendingAll
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mb-4 flex max-w-6xl items-center gap-2 text-sm font-extrabold text-gray-700">
        <FiGrid className="text-gray-600" />
        شركات الحجز
      </div>

      <motion.div
        className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {visibleCompanies.map((c) => {
          const n = Number(companyCounts[c.key] || 0);
          const showBadge = !countsLoaded || n > 0;

          return (
            <Link key={c.key} href={`/ex/ex-home/${encodeURIComponent(c.key)}`} className="block">
              <motion.div
                variants={item}
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.995 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="
                group relative cursor-pointer rounded-3xl p-6
                bg-white/40 backdrop-blur-2xl
                ring-1 ring-white/25
                shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)]
                hover:bg-white/55 hover:ring-white/35
                transition-all duration-300
                text-center flex flex-col items-center
              "
              >
                {showBadge && (
                  <div
                    className="
                      absolute left-4 top-4 z-20
                      inline-flex min-h-[30px] min-w-[34px] items-center justify-center
                      rounded-full px-2.5
                      bg-gradient-to-r from-rose-600 to-red-600 text-white
                      text-xs font-black tracking-wide tabular-nums
                      shadow-[0_10px_22px_-10px_rgba(220,38,38,0.9)]
                      ring-2 ring-white/75
                      transition-transform duration-300 group-hover:scale-105
                    "
                    title="طلبات تحتاج إجراء منك (جميع النماذج)"
                  >
                    {!countsLoaded ? (
                      <span className="relative inline-flex items-center justify-center">
                        <ExBadgeInlineSpinner />
                      </span>
                    ) : (
                      <>
                        <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative">{n > 99 ? "99+" : n}</span>
                      </>
                    )}
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-90" />

                <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white/50 shadow-md ring-1 ring-white/30 backdrop-blur transition-all duration-300 group-hover:scale-[1.03]">
                  <Image src={c.logo || "/12.png"} alt={c.name} fill className="object-contain p-2" />
                </div>

                <h2 className="relative mt-4 text-lg font-extrabold tracking-tight text-gray-900">{c.name}</h2>
                <p className="relative mt-1 text-xs font-semibold text-gray-600/90">اضغط لفتح النماذج</p>

                <div className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-xs font-extrabold text-gray-800 ring-1 ring-slate-200">
                  المتابعة
                  <span className="text-gray-400">←</span>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}
