"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiMove, FiSave, FiX, FiRotateCcw, FiRotateCw } from "react-icons/fi";
import SheetOrientationControls from "@/components/cheques/SheetOrientationControls";
import DateMoveModeToggle from "@/components/cheques/DateMoveModeToggle";
import { isPrintField } from "@/lib/cheques/templates";
import { slashPositionBetween, datePartTextAlign, datePartJustifyContent } from "@/lib/cheques/dateUtils";
import { printFontSizeToPreviewPx } from "@/lib/cheques/chequeDesignMetrics";
import {
  fieldWithTextLayout,
  layoutFromField,
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  amountWordsPrintCalibKey,
  fieldWithAmountWordsSharedFont,
  fieldWithChequePosition,
  getAmountWordsSharedFont,
} from "@/lib/cheques/textFieldLayout";
import { getA4PaperSize } from "@/lib/cheques/chequePageSize";
import {
  DATE_ALL_GROUP_KEY,
  DATE_GROUP_KEY,
  SLASH_GROUP_KEY,
  formatCmFromMm,
  getEffectiveFieldOffset,
  getFieldFontStyle,
  getFieldOffset,
  getStoredFieldOffset,
  getImageSheetCalib,
  isDatePrintGroupKey,
  isDateSpacingKey,
  normalizePrintCalib,
  PRINT_FIELD_LABELS,
  printDateSpacingKeys,
  printFieldFontCalibKeys,
  chequeSheetTransformStyle,
  normalizeSheetRotationDeg,
  wizardPrintCalibPayload,
  DATE_PART_KEYS,
} from "@/lib/cheques/printCalib";
import {
  ensureWizardCopyLayouts,
  normalizeWizardPrintCalib,
  patchWizardCopyLayout,
} from "@/lib/cheques/wizardCopyLayouts";

const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];
const TEXT_KEY = "text";
const PER_CHEQUE_KEYS = new Set([TEXT_KEY, AMOUNT_WORDS_KEY, AMOUNT_WORDS_LINE2_KEY]);
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
      ? datePartJustifyContent(f.key)
      : f.type === "amount" || f.key === "amountNumeric"
      ? "flex-start"
      : "flex-start",
  overflow: "hidden",
  lineHeight: 1.2,
  transformOrigin: "top left",
});

function fieldShiftPx(calib, key, pxPerMm) {
  const { offsetXmm, offsetYmm } = getEffectiveFieldOffset(calib, key);
  if (!offsetXmm && !offsetYmm) return undefined;
  return `translate(${offsetXmm * pxPerMm}px, ${offsetYmm * pxPerMm}px)`;
}

