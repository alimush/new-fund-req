"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiMove, FiSave, FiX, FiRotateCcw, FiRotateCw } from "react-icons/fi";
import SheetOrientationControls from "@/components/cheques/SheetOrientationControls";
import { isCanvasField } from "@/lib/cheques/templates";
import { slashPositionBetween } from "@/lib/cheques/dateUtils";
import { printFontSizeToPreviewPx } from "@/lib/cheques/chequeDesignMetrics";
import {
  fieldWithTextLayout,
  layoutFromField,
} from "@/lib/cheques/textFieldLayout";
import { getA4PaperSize } from "@/lib/cheques/chequePageSize";
import {
  DATE_GROUP_KEY,
  formatCmFromMm,
  getFieldFontStyle,
  getFieldOffset,
  normalizePrintCalib,
  PRINT_FIELD_LABELS,
  printFieldOffsetKeys,
  resolveFieldOffsetKey,
  chequeSheetTransformStyle,
  normalizeSheetRotationDeg,
} from "@/lib/cheques/printCalib";
import {
  ensureWizardCopyLayouts,
  normalizeWizardPrintCalib,
  patchWizardCopyLayout,
} from "@/lib/cheques/wizardCopyLayouts";

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";
const PREVIEW_PAGE_WIDTH_PX = 720;

const DEMO_VALUES = {
  dateDay: "14",
  dateMonth: "06",
  dateYear: "2024",
  payee: "اسم المستفيد",
  amountNumeric: "000",
  amountWords: "فقط لا غير",
  text: "#",
};

