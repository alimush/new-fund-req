"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPrinter,
  FiX,
  FiType,
  FiBold,
  FiMinus,
  FiPlus,
  FiEdit2,
  FiSave,
} from "react-icons/fi";import { Cairo } from "next/font/google";
import VoucherDateModal from "@/components/VoucherDateModal";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

const pctStyle = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

const DEFAULT_GLOBAL_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const DEFAULT_FIELD_STYLES = {
  amount: { fontSize: 16, fontWeight: 800, color: "#111827" },
  words: { fontSize: 16, fontWeight: 700, color: "#111827" },
  desc: { fontSize: 16, fontWeight: 600, color: "#111827" },
  bank: { fontSize: 16, fontWeight: 700, color: "#111827" },
  fxRate: { fontSize: 16, fontWeight: 800, color: "#111827" },
  receivedBy: { fontSize: 16, fontWeight: 600, color: "#111827" },
  beneficiary: { fontSize: 16, fontWeight: 700, color: "#111827" },
  notes: { fontSize: 16, fontWeight: 600, color: "#111827" },
  chequeNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  nationalId: { fontSize: 16, fontWeight: 700, color: "#111827" },
  phone: { fontSize: 16, fontWeight: 700, color: "#111827" },
  sanadNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  date: { fontSize: 16, fontWeight: 800, color: "#111827" },
  voucherNo: { fontSize: 16, fontWeight: 800, color: "#111827" },
  currencyMark: { fontSize: 16, fontWeight: 800, color: "#111827" },
};

const clampFontSize = (v, fallback = 16) => {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  return Math.max(8, Math.min(72, Number(n)));
};

const clampFontWeight = (v, fallback = 700) => {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  const num = Number(n);
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  return steps.reduce((prev, curr) =>
    Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
  );
};