const MODE_LABELS = {
  field: "حقل واحد",
  sheet: "منطقة البيانات",
  imageSheet: "صورة الصك",
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
  amountWordsLayout = null,
  amountWordsLine2Layout = null,
  layoutFontScale = 100,
  canSave = false,
  onSaved,
  purpose = "data",
  wizardCalibSource = "shared",
  wizardCopyCount = 3,
  imageUrl = null,
  dateMoveMode: dateMoveModeProp,
  onDateMoveModeChange,
}) {
  const isWizardPurpose = purpose === "wizard";
  const wizardCopyTotal = Math.max(1, Math.min(3, Math.round(Number(wizardCopyCount) || 3)));
  const [portalReady, setPortalReady] = useState(false);
  const [mode, setMode] = useState(isWizardPurpose ? "sheet" : "field");
  const [selectedCopy, setSelectedCopy] = useState(1);
  const [selectedKey, setSelectedKey] = useState(DATE_GROUP_KEY);
  const [dateMoveModeInternal, setDateMoveModeInternal] = useState("split");
  const dateMoveMode = dateMoveModeProp ?? dateMoveModeInternal;
  const setDateMoveMode = onDateMoveModeChange ?? setDateMoveModeInternal;
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
    () => list.filter((f) => !PER_CHEQUE_KEYS.has(f.key) && isPrintField(f)),
    [list]
  );

  const resolveAmountField = useCallback(
    (key, layout) => {
      const base = fieldByKey[key];
      if (!base) return null;
      const positioned = layout ? fieldWithChequePosition(base, layout) : base;
      return fieldWithAmountWordsSharedFont(
        positioned,
        amountWordsLayout,
        amountWordsLine2Layout
      );
    },
    [fieldByKey, amountWordsLayout, amountWordsLine2Layout]
  );

  const amountWordsField = resolveAmountField(AMOUNT_WORDS_KEY, amountWordsLayout);
  const amountWordsLine2Field = resolveAmountField(
    AMOUNT_WORDS_LINE2_KEY,
    amountWordsLine2Layout
  );

  const offsetKeys = useMemo(
    () => printFieldFontCalibKeys(list, template),
    [list, template]
  );

  const spacingKeys = useMemo(
    () => printDateSpacingKeys(dateShowSlashes),
    [dateShowSlashes]
  );

  const resolveDragFieldKey = useCallback(
    (fieldKey) => {
      if (dateMoveMode === "unified" && isDatePrintGroupKey(fieldKey)) {
        return DATE_ALL_GROUP_KEY;
      }
      return fieldKey;
    },
    [dateMoveMode]
  );

  const isPrintDateSelected = useCallback(
    (fieldKey) => {
      if (mode !== "field") return false;
      if (dateMoveMode === "unified" && selectedKey === DATE_ALL_GROUP_KEY) {
        return isDatePrintGroupKey(fieldKey);
      }
      if (selectedKey === DATE_GROUP_KEY && DATE_PART_KEYS.includes(fieldKey)) return true;
      if (selectedKey === SLASH_GROUP_KEY && (fieldKey === "slash_0" || fieldKey === "slash_1")) {
        return true;
      }
      return selectedKey === fieldKey;
    },
    [mode, dateMoveMode, selectedKey]
  );

  const fieldItems = useMemo(() => {
    const labelByKey = Object.fromEntries(list.map((f) => [f.key, f.label || f.key]));

    const fontItems = offsetKeys
      .filter((key) => {
        if (key === SLASH_GROUP_KEY && !dateShowSlashes) return false;
        if (dateMoveMode === "unified") {
          if (key === DATE_GROUP_KEY || key === SLASH_GROUP_KEY) return false;
        } else if (key === DATE_ALL_GROUP_KEY) {
          return false;
        }
        return true;
      })
      .map((key) => ({
        key,
        label: PRINT_FIELD_LABELS[key] || labelByKey[key] || key,
        kind: "font",
      }));

    const spacingItems = spacingKeys.map((key) => ({
      key,
      label: PRINT_FIELD_LABELS[key] || labelByKey[key] || key,
      kind: "spacing",
    }));

    const seen = new Set();
    return [...fontItems, ...spacingItems].filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }, [offsetKeys, spacingKeys, list, dateShowSlashes, dateMoveMode]);

  const textBase = fieldByKey[TEXT_KEY];
  const textField = textBase
    ? fieldWithTextLayout(textBase, textFieldLayout || layoutFromField(textBase))
    : null;

  const dateField = fieldByKey.dateDay;
  const slashFontStyle = getFieldFontStyle(calib, SLASH_GROUP_KEY, dateField);
  const sx = calib.scaleX / 100;
  const sy = calib.scaleY / 100;
  const sheetTransform = chequeSheetTransformStyle(calib);

  const imageSheet = useMemo(
    () => getImageSheetCalib(calib, template, list),
    [calib, template, list]
  );
  const imageSheetW = imageSheet.widthMm * pxPerMmPage;
  const imageSheetH = imageSheet.heightMm * pxPerMmPage;
  const imageSheetTop = imageSheet.pageTopMm * pxPerMmPage;
  const imageSheetLeft = imageSheet.pageLeftMm * pxPerMmPage;
  const imageSheetTransform = chequeSheetTransformStyle(imageSheet);
  const imageSx = imageSheet.scaleX / 100;
  const imageSy = imageSheet.scaleY / 100;
  const showImageSheet = !isWizardPurpose && Boolean(imageUrl);

  const previewFontPx = useCallback(
    (field, fontStyle, fallbackMm = 3.2) =>
      printFontSizeToPreviewPx(
        field,
        template,
        calib,
        fontStyle,
        pxPerMmSheet,
        fallbackMm,
        layoutFontScale
      ),
    [template, calib, pxPerMmSheet, layoutFontScale]
  );

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
    if (!dateMoveModeProp) setDateMoveModeInternal("split");
    if (fieldItems.length) setSelectedKey(fieldItems[0].key);
  }, [open, isWizardPurpose, fieldItems, dateMoveModeProp]);

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

  const patchImageSheet = useCallback(
    (partial) => {
      onCalibChange?.(
        normalizePrintCalib(
          {
            ...calib,
            imageSheet: { ...imageSheet, ...partial },
          },
          template,
          list
        )
      );
    },
    [calib, imageSheet, list, onCalibChange, template]
  );

  const patchField = useCallback(
    (fieldKey, partial) => {
      onCalibChange?.(
        normalizePrintCalib(
          {
            ...calib,
            fieldOffsets: {
              ...(calib.fieldOffsets || {}),
              [fieldKey]: { ...getStoredFieldOffset(calib, fieldKey), ...partial },
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
      if (mode !== "sheet" && mode !== "imageSheet") return;
      e.preventDefault();
      e.stopPropagation();
      const copy = isWizardPurpose ? copyIndex ?? selectedCopy : null;
      const layout = isWizardPurpose ? wizardCopyLayouts?.[String(copy)] : null;
      const isImage = mode === "imageSheet";
      dragRef.current = {
        kind: isWizardPurpose ? "wizard-sheet" : isImage ? "image-sheet" : "sheet",
        copy,
        startX: e.clientX,
        startY: e.clientY,
        startTop: isWizardPurpose
          ? layout?.pageTopMm ?? 0
          : isImage
          ? imageSheet.pageTopMm
          : calib.pageTopMm,
        startLeft: isWizardPurpose
          ? layout?.pageLeftMm ?? 0
          : isImage
          ? imageSheet.pageLeftMm
          : calib.pageLeftMm,
        pxPerMm: pxPerMmPage,
        calibSnap: calib,
        imageSheetSnap: imageSheet,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (
          !d ||
          (d.kind !== "sheet" &&
            d.kind !== "wizard-sheet" &&
            d.kind !== "image-sheet")
        ) {
          return;
        }
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
        } else if (d.kind === "image-sheet") {
          onCalibChange?.(
            normalizePrintCalib(
              {
                ...d.calibSnap,
                imageSheet: {
                  ...d.imageSheetSnap,
                  pageLeftMm: d.startLeft + dx,
                  pageTopMm: d.startTop + dy,
                },
              },
              template,
              list
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
      imageSheet,
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
      if (mode !== "sheet" && mode !== "imageSheet") return;
      e.preventDefault();
      e.stopPropagation();

      const pageEl = pageRef.current;
      if (!pageEl) return;

      const copy = isWizardPurpose ? copyIndex ?? selectedCopy : null;
      const layout = isWizardPurpose ? wizardCopyLayouts?.[String(copy)] : null;
      const isImage = mode === "imageSheet";
      const localTop = isWizardPurpose
        ? (layout?.pageTopMm ?? 0) * pxPerMmPage
        : isImage
        ? imageSheetTop
        : sheetTop;
      const localLeft = isWizardPurpose
        ? (layout?.pageLeftMm ?? 0) * pxPerMmPage
        : isImage
        ? imageSheetLeft
        : sheetLeft;
      const localW = isWizardPurpose
        ? (layout?.widthMm ?? calib.widthMm) * pxPerMmPage
        : isImage
        ? imageSheetW
        : sheetW;
      const localH = isWizardPurpose
        ? (layout?.heightMm ?? calib.heightMm) * pxPerMmPage
        : isImage
        ? imageSheetH
        : sheetH;

      const pageRect = pageEl.getBoundingClientRect();
      const pivotX = pageRect.left + localLeft;
      const pivotY = pageRect.top + localTop;
      const baseCornerDeg = (Math.atan2(localH, localW) * 180) / Math.PI;
      const startRot = isWizardPurpose
        ? normalizeSheetRotationDeg(layout?.sheetRotationDeg ?? 0)
        : isImage
        ? normalizeSheetRotationDeg(imageSheet.sheetRotationDeg)
        : normalizeSheetRotationDeg(calib.sheetRotationDeg);

      dragRef.current = {
        kind: isWizardPurpose
          ? "wizard-sheet-rotate"
          : isImage
          ? "image-sheet-rotate"
          : "sheet-rotate",
        copy,
        pivotX,
        pivotY,
        baseCornerDeg,
        calibSnap: calib,
        imageSheetSnap: imageSheet,
        startRot,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (
          !d ||
          (d.kind !== "sheet-rotate" &&
            d.kind !== "wizard-sheet-rotate" &&
            d.kind !== "image-sheet-rotate")
        ) {
          return;
        }
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
        } else if (d.kind === "image-sheet-rotate") {
          onCalibChange?.(
            normalizePrintCalib(
              {
                ...d.calibSnap,
                imageSheet: { ...d.imageSheetSnap, sheetRotationDeg: nextRot },
              },
              template,
              list
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
      imageSheetLeft,
      imageSheetTop,
      imageSheetW,
      imageSheetH,
      imageSheet,
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
      const resolved = resolveDragFieldKey(fieldKey);
      setSelectedKey(resolved);
      const { offsetXmm, offsetYmm } = getStoredFieldOffset(calib, resolved);
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
    [mode, calib, pxPerMmSheet, patchField, endDrag, resolveDragFieldKey]
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
                printCalibOnly: true,
                printCalib: wizardPrintCalibPayload(
                  calib,
                  template,
                  list,
                  wizardCopyTotal
                ),
                wizardCalibSource: "shared",
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
        ? normalizeWizardPrintCalib(json.printCalib, template, list, wizardCopyTotal)
        : normalizePrintCalib(json.printCalib, template, list);
      onCalibChange?.(saved);
      onSaved?.(saved, json);
      setSaveMessage(
        isWizardPurpose
          ? "تم حفظ مواضع النسخ — تُستخدم في طباعة الصك"
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
                  : "A4 عرضي — منطقة البيانات وصورة الصك بشكل مستقل"}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">
                {isWizardPurpose
                  ? `اختر نسخة ثم حرّكها أو دوّرها بشكل مستقل (١–${wizardCopyTotal})`
                  : "حرّك منطقة البيانات أو صورة الصك — الصورة تظهر فقط عند طباعة الصك والبيانات معاً"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(MODE_LABELS)
                .filter(([key]) => {
                  if (isWizardPurpose) return key === "sheet";
                  if (key === "imageSheet") return showImageSheet;
                  return true;
                })
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
                <>
                {showImageSheet ? (
                  <div
                    className="absolute overflow-visible"
                    style={{
                      top: imageSheetTop,
                      left: imageSheetLeft,
                      width: imageSheetW,
                      height: imageSheetH,
                      outline:
                        mode === "imageSheet"
                          ? "3px solid #f59e0b"
                          : "2px dashed #fbbf24",
                      boxShadow:
                        mode === "imageSheet"
                          ? "0 0 0 4px rgba(245,158,11,0.25)"
                          : "none",
                      cursor: mode === "imageSheet" ? "move" : "default",
                      zIndex: 5,
                      ...imageSheetTransform,
                    }}
                    onMouseDown={(e) => {
                      if (mode === "imageSheet") startSheetDrag(e);
                    }}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                      style={{
                        backgroundImage: `url(${imageUrl})`,
                        transform: `scale(${imageSx}, ${imageSy})`,
                        transformOrigin: "top left",
                      }}
                    />
                    <div className="pointer-events-none absolute left-1 top-1 rounded bg-amber-600/90 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      صورة الصك
                    </div>
                    {mode === "imageSheet" ? (
                      <>
                        <div
                          role="button"
                          tabIndex={-1}
                          className="absolute -top-8 left-0 z-50 cursor-move rounded bg-amber-500 px-2 py-1 text-[10px] font-extrabold text-white shadow"
                          onMouseDown={startSheetDrag}
                        >
                          ⋮⋮ اسحب صورة الصك
                        </div>
                        <div
                          role="button"
                          tabIndex={-1}
                          title="اسحب لتدوير صورة الصك"
                          className="absolute -bottom-4 -right-4 z-50 flex h-8 w-8 cursor-grab items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-lg active:cursor-grabbing"
                          onMouseDown={startSheetRotate}
                        >
                          <FiRotateCw size={14} />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <div
                  ref={sheetRef}
                  className={`absolute overflow-visible ${showImageSheet ? "bg-transparent" : "bg-white"}`}
                  style={{
                    top: sheetTop,
                    left: sheetLeft,
                    width: sheetW,
                    height: sheetH,
                    outline: mode === "sheet" ? "3px solid #0ea5e9" : "2px solid #0ea5e9",
                    boxShadow:
                      mode === "sheet"
                        ? "0 0 0 4px rgba(14,165,233,0.25)"
                        : showImageSheet
                        ? "none"
                        : "0 0 0 1px rgba(14,165,233,0.35)",
                    cursor: mode === "sheet" ? "move" : "default",
                    zIndex: 10,
                    pointerEvents: mode === "imageSheet" ? "none" : "auto",
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
                      ⋮⋮ اسحب منطقة البيانات
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
                          const slashSelected = mode === "field" && isPrintDateSelected(slashKey);
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
                                fontWeight: slashFontStyle.fontWeight,
                                fontSize: previewFontPx(a || dateField, slashFontStyle),
                                color: slashFontStyle.color,
                                transform: shift
                                  ? `translate(-50%, 0) ${shift}`
                                  : "translate(-50%, 0)",
                                outline: slashSelected
                                  ? "2px dashed #2563eb"
                                  : "1px dashed transparent",
                                background: slashSelected
                                  ? "rgba(37,99,235,0.06)"
                                  : "transparent",
                                pointerEvents: mode === "field" ? "auto" : "none",
                              }}
                              onMouseDown={(e) => startFieldDrag(e, slashKey)}
                              onDoubleClick={() => {
                                if (dateMoveMode === "split") setSelectedKey(slashKey);
                              }}
                            >
                              /
                            </div>
                          );
                        })
                      : null}

                    {staticFields.map((f) => {
                      const val = displayValues?.[f.key];
                      if (val == null || val === "") return null;
                      const isDate = f.type === "datePart";
                      const isAmount = f.type === "amount" || f.key === "amountNumeric";
                      const fontStyle = getFieldFontStyle(
                        calib,
                        isDate ? DATE_GROUP_KEY : f.key,
                        f
                      );
                      const fs = previewFontPx(f, fontStyle);
                      const shift = fieldShiftPx(calib, f.key, pxPerMmSheet);
                      const selected = mode === "field" && isPrintDateSelected(f.key);
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
                          onDoubleClick={() => setSelectedKey(f.key)}
                        >
                          <span
                            style={{
                              fontSize: fs,
                              fontWeight: fontStyle.fontWeight,
                              width: "100%",
                              textAlign: isDate ? datePartTextAlign(f.key) : isAmount ? "left" : "right",
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

                    {amountWordsField && displayValues?.[AMOUNT_WORDS_KEY] ? (
                      <div
                        style={{
                          ...fieldBox(amountWordsField),
                          transform: fieldShiftPx(calib, AMOUNT_WORDS_KEY, pxPerMmSheet),
                          cursor: mode === "field" ? "grab" : "default",
                          outline:
                            mode === "field" && selectedKey === AMOUNT_WORDS_KEY
                              ? "2px dashed #2563eb"
                              : "1px dashed transparent",
                          background:
                            mode === "field" && selectedKey === AMOUNT_WORDS_KEY
                              ? "rgba(37,99,235,0.06)"
                              : "transparent",
                          pointerEvents: mode === "field" ? "auto" : "none",
                        }}
                        onMouseDown={(e) => startFieldDrag(e, AMOUNT_WORDS_KEY)}
                        onDoubleClick={() => setSelectedKey(AMOUNT_WORDS_KEY)}
                      >
                        <span
                          style={{
                            fontSize: previewFontPx(
                              amountWordsField,
                              getFieldFontStyle(calib, AMOUNT_WORDS_KEY, amountWordsField)
                            ),
                            fontWeight: getFieldFontStyle(
                              calib,
                              AMOUNT_WORDS_KEY,
                              amountWordsField
                            ).fontWeight,
                            width: "100%",
                            textAlign: "right",
                            direction: "rtl",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            color: getFieldFontStyle(calib, AMOUNT_WORDS_KEY, amountWordsField)
                              .color,
                          }}
                        >
                          {displayValues[AMOUNT_WORDS_KEY]}
                        </span>
                      </div>
                    ) : null}

                    {amountWordsLine2Field && displayValues?.[AMOUNT_WORDS_LINE2_KEY] ? (
                      <div
                        style={{
                          ...fieldBox(amountWordsLine2Field),
                          transform: fieldShiftPx(calib, AMOUNT_WORDS_LINE2_KEY, pxPerMmSheet),
                          cursor: mode === "field" ? "grab" : "default",
                          outline:
                            mode === "field" && selectedKey === AMOUNT_WORDS_LINE2_KEY
                              ? "2px dashed #2563eb"
                              : "1px dashed transparent",
                          background:
                            mode === "field" && selectedKey === AMOUNT_WORDS_LINE2_KEY
                              ? "rgba(37,99,235,0.06)"
                              : "transparent",
                          pointerEvents: mode === "field" ? "auto" : "none",
                        }}
                        onMouseDown={(e) => startFieldDrag(e, AMOUNT_WORDS_LINE2_KEY)}
                        onDoubleClick={() => setSelectedKey(AMOUNT_WORDS_LINE2_KEY)}
                      >
                        <span
                          style={{
                            fontSize: previewFontPx(
                              amountWordsLine2Field,
                              getFieldFontStyle(
                                calib,
                                amountWordsPrintCalibKey(AMOUNT_WORDS_LINE2_KEY),
                                amountWordsLine2Field
                              )
                            ),
                            fontWeight: getFieldFontStyle(
                              calib,
                              amountWordsPrintCalibKey(AMOUNT_WORDS_LINE2_KEY),
                              amountWordsLine2Field
                            ).fontWeight,
                            width: "100%",
                            textAlign: "right",
                            direction: "rtl",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            color: getFieldFontStyle(
                              calib,
                              amountWordsPrintCalibKey(AMOUNT_WORDS_LINE2_KEY),
                              amountWordsLine2Field
                            ).color,
                          }}
                        >
                          {displayValues[AMOUNT_WORDS_LINE2_KEY]}
                        </span>
                      </div>
                    ) : null}

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
                            fontSize: previewFontPx(
                              textField,
                              getFieldFontStyle(calib, TEXT_KEY, textField)
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
                </>
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
                <>
                <DateMoveModeToggle
                  value={dateMoveMode}
                  onChange={(mode) => {
                    setDateMoveMode(mode);
                    setSelectedKey(
                      mode === "unified" ? DATE_ALL_GROUP_KEY : DATE_GROUP_KEY
                    );
                  }}
                  variant="dark"
                />
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-xs font-extrabold text-white">الحقول</p>
                  <div className="space-y-1">
                    {fieldItems.map(({ key, label, kind }) => (
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
                        <span>
                          {kind === "spacing" ? "↔ " : ""}
                          {label}
                        </span>
                        <span className="tabular-nums text-[10px] text-slate-400">
                          {formatCmFromMm(getStoredFieldOffset(calib, key).offsetXmm)} ×{" "}
                          {formatCmFromMm(getStoredFieldOffset(calib, key).offsetYmm)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                </>
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
                    {selectedKey === DATE_ALL_GROUP_KEY ? (
                      <p className="mt-1 text-[10px] font-semibold text-violet-300">
                        يحرّك أرقام التاريخ والفواصل / معاً — للتباعد الدقيق استخدم ↔ بالقائمة
                      </p>
                    ) : null}
                    {isDateSpacingKey(selectedKey) ? (
                      <p className="mt-1 text-[10px] font-semibold text-violet-300">
                        مسافة هذا الجزء — يُضاف فوق إزاحة مجموعة{" "}
                        {["dateDay", "dateMonth", "dateYear"].includes(selectedKey)
                          ? "الأرقام"
                          : "الشرطات"}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {mode === "sheet" || mode === "imageSheet" ? (
                  <div className="space-y-3">
                    <div
                      className={`rounded-xl border p-3 text-xs font-semibold ${
                        mode === "imageSheet"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                          : "border-sky-500/30 bg-sky-500/10 text-sky-100"
                      }`}
                    >
                      {isWizardPurpose ? (
                        <>
                          النسخة <strong>{selectedCopy}</strong> — اسحب الإطار أو المقبض الدائري.
                          <p className="mt-2 text-sky-200/80">
                            من الأعلى: {formatCmFromMm(activeCopyLayout?.pageTopMm ?? 0)} سم — من
                            اليسار: {formatCmFromMm(activeCopyLayout?.pageLeftMm ?? 0)} سم — زاوية:{" "}
                            {normalizeSheetRotationDeg(activeCopyLayout?.sheetRotationDeg ?? 0)}°
                          </p>
                        </>
                      ) : mode === "imageSheet" ? (
                        <>
                          اسحب إطار صورة الصك — تُطبع مع البيانات فقط (لا تُطبع عند طباعة البيانات
                          وحدها).
                          <p className="mt-2 text-amber-200/80">
                            من الأعلى: {formatCmFromMm(imageSheet.pageTopMm)} سم — من اليسار:{" "}
                            {formatCmFromMm(imageSheet.pageLeftMm)} سم — زاوية:{" "}
                            {normalizeSheetRotationDeg(imageSheet.sheetRotationDeg)}°
                          </p>
                        </>
                      ) : (
                        <>
                          اسحب إطار البيانات — أو المقبض الدائري من الزاوية للتدوير الحر.
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
                            : mode === "imageSheet"
                            ? imageSheet.sheetRotationDeg ?? 0
                            : calib.sheetRotationDeg ?? 0
                        }
                        flipHorizontal={Boolean(
                          isWizardPurpose
                            ? activeCopyLayout?.flipHorizontal
                            : mode === "imageSheet"
                            ? imageSheet.flipHorizontal
                            : calib.flipHorizontal
                        )}
                        flipVertical={Boolean(
                          isWizardPurpose
                            ? activeCopyLayout?.flipVertical
                            : mode === "imageSheet"
                            ? imageSheet.flipVertical
                            : calib.flipVertical
                        )}
                        onRotation={(deg) => {
                          if (isWizardPurpose) patchWizardCopy(selectedCopy, { sheetRotationDeg: deg });
                          else if (mode === "imageSheet") patchImageSheet({ sheetRotationDeg: deg });
                          else patch("sheetRotationDeg", deg);
                        }}
                        onFlipHorizontal={(v) => {
                          if (isWizardPurpose) patchWizardCopy(selectedCopy, { flipHorizontal: v });
                          else if (mode === "imageSheet") patchImageSheet({ flipHorizontal: v });
                          else patch("flipHorizontal", v);
                        }}
                        onFlipVertical={(v) => {
                          if (isWizardPurpose) patchWizardCopy(selectedCopy, { flipVertical: v });
                          else if (mode === "imageSheet") patchImageSheet({ flipVertical: v });
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
