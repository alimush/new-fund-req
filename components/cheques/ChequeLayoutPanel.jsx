"use client";

import { useMemo } from "react";
import {
  FiMove,
  FiCopy,
  FiSave,
  FiRotateCcw,
  FiType,
} from "react-icons/fi";
import { exportLayoutForTemplatesFile } from "@/lib/cheques/mergeFields";
import { isCanvasField } from "@/lib/cheques/templates";
import { fieldPositionMm, formatMm } from "@/lib/cheques/coordinates";
import {
  LAYOUT_FONT_SCALE_DEFAULT,
  LAYOUT_FONT_SCALE_MAX,
  LAYOUT_FONT_SCALE_MIN,
  clampLayoutFontScale,
} from "@/lib/cheques/chequeDesignMetrics";

function NumControl({ label, value, onChange, min = 0, max = 100, step = 0.5 }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold text-slate-800"
      />
    </div>
  );
}

export default function ChequeLayoutPanel({
  templateKey,
  templateName,
  template,
  fields,
  selectedKey,
  onSelectField,
  onUpdateField,
  onSaveLayout,
  onResetLayout,
  savingLayout = false,
  dateShowSlashes = true,
  onDateShowSlashesChange,
  onSaveDateStyle,
  savingDateStyle = false,
  globalFontScale = LAYOUT_FONT_SCALE_DEFAULT,
  onGlobalFontScaleChange,
}) {
  const selected = useMemo(
    () => fields.find((f) => f.key === selectedKey) || null,
    [fields, selectedKey]
  );

  const patch = (partial) => {
    if (!selectedKey) return;
    onUpdateField(selectedKey, partial);
  };

  const handleCopyJson = async () => {
    const text = exportLayoutForTemplatesFile(
      templateKey,
      fields,
      template,
      dateShowSlashes
    );
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("انسخ التخطيط:", text);
    }
  };

  return (
    <aside className="flex flex-col gap-4 w-full lg:w-[300px] xl:w-[340px] shrink-0">
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
          <FiMove />
          وضع ترتيب الحقول
        </p>
        <p className="text-xs font-extrabold text-amber-950 mt-2 rounded-lg bg-amber-100/80 px-2 py-1">
          {templateName || templateKey}
        </p>
        <p className="text-[10px] text-amber-800/80 font-mono mt-1">{templateKey}</p>
        <p className="text-[11px] text-amber-800/90 font-semibold mt-2 leading-relaxed">
          لتعديل <strong>افتراضي text</strong>: اختر «text» من القائمة أو اسحبه على الصورة ثم احفظ.
          موضع text في وضع الإدخال (الشريط الأزرق) يخص كل صك على حدة.
        </p>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
        <p className="text-xs font-extrabold text-violet-900 mb-2">
          شكل التاريخ — {templateKey}
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-violet-200 bg-white px-3 py-2 hover:bg-violet-50">
            <input
              type="radio"
              name={`dateSlash-${templateKey}`}
              checked={dateShowSlashes}
              onChange={() => onDateShowSlashesChange?.(true)}
              className="accent-violet-600"
            />
            <span className="text-sm font-bold text-slate-800">مع فواصل / / /</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-violet-200 bg-white px-3 py-2 hover:bg-violet-50">
            <input
              type="radio"
              name={`dateSlash-${templateKey}`}
              checked={!dateShowSlashes}
              onChange={() => onDateShowSlashesChange?.(false)}
              className="accent-violet-600"
            />
            <span className="text-sm font-bold text-slate-800">بدون فواصل</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onSaveDateStyle?.(dateShowSlashes)}
          disabled={savingDateStyle || savingLayout}
          className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {savingDateStyle ? "جاري الحفظ..." : "حفظ شكل التاريخ لهذا الصك"}
        </button>
        <p className="text-[10px] text-violet-800/80 font-semibold mt-2 text-center">
          يُحفظ لـ mustashar و real_estate كل واحد على حدة
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-emerald-950">
          <FiType size={14} />
          حجم الخط العام
        </p>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-emerald-900/80">كل الحقول على الصورة</span>
          <span className="text-sm font-black text-emerald-800 tabular-nums">
            {clampLayoutFontScale(globalFontScale)}%
          </span>
        </div>
        <input
          type="range"
          min={LAYOUT_FONT_SCALE_MIN}
          max={LAYOUT_FONT_SCALE_MAX}
          step={1}
          value={clampLayoutFontScale(globalFontScale)}
          onChange={(e) =>
            onGlobalFontScaleChange?.(parseInt(e.target.value, 10))
          }
          className="w-full accent-emerald-600"
        />
        <p className="mt-2 text-[10px] font-semibold text-emerald-900/75 leading-relaxed">
          يكبّر أو يصغّر كل البيانات معاً — اضغط «حفظ تخطيط هذا الصك» لتثبيته
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 max-h-[220px] overflow-y-auto">
        <p className="text-xs font-extrabold text-slate-700 mb-2">الحقول</p>
        <div className="flex flex-col gap-1">
          {fields.filter(isCanvasField).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelectField(f.key)}
              className={`text-right rounded-lg px-3 py-2 text-sm font-bold transition ${
                selectedKey === f.key
                  ? "bg-emerald-600 text-white"
                  : f.key === "text"
                  ? "bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {f.label}
              {f.key === "text" ? (
                <span className="block text-[10px] font-semibold opacity-80">
                  الافتراضي لهذا النوع من الصك
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 space-y-3">
          <p className="text-sm font-extrabold text-slate-800">{selected.label}</p>
          {template ? (
            <p className="rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-600 leading-relaxed">
              {(() => {
                const pos = fieldPositionMm(selected, template);
                return `mm: X ${formatMm(pos.xMm)} · Y ${formatMm(pos.yMm)} · ${formatMm(pos.widthMm)}×${formatMm(pos.heightMm)} (ورقة ${formatMm(pos.sheetWidthMm)}×${formatMm(pos.sheetHeightMm)})`;
              })()}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <NumControl
              label="X (يسار %)"
              value={selected.left}
              onChange={(v) => patch({ left: v })}
            />
            <NumControl
              label="Y (أعلى %)"
              value={selected.top}
              onChange={(v) => patch({ top: v })}
            />
            <NumControl
              label="العرض %"
              value={selected.width}
              onChange={(v) => patch({ width: v })}
            />
            <NumControl
              label="الارتفاع %"
              value={selected.height}
              onChange={(v) => patch({ height: v })}
            />
          </div>
          <div className="flex items-center gap-2 text-emerald-700">
            <FiType size={14} />
            <span className="text-xs font-extrabold">الخط</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumControl
              label="حجم الخط px"
              value={selected.fontSize}
              min={8}
              max={48}
              step={1}
              onChange={(v) => patch({ fontSize: v })}
            />
            <NumControl
              label="سماكة الخط"
              value={selected.fontWeight}
              min={400}
              max={900}
              step={100}
              onChange={(v) => patch({ fontWeight: v })}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 font-semibold text-center py-4">
          اختر حقلاً لتعديل موضعه
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSaveLayout}
          disabled={savingLayout}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <FiSave />
          {savingLayout ? "جاري الحفظ..." : "حفظ تخطيط هذا الصك"}
        </button>
        <button
          type="button"
          onClick={handleCopyJson}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
        >
          <FiCopy />
          نسخ JSON للقالب
        </button>
        <button
          type="button"
          onClick={onResetLayout}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-extrabold text-amber-900 hover:bg-amber-100"
        >
          <FiRotateCcw />
          إعادة الافتراضي
        </button>
      </div>
    </aside>
  );
}
