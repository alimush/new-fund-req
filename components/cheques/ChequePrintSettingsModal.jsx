"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiPrinter, FiSave, FiX, FiRotateCcw, FiTarget, FiMove } from "react-icons/fi";
import ChequePrintCalibPreview from "@/components/cheques/ChequePrintCalibPreview";
import ChequeCalibWizard from "@/components/cheques/ChequeCalibWizard";
import ChequePrintPositionEditor from "@/components/cheques/ChequePrintPositionEditor";
import SheetOrientationControls from "@/components/cheques/SheetOrientationControls";
import {
  fetchPrinterCalibrationList,
} from "@/lib/cheques/fetchPrintCalib";
import {
  readStoredPrinterName,
  writeStoredPrinterName,
} from "@/lib/cheques/printerCalibration";
import {
  applyGlobalTextColorToCalib,
  cmToMm,
  defaultPrintCalib,
  FONT_SIZE_SCALE_MAX,
  FONT_SIZE_SCALE_MIN,
  GLOBAL_FONT_SIZE_SCALE_MAX,
  GLOBAL_FONT_SIZE_SCALE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  formatCmFromMm,
  getFieldFontStyle,
  getFieldOffset,
  mmToCm,
  normalizePrintCalib,
  normalizeWizardCalibSource,
  parseCmInput,
  resolveWizardPrintCalib,
  WIZARD_CALIB_SOURCE_SEPARATE,
  WIZARD_CALIB_SOURCE_SHARED,
  DATE_GROUP_KEY,
  DEFAULT_PRINT_FIELD_COLOR,
  PRINT_FIELD_LABELS,
  printFieldOffsetKeys,
} from "@/lib/cheques/printCalib";
import { normalizeWizardPrintCalib } from "@/lib/cheques/wizardCopyLayouts";
import {
  normalizeWizardTestCopyCount,
  WIZARD_TEST_COPY_DEFAULT,
  WIZARD_TEST_COPY_MAX,
  WIZARD_TEST_COPY_MIN,
} from "@/lib/cheques/chequePrintPageStyles";

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

function FieldColorRow({ label, color, onChangeColor, resetColor = DEFAULT_PRINT_FIELD_COLOR }) {
  const safeColor = color || DEFAULT_PRINT_FIELD_COLOR;

  return (
    <label className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-slate-700">{label}</span>
        <span
          className="inline-block h-6 w-6 shrink-0 rounded border border-slate-300"
          style={{ backgroundColor: safeColor }}
          aria-hidden
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeColor}
          onChange={(e) => onChangeColor(e.target.value)}
          className="h-10 min-w-0 flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white"
        />
        <button
          type="button"
          onClick={() => onChangeColor(resetColor)}
          className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-extrabold text-slate-700 hover:bg-slate-100"
        >
          افتراضي
        </button>
      </div>
    </label>
  );
}

