"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiPrinter, FiSave, FiX, FiRotateCcw } from "react-icons/fi";
import ChequePrintCalibPreview from "@/components/cheques/ChequePrintCalibPreview";
import {
  cmToMm,
  defaultPrintCalib,
  FONT_SIZE_SCALE_MAX,
  FONT_SIZE_SCALE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  formatCmFromMm,
  getFieldFontStyle,
  getFieldOffset,
  mmToCm,
  normalizePrintCalib,
  parseCmInput,
  DATE_GROUP_KEY,
  PRINT_FIELD_LABELS,
  printFieldOffsetKeys,
} from "@/lib/cheques/printCalib";

const MODE_LABELS = {
  data: "طباعة على صك فارغ",
  withImage: "طباعة الصك والبيانات",
  imageOnly: "طباعة الصك (صورة فقط)",
};

function CmInputRow({
  label,
  hint,
  valueMm,
  minCm,
  maxCm,
  onChangeMm,
  showSlider = false,
  sliderStep = 0.01,
}) {
  const liveCm = mmToCm(valueMm);
  const display = formatCmFromMm(valueMm);
  const [draft, setDraft] = useState(display);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatCmFromMm(valueMm));
  }, [valueMm, focused]);

  const applyCm = (cm) => {
    const clamped = Math.min(maxCm, Math.max(minCm, cm));
    onChangeMm(cmToMm(clamped));
  };

  const commit = () => {
    const cm = parseCmInput(draft);
    if (cm == null) {
      setDraft(display);
      return;
    }
    applyCm(cm);
    setDraft(formatCmFromMm(cmToMm(Math.min(maxCm, Math.max(minCm, cm)))));
  };

  const handleDraftChange = (next) => {
    setDraft(next);
    const cm = parseCmInput(next);
    if (cm != null) applyCm(cm);
  };

  return (
    <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-extrabold text-slate-700">{label}</span>
        <span className="text-xs font-black text-emerald-700 tabular-nums">{display} سم</span>
      </div>
      {hint ? (
        <p className="text-[10px] font-semibold text-slate-500 mb-2">{hint}</p>
      ) : null}
      {showSlider ? (
        <input
          type="range"
          min={minCm}
          max={maxCm}
          step={sliderStep}
          value={liveCm}
          onChange={(e) => applyCm(parseFloat(e.target.value))}
          className="mb-2 w-full accent-emerald-600"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
          }}
          placeholder="0.00"
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <span className="shrink-0 text-xs font-extrabold text-slate-500">سم</span>
      </div>
    </label>
  );
}

function PercentInputRow({ label, hint, value, min, max, onChange, showSlider = false }) {
  const safe = Number.isFinite(value) ? value : min;
  const [draft, setDraft] = useState(String(safe));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(Number.isFinite(value) ? String(value) : String(min));
  }, [value, min, focused]);

  const apply = (n) => {
    const clamped = Math.min(max, Math.max(min, Math.round(n * 10) / 10));
    onChange(clamped);
  };

  const commit = () => {
    const n = parseFloat(String(draft).replace(",", "."));
    if (!Number.isFinite(n)) {
      setDraft(String(safe));
      return;
    }
    apply(n);
    setDraft(String(Math.min(max, Math.max(min, Math.round(n * 10) / 10))));
  };

  const handleDraftChange = (next) => {
    setDraft(next);
    const n = parseFloat(String(next).replace(",", "."));
    if (Number.isFinite(n)) apply(n);
  };

  return (
    <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-extrabold text-slate-700">{label}</span>
        <span className="text-xs font-black text-violet-700 tabular-nums">{safe}%</span>
      </div>
      {hint ? (
        <p className="text-[10px] font-semibold text-slate-500 mb-2">{hint}</p>
      ) : null}
      {showSlider ? (
        <input
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={safe}
          onChange={(e) => apply(parseFloat(e.target.value))}
          className="mb-2 w-full accent-violet-600"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
          }}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 tabular-nums focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        <span className="shrink-0 text-xs font-extrabold text-slate-500">%</span>
      </div>
    </label>
  );
}

