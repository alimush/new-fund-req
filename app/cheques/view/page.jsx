"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FiArrowRight, FiPrinter } from "react-icons/fi";
import { ChequeViewContent } from "@/components/cheques/ChequeViewDrawer";
import { printChequeData } from "@/lib/cheques/printCheque";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";

function ChequeViewInner() {
  const searchParams = useSearchParams();
  const id = String(searchParams.get("id") || "").trim();
  const { canUseCheques, ready } = useChequeAccess();
  const [printing, setPrinting] = useState(false);
  const [printPayload, setPrintPayload] = useState(null);

  const handlePrint = useCallback(async () => {
    if (!printPayload?.template) return;
    const title =
      [printPayload.doc?.templateName, printPayload.doc?.chequeNumber]
        .filter(Boolean)
        .join(" — ") || "صك";
    await printChequeData({
      ...printPayload,
      title,
      onStart: () => setPrinting(true),
      onEnd: () => setPrinting(false),
    });
  }, [printPayload]);

  if (!ready || !canUseCheques) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  if (!id) {
    return (
      <div className="max-w-lg mx-auto text-center py-20" dir="rtl">
        <p className="text-slate-700 font-bold">لم يُحدد معرّف الصك</p>
        <Link href="/cheques/reports" className="mt-4 inline-block text-emerald-700 font-extrabold">
          العودة للتقارير
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto pb-12" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/cheques/reports"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-800 mb-2"
          >
            <FiArrowRight className="rotate-180" />
            تقارير الصكوك
          </Link>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">معاينة الصك</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            الصورة للمعاينة — الطباعة بيانات فقط على الصك الفارغ في الطابعة
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          disabled={printing || !printPayload}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <FiPrinter className={printing ? "animate-pulse" : ""} />
          {printing ? "جاري الطباعة…" : "طباعة على صك فارغ"}
        </button>
      </div>
      <ChequeViewContent chequeId={id} onReady={setPrintPayload} />
    </div>
  );
}

export default function ChequeViewPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center font-bold text-slate-600" dir="rtl">
          جاري التحميل…
        </div>
      }
    >
      <ChequeViewInner />
    </Suspense>
  );
}