function FieldCalibPanel({
  label,
  offsetXmm,
  offsetYmm,
  fontSizeScale,
  fontWeight,
  color,
  globalTextColor,
  onChangeX,
  onChangeY,
  onChangeFontScale,
  onChangeFontWeight,
  onChangeColor,
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
        <FieldColorRow
          label="لون الخط"
          color={color}
          resetColor={globalTextColor}
          onChangeColor={onChangeColor}
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
  initialWizardCalibSource = WIZARD_CALIB_SOURCE_SHARED,
  initialWizardPrintCalib = null,
  canSave = false,
  onPrint,
  onSaved,
  previewFields = [],
  previewValues = {},
  dateShowSlashes = true,
  textFieldLayout = null,
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  layoutFontScale = 100,
}) {
  const [portalReady, setPortalReady] = useState(false);
  const [calib, setCalib] = useState(() =>
    normalizePrintCalib(initialCalib, template || null, previewFields)
  );
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [calibrationList, setCalibrationList] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [positionEditorOpen, setPositionEditorOpen] = useState(false);
  const [wizardPositionEditorOpen, setWizardPositionEditorOpen] = useState(false);
  const [wizardCalibSource, setWizardCalibSource] = useState(WIZARD_CALIB_SOURCE_SHARED);
  const [wizardCalib, setWizardCalib] = useState(() =>
    normalizeWizardPrintCalib(initialWizardPrintCalib, template || null, previewFields)
  );
  const [wizardTestCopyCount, setWizardTestCopyCount] = useState(WIZARD_TEST_COPY_DEFAULT);

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
    setWizardCalibSource(normalizeWizardCalibSource(initialWizardCalibSource));
    setWizardCalib(
      normalizeWizardPrintCalib(
        initialWizardPrintCalib || defaults,
        template,
        previewFields,
        wizardTestCopyCount
      )
    );
    setError("");
    setSaveMessage("");
    if (templateKey) {
      setPrinterName(readStoredPrinterName(templateKey));
      fetchPrinterCalibrationList(templateKey).then(setCalibrationList);
      fetch(`/api/cheques/layout?templateKey=${encodeURIComponent(templateKey)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .then((json) => {
          if (!json?.success) return;
          setWizardCalibSource(normalizeWizardCalibSource(json.wizardCalibSource));
          setWizardCalib(
            normalizeWizardPrintCalib(
              json.wizardPrintCalib,
              template,
              previewFields,
              normalizeWizardTestCopyCount(json.wizardTestCopyCount)
            )
          );
          setWizardTestCopyCount(normalizeWizardTestCopyCount(json.wizardTestCopyCount));
        })
        .catch(() => {});
    }
  }, [
    open,
    initialCalib,
    initialWizardCalibSource,
    initialWizardPrintCalib,
    template,
    previewFields,
    templateKey,
    defaults,
  ]);

  const resolvedWizardCalib = useMemo(
    () =>
      resolveWizardPrintCalib({
        printCalib: calib,
        wizardPrintCalib: wizardCalib,
        wizardCalibSource,
        template,
        fields: previewFields,
        copyCount: wizardTestCopyCount,
      }),
    [calib, wizardCalib, wizardCalibSource, template, previewFields, wizardTestCopyCount]
  );

  const saveWizardLayout = async (nextWizardCalib) => {
    if (!templateKey) return false;
    try {
      const res = await fetch("/api/cheques/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          wizardCalibOnly: true,
          wizardCalibSource: WIZARD_CALIB_SOURCE_SEPARATE,
          wizardPrintCalib: nextWizardCalib,
          wizardTestCopyCount,
        }),
      });
      const json = await res.json();
      if (!json?.success) return false;
      setWizardCalibSource(WIZARD_CALIB_SOURCE_SEPARATE);
      setWizardCalib(
        normalizeWizardPrintCalib(
          json.wizardPrintCalib,
          template,
          previewFields,
          wizardTestCopyCount
        )
      );
      return true;
    } catch {
      return false;
    }
  };

  const loadPrinterCalibration = async (name) => {
    const trimmed = String(name || "").trim();
    if (!templateKey || !trimmed) return;
    try {
      const res = await fetch(
        `/api/cheques/calibration?templateKey=${encodeURIComponent(templateKey)}&printerName=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json?.success && json.printCalib) {
        setCalib(normalizePrintCalib(json.printCalib, template, previewFields));
      }
    } catch {
      //
    }
  };

  const handlePrinterNameChange = (name) => {
    setPrinterName(name);
    if (templateKey) writeStoredPrinterName(templateKey, name);
  };

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
    setCalib((prev) => {
      if (key === "globalTextColor") {
        return applyGlobalTextColorToCalib(prev, val, template, previewFields);
      }
      return normalizePrintCalib({ ...prev, [key]: val }, template, previewFields);
    });
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

  const handleSavePrinter = async () => {
    const name = printerName.trim();
    if (!name || !templateKey) {
      setError("أدخل اسم الطابعة قبل الحفظ");
      return;
    }
    setSavingPrinter(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await fetch("/api/cheques/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          printerName: name,
          printCalib: calib,
          isDefault: true,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error || "فشل حفظ معايرة الطابعة");
        return;
      }
      setCalib(normalizePrintCalib(json.printCalib, template, previewFields));
      writeStoredPrinterName(templateKey, name);
      setCalibrationList(await fetchPrinterCalibrationList(templateKey));
      setSaveMessage(`تم حفظ معايرة الطابعة «${name}»`);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSavingPrinter(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || !templateKey) return;
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await fetch("/api/cheques/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          printCalibOnly: true,
          printCalib: calib,
          wizardCalibSource,
          wizardPrintCalib: wizardCalib,
          wizardTestCopyCount,
        }),
      });
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error || "فشل حفظ الإعدادات");
        return;
      }
      const saved = normalizePrintCalib(json.printCalib, template, previewFields);
      setCalib(saved);
      if (json.wizardCalibSource != null) {
        setWizardCalibSource(normalizeWizardCalibSource(json.wizardCalibSource));
      }
      if (json.wizardPrintCalib) {
        setWizardCalib(
          normalizeWizardPrintCalib(
            json.wizardPrintCalib,
            template,
            previewFields,
            wizardTestCopyCount
          )
        );
      }
      if (json.wizardTestCopyCount != null) {
        setWizardTestCopyCount(normalizeWizardTestCopyCount(json.wizardTestCopyCount));
      }
      onSaved?.(saved);
      setSaveMessage("تم حفظ إعدادات الطباعة (الخط، اللون، والمواضع) للقالب");
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
      const ok = await onPrint?.(mode === "imageOnly" ? resolvedWizardCalib : calib, {
        printerName: printerName.trim(),
        copyCount: mode === "imageOnly" ? wizardTestCopyCount : undefined,
        printMode: mode,
      });
      if (ok === false) setError("تعذرت الطباعة");
      else onClose?.();
    } catch {
      setError("تعذرت الطباعة");
    } finally {
      setPrinting(false);
    }
  };

  if (!portalReady) return null;

  const wizardImageUrl =
    template?.image && typeof window !== "undefined"
      ? new URL(template.image, window.location.origin).href
      : template?.image || null;

  return (
    <>
      {createPortal(
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
                  ورقة A4 — منطقة الصك {formatCmFromMm(178)} × {formatCmFromMm(82)} سم
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
                تفتح نافذة طباعة المتصفح على <strong>ورقة A4 عرضي (Landscape)</strong>. في نافذة
                الطباعة: <strong>Landscape</strong>، <strong>Scale Default (100%)</strong>، وألغِ{" "}
                <strong>Headers and footers</strong> و<strong>Two-sided</strong>.
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-semibold text-sky-900 leading-relaxed mb-4">
                إعدادات <strong>الخط واللون والموضع</strong> هنا مرتبطة مع{" "}
                <strong>طباعة على صك فارغ</strong> و<strong>طباعة الصك والبيانات</strong> — أي
                تعديل يُطبَّق على الاثنين معاً. زر <strong>طباعة الصك</strong> (صورة فقط) يبقى
                على إعدادات <strong>Wizard</strong> المنفصلة أدناه.
              </div>

              <button
                type="button"
                onClick={() => setPositionEditorOpen(true)}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-sm font-extrabold text-sky-950 hover:bg-sky-100"
              >
                <FiMove size={16} />
                تحكم بموضع البيانات على الورقة
              </button>
              <p className="-mt-2 mb-4 text-center text-[10px] font-semibold text-slate-500">
                افتح محرّراً مرئياً — اسحب الحقول أو منطقة الصك ثم احفظ
              </p>

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
                    amountWordsLayout={amountWordsLayout}
                    amountWordsLine2Layout={amountWordsLine2Layout}
                    layoutFontScale={layoutFontScale}
                    showChequeImage={mode === "withImage"}
                  />
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                    <p className="mb-2 text-xs font-extrabold text-violet-950">
                      معايرة الطابعة
                    </p>
                    <p className="mb-3 text-[10px] font-semibold text-violet-900/80">
                      كل طابعة لها إعداداتها — تُحفظ لحسابك وتُطبّق تلقائياً
                    </p>
                    <div className="space-y-2">
                      <label className="block rounded-xl border border-violet-200 bg-white px-3 py-2.5">
                        <span className="mb-1 block text-xs font-extrabold text-slate-700">
                          اسم الطابعة
                        </span>
                        <input
                          type="text"
                          value={printerName}
                          onChange={(e) => handlePrinterNameChange(e.target.value)}
                          placeholder="مثال: Canon MF633 — الدرج 1"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-bold text-slate-900"
                        />
                      </label>
                      {calibrationList.length > 0 ? (
                        <label className="block rounded-xl border border-violet-200 bg-white px-3 py-2.5">
                          <span className="mb-1 block text-xs font-extrabold text-slate-700">
                            معايرة محفوظة
                          </span>
                          <select
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-bold text-slate-900"
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              handlePrinterNameChange(v);
                              loadPrinterCalibration(v);
                            }}
                          >
                            <option value="">— اختر —</option>
                            {calibrationList.map((item) => (
                              <option key={item._id} value={item.printerName}>
                                {item.printerName}
                                {item.isDefault ? " (افتراضي)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => loadPrinterCalibration(printerName)}
                          disabled={!printerName.trim()}
                          className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-[11px] font-extrabold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                        >
                          تحميل معايرة
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePrinter}
                          disabled={savingPrinter || !printerName.trim()}
                          className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] font-extrabold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {savingPrinter ? "جاري الحفظ…" : "حفظ لهذه الطابعة"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardOpen(true)}
                          className="inline-flex items-center gap-1 rounded-xl border border-violet-400 bg-violet-600 px-3 py-2 text-[11px] font-extrabold text-white hover:bg-violet-700"
                        >
                          <FiTarget size={13} />
                          Wizard معايرة
                        </button>
                      </div>
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3">
                        <p className="mb-2 text-xs font-extrabold text-amber-950">
                          موضع ورقة المعايرة (Wizard)
                        </p>
                        <div className="space-y-2">
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-100 bg-white px-2.5 py-2">
                            <input
                              type="radio"
                              name="wizard-calib-source"
                              className="mt-0.5"
                              checked={wizardCalibSource === WIZARD_CALIB_SOURCE_SHARED}
                              onChange={() =>
                                setWizardCalibSource(WIZARD_CALIB_SOURCE_SHARED)
                              }
                            />
                            <span className="text-[11px] font-semibold leading-relaxed text-slate-800">
                              نفس إحداثيات «تحكم بموضع البيانات على الورقة»
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-100 bg-white px-2.5 py-2">
                            <input
                              type="radio"
                              name="wizard-calib-source"
                              className="mt-0.5"
                              checked={wizardCalibSource === WIZARD_CALIB_SOURCE_SEPARATE}
                              onChange={() => {
                                setWizardCalibSource(WIZARD_CALIB_SOURCE_SEPARATE);
                                setWizardCalib((prev) =>
                                  normalizeWizardPrintCalib(
                                    prev || calib,
                                    template,
                                    previewFields,
                                    wizardTestCopyCount
                                  )
                                );
                              }}
                            />
                            <span className="text-[11px] font-semibold leading-relaxed text-slate-800">
                              موضع خاص لورقة اختبار المعايرة (Wizard)
                            </span>
                          </label>
                        </div>
                        {wizardCalibSource === WIZARD_CALIB_SOURCE_SEPARATE ? (
                          <button
                            type="button"
                            onClick={() => setWizardPositionEditorOpen(true)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-100 px-3 py-2.5 text-[11px] font-extrabold text-amber-950 hover:bg-amber-200"
                          >
                            <FiTarget size={14} />
                            تحكم بموضع الورقة للمعايرة
                          </button>
                        ) : (
                          <p className="mt-2 text-[10px] font-semibold text-amber-900/80">
                            يستخدم نفس موضع منطقة الصك من زر «تحكم بموضع البيانات» أعلاه.
                          </p>
                        )}
                        <div className="mt-3 rounded-lg border border-amber-100 bg-white px-2.5 py-2.5">
                          <p className="mb-2 text-[11px] font-extrabold text-amber-950">
                            عدد النسخ على ورقة المعايرة
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(
                              { length: WIZARD_TEST_COPY_MAX - WIZARD_TEST_COPY_MIN + 1 },
                              (_, i) => WIZARD_TEST_COPY_MIN + i
                            ).map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  setWizardTestCopyCount(n);
                                  setWizardCalib((prev) =>
                                    normalizeWizardPrintCalib(
                                      prev,
                                      template,
                                      previewFields,
                                      n
                                    )
                                  );
                                }}
                                className={`rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                                  wizardTestCopyCount === n
                                    ? "bg-amber-500 text-white"
                                    : "border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
                                }`}
                              >
                                {n === 1 ? "صك واحد" : `${n} نسخ`}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-[10px] font-semibold text-slate-500 leading-relaxed">
                            {wizardTestCopyCount === 3
                              ? "3 نسخ — يمكن ضبط كل نسخة بحرية من «تحكم بموضع الورقة للمعايرة»."
                              : wizardTestCopyCount === 2
                              ? "نسختان — يمكن تحريك كل واحدة بشكل مستقل."
                              : "نسخة واحدة للمعايرة البسيطة."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                    <p className="mb-2 text-xs font-extrabold text-blue-950">
                      حجم ولون الخط العام عند الطباعة
                    </p>
                    <p className="mb-3 text-[10px] font-semibold text-blue-900/80">
                      يطبّق على كل البيانات معاً — يمكن تجاوزه لكل حقل على حدة أدناه
                    </p>
                    <div className="space-y-3">
                      <PercentInputRow
                        label="مقياس حجم الخط لكل الحقول"
                        value={calib.globalFontSizeScale}
                        min={GLOBAL_FONT_SIZE_SCALE_MIN}
                        max={GLOBAL_FONT_SIZE_SCALE_MAX}
                        showSlider
                        onChange={(v) => patch("globalFontSizeScale", v)}
                      />
                      <FieldColorRow
                        label="لون الخط لكل الحقول"
                        color={calib.globalTextColor}
                        onChangeColor={(c) => patch("globalTextColor", c)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-extrabold text-slate-800">
                      موضع وحجم الصك على الورقة
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <CmInputRow
                        label="من الأعلى"
                        hint="تحريك منطقة الصك على الورقة"
                        valueMm={calib.pageTopMm}
                        minCm={0}
                        maxCm={13}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("pageTopMm", v)}
                      />
                      <CmInputRow
                        label="من اليسار"
                        valueMm={calib.pageLeftMm}
                        minCm={0}
                        maxCm={12}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("pageLeftMm", v)}
                      />
                      <CmInputRow
                        label="عرض الصك"
                        valueMm={calib.widthMm}
                        minCm={16}
                        maxCm={17.8}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("widthMm", v)}
                      />
                      <CmInputRow
                        label="ارتفاع الصك"
                        valueMm={calib.heightMm}
                        minCm={7}
                        maxCm={8.2}
                        showSlider
                        sliderStep={0.01}
                        onChangeMm={(v) => patch("heightMm", v)}
                      />
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                      <SheetOrientationControls
                        rotationDeg={calib.sheetRotationDeg ?? 0}
                        flipHorizontal={Boolean(calib.flipHorizontal)}
                        flipVertical={Boolean(calib.flipVertical)}
                        onRotation={(deg) => patch("sheetRotationDeg", deg)}
                        onFlipHorizontal={(v) => patch("flipHorizontal", v)}
                        onFlipVertical={(v) => patch("flipVertical", v)}
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-extrabold text-slate-800">
                      ضبط كل حقل على حدة (طباعة فقط)
                    </p>
                    <p className="mb-3 text-[10px] font-semibold text-slate-500">
                      حجم الخط، السُمك، اللون، والإزاحة — التعديل يظهر مباشرة بالمعاينة
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
                            color={font.color}
                            globalTextColor={calib.globalTextColor}
                            onChangeX={(v) => patchField(key, { offsetXmm: v })}
                            onChangeY={(v) => patchField(key, { offsetYmm: v })}
                            onChangeFontScale={(v) =>
                              patchFieldFont(key, field, { fontSizeScale: v })
                            }
                            onChangeFontWeight={(w) =>
                              patchFieldFont(key, field, { fontWeight: w })
                            }
                            onChangeColor={(c) => patchFieldFont(key, field, { color: c })}
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
              {saveMessage ? (
                <p className="mt-4 text-sm font-bold text-emerald-700">{saveMessage}</p>
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
      )}
      <ChequeCalibWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        template={template}
        templateKey={templateKey}
        fields={previewFields}
        calib={resolvedWizardCalib}
        wizardCalibSource={wizardCalibSource}
        copyCount={wizardTestCopyCount}
        printerName={printerName}
        imageUrl={wizardImageUrl}
        onApplyCalib={(next) => {
          if (wizardCalibSource === WIZARD_CALIB_SOURCE_SEPARATE) {
            setWizardCalib(
              normalizeWizardPrintCalib(next, template, previewFields, wizardTestCopyCount)
            );
          } else {
            setCalib(normalizePrintCalib(next, template, previewFields));
          }
        }}
        onSaveWizardLayout={saveWizardLayout}
        onSavePrinterCalib={async (saved, name) => {
          setCalib(normalizePrintCalib(saved, template, previewFields));
          writeStoredPrinterName(templateKey, name);
          setCalibrationList(await fetchPrinterCalibrationList(templateKey));
          setSaveMessage(`تم حفظ معايرة الطابعة «${name}» من Wizard`);
        }}
      />
      <ChequePrintPositionEditor
        open={positionEditorOpen}
        onClose={() => setPositionEditorOpen(false)}
        calib={calib}
        onCalibChange={(next) => setCalib(next)}
        template={template}
        templateKey={templateKey}
        fields={previewFields}
        values={previewValues}
        dateShowSlashes={dateShowSlashes}
        textFieldLayout={textFieldLayout}
        canSave={canSave}
        purpose="data"
        onSaved={(saved) => {
          setCalib(saved);
          onSaved?.(saved);
          setSaveMessage("تم حفظ مواضع البيانات على الورقة");
        }}
      />
      <ChequePrintPositionEditor
        open={wizardPositionEditorOpen}
        onClose={() => setWizardPositionEditorOpen(false)}
        calib={wizardCalib}
        onCalibChange={(next) =>
          setWizardCalib(
            normalizeWizardPrintCalib(next, template, previewFields, wizardTestCopyCount)
          )
        }
        template={template}
        templateKey={templateKey}
        fields={previewFields}
        values={previewValues}
        dateShowSlashes={dateShowSlashes}
        textFieldLayout={textFieldLayout}
        canSave={canSave}
        purpose="wizard"
        wizardCalibSource={WIZARD_CALIB_SOURCE_SEPARATE}
        wizardCopyCount={wizardTestCopyCount}
        onSaved={(saved, json) => {
          setWizardCalib(saved);
          setWizardCalibSource(WIZARD_CALIB_SOURCE_SEPARATE);
          if (json?.wizardTestCopyCount != null) {
            setWizardTestCopyCount(normalizeWizardTestCopyCount(json.wizardTestCopyCount));
          }
          setSaveMessage("تم حفظ مواضع النسخ للمعايرة");
        }}
      />
    </>
  );
}