const normalizeColor = (v, fallback = "#111827") => {
  const s = String(v || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(s) ? s : fallback;
};

export default function VoucherCanvasDialog({
  open,
  onClose,
  onPrint,
  isPrinting,
  selectedCompany,
  isPayment,
  paperRef,
  currentImg,
  POS,
  EXTRA,
  editMode = false,
  onToggleEdit,
  onSave,
  isSaving = false,
  isViewPage = false,

  vDateYY,
  vDateMM,
  vDateDD,
  todayYY,
  todayMM,
  todayDD,
  printButtonText = "إنشاء وطباعة",
  printingButtonText = "جاري الإنشاء والطباعة...",
  hasBeenCreated = false,
  onCreate,
  onPrintOnly,
  createButtonText = "إنشاء",
  creatingButtonText = "جاري الإنشاء...",
  printOnlyButtonText = "طباعة",
  printingOnlyButtonText = "جاري الطباعة...",

  vCurrency,
  vAmount,
  vWords,
  vDesc,
  vBank,
  vFxRate,
  vReceivedBy,
  vBeneficiary,
  vNotes,
  cbOne,
  cbTwo,
  voucherNo,

  yyRef,
  mmRef,
  ddRef,
  amountRef,
  wordsRef,
  descRef,
  fxRef,
  receivedByRef,
  bankRef,
  beneficiaryRef,
  notesRef,

  onYYChange,
  onMMChange,
  onDDChange,
  onDateKeyDown,

  setVCurrency,
  setVAmount,
  setVWords,
  setVDesc,
  setVFxRate,
  setVReceivedBy,
  setVBank,
  setVBeneficiary,
  setVNotes,
  setCbOne,
  setCbTwo,

  vChequeNo,
  chequeNoRef,
  setVChequeNo,

  vNationalId,
  vPhone,
  vSanadNo,

  nationalIdRef,
  phoneRef,
  sanadRef,

  setVNationalId,
  setVPhone,
  setVSanadNo,

  cleanAmount,
  formatAmount,

  globalTextStyle = DEFAULT_GLOBAL_TEXT_STYLE,
  setGlobalTextStyle,
  fieldStyles = DEFAULT_FIELD_STYLES,
  setFieldStyles,
  onImageLoad,
}) {
  const [selectedField, setSelectedField] = useState(null);

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [tmpDate, setTmpDate] = useState({
    yearShort: vDateYY || todayYY || "",
    month: vDateMM || todayMM || "",
    day: vDateDD || todayDD || "",
  });

  const only2Digits = (value) => String(value || "").replace(/\D/g, "").slice(0, 2);

  const openDateModal = () => {
    setTmpDate({
      yearShort: vDateYY || todayYY || "",
      month: vDateMM || todayMM || "",
      day: vDateDD || todayDD || "",
    });
    setDateModalOpen(true);
  };

  const saveDateModal = () => {
    onYYChange?.({ target: { value: tmpDate.yearShort } });
    onMMChange?.({ target: { value: tmpDate.month } });
    onDDChange?.({ target: { value: tmpDate.day } });
    setDateModalOpen(false);
  };

  const fieldLabels = useMemo(
    () => ({
      date: "التاريخ",
      amount: "المبلغ",
      words: "المبلغ بالحروف",
      desc: "الوصف",
      bank: "البنك",
      fxRate: "سعر الصرف",
      receivedBy: "استلمت من",
      beneficiary: "المستفيد",
      notes: "الملاحظات",
      chequeNo: "رقم الشيك",
      nationalId: "البطاقة الوطنية",
      phone: "رقم الهاتف",
      sanadNo: "رقم السند",
      voucherNo: "رقم الوصل",
      currencyMark: "علامة العملة",
    }),
    []
  );

  const allFieldKeys = useMemo(() => Object.keys(fieldStyles || {}), [fieldStyles]);

  const getStyle = (fieldKey) => {
    const perField = fieldStyles?.[fieldKey] || {};
    return {
      fontSize: clampFontSize(perField.fontSize, globalTextStyle.fontSize),
      fontWeight: clampFontWeight(perField.fontWeight, globalTextStyle.fontWeight),
      color: normalizeColor(perField.color, globalTextStyle.color),
    };
  };

  const mergeFieldTextStyle = (fieldKey, extra = {}) => {
    const s = getStyle(fieldKey);
    return {
      background: "transparent",
      border: "none",
      outline: "none",
      caretColor: s.color,
      fontFamily: "inherit",
      color: s.color,
      lineHeight: 1.25,
      resize: "none",
      overflow: "hidden",
      fontSize: `${s.fontSize}px`,
      fontWeight: s.fontWeight,
      ...extra,
    };
  };

  const setFieldFontSize = (fieldKey, size) => {
    setFieldStyles((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev?.[fieldKey] || {}),
        fontSize: clampFontSize(size, 16),
      },
    }));
  };

  const setFieldFontWeight = (fieldKey, weight) => {
    setFieldStyles((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev?.[fieldKey] || {}),
        fontWeight: clampFontWeight(weight, 700),
      },
    }));
  };

  const setFieldColor = (fieldKey, color) => {
    setFieldStyles((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev?.[fieldKey] || {}),
        color: normalizeColor(color, "#111827"),
      },
    }));
  };

  const applyToAllFields = () => {
    if (!selectedField) return;
    const current = getStyle(selectedField);

    setGlobalTextStyle({
      fontSize: current.fontSize,
      fontWeight: current.fontWeight,
      color: current.color,
    });

    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = {
          ...(next[key] || {}),
          fontSize: current.fontSize,
          fontWeight: current.fontWeight,
          color: current.color,
        };
      });
      return next;
    });
  };

  const setAllFontSize = (size) => {
    const numeric = clampFontSize(size, 16);
    setGlobalTextStyle((prev) => ({ ...prev, fontSize: numeric }));
    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...(next[key] || {}), fontSize: numeric };
      });
      return next;
    });
  };

  const setAllFontWeight = (weight) => {
    const numeric = clampFontWeight(weight, 700);
    setGlobalTextStyle((prev) => ({ ...prev, fontWeight: numeric }));
    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...(next[key] || {}), fontWeight: numeric };
      });
      return next;
    });
  };

  const setAllColor = (color) => {
    const normalized = normalizeColor(color, "#111827");
    setGlobalTextStyle((prev) => ({ ...prev, color: normalized }));
    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...(next[key] || {}), color: normalized };
      });
      return next;
    });
  };

  const nudgeSelectedSize = (diff) => {
    if (!selectedField) return;
    const current = getStyle(selectedField).fontSize;
    const next = Math.max(8, Math.min(72, current + diff));
    setFieldFontSize(selectedField, next);
  };

  const nudgeSelectedWeight = (diff) => {
    if (!selectedField) return;
    const current = getStyle(selectedField).fontWeight;
    const next = Math.max(100, Math.min(900, current + diff));
    setFieldFontWeight(selectedField, next);
  };

  const oneLineRtl = (fieldKey) =>
    mergeFieldTextStyle(fieldKey, {
      textAlign: "right",
      whiteSpace: "nowrap",
    });

  const oneLineLtr = (fieldKey) =>
    mergeFieldTextStyle(fieldKey, {
      textAlign: "left",
      whiteSpace: "nowrap",
    });

  const multiLineRtl = (fieldKey) =>
    mergeFieldTextStyle(fieldKey, {
      textAlign: "right",
    });

  const editableFieldProps = (fieldKey) => ({
    onFocus: () => setSelectedField(fieldKey),
    onClick: () => setSelectedField(fieldKey),
  });

  if (!selectedCompany) return null;

  const dateStyle = getStyle("date");
  const currencyMarkStyle = getStyle("currencyMark");
  const voucherNoStyle = getStyle("voucherNo");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/40 p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="min-h-full flex items-start justify-center py-4 sm:py-6">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[1180px] rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.45)]"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
            >
              <div className="flex items-center justify-between px-5 py-4 bg-white/25">
                <div className="text-sm font-extrabold text-gray-900">
                  {isPayment ? "وصل صرف" : "وصل قبض"} — {selectedCompany.name}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                {isViewPage && !editMode ? (
  <button
    onClick={onToggleEdit}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white shadow-sm font-extrabold hover:bg-blue-700 hover:shadow-md active:scale-[0.97] transition-all duration-150"
  >
    <FiEdit2 className="text-lg" />
    Edit
  </button>
) : isViewPage && editMode ? (
  <button
    onClick={onSave}
    disabled={isSaving}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm font-extrabold hover:bg-emerald-700 hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-150"
  >
    <FiSave className={`text-lg ${isSaving ? "animate-spin" : ""}`} />
    {isSaving ? "Saving..." : "Save"}
  </button>
) : null}

  <button
    onClick={() => {
      if (!hasBeenCreated) {
        onCreate?.();
      } else {
        onPrintOnly?.();
      }
    }}
    disabled={isPrinting}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/70 backdrop-blur ring-1 ring-black/5 shadow-sm font-extrabold text-gray-800 hover:bg-white hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-150"
  >
    <FiPrinter className={`text-lg ${isPrinting ? "animate-spin" : ""}`} />
    {!hasBeenCreated
      ? isPrinting
        ? creatingButtonText || "جاري الإنشاء..."
        : createButtonText || "إنشاء"
      : isPrinting
      ? printingOnlyButtonText || "جاري الطباعة..."
      : printOnlyButtonText || "طباعة"}
  </button>

  <button
    onClick={() => onClose?.()}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 text-white shadow-sm font-extrabold hover:bg-red-700 hover:shadow-md active:scale-[0.97] transition-all duration-150"
  >
    <FiX className="text-lg" />
    إغلاق
  </button>
