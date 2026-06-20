"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiPrinter, FiX } from "react-icons/fi";
import { buildCalibTestPrintHtml } from "@/lib/cheques/buildCalibTestHtml";
import { runChequePrintHtml } from "@/lib/cheques/runChequePrintHtml";
import {
  cmToMm,
  formatCmFromMm,
  normalizeWizardGuideStyle,
  parseCmInput,
  WIZARD_GUIDE_STYLE_COORDINATES,
  WIZARD_GUIDE_STYLE_FRAME,
} from "@/lib/cheques/printCalib";

function ShiftInput({ label, hint, valueMm, onChangeMm }) {
  const [draft, setDraft] = useState(formatCmFromMm(valueMm));

  return (
    <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-slate-700">{label}</span>
        <span className="text-xs font-black text-violet-700 tabular-nums">
          {formatCmFromMm(valueMm)} سم
        </span>
      </div>
      {hint ? (
        <p className="mb-2 text-[10px] font-semibold text-slate-500">{hint}</p>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const cm = parseCmInput(e.target.value);
          if (cm != null) onChangeMm(cmToMm(cm));
        }}
        onBlur={() => setDraft(formatCmFromMm(valueMm))}
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 tabular-nums"
      />
    </label>
  );
}

export default function ChequeCalibWizard({
  open,
  onClose,
  template,
  templateKey,
  fields = [],
  calib,
  printerName,
  imageUrl = null,
  onApplyCalib,
  wizardCalibSource = "shared",
  copyCount = 3,
  onSaveWizardLayout,
  onSavePrinterCalib,
}) {
  const [step, setStep] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shiftRightMm, setShiftRightMm] = useState(0);
  const [shiftDownMm, setShiftDownMm] = useState(0);
  const [guideStyle, setGuideStyle] = useState(WIZARD_GUIDE_STYLE_COORDINATES);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setGuideStyle(normalizeWizardGuideStyle(calib?.wizardGuideStyle));
  }, [open, calib?.wizardGuideStyle]);

  const reset = () => {
    setStep(1);
    setShiftRightMm(0);
    setShiftDownMm(0);
    setGuideStyle(normalizeWizardGuideStyle(calib?.wizardGuideStyle));
    setError("");
  };

  const handleGuideStyleChange = (style) => {
    const next = normalizeWizardGuideStyle(style);
    setGuideStyle(next);
    onApplyCalib?.({ ...calib, wizardGuideStyle: next });
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handlePrintTest = async () => {
    setPrinting(true);
    setError("");
    try {
      const html = buildCalibTestPrintHtml({
        template,
        printCalib: { ...calib, wizardGuideStyle: guideStyle },
        fields,
        imageUrl,
        title: "معايرة الطابعة",
        copyCount,
      });
      const ok = await runChequePrintHtml(html, "معايرة الطابعة");
      if (!ok) setError("تعذرت طباعة صفحة المعايرة");
      else setStep(2);
    } catch {
      setError("تعذرت طباعة صفحة المعايرة");
    } finally {
      setPrinting(false);
    }
  };

  const buildAdjustedCalib = () => ({
    ...calib,
    wizardGuideStyle: guideStyle,
    offsetXmm: (Number(calib?.offsetXmm) || 0) + shiftRightMm,
    offsetYmm: (Number(calib?.offsetYmm) || 0) + shiftDownMm,
  });

  const handleApply = () => {
    const next = buildAdjustedCalib();
    onApplyCalib?.(next);
    setStep(3);
  };

  const handleSave = async () => {
    if (!printerName?.trim()) {
      setError("أدخل اسم الطابعة أولاً");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = buildAdjustedCalib();
      onApplyCalib?.(next);

      const res = await fetch("/api/cheques/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          printerName: printerName.trim(),
          printCalib: next,
          isDefault: true,
          fromWizard: true,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error || "فشل الحفظ");
        return;
      }
      onSavePrinterCalib?.(json.printCalib, json.printerName);
      handleClose();
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-lg rounded-2xl border border-white/60 bg-white p-5 shadow-2xl"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold text-violet-700">معايرة الطابعة</p>
              <h3 className="text-base font-extrabold text-slate-900">
                {step === 1
                  ? "الخطوة 1 — طباعة صفحة الاختبار"
                  : step === 2
                  ? "الخطوة 2 — قيس الانزياح"
                  : "الخطوة 3 — حفظ المعايرة"}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <FiX size={18} />
            </button>
          </div>

          {step === 1 ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
                <p className="mb-2 text-xs font-extrabold text-slate-800">دليل المعايرة على الورقة</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 ${
                      guideStyle === WIZARD_GUIDE_STYLE_COORDINATES
                        ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="wizardGuideStyle"
                      className="mt-1 accent-violet-600"
                      checked={guideStyle === WIZARD_GUIDE_STYLE_COORDINATES}
                      onChange={() => handleGuideStyleChange(WIZARD_GUIDE_STYLE_COORDINATES)}
                    />
                    <span>
                      <span className="block text-xs font-extrabold text-slate-900">إحداثيات</span>
                      <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                        خطوط متقاطعة + علامات REF + زوايا زرقاء
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 ${
                      guideStyle === WIZARD_GUIDE_STYLE_FRAME
                        ? "border-red-400 bg-red-50 ring-2 ring-red-200"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="wizardGuideStyle"
                      className="mt-1 accent-red-600"
                      checked={guideStyle === WIZARD_GUIDE_STYLE_FRAME}
                      onChange={() => handleGuideStyleChange(WIZARD_GUIDE_STYLE_FRAME)}
                    />
                    <span>
                      <span className="block text-xs font-extrabold text-slate-900">إطار أحمر</span>
                      <span className="block text-[10px] font-semibold text-slate-500 mt-0.5">
                        إطار أحمر حول حدود الصك فقط
                      </span>
                    </span>
                  </label>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                ستُطبع{" "}
                <strong>
                  {copyCount === 1 ? "نسخة واحدة" : `${copyCount} نسخ`}
                </strong>{" "}
                على ورقة واحدة — كل نسخة بموضعها المحفوظ. اطبعها على Scale{" "}
                <strong>100%</strong> و A4 <strong>أفقي</strong> ثم{" "}
                {guideStyle === WIZARD_GUIDE_STYLE_FRAME
                  ? "قارن الإطار الأحمر مع حدود الصك الفعلي."
                  : "قارن موضع العلامات."}
              </p>
              <button
                type="button"
                onClick={handlePrintTest}
                disabled={printing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <FiPrinter className={printing ? "animate-pulse" : ""} />
                {printing
                  ? "جاري الطباعة…"
                  : copyCount === 1
                  ? "طباعة صفحة المعايرة"
                  : `طباعة ${copyCount} نسخ معايرة`}
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                {guideStyle === WIZARD_GUIDE_STYLE_FRAME ? (
                  <>
                    إذا كان <strong>الإطار الأحمر</strong> انزاح عن حدود الصك الفعلي، أدخل قيم
                    التصحيح بالسنتيمتر. <strong>يمين = موجب</strong>،{" "}
                    <strong>أسفل = موجب</strong>.
                  </>
                ) : (
                  <>
                    إذا كانت العلامات انزاحت على الورقة، أدخل قيم التصحيح بالسنتيمتر.{" "}
                    <strong>يمين = موجب</strong>، <strong>أسفل = موجب</strong>.
                  </>
                )}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ShiftInput
                  label="انزاح لليمين"
                  hint="إذا الطباعة يسار عن المطلوب"
                  valueMm={shiftRightMm}
                  onChangeMm={setShiftRightMm}
                />
                <ShiftInput
                  label="انزاح للأسفل"
                  hint="إذا الطباعة أعلى عن المطلوب"
                  valueMm={shiftDownMm}
                  onChangeMm={setShiftDownMm}
                />
              </div>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                تطبيق على المعاينة
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-emerald-800 leading-relaxed">
                تم تطبيق التصحيح على المعاينة. احفظ المعايرة للطابعة{" "}
                <strong>{printerName || "—"}</strong> لاستخدامها تلقائياً لاحقاً.
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <FiCheck />
                {saving ? "جاري الحفظ…" : "حفظ معايرة الطابعة"}
              </button>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