function FontStyleRow({ label, fontSizeScale, fontWeight, onChangeScale, onChangeWeight }) {
  const safeScale = Number.isFinite(fontSizeScale) ? fontSizeScale : 100;
  const safeWeight = Number.isFinite(fontWeight) ? fontWeight : 700;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-700">{label}</span>
          <span className="text-xs font-black text-blue-700 tabular-nums">{safeScale}%</span>
        </div>
        <input
          type="range"
          min={FONT_SIZE_SCALE_MIN}
          max={FONT_SIZE_SCALE_MAX}
          step={1}
          value={safeScale}
          onChange={(e) => onChangeScale(parseFloat(e.target.value))}
          className="mb-2 w-full accent-blue-600"
        />
        <input
          type="number"
          min={FONT_SIZE_SCALE_MIN}
          max={FONT_SIZE_SCALE_MAX}
          value={safeScale}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) onChangeScale(n);
          }}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>

      <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-700">سُمك الخط (Bold)</span>
          <span className="text-xs font-black text-slate-800 tabular-nums">{safeWeight}</span>
        </div>
        <input
          type="range"
          min={FONT_WEIGHT_MIN}
          max={FONT_WEIGHT_MAX}
          step={100}
          value={safeWeight}
          onChange={(e) => onChangeWeight(parseInt(e.target.value, 10))}
          className="mb-2 w-full accent-slate-800"
        />
        <select
          value={safeWeight}
          onChange={(e) => onChangeWeight(parseInt(e.target.value, 10))}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          {[400, 500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w}>
              {w === 400
                ? "عادي (400)"
                : w === 700
                ? "متوسط (700)"
                : w === 800
                ? "غامق (800)"
                : w === 900
                ? "أغمق (900)"
                : `وزن ${w}`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function FieldCalibPanel({
  label,
  offsetXmm,
  offsetYmm,
  fontSizeScale,
  fontWeight,
  onChangeX,
  onChangeY,
  onChangeFontScale,
  onChangeFontWeight,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3">
      <p className="mb-2 text-[11px] font-extrabold text-slate-800">{label}</p>
      <div className="space-y-2">
        <FontStyleRow
          label="حجم الخط"
          fontSizeScale={fontSizeScale}
          fontWeight={fontWeight}
          onChangeScale={onChangeFontScale}
          onChangeWeight={onChangeFontWeight}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <CmInputRow
            label="إزاحة أفقية"
            hint="يمين / يسار"
            valueMm={offsetXmm}
            minCm={-2}
            maxCm={2}
            showSlider
            sliderStep={0.01}
            onChangeMm={onChangeX}
          />
          <CmInputRow
            label="إزاحة عمودية"
            hint="أعلى / أسفل"
            valueMm={offsetYmm}
            minCm={-2}
            maxCm={2}
            showSlider
            sliderStep={0.01}
            onChangeMm={onChangeY}
          />
        </div>
      </div>
    </div>
  );
}

export default function ChequePrintSettingsModal({
  open,
  onClose,
  mode = "data",
  template,
  templateKey,
  initialCalib,
  canSave = false,
  onPrint,
  onSaved,
  previewFields = [],
  previewValues = {},
  dateShowSlashes = true,
  textFieldLayout = null,
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [calib, setCalib] = useState(() =>
    normalizePrintCalib(initialCalib, template || null, previewFields)
  );
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const defaults = useMemo(
    () => defaultPrintCalib(template, previewFields),
    [template, previewFields]
  );

  const offsetFieldList = useMemo(() => {
    const keys = printFieldOffsetKeys(previewFields, template);
    const list = previewFields?.length ? previewFields : template?.fields || [];
    const labelByKey = Object.fromEntries(
      list.map((f) => [f.key, f.label || f.key])
    );
    const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));
    return keys.map((key) => ({
      key,
      label: PRINT_FIELD_LABELS[key] || labelByKey[key] || key,
      field:
        key === DATE_GROUP_KEY
          ? fieldByKey.dateDay || fieldByKey.dateMonth
          : fieldByKey[key],
    }));
  }, [previewFields, template]);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!open || !template) return;
    setCalib(normalizePrintCalib(initialCalib, template, previewFields));
    setError("");
  }, [open, initialCalib, template, previewFields]);

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

  const patch = (key, val) => {
    setCalib((prev) =>
      normalizePrintCalib({ ...prev, [key]: val }, template, previewFields)
    );
  };

  const patchField = (fieldKey, partial) => {
    setCalib((prev) =>
      normalizePrintCalib(
        {
          ...prev,
          fieldOffsets: {
            ...(prev.fieldOffsets || {}),
            [fieldKey]: { ...getFieldOffset(prev, fieldKey), ...partial },
          },
        },
        template,
        previewFields
      )
    );
  };

  const patchFieldFont = (fieldKey, field, partial) => {
    setCalib((prev) => {
      const current = getFieldFontStyle(prev, fieldKey, field);
      return normalizePrintCalib(
        {
          ...prev,
          fieldFontStyles: {
            ...(prev.fieldFontStyles || {}),
            [fieldKey]: { ...current, ...partial },
          },
        },
        template,
        previewFields
      );
    });
  };

  const handleReset = () => setCalib(defaults);

  const handleSave = async () => {
    if (!canSave || !templateKey) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cheques/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          printCalibOnly: true,
          printCalib: calib,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error || "فشل حفظ الإعدادات");
        return;
      }
      const saved = normalizePrintCalib(json.printCalib, template, previewFields);
      setCalib(saved);
      onSaved?.(saved);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    setError("");
    try {
      const ok = await onPrint?.(calib);
      if (ok === false) setError("تعذرت الطباعة");
      else onClose?.();
    } catch {
      setError("تعذرت الطباعة");
    } finally {
      setPrinting(false);
    }
  };

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {open && template ? (
        <motion.div
          key="print-settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 md:px-5">
              <div>
                <p className="text-[11px] font-extrabold text-violet-700">
                  إعدادات الطباعة فقط
                </p>
                <h3 className="text-base font-extrabold text-slate-900">
                  {MODE_LABELS[mode] || "ضبط الطباعة"}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  القياسات بالسنتيمتر (مثال: 18.22 سم) — لا تؤثر على الشاشة
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="إغلاق"
              >
                <FiX size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 leading-relaxed mb-4">
                تفتح نافذة <strong>PDF</strong> بمقاس <strong>18.22 × 9 سم</strong> ثم الطباعة
                تلقائياً. في نافذة الطباعة: <strong>Scale 100%</strong> وألغِ{" "}
                <strong>Headers and footers</strong> و<strong>Two-sided</strong>.
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(300px,460px)_1fr]">
                <div className="xl:sticky xl:top-0 xl:self-start">
                  <ChequePrintCalibPreview
                    calib={calib}
                    template={template}
                    fields={previewFields}
                    values={previewValues}
                    mode={mode}
                    dateShowSlashes={dateShowSlashes}
                    textFieldLayout={textFieldLayout}
                    showChequeImage
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-extrabold text-slate-800">
                      موضع وحجم الصك على الورقة
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <CmInputRow
                        label="من الأعلى"
                        hint="تحريك الصك كاملاً"
                        valueMm={calib.pageTopMm}
                        minCm={-1}
                        maxCm={1}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("pageTopMm", v)}
                      />
                      <CmInputRow
                        label="من اليسار"
                        valueMm={calib.pageLeftMm}
                        minCm={-1}
                        maxCm={1}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("pageLeftMm", v)}
                      />
                      <CmInputRow
                        label="عرض الصك"
                        valueMm={calib.widthMm}
                        minCm={16}
                        maxCm={18.22}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("widthMm", v)}
                      />
                      <CmInputRow
                        label="ارتفاع الصك"
                        valueMm={calib.heightMm}
                        minCm={7}
                        maxCm={9}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("heightMm", v)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-extrabold text-slate-800">
                      ضبط كل حقل على حدة (طباعة فقط)
                    </p>
                    <p className="mb-3 text-[10px] font-semibold text-slate-500">
                      حجم الخط، السُمك، والإزاحة — التعديل يظهر مباشرة بالمعاينة
                    </p>
                    <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                      {offsetFieldList.map(({ key, label, field }) => {
                        const o = getFieldOffset(calib, key);
                        const font = getFieldFontStyle(calib, key, field);
                        return (
                          <FieldCalibPanel
                            key={key}
                            label={label}
                            offsetXmm={o.offsetXmm}
                            offsetYmm={o.offsetYmm}
                            fontSizeScale={font.fontSizeScale}
                            fontWeight={font.fontWeight}
                            onChangeX={(v) => patchField(key, { offsetXmm: v })}
                            onChangeY={(v) => patchField(key, { offsetYmm: v })}
                            onChangeFontScale={(v) =>
                              patchFieldFont(key, field, { fontSizeScale: v })
                            }
                            onChangeFontWeight={(w) =>
                              patchFieldFont(key, field, { fontWeight: w })
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-extrabold text-slate-800">
                      مقياس عام + إزاحة إضافية للكل
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PercentInputRow
                        label="مقياس البيانات — عرض"
                        value={calib.scaleX}
                        min={70}
                        max={130}
                        showSlider
                        onChange={(v) => patch("scaleX", v)}
                      />
                      <PercentInputRow
                        label="مقياس البيانات — ارتفاع"
                        value={calib.scaleY}
                        min={70}
                        max={130}
                        showSlider
                        onChange={(v) => patch("scaleY", v)}
                      />
                      <CmInputRow
                        label="إزاحة كل البيانات أفقياً"
                        hint="إضافية فوق إزاحة كل حقل"
                        valueMm={calib.offsetXmm}
                        minCm={-1.5}
                        maxCm={1.5}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("offsetXmm", v)}
                      />
                      <CmInputRow
                        label="إزاحة كل البيانات عمودياً"
                        valueMm={calib.offsetYmm}
                        minCm={-1.5}
                        maxCm={1.5}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("offsetYmm", v)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <p className="mt-4 text-sm font-bold text-red-600">{error}</p>
              ) : null}
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 md:px-5">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
              >
                <FiRotateCcw size={14} />
                افتراضي
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {canSave ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || printing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <FiSave size={14} />
                    {saving ? "جاري الحفظ…" : "حفظ للقالب"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={printing}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={printing || saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <FiPrinter size={14} className={printing ? "animate-pulse" : ""} />
                  {printing ? "جاري الطباعة…" : "طباعة"}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
