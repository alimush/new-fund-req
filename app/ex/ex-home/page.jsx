"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { FiRepeat, FiShield, FiXOctagon, FiFileText, FiShuffle } from "react-icons/fi";

import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

const cards = [
  {
    key: "replace-booking-transfer",
    name: "استبدال حجز وتحويل مبالغ",
    href: "/ex/replace-booking-transfer",
    icon: FiRepeat,
    desc: "إجراء تحويل/استبدال حجز لوحدة سكنية حسب الضوابط.",
  },
  {
    key: "waiver-reservation",
    name: "التنازل عن حجز وحدة سكنية ومبالغ مالية للأقارب فقط",
    href: "/ex/waiver-reservation",
    icon: FiShield,
    desc: "طلب تنازل أو نقل الحجز لشخص آخر مع المتطلبات.",
  },
  {
    key: "cancel-booking-unit",
    name: "طلب الغاء حجز وحدة مجمع بدور",
    href: "/ex/cancel-booking-unit",
    icon: FiXOctagon,
    desc: "تقديم طلب إلغاء الحجز ومتابعة موافقات الإجراء.",
  },
  {
    key: "unit-transfer",
    name: "تحويل وحدة",
    href: "/ex/unit-transfer",
    icon: FiShuffle,
    desc: "تحويل وحدة سكنية بين المستفيدين حسب الضوابط المعتمدة.",
  },
  {
    key: "exceptions",
    name: "الاستثناءات",
    href: "/ex/payment-plan",
    icon: FiFileText,
    desc: "نماذج وخطط الدفع الخاصة بالاستثناءات والمتابعة.",
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

export default function ExDashboardPage() {
  const router = useRouter();

  // ⚠️ خليت جلب أكثر من قيمة حتى يدعم أغلب الـ Contextات
  const { hasPermission, loading, permissions, user } = usePermissions();

  // ✅ نحسبها بطريقة قوية (حتى لو hasPermission مو مضبوط)
  const canEX = useMemo(() => {
    // 1) إذا hasPermission موجودة وتشتغل
    if (typeof hasPermission === "function") {
      try {
        return !!hasPermission(PERMISSIONS.EX);
      } catch {
        // ignore
      }
    }

    // 2) إذا عندك permissions array بالكونتكست
    if (Array.isArray(permissions)) {
      return permissions.includes(PERMISSIONS.EX);
    }

    // 3) إذا عندك user.permissions
    if (Array.isArray(user?.permissions)) {
      return user.permissions.includes(PERMISSIONS.EX);
    }

    return false;
  }, [hasPermission, permissions, user]);

  useEffect(() => {
    if (loading) return;

    if (!canEX) router.replace("/home");
  }, [loading, canEX, router]);

  // ✅ منع الوميض + منع التقييم قبل الاستقرار
  if (loading) return null;
  if (!canEX) return null;

  return (
    <div className="px-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10 text-center mt-14 relative">
        <motion.h1
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="text-3xl md:text-4xl font-extrabold text-gray-900"
        >
          لوحة الاستثناءات
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

      {/* Cards */}
      <motion.div
        className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {cards.map((c) => {
          const Icon = c.icon;

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