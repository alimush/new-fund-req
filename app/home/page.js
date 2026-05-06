"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePermissions } from "@/context/PermissionContext";
import { useEffect, useMemo, useState } from "react";
import { FiFileText, FiBarChart2, FiPieChart } from "react-icons/fi";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";

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
  const { companies, permissions } = usePermissions();

  const allowedCards = useMemo(() => {
    if (!Array.isArray(companies) || !Array.isArray(permissions)) return [];

    const isSuperAdmin = permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);
    const hasEXPerm = permissions.includes(PERMISSIONS.EX);

    const result = [...cards.filter((c) => {
      if (c.key === "EX") return companies.includes("EX") || isSuperAdmin || hasEXPerm;
      return companies.includes(c.key);
    })];

    // ✅ إضافة كارت "إدارة الوصولات"
    const hasAnyVoucherPerm = COMPANIES.some(c => c.permission && permissions.includes(c.permission));
    const canSeeVouchers = isSuperAdmin || hasAnyVoucherPerm || permissions.includes(PERMISSIONS.RECEIPTS);

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
    const canSeeVoucherReports = isSuperAdmin || permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW);

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

  useEffect(() => {
    if (!allowedCards.length) return;

    let alive = true;

    const fetchCounts = async () => {
      try {
        setLoadingCounts(true);
        // Only fetch counts for non-icon cards (company cards)
        const companyList = allowedCards.filter(c => !c.isIcon).map((x) => x.key).join(",");
        if (!companyList) {
          setCounts({});
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
        if (alive) setLoadingCounts(false);
      }
    };

    fetchCounts();

    const t = setInterval(fetchCounts, 30000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [allowedCards]);

  return (
    <div>
      {/* الهيدر */}
      <div className="max-w-6xl mx-auto mb-10 text-center mt-16 relative">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-bold 
                     bg-gradient-to-r from-gray-400 via-gray-600 to-slate-800
                     text-transparent bg-clip-text"
        >
          Companies Dashboard
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="mt-2 bg-gradient-to-r from-gray-500 via-gray-600 to-gray-800 
                     text-transparent bg-clip-text"
        >
          اختر الشركة لعرض تفاصيل الطلبات
        </motion.p>
      </div>

      {/* الكروت */}
      <motion.div
        className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {allowedCards.map((c, idx) => {
          const n = Number(counts?.[c.key] || 0);

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
                {/* ✅ Badge عداد */}
                {!loadingCounts && n > 0 && !c.isIcon && (
                  <div
                    className="
                      absolute top-4 left-4
                      min-w-[34px] h-[28px] px-2
                      rounded-full
                      bg-red-600 text-white
                      flex items-center justify-center
                      text-sm font-extrabold
                      shadow-md
                      ring-2 ring-white/70
                    "
                    title="طلبات تحتاج إجراء منك"
                  >
                    {n > 99 ? "99+" : n}
                  </div>
                )}

                {/* زخارف ناعمة */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-80" />

                {/* اللوغو أو الأيقونة */}
                <div
                  className="
                    relative w-20 h-20 rounded-2xl
                    bg-white/55 backdrop-blur
                    ring-1 ring-white/25
                    shadow-sm overflow-hidden
                    flex items-center justify-center
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
                <h2 className="mt-4 text-lg font-bold tracking-tight text-gray-900">
                  {c.name}
                </h2>
              </motion.div>
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}