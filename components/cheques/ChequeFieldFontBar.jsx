"use client";

import { useEffect, useState } from "react";
import { FiMinus, FiPlus, FiType } from "react-icons/fi";
import { isCanvasField } from "@/lib/cheques/templates";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  clampTextLayout,
  getAmountWordsSharedFont,
  layoutFromField,
} from "@/lib/cheques/textFieldLayout";

const TEXT_KEY = "text";
const MIN_SIZE = 8;
const MAX_SIZE = 48;
const WEIGHT_MIN = 400;
const WEIGHT_MAX = 900;
const WEIGHT_STEP = 100;

const WEIGHT_LABELS = {
  400: "عادي",
  500: "متوسط",
  600: "شبه عريض",
  700: "عريض",
  800: "أثقل",
  900: "أسود",
};

function resolveLayout(fieldKey, field, layouts) {
  if (fieldKey === TEXT_KEY && layouts.textFieldLayout) {
    return layouts.textFieldLayout;
  }
  if (fieldKey === AMOUNT_WORDS_KEY || fieldKey === AMOUNT_WORDS_LINE2_KEY) {
    return (
      layouts.amountWordsLayout ||
      layouts.amountWordsLine2Layout ||
      null
    );
  }
  return null;
}

function resolveFontSize(fieldKey, field, layouts) {
  if (fieldKey === AMOUNT_WORDS_KEY || fieldKey === AMOUNT_WORDS_LINE2_KEY) {
    const shared = getAmountWordsSharedFont(
      layouts.amountWordsLayout,
      layouts.amountWordsLine2Layout
    );
    if (shared?.fontSize != null) return shared.fontSize;
  }
  const saved = resolveLayout(fieldKey, field, layouts);
  if (saved?.fontSize != null) return saved.fontSize;
  return field?.fontSize ?? 14;
}

function resolveFontWeight(fieldKey, field, layouts) {
  if (fieldKey === AMOUNT_WORDS_KEY || fieldKey === AMOUNT_WORDS_LINE2_KEY) {
    const shared = getAmountWordsSharedFont(
      layouts.amountWordsLayout,
      layouts.amountWordsLine2Layout
    );
    if (shared?.fontWeight != null) return shared.fontWeight;
  }
  const saved = resolveLayout(fieldKey, field, layouts);
  if (saved?.fontWeight != null) return saved.fontWeight;
  return field?.fontWeight ?? 700;
}

function clampSize(n) {
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(n) || 14));
}

function clampWeight(n) {
  const v = Math.round((Number(n) || 700) / WEIGHT_STEP) * WEIGHT_STEP;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v));
}

export default function ChequeFieldFontBar({
  activeField,
  fields = [],
  textFieldLayout = null,
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  onTextFieldLayoutChange,
  onAmountWordsLayoutChange,
  onAmountWordsLine2LayoutChange,
  onFieldLayoutChange,
}) {
  const field = fields.find((f) => f.key === activeField);
  const onCanvas = field && isCanvasField(field);
  const screenOnly = Boolean(field?.printExclude);

  const layouts = { textFieldLayout, amountWordsLayout, amountWordsLine2Layout };

  const fontSize = onCanvas ? resolveFontSize(activeField, field, layouts) : 14;
  const fontWeight = onCanvas ? resolveFontWeight(activeField, field, layouts) : 700;

  const [sizeDraft, setSizeDraft] = useState(String(fontSize));

  useEffect(() => {
    setSizeDraft(String(fontSize));
  }, [activeField, fontSize]);

  const commitFont = (partial) => {
    if (activeField === TEXT_KEY) {
      onTextFieldLayoutChange?.((prev) =>
        clampTextLayout(partial, prev || layoutFromField(field))
      );
      return;
    }
    if (activeField === AMOUNT_WORDS_KEY || activeField === AMOUNT_WORDS_LINE2_KEY) {
      onAmountWordsLayoutChange?.(partial);
      onAmountWordsLine2LayoutChange?.(partial);
      return;
    }
    onFieldLayoutChange?.(activeField, partial);
  };

  const commitSize = (nextSize) => {
    commitFont({ fontSize: clampSize(nextSize) });
  };

  const commitWeight = (nextWeight) => {
    commitFont({ fontWeight: clampWeight(nextWeight) });
  };

  const applySizeDelta = (delta) => {
    const next = clampSize(fontSize + delta);
    setSizeDraft(String(next));
    commitSize(next);
  };

  const applyWeightDelta = (delta) => {
    commitWeight(fontWeight + delta);
  };

  return (
    <section className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 mb-3">
        <FiType className="text-emerald-600 shrink-0" size={16} />
        الخط — الحجم والسماكة
      </h3>

      {!activeField ? (
        <p className="text-sm font-semibold text-slate-500 text-center py-2">
          انقر أي حقل على الصك أو من الشريط الجانبي لتعديل حجم خطه وسماكته من هنا
        </p>
      ) : !onCanvas ? (
        <p className="text-sm font-semibold text-slate-500 text-center py-2">
          «{field?.label}» للحفظ فقط — لا يظهر على صورة الصك
        </p>
      ) : (
        <div className="space-y-4">
          {screenOnly ? (
            <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
              «{field.label}» يظهر في المعاينة فقط — لا يُطبع
            </p>
          ) : null}
          <p className="text-[11px] font-bold text-slate-500">
            الحقل النشط:{" "}
            <span className="text-emerald-950 text-sm">{field.label}</span>
          </p>

          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-2">حجم الخط</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applySizeDelta(-1)}
                disabled={fontSize <= MIN_SIZE}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40"
                aria-label="تصغير الخط"
              >
                <FiMinus size={18} />
              </button>

              <input
                type="number"
                min={MIN_SIZE}
                max={MAX_SIZE}
                step={1}
                value={sizeDraft}
                onChange={(e) => setSizeDraft(e.target.value)}
                onBlur={() => {
                  commitSize(sizeDraft);
                  setSizeDraft(String(clampSize(sizeDraft)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-20 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-center text-lg font-extrabold text-slate-900"
              />

              <span className="text-xs font-bold text-slate-500">px</span>

              <button
                type="button"
                onClick={() => applySizeDelta(1)}
                disabled={fontSize >= MAX_SIZE}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40"
                aria-label="تكبير الخط"
              >
                <FiPlus size={18} />
              </button>
            </div>

            <input
              type="range"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step={1}
              value={fontSize}
              onChange={(e) => {
                const next = clampSize(e.target.value);
                setSizeDraft(String(next));
                commitSize(next);
              }}
              className="w-full h-2 mt-3 accent-emerald-600 cursor-pointer"
            />
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-500 mb-2">سماكة الخط</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyWeightDelta(-WEIGHT_STEP)}
                disabled={fontWeight <= WEIGHT_MIN}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40"
                aria-label="تخفيف السماكة"
              >
                <FiMinus size={18} />
              </button>

              <select
                value={fontWeight}
                onChange={(e) => commitWeight(Number(e.target.value))}
                className="min-w-[120px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-900"
              >
                {[400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>
                    {w} — {WEIGHT_LABELS[w]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => applyWeightDelta(WEIGHT_STEP)}
                disabled={fontWeight >= WEIGHT_MAX}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40"
                aria-label="زيادة السماكة"
              >
                <FiPlus size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
