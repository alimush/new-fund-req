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
  FiCreditCard,
  FiLayers,
  FiUser,
  FiBriefcase,
} from "react-icons/fi";
import { hasPermission, PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { useRouter } from "next/navigation";
import { ExBadgeInlineSpinner } from "@/components/ex/ExBadgeInlineSpinner";
import {
  getApprovalCount,
  getDisbursementCount,
  sumApprovalCounts,
  sumDisbursementCounts,
} from "@/lib/notifications/notificationCounts";
import PageLoader from "@/components/PageLoader";

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
    href: "/ex/ex-home",
    Icon: FiLayers,
    iconClass: "w-10 h-10 text-indigo-600",
  },
  { key: "alleanza", name: "طلبات اليانزا", logo: "/اليانزا.png" },
  { key: "Al-Rida", name: "طلبات الرضا", logo: "/الرضا.png" },
  { key: "1", name: "شركة أفق للاستثمار", logo: "/assets/companies/company-1.png" },
  { key: "2", name: "شركة رواسي للتطوير", logo: "/assets/companies/company-2.png" },
  { key: "3", name: "شركة مدار للمقاولات", logo: "/assets/companies/company-3.png" },
  { key: "4", name: "شركة نبراس للتجارة", logo: "/assets/companies/company-4.png" },
  { key: "5", name: "شركة سدرة العقارية", logo: "/assets/companies/company-5.png" },
  { key: "6", name: "شركة جسور للخدمات", logo: "/assets/companies/company-6.png" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { y: 16, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

const glassCard =
  "rounded-3xl bg-white/45 backdrop-blur-2xl ring-1 ring-white/30 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.32)]";

const cardHoverAction =
  "group transition-all duration-300 ease-out hover:-translate-y-1 hover:border-indigo-200/80 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(79,70,241,0.18)] hover:ring-indigo-100/90";

export default function HomePage() {
  const router = useRouter();
  const { companies, permissions, user, permissionsLoaded } = usePermissions();

  const allowedCards = useMemo(() => {
    if (!Array.isArray(companies) || !Array.isArray(permissions)) return [];

    const isSuperAdmin = permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);
    const hasEXPerm = permissions.includes(PERMISSIONS.EX);

    const result = [
      ...cards.filter((c) => {
        if (c.key === "EX") return companies.includes("EX") || hasEXPerm;
        return companies.includes(c.key);
      }),
    ];

    const hasAnyVoucherPerm = COMPANIES.some(
      (c) => c.permission && permissions.includes(c.permission)
    );
    const canSeeVouchers =
      hasAnyVoucherPerm || permissions.includes(PERMISSIONS.RECEIPTS);

    if (canSeeVouchers) {
      result.push({
        key: "vouchers-management",
        name: "إدارة الوصولات",
        href: "/vouchers",
        isIcon: true,
        Icon: FiFileText,
        color: "text-blue-600",
      });
    }

    if (permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW)) {
      result.push({
        key: "vouchers-reports",
        name: "تقارير الوصولات",
        href: "/vouchers/reports",
        isIcon: true,
        Icon: FiBarChart2,
        color: "text-emerald-600",
      });
    }

    if (permissions.includes(PERMISSIONS.RECEIPTS)) {
      result.push({
        key: "receipts-disbursement",
        name: "تتبع صرف الطلبات",
        href: "/receipts/disbursement",
        isIcon: true,
        Icon: FiClock,
        color: "text-amber-600",
      });
    }

    const canSeeGeneralReports =
      isSuperAdmin || permissions.includes(PERMISSIONS.VIEW_REPORTS);

    if (canSeeGeneralReports) {
      result.push({
        key: "general-reports",
        name: "تقارير الطلبات",
        href: "/reports",
        isIcon: true,
        Icon: FiPieChart,
        color: "text-purple-600",
      });
    }

    if (hasPermission(permissions, PERMISSIONS.CHEQUES)) {
      result.push({
        key: "cheques-system",
        name: "نظام الصكوك",
        href: "/cheques",
        isIcon: true,
        Icon: FiCreditCard,
        color: "text-teal-600",
      });
    }

    return result;
  }, [companies, permissions]);

  const [counts, setCounts] = useState({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const companyCards = useMemo(
    () => allowedCards.filter((c) => !c.isIcon),
    [allowedCards]
  );
  const toolCards = useMemo(
    () => allowedCards.filter((c) => c.isIcon),
    [allowedCards]
  );

  const permissionsReady = permissionsLoaded && Boolean(user?.id);

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
    () => Array.isArray(permissions) && permissions.includes(PERMISSIONS.RECEIPTS),
    [permissions]
  );

  const canDelegateVoucher = useMemo(
    () =>
      Array.isArray(permissions) &&
      permissions.includes(PERMISSIONS.VOUCHER_DELEGATE),
    [permissions]
  );

  const totalApproval = useMemo(
    () => sumApprovalCounts(counts, companyKeys),
    [counts, companyKeys]
  );

  const totalDisbursement = useMemo(
    () =>
      canViewReceipts && !canDelegateVoucher
        ? sumDisbursementCounts(counts, companyKeys)
        : 0,
    [counts, companyKeys, canViewReceipts, canDelegateVoucher]
  );

  const statCols =
    canViewReceipts && !canDelegateVoucher
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : "sm:grid-cols-2 lg:grid-cols-3";

  useEffect(() => {
    if (!shouldRedirectToExHome) return;
    const t = setTimeout(() => router.replace("/ex/ex-home"), 400);
    return () => clearTimeout(t);
  }, [shouldRedirectToExHome, router]);

  useEffect(() => {
    if (!permissionsReady || shouldRedirectToExHome) return;
    if (!allowedCards.length) return;

    let alive = true;

    const fetchCounts = async () => {
      try {
        const companyList = allowedCards
          .filter((c) => !c.isIcon)
          .map((x) => x.key)
          .join(",");

        if (!companyList) {
          setCounts({});
          setCountsLoaded(true);
          return;
        }

        const res = await fetch(
          `/api/notifications/counts?companies=${encodeURIComponent(companyList)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!alive) return;

        if (res.ok && data?.success) setCounts(data.counts || {});
        else setCounts({});
      } catch {
        if (alive) setCounts({});
      } finally {
        if (alive) setCountsLoaded(true);
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
      <PageLoader
        variant="home"
        title="جاري تحميل لوحة التحكم"
        subtitle="يرجى الانتظار..."
        icon={<FiGrid />}
      />
    );
  }

  if (shouldRedirectToExHome) {
    return (
      <PageLoader
        variant="home"
        title="جاري فتح صفحة طلبات الحجز"
        subtitle="يرجى الانتظار..."
        icon={<FiLayers />}
      />
    );
  }

  return (
    <div className="min-h-screen px-4 pb-10 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto max-w-6xl space-y-7">
        {/* الهيدر */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className={`${glassCard} overflow-hidden border border-slate-200/50`}
        >
          <div className="relative overflow-hidden border-b border-slate-200/50 bg-gradient-to-b from-white/70 via-white/40 to-transparent px-5 py-8 sm:px-8 sm:py-9">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.07),transparent_60%)]" />

            <div className="relative mx-auto max-w-xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                Companies Dashboard
              </p>
              <h1 className="mt-2 text-base font-extrabold leading-relaxed text-slate-800 sm:text-lg">
                اختر الشركة لعرض تفاصيل الطلبات
              </h1>

              <div className={`mx-auto mt-5 inline-flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-2.5 shadow-sm ring-1 ring-slate-200/50 ${cardHoverAction}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition-transform duration-300 group-hover:scale-110">
                  <FiUser className="text-base" />
                </span>
                <span dir="rtl" className="inline-flex items-center gap-2 text-sm font-extrabold">
                  <span className="text-slate-500">مرحباً</span>
                  <span dir="ltr" className="text-slate-900">{user?.username || "User"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-3 bg-slate-50/40 p-4 sm:p-5 ${statCols}`}>
            <StatBox
              icon={FiUser}
              label="المستخدم"
              value={user?.username || "—"}
              tone="slate"
            />
            <StatBox
              icon={FiBriefcase}
              label="الشركات المتاحة"
              value={String(companyCards.length)}
              tone="indigo"
            />
            <StatBox
              icon={FiClock}
              label="بانتظار الموافقة"
              value={
                !countsLoaded ? (
                  <ExBadgeInlineSpinner className="size-4 border-slate-300 border-t-indigo-600" />
                ) : (
                  totalApproval > 99 ? "99+" : String(totalApproval)
                )
              }
              tone="rose"
            />
            {canViewReceipts && !canDelegateVoucher ? (
              <StatBox
                icon={FiCheckCircle}
                label="بانتظار الصرف"
                value={
                  !countsLoaded ? (
                    <ExBadgeInlineSpinner className="size-4 border-slate-300 border-t-indigo-600" />
                  ) : (
                    totalDisbursement > 99 ? "99+" : String(totalDisbursement)
                  )
                }
                tone="emerald"
              />
            ) : null}
          </div>
        </motion.section>

        {/* الأدوات */}
        {toolCards.length > 0 && companyCards.length > 0 ? (
          <section>
            <SectionHeader icon={FiZap} title="الأدوات والتقارير" count={toolCards.length} />
            <div className={`${glassCard} p-4 sm:p-5`}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {toolCards.map((card) => (
                  <ToolLink key={card.key} card={card} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* الشركات */}
        {companyCards.length > 0 ? (
          <section>
            <SectionHeader icon={FiGrid} title="الشركات" count={companyCards.length} />
            <motion.div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {companyCards.map((c) => {
                const approvalN = getApprovalCount(counts, c.key);
                const disbursementN =
                  canViewReceipts && !canDelegateVoucher
                    ? getDisbursementCount(counts, c.key)
                    : 0;

                return (
                  <CompanyCard
                    key={c.key}
                    card={c}
                    approvalN={approvalN}
                    disbursementN={disbursementN}
                  />
                );
              })}
            </motion.div>
          </section>
        ) : (
          <div
            className={`${glassCard} border border-dashed border-gray-300/80 p-10 text-center text-gray-600`}
          >
            لا توجد شركات مرتبطة بهذا المستخدم حالياً.
          </div>
        )}

        {/* أدوات فقط */}
        {companyCards.length === 0 && toolCards.length > 0 ? (
          <section>
            <SectionHeader icon={FiZap} title="الأدوات المتاحة" count={toolCards.length} />
            <motion.div
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              variants={container}
              initial="hidden"
              animate="show"
            >
              {toolCards.map((c) => (
                <ToolCard key={c.key} card={c} />
              ))}
            </motion.div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-extrabold text-gray-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-gray-700 ring-1 ring-white/50 shadow-sm">
          <Icon />
        </span>
        {title}
      </div>
      {count != null ? (
        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-extrabold text-gray-600 ring-1 ring-white/50">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-200",
    rose: "bg-rose-50 text-rose-600 ring-rose-200",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  };

  return (
    <div className={`flex cursor-default flex-col items-center rounded-2xl border border-slate-200/70 bg-white px-4 py-4 text-center shadow-sm ring-1 ring-white/80 ${cardHoverAction}`}>
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 ${tones[tone] || tones.slate}`}
      >
        <Icon className="text-lg" />
      </span>
      <div className="min-w-0 w-full">
        <div className="truncate text-lg font-black tabular-nums text-slate-900 transition-colors duration-300 group-hover:text-indigo-700">
          {value}
        </div>
        <p className="mt-1 text-[11px] font-bold text-slate-500 transition-colors duration-300 group-hover:text-slate-700">
          {label}
        </p>
      </div>
    </div>
  );
}

function ToolLink({ card }) {
  const Icon = card.Icon || FiZap;

  return (
    <Link
      href={card.href || "/home"}
      className={`group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/75 px-3 py-2.5 ring-1 ring-white/50 ${cardHoverAction}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/80 transition-transform duration-300 group-hover:scale-110 group-hover:ring-indigo-200">
        <Icon className={`text-base transition-colors duration-300 group-hover:text-indigo-600 ${card.color || "text-gray-700"}`} />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-gray-800 transition-colors duration-300 group-hover:text-indigo-800">
        {card.name}
      </span>
    </Link>
  );
}

function CompanyCard({ card, approvalN, disbursementN }) {
  const hasBadges = approvalN > 0 || disbursementN > 0;

  return (
    <Link href={card.href || `/requests/${card.key}`}>
      <motion.div
        variants={item}
        whileHover={{ y: -4, scale: 1.012 }}
        whileTap={{ scale: 0.995 }}
        className={`group relative flex h-full min-h-[220px] cursor-pointer flex-col items-center justify-center p-6 text-center transition-all duration-300 hover:bg-white/70 hover:ring-indigo-200/50 hover:shadow-[0_20px_50px_-22px_rgba(79,70,241,0.22)] ${glassCard}`}
      >
        {hasBadges ? (
          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5">
            {approvalN > 0 ? (
              <CountBadge count={approvalN} tone="rose" icon={FiClock} />
            ) : null}
            {disbursementN > 0 ? (
              <CountBadge count={disbursementN} tone="emerald" icon={FiCheckCircle} />
            ) : null}
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-90" />

        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/55 ring-1 ring-white/35 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:ring-indigo-200/60">
          {card.Icon ? (
            <card.Icon
              className={`${card.iconClass || "w-10 h-10 text-gray-700"} transition-transform duration-500 group-hover:scale-110`}
            />
          ) : (
            <Image
              src={card.logo || "/12.png"}
              alt={`${card.name} logo`}
              fill
              className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>

        <h2 className="relative mt-4 text-lg font-extrabold text-gray-900 transition-colors duration-300 group-hover:text-indigo-800">
          {card.name}
        </h2>
        <p className="relative mt-1 text-xs font-semibold text-gray-600/90 transition-colors duration-300 group-hover:text-indigo-600/90">
          اضغط لفتح التفاصيل
        </p>
      </motion.div>
    </Link>
  );
}

function ToolCard({ card }) {
  const Icon = card.Icon || FiZap;

  return (
    <Link href={card.href || "/home"}>
      <motion.div
        variants={item}
        whileHover={{ y: -4, scale: 1.012 }}
        whileTap={{ scale: 0.995 }}
        className={`group relative flex flex-col items-center p-6 text-center transition-all duration-300 hover:bg-white/70 hover:ring-indigo-200/50 hover:shadow-[0_20px_50px_-22px_rgba(79,70,241,0.22)] ${glassCard}`}
      >
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/70 shadow-md ring-1 ring-white/40 transition-all duration-300 group-hover:scale-105 group-hover:ring-indigo-200/60">
          <Icon className={`h-10 w-10 transition-transform duration-300 group-hover:scale-110 ${card.color || "text-gray-700 group-hover:text-indigo-600"}`} />
        </div>
        <h2 className="relative mt-4 text-lg font-extrabold text-gray-900 transition-colors duration-300 group-hover:text-indigo-800">
          {card.name}
        </h2>
        <p className="relative mt-1 text-xs font-semibold text-gray-600/90 transition-colors duration-300 group-hover:text-indigo-600/90">
          اضغط لفتح الأداة
        </p>
      </motion.div>
    </Link>
  );
}

function CountBadge({ count, tone, icon: Icon }) {
  const toneClass =
    tone === "rose" ? "from-rose-600 to-red-600" : "from-emerald-600 to-green-600";

  return (
    <span
      className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center gap-1 rounded-full bg-gradient-to-br ${toneClass} px-2.5 text-xs font-black text-white shadow-sm ring-2 ring-white/85`}
    >
      <Icon className="text-[13px] shrink-0" />
      {count > 99 ? "99+" : count}
    </span>
  );
}
