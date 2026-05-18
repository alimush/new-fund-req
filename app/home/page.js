"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePermissions } from "@/context/PermissionContext";
import { useEffect, useMemo, useState } from "react";
import {
  FiFileText,
  FiBarChart2,
  FiPieChart,
  FiGrid,
  FiZap,
  FiClock,
  FiCheckCircle,
} from "react-icons/fi";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { useRouter } from "next/navigation";
import { ExBadgeInlineSpinner } from "@/components/ex/ExBadgeInlineSpinner";
import {
  getApprovalCount,
  getDisbursementCount,
  sumApprovalCounts,
  sumDisbursementCounts,
} from "@/lib/notifications/notificationCounts";

const cards = [
  { key: "Al-Ghadeer", name: "طلبات الغدير", logo: "/الغدير.png" },
  { key: "Badur-Baghdad", name: "طلبات بدور بغداد", logo: "/بدور_بغداد.png" },
  { key: "Ghadeer-Karbala", name: "طلبات غدير كربلاء", logo: "/غدير_كربلاء.png" },
  { key: "Tiba-Al-najaf", name: "طلبات طيبة النجف", logo: "/طيبة_النجف.png" },
  { key: "badur-Al-najaf", name: "طلبات بدور النجف", logo: "/بدور_النجف.png" },
  { key: "010", name: "test", logo: "/12.png" },
  { key: "old-data", name: "Old Data", logo: "/olddata.jpg" },
  {
    key: "EX",
    name: "طلبات الحجز",
    logo: "/ex.png",
    href: "/ex/ex-home",
  },
  
  { key: "Al-Rida", name: "طلبات الرضا", logo: "/الرضا.png" },
  
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 20, scale: 0.95 },
  show: { y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function HomePage() {
  const router = useRouter();
  const { companies, permissions, user } = usePermissions();

  const allowedCards = useMemo(() => {
    if (!Array.isArray(companies) || !Array.isArray(permissions)) return [];

    const isSuperAdmin = permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);
    const hasEXPerm = permissions.includes(PERMISSIONS.EX);

    const result = [...cards.filter((c) => {
      if (c.key === "EX") return companies.includes("EX") || hasEXPerm;
      return companies.includes(c.key);
    })];

    // ✅ إضافة كارت "إدارة الوصولات"
    const hasAnyVoucherPerm = COMPANIES.some(c => c.permission && permissions.includes(c.permission));
    const canSeeVouchers = hasAnyVoucherPerm || permissions.includes(PERMISSIONS.RECEIPTS);

    if (canSeeVouchers) {
      result.push({
        key: "vouchers-management",
        name: "إدارة الوصولات",
        href: "/vouchers",
        isIcon: true,
        Icon: FiFileText,
        color: "text-blue-600"
      });
    }

    // ✅ إضافة كارت "تقارير الوصولات"
    const canSeeVoucherReports = permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW);

    if (canSeeVoucherReports) {
      result.push({
        key: "vouchers-reports",
        name: "تقارير الوصولات",
        href: "/vouchers/reports",
        isIcon: true,
        Icon: FiBarChart2,
        color: "text-emerald-600"
      });
    }

    if (permissions.includes(PERMISSIONS.RECEIPTS)) {
      result.push({
        key: "receipts-disbursement",
        name: "تتبع صرف الطلبات",
        href: "/receipts/disbursement",
        isIcon: true,
        Icon: FiClock,
        color: "text-amber-600"
      });
    }

    // ✅ إضافة كارت "تقارير الطلبات" (العامة)
    const canSeeGeneralReports = isSuperAdmin || permissions.includes(PERMISSIONS.VIEW_REPORTS);

    if (canSeeGeneralReports) {
      result.push({
        key: "general-reports",
        name: "تقارير الطلبات",
        href: "/reports",
        isIcon: true,
        Icon: FiPieChart,
        color: "text-purple-600"
      });
    }

    return result;
  }, [companies, permissions]);

  const [counts, setCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [countsLoaded, setCountsLoaded] = useState(false);

  const companyCards = useMemo(
    () => allowedCards.filter((c) => !c.isIcon),
    [allowedCards]
  );
  const toolCards = useMemo(
    () => allowedCards.filter((c) => c.isIcon),
    [allowedCards]
  );

  const permissionsReady = Boolean(user?.id);

  const shouldRedirectToExHome = useMemo(() => {
    if (!permissionsReady || !Array.isArray(companies) || !Array.isArray(permissions)) {
      return false;
    }
    const normalizedCompanies = companies.map((c) => String(c || "").trim());
    const hasOnlyEXCompany =
      normalizedCompanies.length === 1 && normalizedCompanies[0] === "EX";
    const hasAnyNonEXCard = companyCards.some((c) => String(c.key) !== "EX");
    return hasOnlyEXCompany && !hasAnyNonEXCard;
  }, [permissionsReady, companies, permissions, companyCards]);

  const companyKeys = useMemo(
    () => companyCards.map((c) => c.key),
    [companyCards]
  );

  const canViewReceipts = useMemo(
    () =>
      Array.isArray(permissions) &&
      permissions.includes(PERMISSIONS.RECEIPTS),
    [permissions]
  );

  const totalApproval = useMemo(
    () => sumApprovalCounts(counts, companyKeys),
    [counts, companyKeys]
  );

  const totalDisbursement = useMemo(
    () =>
      canViewReceipts ? sumDisbursementCounts(counts, companyKeys) : 0,
    [counts, companyKeys, canViewReceipts]
  );

  useEffect(() => {
    if (!shouldRedirectToExHome) return;
    const t = setTimeout(() => {
      router.replace("/ex/ex-home");
    }, 400);
    return () => clearTimeout(t);
  }, [shouldRedirectToExHome, router]);

  useEffect(() => {
    if (!permissionsReady || shouldRedirectToExHome) return;
    if (!allowedCards.length) return;

    let alive = true;

    const fetchCounts = async () => {
      try {
        setLoadingCounts(true);
        // Only fetch counts for non-icon cards (company cards)
        const companyList = allowedCards.filter(c => !c.isIcon).map((x) => x.key).join(",");
        if (!companyList) {
          setCounts({});
          setCountsLoaded(true);
          return;
        }

        const res = await fetch(`/api/notifications/counts?companies=${encodeURIComponent(companyList)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!alive) return;

        if (res.ok && data?.success) setCounts(data.counts || {});
        else setCounts({});
      } catch {
        if (alive) setCounts({});
      } finally {
        if (alive) {
          setLoadingCounts(false);
          setCountsLoaded(true);
        }
      }
    };

    fetchCounts();

    const t = setInterval(fetchCounts, 30000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [allowedCards, permissionsReady, shouldRedirectToExHome]);

  if (!permissionsReady) {
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

  if (shouldRedirectToExHome) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
          aria-hidden
        />
        <p className="text-sm font-semibold text-slate-600">جاري فتح صفحة طلبات الحجز...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pb-10 pt-8">
      {/* الهيدر */}
      <div className="mx-auto mb-5 max-w-6xl rounded-3xl border border-slate-200/70 bg-slate-100/70 px-4 py-4 shadow-xl backdrop-blur">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center text-xl font-extrabold md:text-2xl
                     bg-gradient-to-r from-gray-400 via-gray-600 to-slate-800
                     text-transparent bg-clip-text"
        >
          Companies Dashboard
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="mt-1 text-center text-xs md:text-sm bg-gradient-to-r from-gray-500 via-gray-600 to-gray-800 
                     text-transparent bg-clip-text"
        >
          اختر الشركة لعرض تفاصيل الطلبات
        </motion.p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">المستخدم</p>
            <p className="mt-1 truncate text-sm font-extrabold text-gray-900">
              {user?.username || "User"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">الشركات</p>
            <p className="mt-1 text-sm font-extrabold text-gray-900">{companyCards.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-2.5 ring-1 ring-slate-200 shadow-sm">
            <p className="text-center text-[11px] font-bold text-gray-500">إشعارات بانتظارك</p>
            <div className="mt-2 space-y-1.5">
              <div
                className="flex items-center justify-between gap-2 rounded-xl bg-white/90 px-2.5 py-2 ring-1 ring-slate-200/80"
                title="طلبات تحتاج موافقتك في سير العمل"
              >
                <span className="min-w-0 text-right text-[10px] font-extrabold leading-tight text-gray-800 sm:text-[11px]">
                  قيد الانتظار للموافقة
                </span>
                <span className="inline-flex shrink-0 min-h-[26px] min-w-[30px] items-center justify-center gap-1 rounded-full bg-gradient-to-r from-rose-600 to-red-600 px-2 text-[11px] font-black text-white tabular-nums shadow-[0_6px_14px_-6px_rgba(220,38,38,0.85)] ring-2 ring-white/70">
                  <FiClock className="text-[10px]" />
                  {!countsLoaded ? (
                    <ExBadgeInlineSpinner />
                  ) : (
                    totalApproval > 99 ? "99+" : totalApproval
                  )}
                </span>
              </div>
              {canViewReceipts && (
                <div
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/90 px-2.5 py-2 ring-1 ring-slate-200/80"
                  title="طلبات جاهزة للصرف — نفس تقرير تتبع الصرف"
                >
                  <span className="min-w-0 text-right text-[10px] font-extrabold leading-tight text-gray-800 sm:text-[11px]">
                    قيد الانتظار للصرف
                  </span>
                  <span className="inline-flex shrink-0 min-h-[26px] min-w-[30px] items-center justify-center gap-1 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 px-2 text-[11px] font-black text-white tabular-nums shadow-[0_6px_14px_-6px_rgba(5,150,105,0.8)] ring-2 ring-white/70">
                    <FiCheckCircle className="text-[10px]" />
                    {!countsLoaded ? (
                      <ExBadgeInlineSpinner />
                    ) : (
                      totalDisbursement > 99 ? "99+" : totalDisbursement
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {companyCards.length > 0 && toolCards.length > 0 && (
          <div className="mt-4 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {toolCards.map((card) => (
                <Link
                  key={`chip-${card.key}`}
                  href={card.href || "/home"}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-extrabold text-gray-800 ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {card.Icon ? (
                    <card.Icon className={card.color || "text-gray-700"} />
                  ) : (
                    <FiZap className="text-gray-700" />
                  )}
                  {card.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {companyCards.length > 0 && (
        <>
          {/* كروت الشركات */}
          <div className="mx-auto mb-4 flex max-w-6xl items-center gap-2 text-sm font-extrabold text-gray-700">
            <FiGrid className="text-gray-600" />
            الشركات
          </div>
          <motion.div
            className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {companyCards.map((c, idx) => {
              const approvalN = getApprovalCount(counts, c.key);
              const disbursementN = canViewReceipts
                ? getDisbursementCount(counts, c.key)
                : 0;

              return (
                <Link key={idx} href={c.href || `/requests/${c.key}`} passHref>
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
                    {(approvalN > 0 || disbursementN > 0) && !c.isIcon && (
                      <motion.div
                        className="absolute left-3 top-3 z-20 flex items-center gap-1.5"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        {approvalN > 0 && (
                          <span
                            className="inline-flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded-full bg-gradient-to-br from-rose-600 to-red-600 px-2.5 text-white shadow-[0_8px_22px_-8px_rgba(220,38,38,0.9)] ring-2 ring-white/85 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110"
                            title="قيد الانتظار للموافقة"
                          >
                            <FiClock className="text-[13px] shrink-0 opacity-95" aria-hidden />
                            <span className="text-xs font-black tabular-nums leading-none">
                              {approvalN > 99 ? "99+" : approvalN}
                            </span>
                          </span>
                        )}
                        {disbursementN > 0 && (
                          <span
                            className="inline-flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded-full bg-gradient-to-br from-emerald-600 to-green-600 px-2.5 text-white shadow-[0_8px_22px_-8px_rgba(5,150,105,0.85)] ring-2 ring-white/85 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110"
                            title="قيد الانتظار للصرف"
                          >
                            <FiCheckCircle className="text-[13px] shrink-0 opacity-95" aria-hidden />
                            <span className="text-xs font-black tabular-nums leading-none">
                              {disbursementN > 99 ? "99+" : disbursementN}
                            </span>
                          </span>
                        )}
                      </motion.div>
                    )}

                    {/* زخارف ناعمة */}
                    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-90" />

                    {/* اللوغو أو الأيقونة */}
                    <div
                      className="
                    relative w-20 h-20 rounded-2xl
                    bg-white/50 backdrop-blur
                    ring-1 ring-white/30
                    shadow-md overflow-hidden
                    flex items-center justify-center
                    transition-all duration-300 group-hover:scale-[1.03]
                  "
                    >
                      {c.isIcon ? (
                        <c.Icon className={`w-10 h-10 ${c.color || "text-gray-700"} transition-transform duration-500 group-hover:scale-110`} />
                      ) : (
                        <Image
                          src={c.logo || "/12.png"}
                          alt={`${c.name} logo`}
                          fill
                          className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>

                    {/* النص */}
                    <h2 className="mt-4 text-lg font-extrabold tracking-tight text-gray-900">
                      {c.name}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-gray-600/90">
                      اضغط لفتح التفاصيل
                    </p>
                  </motion.div>
                </Link>
              );
            })}
          </motion.div>
        </>
      )}

      {companyCards.length === 0 && (
        <div className="mx-auto max-w-6xl rounded-2xl border border-dashed border-gray-300 bg-white/70 p-10 text-center text-gray-600">
          لا توجد شركات مرتبطة بهذا المستخدم حالياً.
        </div>
      )}

      {companyCards.length === 0 && toolCards.length > 0 && (
        <>
          <motion.div
            className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {toolCards.map((c, idx) => (
              <Link key={`${c.key}-${idx}`} href={c.href || "/home"} passHref>
                <motion.div
                  variants={item}
                  whileHover={{ y: -4, scale: 1.015 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="group relative flex cursor-pointer flex-col items-center rounded-3xl bg-white/45 p-6 text-center shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] ring-1 ring-white/35 transition-all duration-300 hover:bg-white/60 hover:ring-white/45"
                >
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-90" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/70 shadow-md ring-1 ring-white/40 backdrop-blur transition-all duration-300 group-hover:scale-[1.03]">
                    {c.Icon ? (
                      <c.Icon
                        className={`h-10 w-10 ${
                          c.color || "text-gray-700"
                        } transition-transform duration-500 group-hover:scale-110`}
                      />
                    ) : (
                      <FiZap className="h-10 w-10 text-gray-700" />
                    )}
                  </div>
                  <h2 className="mt-4 text-lg font-extrabold tracking-tight text-gray-900">
                    {c.name}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-gray-600/90">
                    اضغط لفتح الأداة
                  </p>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        </>
      )}

    </div>
  );
}