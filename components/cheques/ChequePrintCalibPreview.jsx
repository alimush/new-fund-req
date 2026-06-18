"use client";

import { useMemo } from "react";
import { isCanvasField } from "@/lib/cheques/templates";
import { slashPositionBetween } from "@/lib/cheques/dateUtils";
import { printFontSizeToPreviewPx } from "@/lib/cheques/chequeDesignMetrics";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  amountWordsPrintCalibKey,
  fieldWithAmountWordsSharedFont,
  fieldWithChequePosition,
  fieldWithTextLayout,
  layoutFromField,
} from "@/lib/cheques/textFieldLayout";
import {
  formatCmFromMm,
  getFieldFontStyle,
  getFieldOffset,
  chequeSheetTransformStyle,
} from "@/lib/cheques/printCalib";
import { getA4PaperSize } from "@/lib/cheques/chequePageSize";

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";
const PER_CHEQUE_KEYS = new Set([TEXT_KEY, AMOUNT_WORDS_KEY, AMOUNT_WORDS_LINE2_KEY]);

/** عرض معاينة ورقة A4 (Landscape) */
const PREVIEW_PAGE_WIDTH_PX = 560;

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
  transformOrigin: "top left",
});

export default function ChequePrintCalibPreview({
  calib,
  template,
  fields = [],
  values = {},
  mode = "data",
  dateShowSlashes = true,
  textFieldLayout = null,
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  layoutFontScale = 100,
  showChequeImage = false,
}) {
  const { pageWidthMm: paperW, pageHeightMm: paperH } = getA4PaperSize();
  const pxPerMm = PREVIEW_PAGE_WIDTH_PX / paperW;
  const previewPageH = paperH * pxPerMm;
  const sheetW = calib.widthMm * pxPerMm;
  const sheetH = calib.heightMm * pxPerMm;
  const sheetTop = calib.pageTopMm * pxPerMm;
  const sheetLeft = calib.pageLeftMm * pxPerMm;

  const list = fields.length ? fields : template?.fields || [];
  const fieldByKey = useMemo(
    () => Object.fromEntries(list.map((f) => [f.key, f])),
    [list]
  );

  const staticFields = useMemo(
    () => list.filter((f) => !PER_CHEQUE_KEYS.has(f.key) && isCanvasField(f)),
    [list]
  );

  const showImage =
    Boolean(template?.image) &&
    (showChequeImage || mode === "withImage" || mode === "imageOnly");
  const showData = true;

  const sx = calib.scaleX / 100;
  const sy = calib.scaleY / 100;
  const sheetTransform = chequeSheetTransformStyle(calib);

  const textBase = fieldByKey[TEXT_KEY];
  const textField = textBase
    ? fieldWithTextLayout(textBase, textFieldLayout || layoutFromField(textBase))
    : null;

  const resolveAmountField = (key, layout) => {
    const base = fieldByKey[key];
    if (!base) return null;
    const positioned = layout ? fieldWithChequePosition(base, layout) : base;
    return fieldWithAmountWordsSharedFont(
      positioned,
      amountWordsLayout,
      amountWordsLine2Layout
    );
  };

  const amountWordsField = resolveAmountField(AMOUNT_WORDS_KEY, amountWordsLayout);
  const amountWordsLine2Field = resolveAmountField(
    AMOUNT_WORDS_LINE2_KEY,
    amountWordsLine2Layout
  );

  const dateField = fieldByKey.dateDay;
  const dateFontStyle = getFieldFontStyle(calib, "date", dateField);

  const hasPageOffset = calib.pageTopMm > 0 || calib.pageLeftMm > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
      <p className="mb-1 text-center text-[11px] font-extrabold text-slate-800">
        معاينة A4 — منطقة الصك {formatCmFromMm(calib.widthMm)} × {formatCmFromMm(calib.heightMm)} سم
      </p>
      <p className="mb-2 text-center text-[10px] font-semibold text-slate-500">
        Landscape + Scale Default — الحقول موزّعة داخل الإطار الأزرق كما في الطباعة
      </p>

      {hasPageOffset ? (
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-center text-[10px] font-semibold text-amber-900">
          موضع الصك على الورقة: من الأعلى {formatCmFromMm(calib.pageTopMm)} سم — من اليسار{" "}
          {formatCmFromMm(calib.pageLeftMm)} سم
        </p>
      ) : null}

      <div
        className="relative mx-auto overflow-auto rounded-lg border border-slate-300 bg-slate-200/80 p-2 shadow-inner"
        style={{ maxWidth: "100%" }}
      >
        <div
          className="relative mx-auto overflow-hidden bg-white shadow-sm"
          style={{
            width: PREVIEW_PAGE_WIDTH_PX,
            height: previewPageH,
            border: "1px solid #cbd5e1",
          }}
        >
          <div
            className="absolute overflow-visible bg-white"
            style={{
              top: sheetTop,
              left: sheetLeft,
              width: sheetW,
              height: sheetH,
              outline: "2px solid #0ea5e9",
              boxShadow: "0 0 0 1px rgba(14,165,233,0.35)",
              ...sheetTransform,
            }}
          >
          {showImage ? (
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${template.image})`,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center center",
              }}
              aria-hidden
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-0 z-0 border border-dashed border-slate-300/80 bg-white"
              aria-hidden
            />
          )}

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
                    const slashFs = printFontSizeToPreviewPx(
                      a || dateField,
                      template,
                      calib,
                      dateFontStyle,
                      pxPerMm,
                      3.2,
                      layoutFontScale
                    );
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
                          fontWeight: dateFontStyle.fontWeight,
                          fontSize: slashFs,
                          color: dateFontStyle.color,
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
                const fontStyle = getFieldFontStyle(calib, f.key, f);
                const fs = printFontSizeToPreviewPx(
                  f,
                  template,
                  calib,
                  fontStyle,
                  pxPerMm,
                  3.2,
                  layoutFontScale
                );
                const isDate = f.type === "datePart";
                const isAmount = f.type === "amount" || f.key === "amountNumeric";
                const shift = fieldShiftPx(calib, f.key, pxPerMm);
                return (
                  <div key={f.key} style={{ ...fieldBox(f), transform: shift }}>
                    <span
                      style={{
                        fontSize: fs,
                        fontWeight: fontStyle.fontWeight,
                        width: "100%",
                        textAlign: isDate ? "center" : isAmount ? "left" : "right",
                        direction: isDate || isAmount ? "ltr" : "rtl",
                        whiteSpace: f.key === "amountWords" ? "nowrap" : "normal",
                        overflow: "hidden",
                        color: fontStyle.color,
                      }}
                    >
                      {val}
                    </span>
                  </div>
                );
              })}

              {amountWordsField && values?.[AMOUNT_WORDS_KEY] ? (
                <div
                  style={{
                    ...fieldBox(amountWordsField),
                    transform: fieldShiftPx(calib, AMOUNT_WORDS_KEY, pxPerMm),
                  }}
                >
                  {(() => {
                    const fontStyle = getFieldFontStyle(calib, AMOUNT_WORDS_KEY, amountWordsField);
                    return (
                      <span
                        style={{
                          fontSize: printFontSizeToPreviewPx(
                            amountWordsField,
                            template,
                            calib,
                            fontStyle,
                            pxPerMm,
                            3.2,
                            layoutFontScale
                          ),
                          fontWeight: fontStyle.fontWeight,
                          width: "100%",
                          textAlign: "right",
                          direction: "rtl",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          color: fontStyle.color,
                        }}
                      >
                        {values[AMOUNT_WORDS_KEY]}
                      </span>
                    );
                  })()}
                </div>
              ) : null}

              {amountWordsLine2Field && values?.[AMOUNT_WORDS_LINE2_KEY] ? (
                <div
                  style={{
                    ...fieldBox(amountWordsLine2Field),
                    transform: fieldShiftPx(calib, AMOUNT_WORDS_LINE2_KEY, pxPerMm),
                  }}
                >
                  {(() => {
                    const fontStyle = getFieldFontStyle(
                      calib,
                      amountWordsPrintCalibKey(AMOUNT_WORDS_LINE2_KEY),
                      amountWordsLine2Field
                    );
                    return (
                      <span
                        style={{
                          fontSize: printFontSizeToPreviewPx(
                            amountWordsLine2Field,
                            template,
                            calib,
                            fontStyle,
                            pxPerMm,
                            3.2,
                            layoutFontScale
                          ),
                          fontWeight: fontStyle.fontWeight,
                          width: "100%",
                          textAlign: "right",
                          direction: "rtl",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          color: fontStyle.color,
                        }}
                      >
                        {values[AMOUNT_WORDS_LINE2_KEY]}
                      </span>
                    );
                  })()}
                </div>
              ) : null}

              {textField && values?.[TEXT_KEY] ? (
                <div
                  style={{
                    ...fieldBox(textField),
                    transform: fieldShiftPx(calib, TEXT_KEY, pxPerMm),
                  }}
                >
                  {(() => {
                    const fontStyle = getFieldFontStyle(calib, TEXT_KEY, textField);
                    return (
                      <span
                        style={{
                          fontSize: printFontSizeToPreviewPx(
                            textField,
                            template,
                            calib,
                            fontStyle,
                            pxPerMm,
                            3.2,
                            layoutFontScale
                          ),
                          fontWeight: fontStyle.fontWeight,
                          width: "100%",
                          textAlign: "right",
                          direction: "rtl",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.2,
                            color: fontStyle.color,
                        }}
                      >
                        {values[TEXT_KEY]}
                      </span>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] font-semibold text-slate-500">
        الإطار الأزرق = منطقة الصك على ورقة A4 — الباقي أبيض كما في معاينة الطباعة
      </p>
    </div>
  );
}
