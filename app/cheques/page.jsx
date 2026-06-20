"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FiFileText,
  FiArrowLeft,
  FiPieChart,
  FiSearch,
  FiChevronLeft,
} from "react-icons/fi";
import { CHEQUE_TEMPLATES } from "@/lib/cheques/templates";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { y: 16, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.4 } },
};

export default function ChequesHomePage() {
  const { canUseCheques, ready } = useChequeAccess();

  if (!ready || !canUseCheques) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-3 transition"
          >
            <FiArrowLeft />
            الرئيسية
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            نظام الصكوك
          </h1>
          <p className="mt-2 text-slate-600 font-semibold text-[15px]">
            إصدار صكوك جديدة أو مراجعة المحفوظة في قاعدة البيانات
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
          <FiFileText size={28} />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link
          href="/cheques/reports"
          className="group relative block overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-indigo-50/80 p-6 md:p-7 shadow-[0_20px_55px_-28px_rgba(99,102,241,0.45)] transition hover:shadow-[0_24px_60px_-24px_rgba(99,102,241,0.55)] hover:-translate-y-0.5"
        >
          <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-violet-400/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-6 h-40 w-40 rounded-full bg-indigo-400/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg group-hover:scale-105 transition">
                <FiPieChart size={26} />
              </div>
              <div>
                <p className="text-xs font-extrabold text-violet-700/90 uppercase tracking-wide">
                  تقارير وبحث
                </p>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 mt-0.5">
                  تقارير الصكوك المحفوظة
                </h2>
                <p className="mt-2 text-slate-600 font-semibold text-sm max-w-lg leading-relaxed">
                  فلترة حسب نوع الصك، رقم الصك، الحساب، التاريخ، والمستفيد — مع تصدير Excel
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-violet-800 ring-1 ring-violet-200/80">
                    <FiSearch size={12} />
                    بحث متقدم
                  </span>

                </div>
              </div>
            </div>
            <span className="inline-flex items-center justify-center gap-2 self-start sm:self-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-white text-sm font-extrabold shadow-md group-hover:gap-3 transition-all">
              فتح التقارير
              <FiChevronLeft className="rotate-180" size={18} />
            </span>
          </div>
        </Link>
      </motion.div>

      <div className="mb-4 flex items-center gap-2">
        <span className="h-8 w-1 rounded-full bg-emerald-500" />
        <h2 className="text-lg font-extrabold text-slate-800">إصدار صك جديد</h2>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 sm:grid-cols-2"
      >
        {CHEQUE_TEMPLATES.map((tpl) => {
          const cardImage =
            tpl.key === "mustashar_ghadeer"
              ? "/assets/cheques/branches/mib_main.png"
              : tpl.image;

          return (
          <motion.div key={tpl.key} variants={item}>
            <Link
              href={
                tpl.key === "mustashar_ghadeer"
                  ? "/cheques/mustashar_ghadeer/branches"
                  : `/cheques/${tpl.key}`
              }
              className="group block overflow-hidden rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl shadow-[0_18px_50px_-28px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_60px_-24px_rgba(16,185,129,0.35)] hover:-translate-y-1"
            >
              <div
                className="relative h-36 bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden"
                style={{
                  backgroundImage: `url(${cardImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />
                <div className="absolute bottom-0 right-0 left-0 p-4">
                  <p className="text-white font-extrabold text-lg leading-snug">
                    {tpl.name}
                  </p>
                  <p className="text-white/80 text-xs font-semibold mt-1">
                    {tpl.subtitle}
                  </p>
                </div>
              </div>
              <div className="p-5">
                <p className="text-slate-700 font-bold text-sm">{tpl.bankName}</p>
                <p className="text-slate-500 text-xs font-semibold mt-1 truncate">
                  {tpl.drawerName}
                </p>
                <span className="mt-4 inline-flex items-center rounded-xl bg-emerald-50 px-3 py-1.5 text-emerald-800 text-sm font-extrabold group-hover:bg-emerald-100">
                  {tpl.key === "mustashar_ghadeer"
                    ? "اختر الفرع ←"
                    : "فتح وإدخال البيانات ←"}
                </span>
              </div>
            </Link>
          </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