</div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
                  <div className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 p-4">
                    <div className="w-full">
                      <div
                        ref={paperRef}
                        className={`relative bg-white overflow-hidden ${cairo.className}`}
                        style={{
                          width: "210mm",
                          height: "297mm",
                          margin: "0 auto",
                        }}
                      >
                        <img
                          src={currentImg}
                          alt="voucher"
                          onLoad={onImageLoad}
                          draggable={false}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "fill",
                            objectPosition: "top center",
                            userSelect: "none",
                            pointerEvents: "none",
                          }}
                        />

                        <div
                          className={`absolute leading-none ${cairo.className}`}
                          style={{
                            ...pctStyle(vCurrency === "USD" ? POS.currencyUSDBox : POS.currencyIQDBox),
                            fontSize: `${currencyMarkStyle.fontSize}px`,
                            fontWeight: currencyMarkStyle.fontWeight,
                            color: currencyMarkStyle.color,
                          }}
                        >
                          ✓
                        </div>

                        <div
                          className={`absolute flex items-center gap-2 text-white font-extrabold ${cairo.className}`}
                          style={{ ...pctStyle(POS.date), fontSize: "12px" }}
                        >
                          <span style={{ transform: "translateX(-12px)" }}>{vDateYY || todayYY}</span>
                          <span style={{ transform: "translateX(-2px)" }}>{vDateMM || todayMM}</span>
                          <span style={{ transform: "translateX(1px)" }}>{vDateDD || todayDD}</span>
                        </div>

                        {cbOne ? (
                          <div
                            className={`absolute leading-none ${cairo.className}`}
                            style={{
                              ...pctStyle(EXTRA.cb1),
                              fontSize: `${currencyMarkStyle.fontSize}px`,
                              fontWeight: currencyMarkStyle.fontWeight,
                              color: currencyMarkStyle.color,
                            }}
                          >
                            ✓
                          </div>
                        ) : null}

                        {cbTwo ? (
                          <div
                            className={`absolute leading-none ${cairo.className}`}
                            style={{
                              ...pctStyle(EXTRA.cb2),
                              fontSize: `${currencyMarkStyle.fontSize}px`,
                              fontWeight: currencyMarkStyle.fontWeight,
                              color: currencyMarkStyle.color,
                            }}
                          >
                            ✓
                          </div>
                        ) : null}

                        {voucherNo !== null ? (
                          <div
                            className={`absolute ${cairo.className}`}
                            style={{
                              top: "12.9%",
                              left: "39.5%",
                              fontSize: "12px",
                              fontWeight: voucherNoStyle.fontWeight,
                              direction: "ltr",
                              textAlign: "left",
                              letterSpacing: "1px",
                              color: voucherNoStyle.color,
                            }}
                          >
                            NO:{String(voucherNo).padStart(5, "0")}
                          </div>
                        ) : null}

                        <div className="absolute inset-0">
                          <div
                            className="absolute flex items-center gap-5"
                            style={{ ...pctStyle(POS.date), width: "22%", height: "7%" }}
                          >
                            <textarea
                              ref={yyRef}
                              inputMode="numeric"
                              value={vDateYY}
                              onChange={onYYChange}
                              maxLength={2}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="h-full resize-none"
                              style={{
                                width: "28px",
                                height: "100%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                              }}
                              dir="rtl"
                            />

                            <textarea
                              ref={mmRef}
                              inputMode="numeric"
                              value={vDateMM}
                              onChange={onMMChange}
                              maxLength={2}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                onDateKeyDown?.(e, "mm");
                              }}
                              className="h-full resize-none"
                              style={{
                                width: "28px",
                                height: "100%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                              }}
                              dir="rtl"
                            />

                            <textarea
                              ref={ddRef}
                              inputMode="numeric"
                              value={vDateDD}
                              onChange={onDDChange}
                              maxLength={2}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                onDateKeyDown?.(e, "dd");
                              }}
                              className="h-full resize-none"
                              style={{
                                width: "28px",
                                height: "100%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                              }}
                              dir="rtl"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => setVCurrency("USD")}
                            className="absolute"
                            style={{ ...pctStyle(POS.currencyUSDBox), width: "7%", height: "7%", opacity: 0 }}
                            aria-label="USD"
                          />
                          <button
                            type="button"
                            onClick={() => setVCurrency("IQD")}
                            className="absolute"
                            style={{ ...pctStyle(POS.currencyIQDBox), width: "7%", height: "7%", opacity: 0 }}
                            aria-label="IQD"
                          />

                          <textarea
                            ref={receivedByRef}
                            value={vReceivedBy}
                            onChange={(e) => setVReceivedBy(e.target.value)}
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(EXTRA.receivedBy),
                              width: `${EXTRA.receivedBy.width}%`,
                              height: `${EXTRA.receivedBy.height}%`,
                              ...oneLineRtl("receivedBy"),
                            }}
                            dir="rtl"
                            {...editableFieldProps("receivedBy")}
                          />

                          {EXTRA.nationalId ? (
                            <textarea
                              ref={nationalIdRef}
                              value={vNationalId}
                              onChange={(e) => setVNationalId(e.target.value)}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(EXTRA.nationalId),
                                width: `${EXTRA.nationalId.width}%`,
                                height: `${EXTRA.nationalId.height}%`,
                                ...oneLineRtl("nationalId"),
                              }}
                              dir="rtl"
                              {...editableFieldProps("nationalId")}
                            />
                          ) : null}

                          {EXTRA.phone ? (
                            <textarea
                              ref={phoneRef}
                              value={vPhone}
                              onChange={(e) => setVPhone(e.target.value)}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(EXTRA.phone),
                                width: `${EXTRA.phone.width}%`,
                                height: `${EXTRA.phone.height}%`,
                                ...oneLineRtl("phone"),
                              }}
                              dir="rtl"
                              {...editableFieldProps("phone")}
                            />
                          ) : null}

                          {EXTRA.sanadNo ? (
                            <textarea
                              ref={sanadRef}
                              value={vSanadNo}
                              onChange={(e) => setVSanadNo(e.target.value)}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(EXTRA.sanadNo),
                                width: `${EXTRA.sanadNo.width}%`,
                                height: `${EXTRA.sanadNo.height}%`,
                                ...oneLineRtl("sanadNo"),
                              }}
                              dir="rtl"
                              {...editableFieldProps("sanadNo")}
                            />
                          ) : null}

                          <textarea
                            ref={wordsRef}
                            value={vWords}
                            onChange={(e) => setVWords(e.target.value)}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(POS.amountWords),
                              width: `${POS.amountWords.width}%`,
                              height: "13%",
                              ...multiLineRtl("words"),
                            }}
                            dir="rtl"
                            {...editableFieldProps("words")}
                          />

                          <textarea
                            ref={descRef}
                            value={vDesc}
                            onChange={(e) => setVDesc(e.target.value)}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(POS.description),
                              width: `${POS.description.width}%`,
                              height: `${POS.description.height}%`,
                              ...multiLineRtl("desc"),
                            }}
                            dir="rtl"
                            {...editableFieldProps("desc")}
                          />

                          <textarea
                            ref={bankRef}
                            value={vBank}
                            onChange={(e) => setVBank(e.target.value)}
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(EXTRA.bank),
                              width: `${EXTRA.bank.width}%`,
                              height: `${EXTRA.bank.height}%`,
                              ...oneLineRtl("bank"),
                            }}
                            dir="rtl"
                            {...editableFieldProps("bank")}
                          />

                          {EXTRA.beneficiary ? (
                            <textarea
                              ref={beneficiaryRef}
                              value={vBeneficiary}
                              onChange={(e) => setVBeneficiary(e.target.value)}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(EXTRA.beneficiary),
                                width: `${EXTRA.beneficiary.width}%`,
                                height: `${EXTRA.beneficiary.height}%`,
                                ...oneLineRtl("beneficiary"),
                              }}
                              dir="rtl"
                              {...editableFieldProps("beneficiary")}
                            />
                          ) : null}

                          {EXTRA.chequeNo ? (
                            <textarea
                              ref={chequeNoRef}
                              value={vChequeNo}
                              onChange={(e) => setVChequeNo(e.target.value)}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(EXTRA.chequeNo),
                                width: `${EXTRA.chequeNo.width}%`,
                                height: `${EXTRA.chequeNo.height}%`,
                                ...oneLineLtr("chequeNo"),
                              }}
                              dir="ltr"
                              {...editableFieldProps("chequeNo")}
                            />
                          ) : null}

                          <textarea
                            ref={notesRef}
                            value={vNotes}
                            onChange={(e) => setVNotes(e.target.value)}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(EXTRA.notes),
                              width: `${EXTRA.notes.width}%`,
                              height: `${EXTRA.notes.height}%`,
                              ...multiLineRtl("notes"),
                            }}
                            dir="rtl"
                            {...editableFieldProps("notes")}
                          />

                          <textarea
                            ref={amountRef}
                            value={vAmount}
                            onChange={(e) => {
                              const cleaned = cleanAmount(e.target.value);
                              if (!cleaned) {
                                setVAmount("");
                                return;
                              }
                              setVAmount(formatAmount(cleaned));
                            }}
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(POS.amountFixed),
                              width: "22%",
                              height: "7%",
                              ...oneLineLtr("amount"),
                            }}
                            dir="ltr"
                            {...editableFieldProps("amount")}
                          />

                          <textarea
                            ref={fxRef}
                            value={vFxRate}
                            onChange={(e) => setVFxRate(e.target.value)}
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(EXTRA.fxRate),
                              width: `${EXTRA.fxRate.width}%`,
                              height: `${EXTRA.fxRate.height}%`,
                              ...oneLineLtr("fxRate"),
                            }}
                            dir="ltr"
                            {...editableFieldProps("fxRate")}
                          />

                          <label
                            className="absolute"
                            style={{
                              ...pctStyle(EXTRA.cb1),
                              width: "3%",
                              height: "3%",
                              opacity: 0,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={cbOne}
                              onChange={(e) => setCbOne(e.target.checked)}
                              style={{ width: "100%", height: "100%", margin: 0, cursor: "pointer" }}
                            />
                          </label>

                          <label
                            className="absolute"
                            style={{
                              ...pctStyle(EXTRA.cb2),
                              width: "3%",
                              height: "3%",
                              opacity: 0,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={cbTwo}
                              onChange={(e) => setCbTwo(e.target.checked)}
                              style={{ width: "100%", height: "100%", margin: 0, cursor: "pointer" }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={openDateModal}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل تاريخ
                          </button>

                          <button
                            type="button"
                            onClick={() => amountRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل مبلغ
                          </button>

                          {chequeNoRef ? (
                            <button
                              type="button"
                              onClick={() => chequeNoRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل رقم الشيك
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => wordsRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل مبلغ بالحروف
                          </button>

                          {nationalIdRef ? (
                            <button
                              type="button"
                              onClick={() => nationalIdRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل البطاقة الوطنية
                            </button>
                          ) : null}

                          {phoneRef ? (
                            <button
                              type="button"
                              onClick={() => phoneRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل رقم الهاتف
                            </button>
                          ) : null}

                          {sanadRef ? (
                            <button
                              type="button"
                              onClick={() => sanadRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل رقم السند
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => descRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل وصف
                          </button>

                          <button
                            type="button"
                            onClick={() => fxRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل سعر الصرف
                          </button>

                          <button
                            type="button"
                            onClick={() => receivedByRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل استلمت من
                          </button>

                          <button
                            type="button"
                            onClick={() => bankRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل بنك
                          </button>

                          {beneficiaryRef ? (
                            <button
                              type="button"
                              onClick={() => beneficiaryRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل مستفيد
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => notesRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل ملاحظات
                          </button>

                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticky top-4 rounded-3xl bg-white/55 backdrop-blur-2xl ring-1 ring-white/30 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-gray-900 font-extrabold">
                      <FiType />
                      أدوات النص
                    </div>

                    <div className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3 mb-4">
                      <div className="text-xs text-gray-500 mb-1">الحقل المحدد</div>
                      <div className="font-extrabold text-gray-900">
                        {selectedField ? fieldLabels[selectedField] : "ما محدد"}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3 mb-4">
                      <div className="font-extrabold text-gray-900 mb-3">تعديل الحقل المحدد</div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>حجم الخط</span>
                          <span>{selectedField ? getStyle(selectedField)?.fontSize : "-"} px</span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => nudgeSelectedSize(-1)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiMinus />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeSelectedSize(1)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiPlus />
                          </button>
                        </div>

                        <input
                          type="range"
                          min="8"
                          max="72"
                          step="1"
                          value={selectedField ? getStyle(selectedField)?.fontSize : 16}
                          disabled={!selectedField}
                          onChange={(e) => selectedField && setFieldFontSize(selectedField, e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>سماكة الخط</span>
                          <span>{selectedField ? getStyle(selectedField)?.fontWeight : "-"}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => nudgeSelectedWeight(-100)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiMinus />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeSelectedWeight(100)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiBold />
                          </button>
                        </div>

                        <input
                          type="range"
                          min="100"
                          max="900"
                          step="100"
                          value={selectedField ? getStyle(selectedField)?.fontWeight : 700}
                          disabled={!selectedField}
                          onChange={(e) => selectedField && setFieldFontWeight(selectedField, e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>لون الخط</span>
                          <span
                            className="inline-block w-6 h-6 rounded border border-gray-300"
                            style={{
                              backgroundColor: selectedField
                                ? getStyle(selectedField)?.color || "#111827"
                                : "#111827",
                            }}
                          />
                        </div>

                        <input
                          type="color"
                          value={selectedField ? getStyle(selectedField)?.color || "#111827" : "#111827"}
                          disabled={!selectedField}
                          onChange={(e) => selectedField && setFieldColor(selectedField, e.target.value)}
                          className="w-full h-10 rounded-xl border border-black/10 bg-white cursor-pointer disabled:opacity-40"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={applyToAllFields}
                        disabled={!selectedField}
                        className="mt-4 w-full px-4 py-2.5 rounded-2xl bg-gray-900 text-white font-extrabold disabled:opacity-40"
                      >
                        تطبيق إعدادات الحقل على الكل
                      </button>
                    </div>

                    <div className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3">
                      <div className="font-extrabold text-gray-900 mb-3">تعديل كل الانبتات</div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>حجم الخط العام</span>
                          <span>{globalTextStyle.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="72"
                          step="1"
                          value={globalTextStyle.fontSize}
                          onChange={(e) => setAllFontSize(e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>سماكة الخط العامة</span>
                          <span>{globalTextStyle.fontWeight}</span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="900"
                          step="100"
                          value={globalTextStyle.fontWeight}
                          onChange={(e) => setAllFontWeight(e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>اللون العام</span>
                          <span
                            className="inline-block w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: globalTextStyle.color }}
                          />
                        </div>
                        <input
                          type="color"
                          value={globalTextStyle.color}
                          onChange={(e) => setAllColor(e.target.value)}
                          className="w-full h-10 rounded-xl border border-black/10 bg-white cursor-pointer"
                        />
                      </div>

                      <div className="mt-4 text-xs text-gray-600 leading-6">
                        اضغط على أي حقل داخل الوصل، وبعدها عدّل الحجم أو السماكة أو اللون من هنا.
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white/60 ring-1 ring-black/5 p-3">
                      <div className="text-sm font-extrabold text-gray-900 mb-2">الحقول</div>
                      <div className="flex flex-wrap gap-2">
                        {allFieldKeys.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedField(key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                              selectedField === key
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-800 ring-1 ring-black/5"
                            }`}
                          >
                            {fieldLabels[key] || key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <VoucherDateModal
                open={dateModalOpen}
                tmpDate={tmpDate}
                setTmpDate={setTmpDate}
                only2Digits={only2Digits}
                onClose={() => setDateModalOpen(false)}
                onSave={saveDateModal}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}