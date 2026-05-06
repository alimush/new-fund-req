"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  FiRepeat,
  FiShield,
  FiXOctagon,
  FiFileText,
  FiShuffle,
  FiPaperclip,
  FiGrid,
} from "react-icons/fi";

import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

const cards = [
  {
    key: "replace-booking-transfer",
    name: "استبدال حجز وتحويل مبالغ",
    href: "/ex/replace-booking-transfer",
    icon: FiRepeat,
    desc: "إجراء تحويل/استبدال حجز لوحدة سكنية حسب الضوابط.",
    permission: PERMISSIONS.EX_REPLACE_BOOKING_TRANSFER,
  },
  {
    key: "waiver-reservation",
    name: "التنازل عن حجز وحدة سكنية ومبالغ مالية للأقارب فقط",
    href: "/ex/waiver-reservation",
    icon: FiShield,
    desc: "طلب تنازل أو نقل الحجز لشخص آخر مع المتطلبات.",
    permission: PERMISSIONS.EX_WAIVER_RESERVATION,
  },
  {
    key: "cancel-booking-unit",
    name: "طلب الغاء حجز وحدة مجمع بدور",
    href: "/ex/cancel-booking-unit",
    icon: FiXOctagon,
    desc: "تقديم طلب إلغاء الحجز ومتابعة موافقات الإجراء.",
    permission: PERMISSIONS.EX_CANCEL_BOOKING_UNIT,
  },
  {
    key: "unit-transfer",
    name: "تحويل وحدة",
    href: "/ex/unit-transfer",
    icon: FiShuffle,
    desc: "تحويل وحدة سكنية بين المستفيدين حسب الضوابط المعتمدة.",
    permission: PERMISSIONS.EX_UNIT_TRANSFER,
  },
  {
    key: "exceptions",
    name: "الاستثناءات",
    href: "/ex/payment-plan",
    icon: FiFileText,
    desc: "نماذج وخطط الدفع الخاصة بالاستثناءات والمتابعة.",
    permission: PERMISSIONS.EX_EXCEPTIONS,
  },
  {
    key: "attachment-only",
    name: "معامله زبون",
    href: "/ex/attachment-only",
    icon: FiPaperclip,
    desc: "رفع مرفق وإرساله للموافقة حسب الورك فلو.",
    permission: PERMISSIONS.EX_ATTACHMENT_ONLY,
  },
];

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

const norm = (v) => String(v ?? "").trim().toLowerCase();

export default function ExDashboardPage() {
  const router = useRouter();
  const { permissions, user } = usePermissions();

  const permissionsReady = Boolean(user?.id);

  const hasGeneralEX = useMemo(() => {
    const perms = Array.isArray(permissions)
      ? permissions
      : Array.isArray(user?.permissions)
      ? user.permissions
      : [];
    return perms.includes(PERMISSIONS.EX);
  }, [permissions, user]);

  const allowedCards = useMemo(() => {
    const perms = Array.isArray(permissions)
      ? permissions
      : Array.isArray(user?.permissions)
      ? user.permissions
      : [];

    return cards.filter((card) => {
      if (!hasGeneralEX) return false;
      return perms.includes(card.permission);
    });
  }, [hasGeneralEX, permissions, user]);

  const [counts, setCounts] = useState({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const totalPending = useMemo(() => {
    return allowedCards.reduce((sum, c) => sum + Number(counts?.[c.key] || 0), 0);
  }, [allowedCards, counts]);

  useEffect(() => {
    if (!permissionsReady) return;
    if (allowedCards.length === 0) router.replace("/home");
  }, [permissionsReady, allowedCards, router]);

  useEffect(() => {
    if (!permissionsReady || allowedCards.length === 0) return;

    let alive = true;

    const currentUserId = user?.id || "";

    if (!currentUserId) {
      setCounts({});
      setCountsLoaded(true);
      return;
    }

    const isPendingWithMe = (r) => {
      const currentStep = Number.isInteger(r?.currentStep) ? r.currentStep : -1;
      if (currentStep < 0) return false;

      if (norm(r?.status) !== "pending") return false;

      const step = r?.workflow?.steps?.[currentStep];
      if (!step) return false;

      if (norm(step?.status || "pending") !== "pending") return false;

      const users = Array.isArray(step?.users) ? step.users : [];

      return users.some((u) => {
        if (!u) return false;
        if (typeof u === "string" || typeof u === "number") {
          return String(u) === String(currentUserId);
        }
        if (typeof u === "object" && u._id) {
          return String(u._id) === String(currentUserId);
        }
        return false;
      });
    };

    const fetchCounts = async () => {
      try {
        const results = await Promise.all(
          allowedCards.map(async (card) => {
            try {
              let url = "";

              if (card.key === "exceptions") {
                url = "/api/ex/payment-plans";
              } else {
                url = `/api/ex/${encodeURIComponent(card.key)}`;
              }

              const res = await fetch(url, {
                cache: "no-store",
                credentials: "include",
              });

              const data = await res.json().catch(() => ({}));
              const list =
                res.ok && data?.success && Array.isArray(data?.data) ? data.data : [];

              const count = list.filter(isPendingWithMe).length;

              return [card.key, count];
            } catch {
              return [card.key, 0];
            }
          })
        );

        if (!alive) return;

        setCounts(Object.fromEntries(results));
      } catch {
        if (!alive) return;
        setCounts({});
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
  }, [permissionsReady, allowedCards, user?.id]);

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

  if (allowedCards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
          aria-hidden
        />
        <p className="text-sm font-semibold text-slate-600">جاري تحويلك...</p>
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
          اختر القسم المطلوب للمتابعة
        </motion.p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">المستخدم</p>
            <p className="mt-1 truncate text-sm font-extrabold text-gray-900">
              {user?.username || "User"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">الأقسام</p>
            <p className="mt-1 text-sm font-extrabold text-gray-900">{allowedCards.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50/90 p-2.5 text-center ring-1 ring-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-gray-500">طلبات قيد الانتظار</p>
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
                {!countsLoaded ? "..." : totalPending > 99 ? "99+" : totalPending}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mb-4 flex max-w-6xl items-center gap-2 text-sm font-extrabold text-gray-700">
        <FiGrid className="text-gray-600" />
        أقسام الحجز
      </div>

      <motion.div
        className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {allowedCards.map((c) => {
          const Icon = c.icon;
          const n = Number(counts?.[c.key] || 0);

          return (
            <Link key={c.key} href={c.href} className="block">
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
                {c.key !== "attachment-only" && n > 0 && (
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
                      title="طلبات تحتاج إجراء منك"
                    >
                      <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <span className="relative">{n > 99 ? "99+" : n}</span>
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-90" />

                <div className="relative w-20 h-20 rounded-2xl bg-white/50 backdrop-blur ring-1 ring-white/30 shadow-md overflow-hidden flex items-center justify-center transition-all duration-300 group-hover:scale-[1.03]">
                  <Icon className="text-[2rem] text-gray-800 transition-transform duration-500 group-hover:scale-110" />
                </div>

                <div className="relative mt-4 min-w-0">
                  <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
                    {c.name}
                  </h2>

                  <p className="mt-1 text-xs font-semibold text-gray-600/90 leading-relaxed">
                    {c.desc}
                  </p>

                  <div
                    className="
                      mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-gray-800
                      rounded-full bg-white/75 px-3 py-1.5 ring-1 ring-slate-200
                    "
                  >
                    فتح
                    <span className="text-gray-400">←</span>
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
}