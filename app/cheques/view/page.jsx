"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FiArrowRight, FiPrinter, FiSliders, FiSlash } from "react-icons/fi";
import { ChequeViewContent } from "@/components/cheques/ChequeViewDrawer";
import { printChequeData, printChequeImageOnly, printChequeWithImage } from "@/lib/cheques/printCheque";
import ChequePrintSettingsModal from "@/components/cheques/ChequePrintSettingsModal";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";

function ChequeViewInner() {
  const searchParams = useSearchParams();
  const id = String(searchParams.get("id") || "").trim();
  const { canUseCheques, canManagePrintSettings, ready } = useChequeAccess();
  const [printing, setPrinting] = useState(false);
  const [printingImage, setPrintingImage] = useState(false);
  const [printingWithData, setPrintingWithData] = useState(false);
  const [printPayload, setPrintPayload] = useState(null);
  const [printModal, setPrintModal] = useState({ open: false, mode: "data" });

  const printTitle =
    [printPayload?.doc?.templateName, printPayload?.doc?.chequeNumber]
      .filter(Boolean)
      .join(" — ") || "صك";

  const runPrint = useCallback(
    async (mode, printCalib, useProvidedCalib = false, copyCount, printerName = "", printMode) => {
      if (!printPayload?.template) return false;
      const effectiveMode = printMode || mode;
      const base = {
        ...printPayload,
        title: printTitle,
        printCalib,
        layoutFontScale: printPayload?.layoutFontScale,
        useProvidedCalib,
        copyCount,
        printerName,
        printMode: effectiveMode,
      };
      if (effectiveMode === "data") {
        return printChequeData({
          ...base,
          onStart: () => setPrinting(true),
          onEnd: () => setPrinting(false),
        });
      }
      if (effectiveMode === "withImage") {
        return printChequeWithImage({
          ...base,
          onStart: () => setPrintingWithData(true),
          onEnd: () => setPrintingWithData(false),
        });
      }
      return printChequeImageOnly({
        ...base,
        onStart: () => setPrintingImage(true),
        onEnd: () => setPrintingImage(false),
      });
    },
    [printPayload, printTitle]
  );

  const openPrintModal = (mode) => {
    if (!printPayload?.template) return;
    setPrintModal({ open: true, mode });
  };

  const quickPrint = useCallback(
    async (mode) => {
      if (!printPayload?.template) return;
      await runPrint(mode, null, false);
    },
    [printPayload, runPrint]
  );

  const isVoid = printPayload?.doc?.status === "void";

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
            {isVoid
              ? "هذا الصك مبطّل — لا يمكن طباعته"
              : "الطباعة تستخدم إعدادات القالب المحفوظة — كل نوع صك له ضبط مستقل"}
          </p>
        </div>
        {isVoid ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-600 px-5 py-3 text-base font-extrabold text-white shadow-sm">
            <FiSlash size={18} />
            الصك باطل
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => quickPrint("data")}
              disabled={printing || printingImage || printingWithData || !printPayload}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <FiPrinter className={printing ? "animate-pulse" : ""} />
              {printing ? "جاري الطباعة…" : "طباعة على صك فارغ"}
            </button>
            <button
              type="button"
              onClick={() => quickPrint("withImage")}
              disabled={
                printing ||
                printingImage ||
                printingWithData ||
                !printPayload?.template?.image
              }
              title="طباعة صورة الصك مع البيانات"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiPrinter className={printingWithData ? "animate-pulse" : ""} />
              {printingWithData ? "جاري الطباعة…" : "طباعة الصك والبيانات"}
            </button>
            <button
              type="button"
              onClick={() => quickPrint("imageOnly")}
              disabled={printing || printingImage || printingWithData || !printPayload?.template?.image}
              title="طباعة صورة الصك فقط بدون بيانات"
              className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-extrabold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
            >
              <FiPrinter className={printingImage ? "animate-pulse" : ""} />
              {printingImage ? "جاري الطباعة…" : "طباعة الصك"}
            </button>
            {canManagePrintSettings ? (
              <button
                type="button"
                onClick={() => openPrintModal("data")}
                disabled={!printPayload}
                title="ضبط إعدادات الطباعة المحفوظة لهذا القالب"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <FiSliders />
                ضبط الطباعة
              </button>
            ) : null}
          </div>
        )}
      </div>
      <ChequeViewContent chequeId={id} onReady={setPrintPayload} />
      {!isVoid ? (
      <ChequePrintSettingsModal
        open={printModal.open}
        mode={printModal.mode}
        template={printPayload?.template}
        templateKey={printPayload?.templateKey}
        initialCalib={printPayload?.printCalib}
        canSave={canManagePrintSettings}
        previewFields={printPayload?.fields}
        previewValues={printPayload?.values}
        dateShowSlashes={printPayload?.dateShowSlashes}
        textFieldLayout={printPayload?.textFieldLayout}
        amountWordsLayout={printPayload?.amountWordsLayout}
        amountWordsLine2Layout={printPayload?.amountWordsLine2Layout}
        layoutFontScale={printPayload?.layoutFontScale}
        onClose={() => setPrintModal({ open: false, mode: "data" })}
        onSaved={(saved) =>
          setPrintPayload((prev) => (prev ? { ...prev, printCalib: saved } : prev))
        }
        onPrint={(calib, meta) =>
          runPrint(
            meta?.printMode || printModal.mode,
            calib,
            true,
            meta?.copyCount,
            meta?.printerName || printPayload?.printerName || "",
            meta?.printMode
          )
        }
      />
      ) : null}
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
