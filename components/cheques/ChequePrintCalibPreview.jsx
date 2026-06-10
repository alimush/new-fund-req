"use client";

import { useMemo } from "react";
import { isCanvasField } from "@/lib/cheques/templates";
import { slashPositionBetween } from "@/lib/cheques/dateUtils";
import {
  fieldDesignFontPx,
  screenFontScaleFromWidth,
} from "@/lib/cheques/chequeDesignMetrics";
import {
  fieldWithTextLayout,
  layoutFromField,
} from "@/lib/cheques/textFieldLayout";
import { getFieldOffset } from "@/lib/cheques/printCalib";
import { getChequePageSize } from "@/lib/cheques/chequePageSize";

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";

function fieldShiftPx(calib, key, pxPerMm) {
  const { offsetXmm, offsetYmm } = getFieldOffset(calib, key);
  if (!offsetXmm && !offsetYmm) return undefined;
  return `translate(${offsetXmm * pxPerMm}px, ${offsetYmm * pxPerMm}px)`;
}

const fieldBox = (f) => ({
  position: "absolute",
  top: `${f.top}%`,
  left: `${f.left}%`,
  width: `${f.width}%`,
  height: `${f.height}%`,
  display: "flex",
  alignItems: f.type === "datePart" || f.type === "amount" ? "center" : "flex-start",
  justifyContent:
    f.type === "datePart"
      ? "center"
      : f.type === "amount" || f.key === "amountNumeric"
      ? "flex-start"
      : "flex-start",
  overflow: "hidden",
  lineHeight: 1.2,
});

export default function ChequePrintCalibPreview({
  calib,
  template,
  fields = [],
  values = {},
  mode = "data",
  dateShowSlashes = true,
  textFieldLayout = null,
  /** في نافذة ضبط الطباعة — إظهار صورة القالب مع البيانات */
  showChequeImage = false,
}) {
  const { pageWidthMm, pageHeightMm } = getChequePageSize();
  const previewW = 300;
  const pxPerMm = previewW / pageWidthMm;
  const previewH = pageHeightMm * pxPerMm;

  const list = fields.length ? fields : template?.fields || [];
  const fieldByKey = useMemo(
    () => Object.fromEntries(list.map((f) => [f.key, f])),
    [list]
  );

  const staticFields = useMemo(
    () => list.filter((f) => f.key !== TEXT_KEY && isCanvasField(f)),
    [list]
  );

  const chequePxW = calib.widthMm * pxPerMm;
  const fontScale = screenFontScaleFromWidth(chequePxW, template);
  const showImage =
    Boolean(template?.image) &&
    (showChequeImage || mode === "withImage" || mode === "imageOnly");
  const showData = true;

  const sx = calib.scaleX / 100;
  const sy = calib.scaleY / 100;

  const textBase = fieldByKey[TEXT_KEY];
  const textField = textBase
    ? fieldWithTextLayout(textBase, textFieldLayout || layoutFromField(textBase))
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
      <p className="mb-2 text-center text-[10px] font-extrabold text-slate-600">
        {showImage ? "معاينة — صورة الصك + البيانات" : "معاينة — A4 أفقي + البيانات"}
      </p>
      <div
        className="relative mx-auto overflow-hidden rounded-md border border-slate-300 bg-white shadow-inner"
        style={{ width: previewW, height: previewH }}
      >
        <div
          className="absolute overflow-hidden bg-white"
          style={{
            top: calib.pageTopMm * pxPerMm,
            left: calib.pageLeftMm * pxPerMm,
            width: calib.widthMm * pxPerMm,
            height: calib.heightMm * pxPerMm,
            outline: "2px solid #0ea5e9",
          }}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.image}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            />
          ) : null}

          {showData ? (
            <div
              className="absolute inset-0 z-[1] text-slate-900"
              style={{
                fontFamily: "Cairo, sans-serif",
                transform: `translate(${calib.offsetXmm * pxPerMm}px, ${calib.offsetYmm * pxPerMm}px) scale(${sx}, ${sy})`,
                transformOrigin: "top left",
                width: "100%",
                height: "100%",
              }}
            >
              {dateShowSlashes
                ? DATE_ORDER.slice(0, -1).map((key, i) => {
                    const a = fieldByKey[DATE_ORDER[i]];
                    const b = fieldByKey[DATE_ORDER[i + 1]];
                    const pos = slashPositionBetween(a, b);
                    if (!pos) return null;
                    const slashKey = `slash_${i}`;
                    const shift = fieldShiftPx(calib, slashKey, pxPerMm);
                    return (
                      <div
                        key={`slash-${i}`}
                        style={{
                          position: "absolute",
                          top: `${pos.top}%`,
                          left: `${pos.left}%`,
                          width: `${pos.width}%`,
                          height: `${pos.height}%`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: fieldDesignFontPx(a) * fontScale,
                          transform: shift
                            ? `translate(-50%, 0) ${shift}`
                            : "translate(-50%, 0)",
                        }}
                      >
                        /
                      </div>
                    );
                  })
                : null}

              {staticFields.map((f) => {
                const val = values?.[f.key];
                if (val == null || val === "") return null;
                const fs = fieldDesignFontPx(f) * fontScale;
                const isDate = f.type === "datePart";
                const isAmount = f.type === "amount" || f.key === "amountNumeric";
                const shift = fieldShiftPx(calib, f.key, pxPerMm);
                return (
                  <div key={f.key} style={{ ...fieldBox(f), transform: shift }}>
                    <span
                      style={{
                        fontSize: fs,
                        fontWeight: f.fontWeight || 800,
                        width: "100%",
                        textAlign: isDate ? "center" : isAmount ? "left" : "right",
                        direction: isDate || isAmount ? "ltr" : "rtl",
                        whiteSpace: f.key === "amountWords" ? "nowrap" : "normal",
                        overflow: "hidden",
                      }}
                    >
                      {val}
                    </span>
                  </div>
                );
              })}

              {textField && values?.[TEXT_KEY] ? (
                <div
                  style={{
                    ...fieldBox(textField),
                    transform: fieldShiftPx(calib, TEXT_KEY, pxPerMm),
                  }}
                >
                  <span
                    style={{
                      fontSize: fieldDesignFontPx(textField) * fontScale,
                      fontWeight: textField.fontWeight || 700,
                      width: "100%",
                      textAlign: "right",
                      direction: "rtl",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.2,
                    }}
                  >
                    {values[TEXT_KEY]}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
