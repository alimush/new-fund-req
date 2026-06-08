"use client";

import { useMemo } from "react";
import { FiMove, FiSave, FiRotateCcw } from "react-icons/fi";

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

export default function PaymentPlanLayoutPanel({
  fields,
  selectedKey,
  onSelectField,
  onUpdateField,
  tableRowHeight,
  onTableRowHeightChange,
  onSaveLayout,
  onResetLayout,
  savingLayout = false,
  canEdit = true,
}) {
  const selected = useMemo(
    () => fields.find((f) => f.key === selectedKey) || null,
    [fields, selectedKey]
  );

  const patch = (partial) => {
    if (!selectedKey) return;
    onUpdateField(selectedKey, partial);
  };

  return (
    <aside className="flex flex-col gap-4 w-full lg:w-[300px] xl:w-[340px] shrink-0">
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
          <FiMove />
          ترتيب حقول خطة الدفع
        </p>
        <p className="text-[11px] text-amber-800/90 font-semibold mt-2 leading-relaxed">
          اسحب الحقل على الصورة أو عدّل X/Y من هنا ثم احفظ.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <NumControl
          label="ارتفاع الصف في الجدول (%)"
          value={tableRowHeight}
          onChange={onTableRowHeightChange}
          min={1.5}
          max={6}
          step={0.1}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 max-h-[240px] overflow-y-auto">
        <p className="text-xs font-extrabold text-slate-700 mb-2">الحقول</p>
        <div className="flex flex-col gap-1">
          {fields.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onSelectField(f.key)}
              className={`text-right rounded-lg px-3 py-2 text-sm font-bold transition ${
                selectedKey === f.key
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm font-extrabold text-slate-800">{selected.label}</p>
          <div className="grid grid-cols-2 gap-2">
            <NumControl label="Top %" value={selected.top} onChange={(v) => patch({ top: v })} />
            <NumControl label="Left %" value={selected.left} onChange={(v) => patch({ left: v })} />
            <NumControl label="Width %" value={selected.width} onChange={(v) => patch({ width: v })} />
            <NumControl label="Height %" value={selected.height} onChange={(v) => patch({ height: v })} />
            <NumControl
              label="Font px"
              value={selected.fontSize}
              onChange={(v) => patch({ fontSize: v })}
              min={8}
              max={48}
              step={1}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500">محاذاة النص</label>
            <select
              value={selected.textAlign || "center"}
              onChange={(e) => patch({ textAlign: e.target.value })}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold"
            >
              <option value="right">يمين</option>
              <option value="center">وسط</option>
              <option value="left">يسار</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSaveLayout}
          disabled={savingLayout || !canEdit}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FiSave />
          {savingLayout ? "جاري الحفظ..." : "حفظ التخطيط"}
        </button>
        <button
          type="button"
          onClick={onResetLayout}
          disabled={savingLayout}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <FiRotateCcw />
          إعادة الافتراضي
        </button>
      </div>
    </aside>
  );
}
