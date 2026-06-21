"use client";

import { useLayoutEffect, useRef } from "react";
import { Cairo } from "next/font/google";
import { only2Digits, formatAmount } from "@/lib/voucher/utils";
import { onlyDatePart, datePartTextAlign } from "@/lib/cheques/dateUtils";
import { singleLineText } from "@/lib/cheques/singleLineText";
import { fieldDesignFontPx } from "@/lib/cheques/chequeDesignMetrics";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

const fontFamily = cairo.style.fontFamily;
const CANVAS_TEXT_COLOR = "#0f172a";
const CANVAS_TEXT_LINE_HEIGHT = 1.5;

function canvasTextMinHeightPx(fontPx) {
  return Math.ceil(fontPx * CANVAS_TEXT_LINE_HEIGHT + 8);
}

function fieldTextStyle(field, isCanvas, designScale = 1) {
  const weight = field?.fontWeight ?? 700;
  if (!isCanvas) {
    return { fontFamily, fontWeight: weight };
  }
  const px = fieldDesignFontPx(field, 14) * designScale;
  return {
    fontFamily,
    fontSize: `${px}px`,
    fontWeight: weight,
    color: CANVAS_TEXT_COLOR,
    WebkitTextFillColor: CANVAS_TEXT_COLOR,
  };
}

export default function ChequeFieldInput({
  field,
  value,
  onChange,
  onFocus,
  onBlur,
  variant = "canvas",
  isActive = false,
  readOnly = false,
  designScale = 1,
}) {
  const v = value ?? "";
  const isCanvas = variant === "canvas";
  const scale = isCanvas ? designScale : 1;
  const isAmountWordsLine =
    field?.key === "amountWords" || field?.key === "amountWordsLine2";
  const textStyle = fieldTextStyle(field, isCanvas, scale);

  const isSingleLineCanvasText = isCanvas && field?.type === "text";
  const canvasFontPx = isCanvas ? fieldDesignFontPx(field, 14) * scale : 0;
  const canvasTextRef = useRef(null);

  useLayoutEffect(() => {
    if (!isSingleLineCanvasText) return;
    const el = canvasTextRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(canvasTextMinHeightPx(canvasFontPx), el.scrollHeight + 4)}px`;
  }, [isSingleLineCanvasText, v, canvasFontPx, field?.fontWeight, field?.fontSize]);

  const canvasClass = `
    w-full ${isSingleLineCanvasText ? "h-auto" : "h-full leading-tight"} bg-transparent border-0 outline-none resize-none
    text-[#0f172a]
    placeholder:text-slate-400/80 placeholder:font-semibold
    rounded-sm transition-shadow
    ${!field?.fontSize && isCanvas ? "font-extrabold" : ""}
    ${isActive ? "ring-2 ring-emerald-500 ring-inset bg-emerald-50/30" : "focus:ring-2 focus:ring-emerald-500/50"}
  `;

  const sidebarClass = `
    w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5
    text-slate-900 font-bold outline-none transition
    placeholder:text-slate-400
    ${isActive ? "border-emerald-500 ring-2 ring-emerald-500/30" : "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25"}
  `;

  const className = isCanvas ? canvasClass : sidebarClass;
  const canvasPlaceholder = readOnly ? "" : undefined;

  const common = {
    onFocus,
    onBlur,
    readOnly,
    "aria-label": field.label,
  };

  if (field.type === "datePart") {
    const maxLen = field.maxLength || 2;
    const align = datePartTextAlign(field.key);
    const alignClass =
      align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center";
    return (
      <input
        type="text"
        inputMode="numeric"
        maxLength={maxLen}
        dir="ltr"
        value={v}
        onChange={(e) => onChange(onlyDatePart(e.target.value, maxLen))}
        placeholder={canvasPlaceholder ?? field.label}
        className={`${className} ${alignClass}`}
        style={textStyle}
        {...common}
      />
    );
  }

  if (field.type === "amount") {
    return (
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={v}
        onChange={(e) => onChange(formatAmount(e.target.value))}
        placeholder="0"
        className={`${className} text-left tracking-wide`}
        style={textStyle}
        {...common}
      />
    );
  }

  if (field.type === "textarea" && isAmountWordsLine) {
    return (
      <input
        type="text"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        value={v}
        onChange={(e) => onChange(singleLineText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = singleLineText(e.clipboardData.getData("text"));
          const el = e.target;
          const start = el.selectionStart ?? v.length;
          const end = el.selectionEnd ?? v.length;
          onChange(singleLineText(`${v.slice(0, start)}${pasted}${v.slice(end)}`));
        }}
        placeholder={canvasPlaceholder ?? field.label}
        dir="rtl"
        className={[
          className,
          "text-right leading-snug whitespace-nowrap",
          isCanvas
            ? "h-full min-h-full overflow-hidden"
            : "truncate",
        ].join(" ")}
        style={{
          ...textStyle,
          lineHeight: 1.2,
        }}
        {...common}
      />
    );
  }

  if (field.type === "textarea") {
    const isTextBlock = field.key === "text" || field.multiline;
    const canvasRows = isTextBlock ? 4 : 1;
    const sidebarRows = isTextBlock ? 5 : 2;

    return (
      <textarea
        value={v}
        onChange={(e) => onChange(e.target.value)}
        placeholder={canvasPlaceholder ?? field.label}
        rows={isCanvas ? canvasRows : sidebarRows}
        dir="rtl"
        wrap="soft"
        className={[
          className,
          "text-right leading-snug",
          isCanvas
            ? isTextBlock
              ? "h-full min-h-full block align-top overflow-y-auto overflow-x-hidden pt-0"
              : ""
            : isTextBlock
            ? "min-h-[100px] resize-y align-top"
            : "min-h-[72px] resize-y",
        ].join(" ")}
        style={{
          ...textStyle,
          verticalAlign: "top",
        }}
        {...common}
      />
    );
  }

  if (field.type === "text" && isSingleLineCanvasText) {
    const minH = canvasTextMinHeightPx(canvasFontPx);
    return (
      <textarea
        ref={canvasTextRef}
        rows={1}
        value={v}
        readOnly={readOnly || Boolean(field.readOnly)}
        onChange={(e) => !readOnly && !field.readOnly && onChange(e.target.value)}
        placeholder={(isCanvas ? canvasPlaceholder : undefined) ?? field.placeholder ?? field.label}
        dir="rtl"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className={`${className} text-right block whitespace-nowrap overflow-x-auto overflow-y-visible`}
        style={{
          ...textStyle,
          lineHeight: CANVAS_TEXT_LINE_HEIGHT,
          minHeight: `${minH}px`,
          height: `${minH}px`,
          paddingTop: "5px",
          paddingBottom: "5px",
          paddingLeft: 0,
          paddingRight: 0,
          boxSizing: "border-box",
          overflowY: "visible",
          fieldSizing: "content",
        }}
        {...common}
      />
    );
  }

  return (
    <input
      type="text"
      value={v}
      readOnly={readOnly || Boolean(field.readOnly)}
      onChange={(e) => !readOnly && !field.readOnly && onChange(e.target.value)}
      placeholder={(isCanvas ? canvasPlaceholder : undefined) ?? field.placeholder ?? field.label}
      dir="rtl"
      className={`${className} text-right`}
      style={textStyle}
      {...common}
    />
  );
}
