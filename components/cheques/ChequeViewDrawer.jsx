"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiPrinter,
  FiSliders,
  FiExternalLink,
  FiHash,
  FiCalendar,
  FiUser,
  FiDollarSign,
} from "react-icons/fi";
import ChequeCanvas from "@/components/cheques/ChequeCanvas";
import { getChequeTemplate } from "@/lib/cheques/templates";
import {
  fieldsFromTemplate,
} from "@/lib/cheques/mergeFields";
import { chequeDocToValues } from "@/lib/cheques/chequeDocToValues";
import {
  formatChequeAmount,
  formatChequeDateParts,
  formatSavedAt,
} from "@/lib/cheques/formatCheque";
import { printChequeData, printChequeImageOnly, printChequeWithImage } from "@/lib/cheques/printCheque";
import { defaultPrintCalib } from "@/lib/cheques/printCalib";
import {
  LAYOUT_FONT_SCALE_DEFAULT,
  clampLayoutFontScale,
} from "@/lib/cheques/chequeDesignMetrics";
import { fetchChequePrintBundle } from "@/lib/cheques/fetchPrintCalib";
import ChequePrintSettingsModal from "@/components/cheques/ChequePrintSettingsModal";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";

function MetaRow({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500 mb-0.5">
        {Icon ? <Icon size={12} className="text-emerald-600" /> : null}
        {label}
      </p>
      <p className="text-sm font-extrabold text-slate-900 break-words">{value || "—"}</p>
    </div>
  );
}

