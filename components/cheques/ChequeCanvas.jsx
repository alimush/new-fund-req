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
  fieldDisplayHeightPercent,
  fieldWithLayoutFontScale,
  getChequeAspectRatioCss,
  getChequePhysicalSizeStyle,
  screenFontScaleFromWidth,
} from "@/lib/cheques/chequeDesignMetrics";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  clampTextLayout,
  fieldWithChequeLayout,
  fieldWithChequePosition,
  getAmountWordsSharedFont,
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

function fieldBoxStyle(f, template, globalFontScale) {
  const height = fieldDisplayHeightPercent(f, template, globalFontScale);
  return {
    position: "absolute",
    top: `${f.top}%`,
    left: `${f.left}%`,
    width: `${f.width}%`,
    height: `${height}%`,
  };
}

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
  /** عرض الصك بالحجم الفعلي (مم) — مطابق للطباعة */
  physicalSize = false,
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

  const canvasFields = useMemo(
    () => list.filter((f) => isCanvasField(f) && f.key !== TEXT_KEY),
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
      if (layoutMode) return displayField(f);

      if (f.key === TEXT_KEY) {
        return displayField(fieldWithChequeLayout(textBaseField, textDisplayLayout));
      }

      const layout =
        f.key === AMOUNT_WORDS_KEY
          ? amountWordsLayout
          : f.key === AMOUNT_WORDS_LINE2_KEY
          ? amountWordsLine2Layout
          : null;
      if (!layout) return displayField(f);

      const shared = getAmountWordsSharedFont(amountWordsLayout, amountWordsLine2Layout);
      let scaled = displayField(f);
      if (shared?.fontSize != null || shared?.fontWeight != null) {
        scaled = displayField({
          ...f,
          fontSize: shared.fontSize ?? f.fontSize,
          fontWeight: shared.fontWeight ?? f.fontWeight,
        });
      } else if (layout.fontSize != null || layout.fontWeight != null) {
        scaled = displayField({
          ...f,
          fontSize: layout.fontSize ?? f.fontSize,
          fontWeight: layout.fontWeight ?? f.fontWeight,
        });
      }

      return fieldWithChequePosition(scaled, layout);
    },
    [
      displayField,
      layoutMode,
      amountWordsLayout,
      amountWordsLine2Layout,
      textBaseField,
      textDisplayLayout,
    ]
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
    e.preventDefault();
    e.stopPropagation();
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
    e.preventDefault();
    e.stopPropagation();
    const rect = getRect();
    if (!rect || !currentLayout) return;

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

  const renderTextField = () => {
    if (!textBaseField) return null;
    if (viewMode && !String(values?.[TEXT_KEY] || "").trim()) return null;

    const fieldForRender = fieldForCanvasRender(textBaseField);
    const adjustable = textFieldAdjustable && !layoutMode && !viewMode;
    const isLayoutSelected = layoutMode && !viewMode && layoutSelectedKey === TEXT_KEY;
    const isActive = activeField === TEXT_KEY && !layoutMode && !viewMode;

    return (
      <div
        key={TEXT_KEY}
        style={fieldBoxStyle(fieldForRender, template, globalFontScale)}
        className={`z-20 flex flex-col items-stretch justify-start ${
          adjustable ? "ring-2 ring-sky-400/80 ring-offset-1 rounded-sm" : ""
        } ${
          isLayoutSelected
            ? "ring-2 ring-amber-500 rounded-sm bg-amber-100/25 cursor-move"
            : isActive
            ? "ring-2 ring-emerald-500/70 ring-offset-1 rounded-sm"
            : ""
        }`}
        onMouseDown={(e) => {
          if (layoutMode && !viewMode) startLayoutDrag(e, TEXT_KEY);
        }}
        onClick={(e) => {
          if (layoutMode && !viewMode) {
            e.stopPropagation();
            onLayoutSelectField?.(TEXT_KEY);
          }
        }}
      >
        {adjustable ? (
          <div
            role="button"
            tabIndex={-1}
            title="اسحب لتحريك الحقل"
            onMouseDown={(e) =>
              startPerChequeMove(e, textDisplayLayout, onTextFieldLayoutChange)
            }
            className="shrink-0 h-5 flex items-center justify-center gap-1 cursor-move border-b rounded-t-sm bg-sky-500/25 border-sky-400/40"
          >
            <span className="text-[9px] font-extrabold px-1 text-sky-800">
              ⋮⋮ text — اسحب للتحريك
            </span>
          </div>
        ) : null}

        <div className="relative flex-1 min-h-0 flex flex-col">
          <ChequeFieldInput
            field={fieldForRender}
            value={values?.[TEXT_KEY]}
            onChange={(val) => set(TEXT_KEY, val)}
            variant="canvas"
            designScale={fontScale}
            isActive={layoutMode ? isLayoutSelected : isActive}
            readOnly={isReadOnly}
            onFocus={() => {
              if (viewMode) return;
              if (layoutMode) onLayoutSelectField?.(TEXT_KEY);
              else onFieldFocus?.(TEXT_KEY);
            }}
            onBlur={onFieldBlur}
          />

          {adjustable ? (
            <div
              role="button"
              tabIndex={-1}
              title="اسحب لتكبير/تصغير"
              onMouseDown={(e) =>
                startPerChequeResize(e, textDisplayLayout, onTextFieldLayoutChange)
              }
              className="absolute bottom-0 left-0 w-5 h-5 cursor-se-resize flex items-end justify-start z-30"
            >
              <span className="block w-3.5 h-3.5 border-r-2 border-b-2 rounded-br-sm bg-white/80 border-sky-600" />
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderFieldBox = (f, opts = {}) => {
    const { isLayoutSelected = false, extraClass = "" } = opts;
    const fieldForRender = fieldForCanvasRender(f);
    const isActive = !viewMode && !layoutMode && activeField === f.key;
    const isSingleLineText = f.type === "text";

    return (
      <div
        key={f.key}
        ref={f.key === AMOUNT_WORDS_KEY ? amountWordsLine1BoxRef : undefined}
        style={fieldBoxStyle(fieldForRender, template, globalFontScale)}
        className={`transition-opacity overflow-visible ${
          isSingleLineText
            ? "flex items-center"
            : "flex flex-col items-stretch justify-start"
        } ${
          isActive ? "z-30" : "z-10"
        } ${extraClass} ${
          viewMode
            ? "pointer-events-none"
            : layoutMode
            ? "cursor-move"
            : activeField && activeField !== f.key
            ? "opacity-75"
            : "opacity-100"
        } ${
          isLayoutSelected
            ? "ring-2 ring-amber-500 rounded-sm bg-amber-100/25"
            : isActive
            ? "ring-2 ring-emerald-500/70 ring-offset-1 rounded-sm"
            : ""
        }`}
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
        {isSingleLineText ? (
          <ChequeFieldInput
            field={fieldForRender}
            value={values?.[f.key]}
            onChange={(val) => set(f.key, val)}
            variant="canvas"
            designScale={fontScale}
            isActive={!viewMode && (layoutMode ? isLayoutSelected : isActive)}
            readOnly={isReadOnly}
            onFocus={() => {
              if (viewMode) return;
              if (layoutMode) onLayoutSelectField?.(f.key);
              else onFieldFocus?.(f.key);
            }}
            onBlur={onFieldBlur}
          />
        ) : (
          <div className="relative flex-1 min-h-0 flex flex-col w-full">
            <ChequeFieldInput
              field={fieldForRender}
              value={values?.[f.key]}
              onChange={(val) => set(f.key, val)}
              variant="canvas"
              designScale={fontScale}
              isActive={!viewMode && (layoutMode ? isLayoutSelected : isActive)}
              readOnly={isReadOnly}
              onFocus={() => {
                if (viewMode) return;
                if (layoutMode) onLayoutSelectField?.(f.key);
                else onFieldFocus?.(f.key);
              }}
              onBlur={onFieldBlur}
            />
          </div>
        )}
      </div>
    );
  };

  const showTemplateImage = !printMode;
  const physicalStyle = physicalSize && template ? getChequePhysicalSizeStyle(template) : null;

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto ${
        physicalSize ? "shrink-0 shadow-lg ring-1 ring-slate-300/80" : "w-full"
      } ${
        printMode
          ? "ring-2 ring-dashed ring-slate-400/80 rounded-lg bg-transparent"
          : layoutMode
          ? "ring-2 ring-amber-400 ring-offset-2 rounded-lg"
          : physicalSize
          ? "rounded-sm bg-white"
          : ""
      }`}
      style={
        physicalStyle
          ? physicalStyle
          : { aspectRatio: getChequeAspectRatioCss(template) }
      }
    >
      {showTemplateImage ? (
        <Image
          src={template.image}
          alt={template.name}
          fill
          priority
          className={`pointer-events-none ${
            physicalSize ? "object-fill" : "object-contain"
          }`}
          sizes={physicalSize ? "178mm" : "(max-width: 1200px) 100vw, 900px"}
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

        {canvasFields.map((f) => {
          if (viewMode) {
            const val = values?.[f.key];
            if (val == null || String(val).trim() === "") return null;
          }
          return renderFieldBox(f, {
            isLayoutSelected: layoutMode && layoutSelectedKey === f.key,
          });
        })}

        {renderTextField()}
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
