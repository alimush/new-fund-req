"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { FiRepeat, FiShield, FiXOctagon, FiFileText, FiShuffle , FiPaperclip } from "react-icons/fi";

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
  const { hasPermission, loading, permissions, user } = usePermissions();

  const hasGeneralEX = useMemo(() => {
    if (typeof hasPermission === "function") {
      try {
        return !!hasPermission(PERMISSIONS.EX);
      } catch {}
    }

    if (Array.isArray(permissions)) {
      return permissions.includes(PERMISSIONS.EX);
    }

    if (Array.isArray(user?.permissions)) {
      return user.permissions.includes(PERMISSIONS.EX);
    }

    return false;
  }, [hasPermission, permissions, user]);

  const allowedCards = useMemo(() => {
    return cards.filter((card) => {
      if (!hasGeneralEX) return false;

      if (typeof hasPermission === "function") {
        try {
          return !!hasPermission(card.permission);
        } catch {
          return false;
        }
      }

      if (Array.isArray(permissions)) {
        return permissions.includes(card.permission);
      }

      if (Array.isArray(user?.permissions)) {
        return user.permissions.includes(card.permission);
      }

      return false;
    });
  }, [hasGeneralEX, hasPermission, permissions, user]);

  useEffect(() => {
    if (loading) return;
    if (allowedCards.length === 0) router.replace("/home");
  }, [loading, allowedCards, router]);

  const [counts, setCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);

  useEffect(() => {
    if (loading || allowedCards.length === 0) return;

    let alive = true;

    const currentUserId =
      typeof window !== "undefined" ? localStorage.getItem("userId") || "" : "";

    if (!currentUserId) {
      setCounts({});
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
        setLoadingCounts(true);

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
        if (alive) setLoadingCounts(false);
      }
    };

    fetchCounts();

    const t = setInterval(fetchCounts, 30000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [loading, allowedCards]);

  if (loading) return null;
  if (allowedCards.length === 0) return null;

  return (
    <div className="px-4">
      <div className="max-w-6xl mx-auto mb-10 text-center mt-14 relative">
        <motion.h1
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-extrabold text-gray-900"
        >
          طلبات الحجز
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55, ease: "easeOut" }}
          className="mt-2 text-gray-600"
        >
          اختر القسم المطلوب للمتابعة
        </motion.p>
      </div>

      <motion.div
        className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
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
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.995 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="
                  group relative cursor-pointer rounded-3xl p-7
                  bg-white/40 backdrop-blur-2xl
                  ring-1 ring-white/25
                  shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)]
                  hover:bg-white/60 hover:ring-white/40
                  transition-all duration-300
                  text-right
                "
              >
{c.key !== "attachment-only" && !loadingCounts && n > 0 && (
                    <div
                    className="
                      absolute top-2 right-3
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

                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-80" />

                <div className="relative flex items-start gap-4">
                  <div
                    className="
                      shrink-0 w-14 h-14 rounded-2xl
                      bg-white/55 backdrop-blur
                      ring-1 ring-white/25
                      shadow-sm
                      flex items-center justify-center
                    "
                  >
                    <Icon className="text-2xl text-gray-800 transition-transform duration-500 group-hover:scale-110" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold tracking-tight text-gray-900">
                      {c.name}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                      {c.desc}
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <span className="px-3 py-1 rounded-full bg-white/60 ring-1 ring-black/5">
                        فتح
                      </span>
                      <span className="text-gray-400">←</span>
                    </div>
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