function mergeDemoValues(values = {}) {
  const out = { ...DEMO_VALUES };
  for (const [key, val] of Object.entries(values || {})) {
    if (val != null && String(val).trim() !== "") out[key] = val;
  }
  return out;
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

function fieldShiftPx(calib, key, pxPerMm) {
  const { offsetXmm, offsetYmm } = getFieldOffset(calib, key);
  if (!offsetXmm && !offsetYmm) return undefined;
  return `translate(${offsetXmm * pxPerMm}px, ${offsetYmm * pxPerMm}px)`;
}

const MODE_LABELS = {
  field: "حقل واحد",
  sheet: "منطقة الصك",
  global: "كل البيانات",
};

export default function ChequePrintPositionEditor({
  open,
  onClose,
  calib,
  onCalibChange,
  template,
  templateKey,
  fields = [],
  values = {},
  dateShowSlashes = true,
  textFieldLayout = null,
  canSave = false,
  onSaved,
  purpose = "data",
  wizardCalibSource = "shared",
  wizardCopyCount = 3,
}) {
  const isWizardPurpose = purpose === "wizard";
  const wizardCopyTotal = Math.max(1, Math.min(3, Math.round(Number(wizardCopyCount) || 3)));
  const [portalReady, setPortalReady] = useState(false);
  const [mode, setMode] = useState(isWizardPurpose ? "sheet" : "field");
  const [selectedCopy, setSelectedCopy] = useState(1);
  const [selectedKey, setSelectedKey] = useState(DATE_GROUP_KEY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const pageRef = useRef(null);
  const sheetRef = useRef(null);
  const dragRef = useRef(null);

  const { pageWidthMm: paperW, pageHeightMm: paperH } = getA4PaperSize();
  const pxPerMmPage = PREVIEW_PAGE_WIDTH_PX / paperW;
  const previewPageH = paperH * pxPerMmPage;
  const sheetW = calib.widthMm * pxPerMmPage;
  const sheetH = calib.heightMm * pxPerMmPage;
  const sheetTop = calib.pageTopMm * pxPerMmPage;
  const sheetLeft = calib.pageLeftMm * pxPerMmPage;
  const pxPerMmSheet = sheetW / calib.widthMm;

  const list = fields.length ? fields : template?.fields || [];
  const displayValues = useMemo(() => mergeDemoValues(values), [values]);

  const fieldByKey = useMemo(
    () => Object.fromEntries(list.map((f) => [f.key, f])),
    [list]
  );

  const staticFields = useMemo(
    () => list.filter((f) => f.key !== TEXT_KEY && isCanvasField(f)),
    [list]
  );

  const offsetKeys = useMemo(
    () => printFieldOffsetKeys(list, template),
    [list, template]
  );

  const fieldItems = useMemo(() => {
    const labelByKey = Object.fromEntries(list.map((f) => [f.key, f.label || f.key]));
    return offsetKeys.map((key) => ({
      key,
      label: PRINT_FIELD_LABELS[key] || labelByKey[key] || key,
      field:
        key === DATE_GROUP_KEY
          ? fieldByKey.dateDay || fieldByKey.dateMonth
          : fieldByKey[key],
    }));
  }, [offsetKeys, list, fieldByKey]);

  const textBase = fieldByKey[TEXT_KEY];
  const textField = textBase
    ? fieldWithTextLayout(textBase, textFieldLayout || layoutFromField(textBase))
    : null;

  const dateField = fieldByKey.dateDay;
  const dateFontStyle = getFieldFontStyle(calib, "date", dateField);
  const sx = calib.scaleX / 100;
  const sy = calib.scaleY / 100;
  const sheetTransform = chequeSheetTransformStyle(calib);

  const wizardCopyLayouts = useMemo(() => {
    if (!isWizardPurpose) return null;
    return ensureWizardCopyLayouts(calib, wizardCopyTotal, template, list);
  }, [isWizardPurpose, calib, template, list, wizardCopyTotal]);

  const activeCopyLayout = wizardCopyLayouts?.[String(selectedCopy)] || null;

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!open) return;
    setMode(isWizardPurpose ? "sheet" : "field");
    if (isWizardPurpose) setSelectedCopy((c) => Math.min(c, wizardCopyTotal) || 1);
    setError("");
    setSaveMessage("");
  }, [open, isWizardPurpose, wizardCopyTotal]);

  useEffect(() => {
    if (!open || isWizardPurpose) return;
    setError("");
    setSaveMessage("");
    setMode("field");
    if (fieldItems.length) setSelectedKey(fieldItems[0].key);
  }, [open, isWizardPurpose, fieldItems]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const patch = useCallback(
    (key, val) => {
      onCalibChange?.(
        normalizePrintCalib({ ...calib, [key]: val }, template, list)
      );
    },
    [calib, list, onCalibChange, template]
  );

  const patchField = useCallback(
    (fieldKey, partial) => {
      onCalibChange?.(
        normalizePrintCalib(
          {
            ...calib,
            fieldOffsets: {
              ...(calib.fieldOffsets || {}),
              [fieldKey]: { ...getFieldOffset(calib, fieldKey), ...partial },
            },
          },
          template,
          list
        )
      );
    },
    [calib, list, onCalibChange, template]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const patchWizardCopy = useCallback(
    (copyIndex, partial) => {
      onCalibChange?.(
        normalizeWizardPrintCalib(
          patchWizardCopyLayout(calib, copyIndex, partial, template, list, wizardCopyTotal),
          template,
          list,
          wizardCopyTotal
        )
      );
    },
    [calib, list, onCalibChange, template, wizardCopyTotal]
  );

  const startSheetDrag = useCallback(
    (e, copyIndex = null) => {
      if (mode !== "sheet") return;
      e.preventDefault();
      e.stopPropagation();
      const copy = isWizardPurpose ? copyIndex ?? selectedCopy : null;
      const layout = isWizardPurpose ? wizardCopyLayouts?.[String(copy)] : null;
      dragRef.current = {
        kind: isWizardPurpose ? "wizard-sheet" : "sheet",
        copy,
        startX: e.clientX,
        startY: e.clientY,
        startTop: isWizardPurpose ? layout?.pageTopMm ?? 0 : calib.pageTopMm,
        startLeft: isWizardPurpose ? layout?.pageLeftMm ?? 0 : calib.pageLeftMm,
        pxPerMm: pxPerMmPage,
        calibSnap: calib,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || (d.kind !== "sheet" && d.kind !== "wizard-sheet")) return;
        const dx = (ev.clientX - d.startX) / d.pxPerMm;
        const dy = (ev.clientY - d.startY) / d.pxPerMm;
        if (d.kind === "wizard-sheet") {
          onCalibChange?.(
            normalizeWizardPrintCalib(
              patchWizardCopyLayout(
                d.calibSnap,
                d.copy,
                {
                  pageLeftMm: d.startLeft + dx,
                  pageTopMm: d.startTop + dy,
                },
                template,
                list,
                wizardCopyTotal
              ),
              template,
              list,
              wizardCopyTotal
            )
          );
        } else {
          onCalibChange?.(
            normalizePrintCalib(
              {
                ...calib,
                pageLeftMm: d.startLeft + dx,
                pageTopMm: d.startTop + dy,
              },
              template,
              list
            )
          );
        }
      };

      const onUp = () => {
        endDrag();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      mode,
      isWizardPurpose,
      selectedCopy,
      wizardCopyLayouts,
      calib,
      pxPerMmPage,
      onCalibChange,
      template,
      list,
      endDrag,
      wizardCopyTotal,
    ]
  );

  const startSheetRotate = useCallback(
    (e, copyIndex = null) => {
      if (mode !== "sheet") return;
      e.preventDefault();
      e.stopPropagation();

      const pageEl = pageRef.current;
      if (!pageEl) return;

      const copy = isWizardPurpose ? copyIndex ?? selectedCopy : null;
      const layout = isWizardPurpose ? wizardCopyLayouts?.[String(copy)] : null;
      const localTop = isWizardPurpose
        ? (layout?.pageTopMm ?? 0) * pxPerMmPage
        : sheetTop;
      const localLeft = isWizardPurpose
        ? (layout?.pageLeftMm ?? 0) * pxPerMmPage
        : sheetLeft;
      const localW = isWizardPurpose
        ? (layout?.widthMm ?? calib.widthMm) * pxPerMmPage
        : sheetW;
      const localH = isWizardPurpose
        ? (layout?.heightMm ?? calib.heightMm) * pxPerMmPage
        : sheetH;

      const pageRect = pageEl.getBoundingClientRect();
      const pivotX = pageRect.left + localLeft;
      const pivotY = pageRect.top + localTop;
      const baseCornerDeg = (Math.atan2(localH, localW) * 180) / Math.PI;
      const startRot = isWizardPurpose
        ? normalizeSheetRotationDeg(layout?.sheetRotationDeg ?? 0)
        : normalizeSheetRotationDeg(calib.sheetRotationDeg);

      dragRef.current = {
        kind: isWizardPurpose ? "wizard-sheet-rotate" : "sheet-rotate",
        copy,
        pivotX,
        pivotY,
        baseCornerDeg,
        calibSnap: calib,
        startRot,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || (d.kind !== "sheet-rotate" && d.kind !== "wizard-sheet-rotate")) return;
        const pointerDeg =
          (Math.atan2(ev.clientY - d.pivotY, ev.clientX - d.pivotX) * 180) / Math.PI;
        const nextRot = normalizeSheetRotationDeg(pointerDeg - d.baseCornerDeg);
        if (d.kind === "wizard-sheet-rotate") {
          onCalibChange?.(
            normalizeWizardPrintCalib(
              patchWizardCopyLayout(
                d.calibSnap,
                d.copy,
                { sheetRotationDeg: nextRot },
                template,
                list,
                wizardCopyTotal
              ),
              template,
              list,
              wizardCopyTotal
            )
          );
        } else {
          onCalibChange?.(
            normalizePrintCalib(
              { ...d.calibSnap, sheetRotationDeg: nextRot },
              template,
              list
            )
          );
        }
      };

      const onUp = () => {
        endDrag();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [
      mode,
      isWizardPurpose,
      selectedCopy,
      wizardCopyLayouts,
      sheetLeft,
      sheetTop,
      sheetW,
      sheetH,
      calib,
      pxPerMmPage,
      onCalibChange,
      template,
      list,
      endDrag,
      wizardCopyTotal,
    ]
  );

  const startGlobalDrag = useCallback(
    (e) => {
      if (mode !== "global") return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        kind: "global",
        startX: e.clientX,
        startY: e.clientY,
        startXmm: calib.offsetXmm,
        startYmm: calib.offsetYmm,
        pxPerMm: pxPerMmSheet,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || d.kind !== "global") return;
        const dx = (ev.clientX - d.startX) / d.pxPerMm;
        const dy = (ev.clientY - d.startY) / d.pxPerMm;
        onCalibChange?.(
          normalizePrintCalib(
            {
              ...calib,
              offsetXmm: d.startXmm + dx,
              offsetYmm: d.startYmm + dy,
            },
            template,
            list
          )
        );
      };

      const onUp = () => {
        endDrag();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [mode, calib, pxPerMmSheet, onCalibChange, template, list, endDrag]
  );

  const startFieldDrag = useCallback(
    (e, fieldKey) => {
      if (mode !== "field") return;
      e.preventDefault();
      e.stopPropagation();
      const resolved = resolveFieldOffsetKey(fieldKey);
      setSelectedKey(resolved);
      const { offsetXmm, offsetYmm } = getFieldOffset(calib, fieldKey);
      dragRef.current = {
        kind: "field",
        key: resolved,
        startX: e.clientX,
        startY: e.clientY,
        startXmm: offsetXmm,
        startYmm: offsetYmm,
        pxPerMm: pxPerMmSheet,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d || d.kind !== "field") return;
        const dx = (ev.clientX - d.startX) / d.pxPerMm;
        const dy = (ev.clientY - d.startY) / d.pxPerMm;
        patchField(d.key, {
          offsetXmm: d.startXmm + dx,
          offsetYmm: d.startYmm + dy,
        });
      };

      const onUp = () => {
        endDrag();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [mode, calib, pxPerMmSheet, patchField, endDrag]
  );

  const handleSave = async () => {
    if (!canSave || !templateKey) {
      setSaveMessage(
        isWizardPurpose
          ? "تم تطبيق موضع ورقة المعايرة — احفظ من ضبط الطباعة إذا لم تكن لديك صلاحية"
          : "تم تطبيق المواضع — اضغط «حفظ للقالب» من ضبط الطباعة إذا لم تكن لديك صلاحية الحفظ"
      );
      onClose?.();
      return;
    }
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await fetch("/api/cheques/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isWizardPurpose
            ? {
                templateKey,
                wizardCalibOnly: true,
                wizardCalibSource,
                wizardPrintCalib: calib,
                wizardTestCopyCount: wizardCopyTotal,
              }
            : {
                templateKey,
                printCalibOnly: true,
                printCalib: calib,
              }
        ),
      });
      const json = await res.json();
      if (!json?.success) {
        setError(json?.error || "فشل حفظ المواضع");
        return;
      }
      const saved = isWizardPurpose
        ? normalizeWizardPrintCalib(json.wizardPrintCalib, template, list, wizardCopyTotal)
        : normalizePrintCalib(json.printCalib, template, list);
      onCalibChange?.(saved);
      onSaved?.(saved, json);
      setSaveMessage(
        isWizardPurpose
          ? "تم حفظ موضع ورقة المعايرة — يُستخدم في Wizard فقط"
          : "تم حفظ مواضع البيانات — تُطبّق على كل أزرار الطباعة"
      );
      setTimeout(() => onClose?.(), 700);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const selectedOffset = getFieldOffset(calib, selectedKey);

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {open && template ? (
        <motion.div
          key="position-editor"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex flex-col bg-slate-900/95"
          dir="rtl"
        >
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 md:px-6">
            <div>
              <p className="text-[11px] font-extrabold text-sky-400">
                {isWizardPurpose ? "محرّر موضع ورقة المعايرة" : "محرّر موضع البيانات"}
              </p>
              <h2 className="text-lg font-extrabold text-white">
                {isWizardPurpose
                  ? `A4 عرضي — اسحب كل نسخة من الـ ${wizardCopyTotal} بحرية`
                  : "A4 عرضي — اسحب الحقول أو منطقة الصك"}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {isWizardPurpose
                  ? `اختر نسخة ثم حرّكها أو دوّرها بشكل مستقل (١–${wizardCopyTotal})`
                  : "انقر مرتين على أي حقل لتحديده — اسحب لتغيير موضعه على الورقة البيضاء"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(MODE_LABELS)
                .filter(([key]) => !isWizardPurpose || key === "sheet")
                .map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`rounded-xl px-3 py-2 text-xs font-extrabold transition ${
                    mode === key
                      ? "bg-sky-500 text-white"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-300 hover:bg-white/10"
                aria-label="إغلاق"
              >
                <FiX size={20} />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 md:p-8">
              <div
                ref={pageRef}
                className="relative shrink-0 bg-white shadow-2xl"
                style={{
                  width: PREVIEW_PAGE_WIDTH_PX,
                  height: previewPageH,
                  cursor: mode === "sheet" ? "move" : "default",
                  overflow: "visible",
                }}
              >
                {isWizardPurpose && wizardCopyLayouts
                  ? Array.from({ length: wizardCopyTotal }, (_, i) => i + 1).map((copyNum) => {
                      const layout = wizardCopyLayouts[String(copyNum)];
                      if (!layout) return null;
                      const copyTop = layout.pageTopMm * pxPerMmPage;
                      const copyLeft = layout.pageLeftMm * pxPerMmPage;
                      const copyW = layout.widthMm * pxPerMmPage;
                      const copyH = layout.heightMm * pxPerMmPage;
                      const copyTransform = chequeSheetTransformStyle(layout);
                      const isSelected = selectedCopy === copyNum;
                      return (
                        <div
                          key={`wizard-copy-${copyNum}`}
                          className="absolute overflow-visible bg-white/95"
                          style={{
                            top: copyTop,
                            left: copyLeft,
                            width: copyW,
                            height: copyH,
                            outline: isSelected
                              ? "3px solid #0ea5e9"
                              : "2px dashed #94a3b8",
                            boxShadow: isSelected
                              ? "0 0 0 4px rgba(14,165,233,0.25)"
                              : "none",
                            cursor: mode === "sheet" ? "move" : "default",
                            zIndex: isSelected ? 20 : 10 + copyNum,
                            ...copyTransform,
                          }}
                          onMouseDown={(e) => {
                            setSelectedCopy(copyNum);
                            if (mode === "sheet") startSheetDrag(e, copyNum);
                          }}
                        >
                          <div className="pointer-events-none absolute left-1 top-1 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-extrabold text-white">
                            نسخة {copyNum}
                          </div>
                          {isSelected && mode === "sheet" ? (
                            <>
                              <div
                                role="button"
                                tabIndex={-1}
                                className="absolute -top-8 left-0 z-20 cursor-move rounded bg-sky-600 px-2 py-1 text-[10px] font-extrabold text-white shadow"
                                onMouseDown={(e) => startSheetDrag(e, copyNum)}
                              >
                                ⋮⋮ اسحب النسخة {copyNum}
                              </div>
                              <div
                                role="button"
                                tabIndex={-1}
                                title="اسحب لتدوير هذه النسخة"
                                className="absolute -bottom-4 -right-4 z-30 flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 border-white bg-sky-600 text-white shadow-lg active:cursor-grabbing"
                                onMouseDown={(e) => startSheetRotate(e, copyNum)}
                              >
                                <FiRotateCw size={14} />
                              </div>
                            </>
                          ) : null}
                        </div>
                      );
                    })
                  : null}

                {!isWizardPurpose ? (
                <div
                  ref={sheetRef}
                  className="absolute overflow-visible bg-white"
                  style={{
                    top: sheetTop,
                    left: sheetLeft,
                    width: sheetW,
                    height: sheetH,
                    outline: mode === "sheet" ? "3px solid #0ea5e9" : "2px solid #0ea5e9",
                    boxShadow:
                      mode === "sheet"
                        ? "0 0 0 4px rgba(14,165,233,0.25)"
                        : "0 0 0 1px rgba(14,165,233,0.35)",
                    cursor: mode === "sheet" ? "move" : "default",
                    ...sheetTransform,
                  }}
                  onMouseDown={(e) => {
                    if (mode === "sheet") startSheetDrag(e);
                  }}
                >
                  {mode === "sheet" ? (
                    <div
                      role="button"
                      tabIndex={-1}
                      className="absolute -top-8 left-0 z-20 cursor-move rounded bg-sky-600 px-2 py-1 text-[10px] font-extrabold text-white shadow"
                      onMouseDown={startSheetDrag}
                    >
                      ⋮⋮ اسحب لتحريك منطقة الصك
                    </div>
                  ) : null}

                  {mode === "sheet" ? (
                    <div
                      role="button"
                      tabIndex={-1}
                      title="اسحب لتدوير المنطقة بحرية"
                      className="absolute -bottom-4 -right-4 z-30 flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 border-white bg-sky-600 text-white shadow-lg active:cursor-grabbing"
                      onMouseDown={startSheetRotate}
                    >
                      <FiRotateCw size={14} />
                    </div>
                  ) : null}

                  <div
                    className="absolute inset-0 z-[1] text-slate-900"
                    style={{
                      fontFamily: "Cairo, sans-serif",
                      transform: `translate(${calib.offsetXmm * pxPerMmSheet}px, ${calib.offsetYmm * pxPerMmSheet}px) scale(${sx}, ${sy})`,
                      transformOrigin: "top left",
                      width: "100%",
                      height: "100%",
                      cursor: mode === "global" ? "move" : "default",
                    }}
                    onMouseDown={startGlobalDrag}
                  >
                    {dateShowSlashes
                      ? DATE_ORDER.slice(0, -1).map((key, i) => {
                          const a = fieldByKey[DATE_ORDER[i]];
                          const b = fieldByKey[DATE_ORDER[i + 1]];
                          const pos = slashPositionBetween(a, b);
                          if (!pos) return null;
                          const slashKey = `slash_${i}`;
                          const shift = fieldShiftPx(calib, slashKey, pxPerMmSheet);
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
                                fontSize: printFontSizeToPreviewPx(
                                  a || dateField,
                                  template,
                                  calib,
                                  dateFontStyle,
                                  pxPerMmSheet
                                ),
                                color: dateFontStyle.color,
                                transform: shift
                                  ? `translate(-50%, 0) ${shift}`
                                  : "translate(-50%, 0)",
                                pointerEvents: mode === "field" ? "auto" : "none",
                              }}
                              onMouseDown={(e) => startFieldDrag(e, slashKey)}
                              onDoubleClick={() => setSelectedKey(DATE_GROUP_KEY)}
                            >
                              /
                            </div>
                          );
                        })
                      : null}

                    {staticFields.map((f) => {
                      const val = displayValues?.[f.key];
                      if (val == null || val === "") return null;
                      const resolved = resolveFieldOffsetKey(f.key);
                      const fontStyle = getFieldFontStyle(calib, f.key, f);
                      const fs = printFontSizeToPreviewPx(
                        f,
                        template,
                        calib,
                        fontStyle,
                        pxPerMmSheet
                      );
                      const isDate = f.type === "datePart";
                      const isAmount = f.type === "amount" || f.key === "amountNumeric";
                      const shift = fieldShiftPx(calib, f.key, pxPerMmSheet);
                      const selected = mode === "field" && selectedKey === resolved;
                      return (
                        <div
                          key={f.key}
                          style={{
                            ...fieldBox(f),
                            transform: shift,
                            cursor: mode === "field" ? "grab" : "default",
                            outline: selected ? "2px dashed #2563eb" : "1px dashed transparent",
                            background: selected ? "rgba(37,99,235,0.06)" : "transparent",
                            pointerEvents: mode === "field" ? "auto" : "none",
                          }}
                          onMouseDown={(e) => startFieldDrag(e, f.key)}
                          onDoubleClick={() => setSelectedKey(resolved)}
                        >
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

                    {textField && displayValues?.[TEXT_KEY] ? (
                      <div
                        style={{
                          ...fieldBox(textField),
                          transform: fieldShiftPx(calib, TEXT_KEY, pxPerMmSheet),
                          cursor: mode === "field" ? "grab" : "default",
                          outline:
                            mode === "field" && selectedKey === TEXT_KEY
                              ? "2px dashed #2563eb"
                              : "1px dashed transparent",
                          background:
                            mode === "field" && selectedKey === TEXT_KEY
                              ? "rgba(37,99,235,0.06)"
                              : "transparent",
                          pointerEvents: mode === "field" ? "auto" : "none",
                        }}
                        onMouseDown={(e) => startFieldDrag(e, TEXT_KEY)}
                        onDoubleClick={() => setSelectedKey(TEXT_KEY)}
                      >
                        <span
                          style={{
                            fontSize: printFontSizeToPreviewPx(
                              textField,
                              template,
                              calib,
                              getFieldFontStyle(calib, TEXT_KEY, textField),
                              pxPerMmSheet
                            ),
                            fontWeight: getFieldFontStyle(calib, TEXT_KEY, textField).fontWeight,
                            width: "100%",
                            textAlign: "right",
                            direction: "rtl",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.2,
                            color: getFieldFontStyle(calib, TEXT_KEY, textField).color,
                          }}
                        >
                          {displayValues[TEXT_KEY]}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                ) : null}
              </div>
            </div>

            <aside className="flex w-full shrink-0 flex-col border-t border-white/10 bg-slate-900/80 lg:w-80 lg:border-t-0 lg:border-r">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isWizardPurpose ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs font-extrabold text-white">
                      النسخ ({wizardCopyTotal})
                    </p>
                    <div className={`grid gap-2 ${wizardCopyTotal === 3 ? "grid-cols-3" : wizardCopyTotal === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {Array.from({ length: wizardCopyTotal }, (_, i) => i + 1).map((copyNum) => (
                        <button
                          key={copyNum}
                          type="button"
                          onClick={() => {
                            setSelectedCopy(copyNum);
                            setMode("sheet");
                          }}
                          className={`rounded-lg px-2 py-2 text-xs font-extrabold transition ${
                            selectedCopy === copyNum
                              ? "bg-sky-500 text-white"
                              : "bg-white/10 text-slate-200 hover:bg-white/15"
                          }`}
                        >
                          نسخة {copyNum}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-xs font-extrabold text-white">الحقول</p>
                  <div className="space-y-1">
                    {fieldItems.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(key);
                          setMode("field");
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold transition ${
                          selectedKey === key && mode === "field"
                            ? "bg-sky-500/30 text-sky-100"
                            : "text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        <span>{label}</span>
                        <span className="tabular-nums text-[10px] text-slate-400">
                          {formatCmFromMm(getFieldOffset(calib, key).offsetXmm)} ×{" "}
                          {formatCmFromMm(getFieldOffset(calib, key).offsetYmm)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                )}

                {mode === "field" && selectedKey && !isWizardPurpose ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
                    <p className="mb-2 font-extrabold text-white">
                      {PRINT_FIELD_LABELS[selectedKey] ||
                        fieldItems.find((f) => f.key === selectedKey)?.label ||
                        selectedKey}
                    </p>
                    <p className="font-semibold text-slate-400">
                      أفقي: {formatCmFromMm(selectedOffset.offsetXmm)} سم
                    </p>
                    <p className="font-semibold text-slate-400">
                      عمودي: {formatCmFromMm(selectedOffset.offsetYmm)} سم
                    </p>
                  </div>
                ) : null}

                {mode === "sheet" ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs font-semibold text-sky-100">
                      {isWizardPurpose ? (
                        <>
                          النسخة <strong>{selectedCopy}</strong> — اسحب الإطار أو المقبض الدائري.
                          <p className="mt-2 text-sky-200/80">
                            من الأعلى: {formatCmFromMm(activeCopyLayout?.pageTopMm ?? 0)} سم — من
                            اليسار: {formatCmFromMm(activeCopyLayout?.pageLeftMm ?? 0)} سم — زاوية:{" "}
                            {normalizeSheetRotationDeg(activeCopyLayout?.sheetRotationDeg ?? 0)}°
                          </p>
                        </>
                      ) : (
                        <>
                          اسحب الإطار للتحريك — أو المقبض الدائري من الزاوية للتدوير الحر.
                          <p className="mt-2 text-sky-200/80">
                            من الأعلى: {formatCmFromMm(calib.pageTopMm)} سم — من اليسار:{" "}
                            {formatCmFromMm(calib.pageLeftMm)} سم — زاوية:{" "}
                            {normalizeSheetRotationDeg(calib.sheetRotationDeg)}°
                          </p>
                        </>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <SheetOrientationControls
                        variant="dark"
                        rotationDeg={
                          isWizardPurpose
                            ? activeCopyLayout?.sheetRotationDeg ?? 0
                            : calib.sheetRotationDeg ?? 0
                        }
                        flipHorizontal={Boolean(
                          isWizardPurpose
                            ? activeCopyLayout?.flipHorizontal
                            : calib.flipHorizontal
                        )}
                        flipVertical={Boolean(
                          isWizardPurpose ? activeCopyLayout?.flipVertical : calib.flipVertical
                        )}
                        onRotation={(deg) => {
                          if (isWizardPurpose) patchWizardCopy(selectedCopy, { sheetRotationDeg: deg });
                          else patch("sheetRotationDeg", deg);
                        }}
                        onFlipHorizontal={(v) => {
                          if (isWizardPurpose) patchWizardCopy(selectedCopy, { flipHorizontal: v });
                          else patch("flipHorizontal", v);
                        }}
                        onFlipVertical={(v) => {
                          if (isWizardPurpose) patchWizardCopy(selectedCopy, { flipVertical: v });
                          else patch("flipVertical", v);
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                {mode === "global" ? (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs font-semibold text-violet-100">
                    اسحب أي مكان داخل منطقة الصك لتحريك كل البيانات معاً.
                    <p className="mt-2 text-violet-200/80">
                      أفقي: {formatCmFromMm(calib.offsetXmm)} سم — عمودي:{" "}
                      {formatCmFromMm(calib.offsetYmm)} سم
                    </p>
                  </div>
                ) : null}

                {error ? <p className="text-sm font-bold text-red-400">{error}</p> : null}
                {saveMessage ? (
                  <p className="text-sm font-bold text-emerald-400">{saveMessage}</p>
                ) : null}
              </div>

              <footer className="flex flex-wrap gap-2 border-t border-white/10 p-4">
                <button
                  type="button"
                  onClick={() => {
                    if (isWizardPurpose) {
                      onCalibChange?.(
                        normalizeWizardPrintCalib(
                          { ...calib, wizardCopyLayouts: null },
                          template,
                          list,
                          wizardCopyTotal
                        )
                      );
                    } else {
                      onCalibChange?.(
                        normalizePrintCalib(
                          {
                            pageTopMm: 0,
                            pageLeftMm: 0,
                            offsetXmm: 0,
                            offsetYmm: 0,
                            sheetRotationDeg: 0,
                            flipHorizontal: false,
                            flipVertical: false,
                            fieldOffsets: {},
                          },
                          template,
                          list
                        )
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-white/10"
                >
                  <FiRotateCcw size={14} />
                  تصفير المواضع
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-white/10"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  <FiSave size={14} />
                  {saving ? "جاري الحفظ…" : canSave ? "حفظ وتطبيق" : "تطبيق"}
                </button>
              </footer>
            </aside>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
