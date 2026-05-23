"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Cairo } from "next/font/google";
import ChequeFieldInput from "@/components/cheques/ChequeFieldInput";
import { cleanAmount } from "@/lib/voucher/utils";
import { getTodayDateParts, slashPositionBetween } from "@/lib/cheques/dateUtils";
import { isCanvasField } from "@/lib/cheques/templates";
import {
  fieldDesignFontPx,
  screenScaleFromWidth,
} from "@/lib/cheques/chequeDesignMetrics";
import {
  clampTextLayout,
  fieldWithTextLayout,
  layoutFromField,
} from "@/lib/cheques/textFieldLayout";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["700", "800"],
});

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";

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
  textFieldAdjustable = false,
  viewMode = false,
  /** معاينة مواضع الطباعة على صك فارغ — بدون صورة القالب */
  printMode = false,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [designScale, setDesignScale] = useState(1);

  const list = fields || template?.fields || [];
  const fieldByKey = useMemo(
    () => Object.fromEntries(list.map((f) => [f.key, f])),
    [list]
  );

  const textBaseField = fieldByKey[TEXT_KEY];
  /** وضع الترتيب = الافتراضي المحفوظ فقط؛ وضع الإدخال = موضع هذا الصك إن وُجد */
  const textDisplayLayout = layoutMode
    ? layoutFromField(textBaseField)
    : textFieldLayout || layoutFromField(textBaseField);
  const textFieldForRender = fieldWithTextLayout(textBaseField, textDisplayLayout);

  const staticFields = useMemo(
    () => list.filter((f) => f.key !== TEXT_KEY && isCanvasField(f)),
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
      setDesignScale(screenScaleFromWidth(el.offsetWidth, template));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [template]);

  const slashFontPx =
    fieldDesignFontPx(fieldByKey.dateDay, 14) * designScale;

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

  const startTextMove = useCallback(
    (e) => {
      if (layoutMode || !textFieldAdjustable || !textDisplayLayout) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = getRect();
      if (!rect) return;

      dragRef.current = {
        mode: "text-move",
        startX: e.clientX,
        startY: e.clientY,
        startLeft: textDisplayLayout.left,
        startTop: textDisplayLayout.top,
        startWidth: textDisplayLayout.width,
        startHeight: textDisplayLayout.height,
        rectW: rect.width,
        rectH: rect.height,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || d.mode !== "text-move") return;
        const dx = ((ev.clientX - d.startX) / d.rectW) * 100;
        const dy = ((ev.clientY - d.startY) / d.rectH) * 100;
        onTextFieldLayoutChange?.(
          clampTextLayout(
            {
              left: d.startLeft + dx,
              top: d.startTop + dy,
            },
            textDisplayLayout
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
    },
    [layoutMode, textFieldAdjustable, textDisplayLayout, onTextFieldLayoutChange]
  );

  const startTextResize = useCallback(
    (e) => {
      if (layoutMode || !textFieldAdjustable || !textDisplayLayout) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = getRect();
      if (!rect) return;

      dragRef.current = {
        mode: "text-resize",
        startX: e.clientX,
        startY: e.clientY,
        startLeft: textDisplayLayout.left,
        startTop: textDisplayLayout.top,
        startWidth: textDisplayLayout.width,
        startHeight: textDisplayLayout.height,
        rectW: rect.width,
        rectH: rect.height,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || d.mode !== "text-resize") return;
        const dw = ((ev.clientX - d.startX) / d.rectW) * 100;
        const dh = ((ev.clientY - d.startY) / d.rectH) * 100;
        onTextFieldLayoutChange?.(
          clampTextLayout(
            {
              width: d.startWidth + dw,
              height: d.startHeight + dh,
            },
            textDisplayLayout
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
    },
    [layoutMode, textFieldAdjustable, textDisplayLayout, onTextFieldLayoutChange]
  );

  const renderFieldBox = (f, opts = {}) => {
    const { isLayoutSelected = false, extraClass = "" } = opts;
    return (
      <div
        key={f.key}
        style={fieldStyle(f)}
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
          field={f}
          value={values?.[f.key]}
          onChange={(val) => set(f.key, val)}
          variant="canvas"
          designScale={designScale}
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
      style={{ aspectRatio: template?.aspectRatio || "1024 / 470" }}
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

        {textFieldForRender ? (
          <div
            style={fieldStyle(textFieldForRender)}
            className={`z-20 flex flex-col items-stretch justify-start ${
              textFieldAdjustable && !layoutMode && !viewMode
                ? "ring-2 ring-sky-400/80 ring-offset-1 rounded-sm"
                : ""
            } ${
              layoutMode && !viewMode && layoutSelectedKey === TEXT_KEY
                ? "ring-2 ring-amber-500 rounded-sm bg-amber-100/25 cursor-move"
                : ""
            } ${activeField === TEXT_KEY && !layoutMode && !viewMode ? "ring-2 ring-emerald-500/60" : ""}`}
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
            {textFieldAdjustable && !layoutMode && !viewMode ? (
              <div
                role="button"
                tabIndex={-1}
                title="اسحب لتحريك مربع النص"
                onMouseDown={startTextMove}
                className="shrink-0 h-5 flex items-center justify-center gap-1 cursor-move bg-sky-500/25 border-b border-sky-400/40 rounded-t-sm"
              >
                <span className="text-[9px] font-extrabold text-sky-800 px-1">
                  ⋮⋮ text — اسحب للتحريك
                </span>
              </div>
            ) : null}

            <div className="relative flex-1 min-h-0 flex flex-col">
              <ChequeFieldInput
                field={textFieldForRender}
                value={values?.[TEXT_KEY]}
                onChange={(val) => set(TEXT_KEY, val)}
                variant="canvas"
                designScale={designScale}
                isActive={
                  layoutMode
                    ? layoutSelectedKey === TEXT_KEY
                    : activeField === TEXT_KEY
                }
                readOnly={isReadOnly}
                onFocus={() => {
                  if (viewMode) return;
                  if (layoutMode) onLayoutSelectField?.(TEXT_KEY);
                  else onFieldFocus?.(TEXT_KEY);
                }}
                onBlur={onFieldBlur}
              />

              {textFieldAdjustable && !layoutMode && !viewMode ? (
                <div
                  role="button"
                  tabIndex={-1}
                  title="اسحب لتكبير/تصغير"
                  onMouseDown={startTextResize}
                  className="absolute bottom-0 left-0 w-5 h-5 cursor-se-resize flex items-end justify-start z-30"
                >
                  <span className="block w-3.5 h-3.5 border-r-2 border-b-2 border-sky-600 rounded-br-sm bg-white/80" />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
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
  const f = (fields || []).find((x) => x.key === TEXT_KEY);
  return layoutFromField(f);
}

export function chequeValuesToPayload(
  templateKey,
  values,
  template,
  textFieldLayout = null
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
    amountNumeric: amountRaw ? Number(amountRaw) : 0,
    amountWords: values?.amountWords || "",
    text: values?.text || "",
    textFieldLayout: textFieldLayout || undefined,
    currency: template?.currency || "IQD",
    status: "draft",
  };
}