export function ChequeViewContent({ chequeId, onReady, className = "" }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState(null);
  const [mergedFields, setMergedFields] = useState([]);
  const [dateShowSlashes, setDateShowSlashes] = useState(true);
  const [values, setValues] = useState({});
  const [globalFontScale, setGlobalFontScale] = useState(LAYOUT_FONT_SCALE_DEFAULT);

  const template = useMemo(
    () => (doc?.templateKey ? getChequeTemplate(doc.templateKey) : null),
    [doc?.templateKey]
  );

  const textFieldLayout = useMemo(() => {
    const lay = doc?.textFieldLayout;
    if (!lay || typeof lay.top !== "number") return null;
    return lay;
  }, [doc?.textFieldLayout]);

  const amountWordsLayout = useMemo(() => {
    const lay = doc?.amountWordsLayout;
    if (!lay || typeof lay.top !== "number") return null;
    return lay;
  }, [doc?.amountWordsLayout]);

  const amountWordsLine2Layout = useMemo(() => {
    const lay = doc?.amountWordsLine2Layout;
    if (!lay || typeof lay.top !== "number") return null;
    return lay;
  }, [doc?.amountWordsLine2Layout]);

  const loadCheque = useCallback(async () => {
    if (!chequeId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/cheques/${encodeURIComponent(chequeId)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json?.success || !json.data) {
        setError(json?.error || "تعذر تحميل الصك");
        setDoc(null);
        return;
      }

      const data = json.data;
      setDoc(data);

      const tpl = getChequeTemplate(data.templateKey);
      if (!tpl) {
        setError("قالب الصك غير معروف");
        return;
      }

      let fields = fieldsFromTemplate(tpl);
      let slashes = tpl.dateShowSlashesDefault ?? true;
      let printCalib = defaultPrintCalib(tpl, fields);
      let layoutFontScale = LAYOUT_FONT_SCALE_DEFAULT;
      let printerName = "";

      try {
        const bundle = await fetchChequePrintBundle(data.templateKey, tpl, fields);
        fields = Array.isArray(bundle?.fields) && bundle.fields.length ? bundle.fields : fields;
        slashes =
          typeof bundle?.dateShowSlashes === "boolean"
            ? bundle.dateShowSlashes
            : slashes;
        printCalib = bundle?.printCalib || defaultPrintCalib(tpl, fields);
        layoutFontScale = clampLayoutFontScale(
          bundle?.globalFontScale ?? layoutFontScale
        );
        printerName = String(bundle?.printerName || "").trim();
      } catch {
        //
      }

      setMergedFields(fields);
      setDateShowSlashes(slashes);
      setGlobalFontScale(layoutFontScale);
      const vals = chequeDocToValues(data);
      setValues(vals);
      onReady?.({
        template: tpl,
        templateKey: data.templateKey,
        fields,
        values: vals,
        dateShowSlashes: slashes,
        textFieldLayout: data.textFieldLayout || null,
        amountWordsLayout: data.amountWordsLayout || null,
        amountWordsLine2Layout: data.amountWordsLine2Layout || null,
        printCalib,
        layoutFontScale,
        printerName,
        doc: data,
      });
    } catch (err) {
      console.error("ChequeViewContent load:", err);
      setError(err?.message || "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }, [chequeId, onReady]);

  useEffect(() => {
    loadCheque();
  }, [loadCheque]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-24 ${className}`}>
        <p className="text-slate-600 font-extrabold animate-pulse">جاري تحميل الصك…</p>
      </div>
    );
  }

  if (error || !doc || !template) {
    return (
      <div className={`text-center py-16 ${className}`}>
        <p className="text-rose-700 font-extrabold">{error || "لا توجد بيانات"}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col xl:flex-row gap-5 xl:gap-6">
        <aside className="w-full xl:w-[280px] shrink-0 space-y-2 order-2 xl:order-1">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 mb-3">
            <p className="text-xs font-bold text-emerald-800/80">نوع الصك</p>
            <p className="text-sm font-extrabold text-emerald-950">{doc.templateName}</p>
            <p className="text-[11px] text-slate-600 font-semibold mt-1">{doc.bankName}</p>
          </div>
          <MetaRow icon={FiHash} label="رقم الصك" value={doc.chequeNumber} />
          <MetaRow icon={FiHash} label="رقم الحساب" value={doc.accountNumber} />
          <MetaRow
            icon={FiCalendar}
            label="تاريخ الصك"
            value={formatChequeDateParts(doc.dateParts)}
          />
          {doc.templateKey === "mustashar_ghadeer" ? (
            <MetaRow label="المحافظة" value={doc.governorate} />
          ) : null}
          <MetaRow icon={FiUser} label="ادفعوا بموجب الأمر" value={doc.payee} />
          <MetaRow
            icon={FiDollarSign}
            label="المبلغ"
            value={formatChequeAmount(doc.amountNumeric, doc.currency)}
          />
          <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5">
            <p className="text-[10px] font-extrabold text-slate-500 mb-0.5">المبلغ كتابة</p>
            <p className="text-xs font-bold text-slate-800 leading-relaxed">{doc.amountWords || "—"}</p>
            {doc.amountWordsLine2 ? (
              <p className="text-xs font-bold text-slate-800 leading-relaxed mt-0.5">
                {doc.amountWordsLine2}
              </p>
            ) : null}
          </div>
          {doc.text ? (
            <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5">
              <p className="text-[10px] font-extrabold text-slate-500 mb-0.5">نص إضافي</p>
              <p className="text-xs font-bold text-slate-800 whitespace-pre-wrap">{doc.text}</p>
            </div>
          ) : null}
          <MetaRow label="أنشئ بواسطة" value={doc.createdBy} />
          <MetaRow label="تاريخ الحفظ" value={formatSavedAt(doc.createdAt)} />
        </aside>

        <div className="flex-1 min-w-0 order-1 xl:order-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-inner">
            <ChequeCanvas
              template={template}
              fields={mergedFields}
              values={values}
              dateShowSlashes={dateShowSlashes}
              textFieldLayout={textFieldLayout}
              amountWordsLayout={amountWordsLayout}
              amountWordsLine2Layout={amountWordsLine2Layout}
              globalFontScale={globalFontScale}
              viewMode
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChequeViewDrawer({ open, chequeId, onClose }) {
  const { canManagePrintSettings } = useChequeAccess();
  const [portalReady, setPortalReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printingImage, setPrintingImage] = useState(false);
  const [printingWithData, setPrintingWithData] = useState(false);
  const [printPayload, setPrintPayload] = useState(null);
  const [printModal, setPrintModal] = useState({ open: false, mode: "data" });

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const printTitle =
    [printPayload?.doc?.templateName, printPayload?.doc?.chequeNumber]
      .filter(Boolean)
      .join(" — ") || "صك";

  const runPrint = async (
    mode,
    printCalib,
    useProvidedCalib = false,
    copyCount,
    printerName = "",
    printMode
  ) => {
    if (!printPayload?.template) return false;
    const effectiveMode = printMode || mode;
    const base = {
      ...printPayload,
      title: printTitle,
      printCalib,
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
  };

  const openPrintModal = (mode) => {
    if (!printPayload?.template) return;
    setPrintModal({ open: true, mode });
  };

  /** طباعة مباشرة — يحمّل القالب المحفوظ تلقائياً */
  const quickPrint = async (mode) => {
    if (!printPayload?.template) return;
    await runPrint(mode, null, false);
  };

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {open && chequeId ? (
        <motion.div
          key="cheque-view-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col bg-slate-900/55 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="flex flex-col h-full max-h-[100dvh] m-2 md:m-4 rounded-3xl border border-white/40 bg-gradient-to-b from-white to-slate-50 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 md:px-6 py-4">
              <div>
                <p className="text-xs font-extrabold text-violet-700">معاينة الصك</p>
                <h2 className="text-lg md:text-xl font-extrabold text-slate-900">
                  عرض الصك المحفوظ
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => quickPrint("data")}
                  disabled={printing || printingImage || printingWithData || !printPayload?.template}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
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
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <FiPrinter className={printingWithData ? "animate-pulse" : ""} />
                  {printingWithData ? "جاري الطباعة…" : "طباعة الصك والبيانات"}
                </button>
                <button
                  type="button"
                  onClick={() => quickPrint("imageOnly")}
                  disabled={printing || printingImage || printingWithData || !printPayload?.template?.image}
                  title="طباعة صورة الصك فقط بدون بيانات"
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-extrabold text-violet-900 hover:bg-violet-100 disabled:opacity-60"
                >
                  <FiPrinter className={printingImage ? "animate-pulse" : ""} />
                  {printingImage ? "جاري الطباعة…" : "طباعة الصك"}
                </button>
                {canManagePrintSettings ? (
                  <button
                    type="button"
                    onClick={() => openPrintModal("data")}
                    disabled={!printPayload?.template}
                    title="ضبط إعدادات الطباعة المحفوظة لهذا القالب"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <FiSliders />
                    ضبط الطباعة
                  </button>
                ) : null}
                <Link
                  href={`/cheques/view?id=${encodeURIComponent(chequeId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
                >
                  <FiExternalLink />
                  نافذة جديدة
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                  aria-label="إغلاق"
                >
                  <FiX size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5" id="cheque-view-scroll">
              <ChequeViewContent chequeId={chequeId} onReady={setPrintPayload} />
            </div>

            <footer className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-4 py-3 text-center">
              <p className="text-[11px] font-bold text-slate-500">
                اضغط خارج النافذة أو Esc للإغلاق — انقر على صف في التقرير لفتح صك آخر
              </p>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
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
    </AnimatePresence>,
    document.body
  );
}
