"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FiArrowRight, FiChevronLeft, FiLayers } from "react-icons/fi";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";
import {
  MUSTASHAR_TEMPLATE_KEY,
  dedupeBranchesList,
} from "@/lib/cheques/chequeBranches";
import { getChequeTemplate } from "@/lib/cheques/templates";

export default function MustasharBranchesPage() {
  const { canUseCheques, ready } = useChequeAccess();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const parentTemplate = getChequeTemplate(MUSTASHAR_TEMPLATE_KEY);

  useEffect(() => {
    if (!ready || !canUseCheques) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/cheques/branches?templateKey=${encodeURIComponent(MUSTASHAR_TEMPLATE_KEY)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (cancelled) return;
        if (!json?.success) {
          setError(json?.error || "تعذّر تحميل الأفرع");
          return;
        }
        setBranches(dedupeBranchesList(json.branches || []));
      } catch {
        if (!cancelled) setError("خطأ في الاتصال");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, canUseCheques]);

  const branchCountLabel = useMemo(() => {
    if (!branches.length) return "";
    return branches.length === 1 ? "فرع واحد" : `${branches.length} أفرع`;
  }, [branches.length]);

  if (!ready || !canUseCheques) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-1 pb-12" dir="rtl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/cheques"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-3 transition"
          >
            <FiArrowRight />
            نظام الصكوك
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            صكوك مصرف المستشار — اختر الفرع
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 font-semibold text-[15px] leading-relaxed">
            {parentTemplate?.bankName} — نفس مقاس الصك ومواضع البيانات وحجم الخط لكل
            الأفرع. يختلف شكل الصك المطبوع مسبقاً فقط.
          </p>
        </div>
        {!loading && branches.length ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-900">
            <FiLayers size={16} />
            {branchCountLabel}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={`branch-skeleton-${i}`}
              className="h-56 animate-pulse rounded-3xl bg-slate-200/70"
            />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : !branches.length ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-600">
          لا توجد أفرع متاحة حالياً
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {branches.map((branch, index) => (
            <motion.article
              key={branch.id || `${branch.branchKey}-${index}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Link
                href={`/cheques/mustashar_ghadeer?branch=${encodeURIComponent(branch.branchKey)}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_22px_50px_-24px_rgba(16,185,129,0.35)]"
              >
                <div className="relative aspect-[2102/969] w-full overflow-hidden bg-slate-100">
                  <Image
                    src={branch.image}
                    alt={branch.name}
                    fill
                    className="object-fill transition duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent px-4 pb-3 pt-10">
                    <p className="text-white font-extrabold text-base leading-snug">
                      {branch.name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-slate-800 font-bold text-sm leading-relaxed line-clamp-2">
                    {branch.drawerName || parentTemplate?.drawerName}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                    {branch.branchLabel ? (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
                        {branch.branchLabel}
                      </span>
                    ) : null}
                    {branch.accountNumber ? (
                      <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-900">
                        حساب {branch.accountNumber}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-extrabold text-emerald-700 group-hover:text-emerald-800">
                    فتح هذا الفرع
                    <FiChevronLeft className="rotate-180 transition group-hover:translate-x-[-2px]" size={16} />
                  </span>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
