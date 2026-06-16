"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Cairo } from "next/font/google";
import ChequeFieldInput from "@/components/cheques/ChequeFieldInput";
import { cleanAmount } from "@/lib/voucher/utils";
import { getTodayDateParts, slashPositionBetween } from "@/lib/cheques/dateUtils";
import { isCanvasField } from "@/lib/cheques/templates";
import {
  fieldDesignFontPx,
  fieldWithLayoutFontScale,
  getChequeAspectRatioCss,
  screenFontScaleFromWidth,
} from "@/lib/cheques/chequeDesignMetrics";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  clampTextLayout,
  fieldWithChequeLayout,
  fieldWithChequePosition,
  layoutFromField,
} from "@/lib/cheques/textFieldLayout";
import { mergeAmountWordsLines } from "@/lib/cheques/amountWords";
import { readAmountWordsBoxMetrics } from "@/lib/cheques/amountWordsBoxFit";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["700", "800"],
});

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";
const PER_CHEQUE_KEYS = new Set([TEXT_KEY]);

const fieldStyle = (f) => ({
  position: "absolute",
  top: `${f.top}%`,
  left: `${f.left}%`,
  width: `${f.width}%`,
  height: `${f.height}%`,
});

export default function ChequeCanvas({
  template,
  fields,
  values,
  onChange,
  activeField,
  onFieldFocus,
  onFieldBlur,
  layoutMode = false,
  layoutSelectedKey,
  onLayoutSelectField,
  onFieldLayoutChange,
  dateShowSlashes = true,
  textFieldLayout = null,
  onTextFieldLayoutChange,
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  textFieldAdjustable = false,
  viewMode = false,
  /** معاينة مواضع الطباعة على صك فارغ — بدون صورة القالب */
  printMode = false,
  /** مقياس خط عام من تخطيط القالب (%) */
  globalFontScale = 100,
}) {
  const containerRef = useRef(null);
  const amountWordsLine1BoxRef = useRef(null);
  const dragRef = useRef(null);
  const [fontScale, setFontScale] = useState(1);

  const list = fields || template?.fields || [];
  const fieldByKey = useMemo(
    () => Object.fromEntries(list.map((f) => [f.key, f])),
    [list]
  );

  const textBaseField = fieldByKey[TEXT_KEY];

  const resolveDisplayLayout = (baseField, savedLayout) =>
    layoutMode ? layoutFromField(baseField) : savedLayout || layoutFromField(baseField);

  const textDisplayLayout = resolveDisplayLayout(textBaseField, textFieldLayout);
  const textFieldForRender = fieldWithChequeLayout(textBaseField, textDisplayLayout);

  const staticFields = useMemo(
    () => list.filter((f) => isCanvasField(f) && !PER_CHEQUE_KEYS.has(f.key)),
    [list]
  );

  const dateSlashes = useMemo(() => {
    if (!dateShowSlashes) return [];
    const slashes = [];
    for (let i = 0; i < DATE_ORDER.length - 1; i++) {
      const a = fieldByKey[DATE_ORDER[i]];
      const b = fieldByKey[DATE_ORDER[i + 1]];
      const pos = slashPositionBetween(a, b);
      if (pos) slashes.push({ id: `slash-${i}`, ...pos });
    }
    return slashes;
  }, [dateShowSlashes, fieldByKey]);

  const set = (key, val) => {
    if (viewMode) return;
    onChange?.({ ...values, [key]: val });
  };

  const isReadOnly = layoutMode || viewMode;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !template) return;

    const update = () => {
      setFontScale(screenFontScaleFromWidth(el.offsetWidth, template));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [template]);

  const amountWordsField = useMemo(
    () => list.find((f) => f.key === AMOUNT_WORDS_KEY),
    [list]
  );

  const displayField = useCallback(
    (field) => fieldWithLayoutFontScale(field, globalFontScale),
    [globalFontScale]
  );

  const fieldForCanvasRender = useCallback(
    (f) => {
      const scaled = displayField(f);
      if (layoutMode) return scaled;

      const layout =
        f.key === AMOUNT_WORDS_KEY
          ? amountWordsLayout
          : f.key === AMOUNT_WORDS_LINE2_KEY
          ? amountWordsLine2Layout
          : null;
      if (!layout) return scaled;

      if (viewMode && (layout.fontSize != null || layout.fontWeight != null)) {
        const withSavedFont = displayField({
          ...f,
          fontSize: layout.fontSize ?? f.fontSize,
          fontWeight: layout.fontWeight ?? f.fontWeight,
        });
        return fieldWithChequePosition(withSavedFont, layout);
      }

      return fieldWithChequePosition(scaled, layout);
    },
    [displayField, layoutMode, viewMode, amountWordsLayout, amountWordsLine2Layout]
  );

  const amountWordsRenderField = useMemo(() => {
    if (!amountWordsField) return null;
    return fieldForCanvasRender(amountWordsField);
  }, [amountWordsField, fieldForCanvasRender]);

  const amountWordsBoxSig = useMemo(() => {
    const f = amountWordsRenderField;
    if (!f) return "";
    return `${f.left}|${f.top}|${f.width}|${f.height}|${f.fontSize}`;
  }, [amountWordsRenderField]);

  useLayoutEffect(() => {
    if (layoutMode || viewMode || printMode || !onChange || !template || !amountWordsRenderField) {
      return;
    }
    const boxEl = amountWordsLine1BoxRef.current;
    const boxMetrics = readAmountWordsBoxMetrics(boxEl, amountWordsRenderField, fontScale);
    if (!boxMetrics) return;

    onChange((prev) =>
      mergeAmountWordsLines(
        prev,
        amountWordsRenderField,
        template,
        globalFontScale,
        null,
        boxMetrics
      )
    );
  }, [
    fontScale,
    amountWordsBoxSig,
    values?.amountNumeric,
    layoutMode,
    viewMode,
    printMode,
    template,
    globalFontScale,
    onChange,
    amountWordsRenderField,
  ]);

  const slashFontPx =
    fieldDesignFontPx(
      fieldWithLayoutFontScale(fieldByKey.dateDay, globalFontScale),
      14
    ) * fontScale;

  const getRect = () => containerRef.current?.getBoundingClientRect();

  const startLayoutDrag = useCallback(
    (e, fieldKey) => {
      if (!layoutMode || !containerRef.current) return;
      e.preventDefault();
      onLayoutSelectField?.(fieldKey);

      const rect = getRect();
      const field = list.find((f) => f.key === fieldKey);
      if (!field || !rect) return;

      dragRef.current = {
        mode: "layout-move",
        key: fieldKey,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: field.left,
        startTop: field.top,
        rectW: rect.width,
        rectH: rect.height,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || d.mode !== "layout-move") return;
        const dx = ((ev.clientX - d.startX) / d.rectW) * 100;
        const dy = ((ev.clientY - d.startY) / d.rectH) * 100;
        onFieldLayoutChange?.(d.key, {
          left: Math.round((d.startLeft + dx) * 100) / 100,
          top: Math.round((d.startTop + dy) * 100) / 100,
        });
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [layoutMode, list, onFieldLayoutChange, onLayoutSelectField]
  );

  const startPerChequeMove = (e, currentLayout, onLayoutChange) => {
    const rect = getRect();
    if (!rect || !currentLayout) return;

    dragRef.current = {
      mode: "per-cheque-move",
      startX: e.clientX,
      startY: e.clientY,
      startLeft: currentLayout.left,
      startTop: currentLayout.top,
      rectW: rect.width,
      rectH: rect.height,
      layout: currentLayout,
      onLayoutChange,
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d || d.mode !== "per-cheque-move") return;
      const dx = ((ev.clientX - d.startX) / d.rectW) * 100;
      const dy = ((ev.clientY - d.startY) / d.rectH) * 100;
      d.onLayoutChange?.(
        clampTextLayout(
          { left: d.startLeft + dx, top: d.startTop + dy },
          d.layout
        )
      );
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startPerChequeResize = (e, currentLayout, onLayoutChange) => {
    const rect = getRect();
    if (!rect || !currentLayout) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      mode: "per-cheque-resize",
      startX: e.clientX,
      startY: e.clientY,
      startWidth: currentLayout.width,
      startHeight: currentLayout.height,
      rectW: rect.width,
      rectH: rect.height,
      layout: currentLayout,
      onLayoutChange,
    };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d || d.mode !== "per-cheque-resize") return;
      const dw = ((ev.clientX - d.startX) / d.rectW) * 100;
      const dh = ((ev.clientY - d.startY) / d.rectH) * 100;
      d.onLayoutChange?.(
        clampTextLayout(
          { width: d.startWidth + dw, height: d.startHeight + dh },
          d.layout
        )
      );
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const renderAdjustableField = ({
    fieldKey,
    fieldForRender,
    displayLayout,
    onLayoutChange,
    dragLabel,
    ringClass = "ring-sky-400/80",
    barClass = "bg-sky-500/25 border-sky-400/40",
    labelClass = "text-sky-800",
    resizeClass = "border-sky-600",
    zClass = "z-20",
  }) => {
    if (!fieldForRender) return null;
    const adjustable = textFieldAdjustable && !layoutMode && !viewMode;
    const isLayoutSelected = layoutMode && !viewMode && layoutSelectedKey === fieldKey;
    const isActive = activeField === fieldKey && !layoutMode && !viewMode;

    return (
      <div
        key={fieldKey}
        style={fieldStyle(fieldForRender)}
        className={`${zClass} flex flex-col items-stretch justify-start ${
          adjustable ? `ring-2 ${ringClass} ring-offset-1 rounded-sm` : ""
        } ${
          isLayoutSelected
            ? "ring-2 ring-amber-500 rounded-sm bg-amber-100/25 cursor-move"
            : ""
        } ${isActive ? "ring-2 ring-emerald-500/60" : ""}`}
        onMouseDown={(e) => {
          if (layoutMode && !viewMode) startLayoutDrag(e, fieldKey);
        }}
        onClick={(e) => {
          if (layoutMode && !viewMode) {
            e.stopPropagation();
            onLayoutSelectField?.(fieldKey);
          }
        }}
      >
        {adjustable ? (
          <div
            role="button"
            tabIndex={-1}
            title="اسحب لتحريك الحقل"
            onMouseDown={(e) => startPerChequeMove(e, displayLayout, onLayoutChange)}
            className={`shrink-0 h-5 flex items-center justify-center gap-1 cursor-move border-b rounded-t-sm ${barClass}`}
          >
            <span className={`text-[9px] font-extrabold px-1 ${labelClass}`}>
              ⋮⋮ {dragLabel}
            </span>
          </div>
        ) : null}

        <div className="relative flex-1 min-h-0 flex flex-col">
          <ChequeFieldInput
            field={displayField(fieldForRender)}
            value={values?.[fieldKey]}
            onChange={(val) => set(fieldKey, val)}
            variant="canvas"
            designScale={fontScale}
            isActive={layoutMode ? isLayoutSelected : isActive}
            readOnly={isReadOnly}
            onFocus={() => {
              if (viewMode) return;
              if (layoutMode) onLayoutSelectField?.(fieldKey);
              else onFieldFocus?.(fieldKey);
            }}
            onBlur={onFieldBlur}
          />

          {adjustable ? (
            <div
              role="button"
              tabIndex={-1}
              title="اسحب لتكبير/تصغير"
              onMouseDown={(e) => startPerChequeResize(e, displayLayout, onLayoutChange)}
              className={`absolute bottom-0 left-0 w-5 h-5 cursor-se-resize flex items-end justify-start z-30`}
            >
              <span
                className={`block w-3.5 h-3.5 border-r-2 border-b-2 rounded-br-sm bg-white/80 ${resizeClass}`}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderFieldBox = (f, opts = {}) => {
    const { isLayoutSelected = false, extraClass = "" } = opts;
    const fieldForRender = fieldForCanvasRender(f);
    return (
      <div
        key={f.key}
        ref={f.key === AMOUNT_WORDS_KEY ? amountWordsLine1BoxRef : undefined}
        style={fieldStyle(fieldForRender)}
        className={`z-10 transition-opacity ${extraClass} ${
          viewMode
            ? "pointer-events-none"
            : layoutMode
            ? "cursor-move"
            : activeField && activeField !== f.key
            ? "opacity-70"
            : "opacity-100"
        } ${isLayoutSelected ? "ring-2 ring-amber-500 rounded-sm bg-amber-100/25" : ""}`}
        onMouseDown={(e) => {
          if (layoutMode && !viewMode) startLayoutDrag(e, f.key);
        }}
        onClick={(e) => {
          if (layoutMode && !viewMode) {
            e.stopPropagation();
            onLayoutSelectField?.(f.key);
          }
        }}
      >
        <ChequeFieldInput
          field={fieldForRender}
          value={values?.[f.key]}
          onChange={(val) => set(f.key, val)}
          variant="canvas"
          designScale={fontScale}
          isActive={!viewMode && (layoutMode ? isLayoutSelected : activeField === f.key)}
          readOnly={isReadOnly}
          onFocus={() => {
            if (layoutMode) onLayoutSelectField?.(f.key);
            else onFieldFocus?.(f.key);
          }}
          onBlur={onFieldBlur}
        />
      </div>
    );
  };

  const showTemplateImage = !printMode;

  return (
    <div
      ref={containerRef}
      className={`relative w-full mx-auto ${
        printMode
          ? "ring-2 ring-dashed ring-slate-400/80 rounded-lg bg-transparent"
          : layoutMode
          ? "ring-2 ring-amber-400 ring-offset-2 rounded-lg"
          : ""
      }`}
      style={{ aspectRatio: getChequeAspectRatioCss(template) }}
    >
      {showTemplateImage ? (
        <Image
          src={template.image}
          alt={template.name}
          fill
          priority
          className="object-contain pointer-events-none"
          sizes="(max-width: 1200px) 100vw, 900px"
        />
      ) : (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg border border-dashed border-slate-300/90 bg-transparent"
          aria-hidden
        />
      )}

      <div className="absolute inset-0">
        {dateSlashes.map((s) => (
          <div
            key={s.id}
            className="pointer-events-none flex items-center justify-center z-[5]"
            style={{
              position: "absolute",
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.width}%`,
              height: `${s.height}%`,
              transform: "translate(-50%, 0)",
            }}
          >
            <span
              className="text-[#0f172a] font-extrabold leading-none"
              style={{
                fontFamily: cairo.style.fontFamily,
                fontSize: `${slashFontPx}px`,
              }}
            >
              /
            </span>
          </div>
        ))}

        {staticFields.map((f) =>
          renderFieldBox(f, {
            isLayoutSelected: layoutMode && layoutSelectedKey === f.key,
          })
        )}

        {renderAdjustableField({
          fieldKey: TEXT_KEY,
          fieldForRender: textFieldForRender,
          displayLayout: textDisplayLayout,
          onLayoutChange: onTextFieldLayoutChange,
          dragLabel: "text — اسحب للتحريك",
        })}
      </div>
    </div>
  );
}

export function buildEmptyChequeValues(template, fields) {
  const list = fields || template?.fields || [];
  const values = { ...getTodayDateParts() };
  for (const f of list) {
    if (DATE_ORDER.includes(f.key)) continue;
    values[f.key] = "";
  }
  return values;
}

export function getDefaultTextFieldLayout(fields) {
  return layoutFromField((fields || []).find((x) => x.key === TEXT_KEY));
}

export function getDefaultAmountWordsLayouts(fields) {
  return {
    amountWordsLayout: layoutFromField(
      (fields || []).find((x) => x.key === AMOUNT_WORDS_KEY)
    ),
    amountWordsLine2Layout: layoutFromField(
      (fields || []).find((x) => x.key === AMOUNT_WORDS_LINE2_KEY)
    ),
  };
}

export function chequeValuesToPayload(
  templateKey,
  values,
  template,
  textFieldLayout = null,
  amountWordsLayout = null,
  amountWordsLine2Layout = null
) {
  const amountRaw = cleanAmount(values?.amountNumeric);
  return {
    templateKey,
    chequeNumber: values?.chequeNumber || "",
    accountNumber: values?.accountNumber || "",
    branch: template?.branch || "",
    dateParts: {
      dd: values?.dateDay || "",
      mm: values?.dateMonth || "",
      yy: values?.dateYear || "",
    },
    payee: values?.payee || "",
    governorate: values?.governorate || "",
    amountNumeric: amountRaw ? Number(amountRaw) : 0,
    amountWords: values?.amountWords || "",
    amountWordsLine2: values?.amountWordsLine2 || "",
    text: values?.text || "",
    textFieldLayout: textFieldLayout || undefined,
    amountWordsLayout: amountWordsLayout || undefined,
    amountWordsLine2Layout: amountWordsLine2Layout || undefined,
    currency: template?.currency || "IQD",
    status: "draft",
  };
}
