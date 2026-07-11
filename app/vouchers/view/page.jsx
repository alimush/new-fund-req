"use client";

import { useMemo, useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { FiPrinter, FiX, FiEdit2, FiSave } from "react-icons/fi";
import { toPng } from "html-to-image";
import { Cairo } from "next/font/google";
import VoucherDateModal from "@/components/VoucherDateModal";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
import VoucherColoredText from "@/components/VoucherColoredText";
import { normalizeFieldColorRuns } from "@/lib/voucher/fieldColorRuns";
// Shared imports
import { 
  only2Digits, 
  cleanAmount, 
  formatAmount,
  displayAmount,
  numberToArabicWords, 
  waitForImages 
} from "@/lib/voucher/utils";

import {
  DEFAULT_GLOBAL_TEXT_STYLE,
  DEFAULT_FIELD_STYLES,
  clampFontSize,
  normalizeHexColor,
  normalizeGlobalTextStyle,
  normalizeFieldStyles
} from "@/lib/voucher/styles";

import {
  COMPANIES,
  TEMPLATE_SWITCH_DATE,
  POS_OLD,
  EXTRA_OLD,
  POS_NEW,
  EXTRA_NEW,
} from "@/lib/voucher/companies";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

const pctStyle = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

function buildLegacyStyles(doc) {
  const mainColor = normalizeHexColor(doc?.fontColorMain, "#111827");
  const accentColor = normalizeHexColor(doc?.fontColorAccent, "#111827");

  const amountSize = clampFontSize(doc?.fontSizeAmount, 16);
  const wordsSize = clampFontSize(doc?.fontSizeWords, 16);
  const descSize = clampFontSize(doc?.fontSizeDesc, 16);
  const extraSize = clampFontSize(doc?.fontSizeExtra, 16);

  const global = {
    fontSize: extraSize,
    fontWeight: 700,
    color: accentColor,
  };

  const fields = {
    ...DEFAULT_FIELD_STYLES,
    amount: { fontSize: amountSize, fontWeight: 800, color: mainColor },
    words: { fontSize: wordsSize, fontWeight: 700, color: mainColor },
    desc: { fontSize: descSize, fontWeight: 600, color: mainColor },
    bank: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    fxRate: { fontSize: extraSize, fontWeight: 800, color: accentColor },
    receivedBy: { fontSize: extraSize, fontWeight: 600, color: accentColor },
    beneficiary: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    notes: { fontSize: extraSize, fontWeight: 600, color: accentColor },
    chequeNo: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    nationalId: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    phone: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    sanadNo: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    date: { fontSize: extraSize, fontWeight: 800, color: accentColor },
    voucherNo: { fontSize: extraSize, fontWeight: 800, color: accentColor },
    currencyMark: { fontSize: extraSize, fontWeight: 800, color: accentColor },
  };

  return { global, fields };
}

function buildEffectiveDate(voucher, yy, mm, dd) {
  const y = String(yy || "").trim();
  const m = String(mm || "").trim();
  const d = String(dd || "").trim();

  if (y && m && d) {
    const fullYear = Number(y) >= 50 ? `19${y}` : `20${y}`;
    const dt = new Date(`${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const raw = voucher?.voucherDate || voucher?.createdAt;
  if (!raw) return null;

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function VoucherViewPageContent() {
  const { permissions } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const companyKey = searchParams.get("company") || "";
  const mode = searchParams.get("mode") || "payment";
  const id = searchParams.get("id") || "";
  const isPayment = mode === "payment";

  const paperRef = useRef(null);

  const yyRef = useRef(null);
  const mmRef = useRef(null);
  const ddRef = useRef(null);
  const amountRef = useRef(null);
  const wordsRef = useRef(null);
  const descRef = useRef(null);
  const bankRef = useRef(null);
  const fxRef = useRef(null);
  const receivedByRef = useRef(null);
  const beneficiaryRef = useRef(null);
  const notesRef = useRef(null);

  const chequeNoRef = useRef(null);
  const nationalIdRef = useRef(null);
  const phoneRef = useRef(null);
  const sanadRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);

  const [vDateYY, setVDateYY] = useState("");
  const [vDateMM, setVDateMM] = useState("");
  const [vDateDD, setVDateDD] = useState("");
  const [vAmount, setVAmount] = useState("");
  const [vWords, setVWords] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vCurrency, setVCurrency] = useState("IQD");
  const [vBank, setVBank] = useState("");
  const [vFxRate, setVFxRate] = useState("");
  const [vReceivedBy, setVReceivedBy] = useState("");
  const [vBeneficiary, setVBeneficiary] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [cbOne, setCbOne] = useState(false);
  const [cbTwo, setCbTwo] = useState(false);
  const [voucherNo, setVoucherNo] = useState(null);

  const [vChequeNo, setVChequeNo] = useState("");
  const [vNationalId, setVNationalId] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vSanadNo, setVSanadNo] = useState("");

  const [globalTextStyle, setGlobalTextStyle] = useState(DEFAULT_GLOBAL_TEXT_STYLE);
  const [fieldStyles, setFieldStyles] = useState(DEFAULT_FIELD_STYLES);
  const [fieldColorRuns, setFieldColorRuns] = useState({});

  const [showDateModal, setShowDateModal] = useState(false);
  const [tmpDate, setTmpDate] = useState({
    yearShort: "",
    month: "",
    day: "",
  });

  const selectedCompany = useMemo(
    () => COMPANIES.find((c) => c.key === companyKey) || null,
    [companyKey]
  );

  const fillForm = useCallback((doc) => {
    if (!doc) return;

    setVoucher(doc);

    setVDateYY(doc?.vDateYY || doc?.dateParts?.yy || "");
    setVDateMM(doc?.vDateMM || doc?.dateParts?.mm || "");
    setVDateDD(doc?.vDateDD || doc?.dateParts?.dd || "");

    setVAmount(displayAmount(doc));
    setVWords(doc?.vWords || doc?.amountWords || "");
    setVDesc(doc?.vDesc || doc?.description || "");
    setVCurrency(doc?.vCurrency || doc?.currency || "IQD");

    setVBank(doc?.vBank || doc?.bank || "");
    setVFxRate(doc?.vFxRate || doc?.fxRate || "");
    setVReceivedBy(doc?.vReceivedBy || doc?.receivedBy || "");
    setVBeneficiary(doc?.vBeneficiary || doc?.beneficiary || "");
    setVNotes(doc?.vNotes || doc?.notes || "");

    setCbOne(Boolean(doc?.cbOne));
    setCbTwo(Boolean(doc?.cbTwo));

    setVChequeNo(doc?.vChequeNo || doc?.chequeNo || "");
    setVNationalId(doc?.vNationalId || doc?.nationalId || "");
    setVPhone(doc?.vPhone || doc?.phone || "");
    setVSanadNo(doc?.vSanadNo || doc?.sanadNo || "");

    if (doc?.globalTextStyle || doc?.fieldStyles) {
      const normalizedGlobal = normalizeGlobalTextStyle(doc?.globalTextStyle || {});
      const normalizedFields = normalizeFieldStyles(doc?.fieldStyles || {}, normalizedGlobal);
      setGlobalTextStyle(normalizedGlobal);
      setFieldStyles(normalizedFields);
    } else {
      const legacy = buildLegacyStyles(doc);
      setGlobalTextStyle(legacy.global);
      setFieldStyles(legacy.fields);
    }

    setFieldColorRuns(normalizeFieldColorRuns(doc?.fieldColorRuns || {}));

    setVoucherNo(doc?.seq ?? doc?.voucherNo ?? doc?.number ?? null);
  }, []);

  const fetchVoucher = useCallback(async () => {
    if (!id) {
      setError("بيانات الرابط غير مكتملة.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/vouchers/view?id=${encodeURIComponent(id)}`, {
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "تعذر تحميل بيانات الوصل");
      }

      fillForm(json.data || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل بيانات الوصل");
      setVoucher(null);
    } finally {
      setLoading(false);
    }
  }, [id, fillForm]);

  useEffect(() => {
    fetchVoucher();
  }, [fetchVoucher]);

  useEffect(() => {
    const cleaned = cleanAmount(vAmount);
    if (!cleaned) {
      setVWords("");
      return;
    }

    const currencyText =
      vCurrency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير";

    setVWords(`${numberToArabicWords(cleaned)} ${currencyText}`.trim());
    setFieldColorRuns((prev) => ({ ...prev, words: [] }));
  }, [vAmount, vCurrency]);

  const fallbackVoucherDate = useMemo(() => {
    const raw = voucher?.voucherDate || voucher?.createdAt;
    if (!raw) return { yy: "", mm: "", dd: "" };

    const d = new Date(raw);
    if (isNaN(d.getTime())) return { yy: "", mm: "", dd: "" };

    return {
      yy: String(d.getFullYear()).slice(-2),
      mm: String(d.getMonth() + 1).padStart(2, "0"),
      dd: String(d.getDate()).padStart(2, "0"),
    };
  }, [voucher]);

  const effectiveDate = useMemo(() => {
    const raw = voucher?.voucherDate || voucher?.createdAt;
    if (!raw) return null;
  
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }, [voucher]);
  
  const useOldTemplate = useMemo(() => {
    if (!effectiveDate) return true;
    return effectiveDate < TEMPLATE_SWITCH_DATE;
  }, [effectiveDate]);

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";

    if (useOldTemplate) {
      return isPayment ? selectedCompany.paymentImgJpg : selectedCompany.receiptImgJpg;
    }

    return isPayment ? selectedCompany.paymentImgPng : selectedCompany.receiptImgPng;
  }, [selectedCompany, isPayment, useOldTemplate]);

  const currentPOS = useMemo(() => (useOldTemplate ? POS_OLD : POS_NEW), [useOldTemplate]);
  const currentEXTRA = useMemo(() => (useOldTemplate ? EXTRA_OLD : EXTRA_NEW), [useOldTemplate]);

  const todayYY = fallbackVoucherDate.yy;
  const todayMM = fallbackVoucherDate.mm;
  const todayDD = fallbackVoucherDate.dd;

  const getStyle = useCallback(
    (fieldKey) => {
      const perField = fieldStyles?.[fieldKey] || {};
      return {
        fontSize: perField.fontSize ?? globalTextStyle.fontSize,
        fontWeight: perField.fontWeight ?? globalTextStyle.fontWeight,
        color: perField.color ?? globalTextStyle.color,
      };
    },
    [fieldStyles, globalTextStyle]
  );

  const onYYChange = (e) => {
    if (!editMode) return;
    const v = only2Digits(e.target.value);
    setVDateYY(v);
    if (v.length === 2) mmRef.current?.focus();
  };

  const onMMChange = (e) => {
    if (!editMode) return;
    const v = only2Digits(e.target.value);
    setVDateMM(v);
    if (v.length === 2) ddRef.current?.focus();
  };

  const onDDChange = (e) => {
    if (!editMode) return;
    const v = only2Digits(e.target.value);
    setVDateDD(v);
  };

  const onDateKeyDown = (e, which) => {
    if (!editMode) return;
    if (e.key !== "Backspace") return;
    if (which === "mm" && !vDateMM) yyRef.current?.focus();
    if (which === "dd" && !vDateDD) mmRef.current?.focus();
  };

  const openDateModal = () => {
    const yy = vDateYY || fallbackVoucherDate.yy;
    const mm = vDateMM || fallbackVoucherDate.mm;
    const dd = vDateDD || fallbackVoucherDate.dd;

    setTmpDate({
      yearShort: String(yy || "").padStart(2, "0"),
      month: String(mm || "").padStart(2, "0"),
      day: String(dd || "").padStart(2, "0"),
    });

    setShowDateModal(true);
  };

  const saveDateModal = () => {
    setVDateYY(only2Digits(tmpDate.yearShort).padStart(2, "0"));
    setVDateMM(only2Digits(tmpDate.month).padStart(2, "0"));
    setVDateDD(only2Digits(tmpDate.day).padStart(2, "0"));
    setShowDateModal(false);
  };

  const handleAmountChange = (rawValue) => {
    const cleaned = cleanAmount(rawValue);

    if (!cleaned) {
      setVAmount("");
      setVWords("");
      return;
    }

    const formatted = Number(cleaned).toLocaleString("en-US");
    const currencyText =
      vCurrency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير";

    setVAmount(formatted);
    setVWords(`${numberToArabicWords(cleaned)} ${currencyText}`.trim());
  };

  const guardSetter = (setter) => (value) => {
    if (!editMode) return;
    setter(value);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const payload = {
        id,
        vDateYY,
        vDateMM,
        vDateDD,
        vAmount,
        vWords,
        vDesc,
        vCurrency,
        vBank,
        vFxRate,
        vReceivedBy,
        vBeneficiary,
        vNotes,
        vChequeNo,
        vNationalId,
        vPhone,
        vSanadNo,
        cbOne,
        cbTwo,
        globalTextStyle,
        fieldStyles,
        fieldColorRuns,

        // legacy support
        fontSizeAmount: String(getStyle("amount").fontSize),
        fontSizeWords: String(getStyle("words").fontSize),
        fontSizeDesc: String(getStyle("desc").fontSize),
        fontSizeExtra: String(getStyle("bank").fontSize),
        fontColorMain: getStyle("amount").color,
        fontColorAccent: getStyle("bank").color,
      };

      const res = await fetch("/api/vouchers/view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "فشل حفظ التعديلات");
      }

      fillForm(json.data);
      setEditMode(false);

      try {
        if (window.opener && !window.opener.closed) {
          console.log("🔔 Notifying reports page about update...");
          window.opener.postMessage(
            {
              type: "VOUCHER_UPDATED",
              payload: { id, companyKey, mode },
            },
            "*"
          );
        }
      } catch (e) {
        console.error("⚠️ Cannot notify opener:", e);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل حفظ التعديلات");
    } finally {
      setIsSaving(false);
    }
  };

  const printCurrentPreviewA4 = async () => {
    if (!paperRef.current) return;

    try {
      setIsPrinting(true);

      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      await waitForImages(paperRef.current);

      const dataUrl = await toPng(paperRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const printStyles = `
        .page {
          width: 210mm;
          height: 297mm;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          overflow: hidden;
          background: #fff;
          padding-top: 5mm;
        }

        img {
          width: 210mm;
          height: auto;
          max-height: 297mm;
          display: block;
          object-fit: contain;
          object-position: top center;
        }
      `;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        setIsPrinting(false);
        return;
      }

      doc.open();
      doc.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Print Voucher</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }

              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm;
                height: 297mm;
                overflow: hidden;
                background: #fff;
              }

              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }

              ${printStyles}
            </style>
          </head>
          <body>
            <div class="page">
              <img id="p" />
            </div>

            <script>
              const img = document.getElementById("p");
              img.src = ${JSON.stringify(dataUrl)};

              img.onload = () => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 100);
              };

              window.onafterprint = () => {
                try {
                  parent.postMessage({ type: "IFRAME_PRINT_DONE" }, "*");
                } catch (e) {}
              };
            </script>
          </body>
        </html>
      `);
      doc.close();

      const onMsg = (ev) => {
        if (ev?.data?.type !== "IFRAME_PRINT_DONE") return;

        console.log("✅ Received IFRAME_PRINT_DONE, cleaning up...");
        window.removeEventListener("message", onMsg);

        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 50);

        setIsPrinting(false);
      };

      window.addEventListener("message", onMsg);
    } catch (e) {
      console.error(e);
      alert("تعذر طباعة الوصل.");
      setIsPrinting(false);
    }
  };

  const handleCancel = () => {
    fillForm(voucher);
    setEditMode(false);
  };

  const [imgReady, setImgReady] = useState(false);

  const handleClose = () => {
    if (editMode) {
      handleCancel();
      return;
    }
    if (window.history.length > 1) router.back();
    else window.close();
  };

  const isActuallyLoading = loading || !imgReady;

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa]">
        <div className="font-extrabold text-red-600 text-xl">{error}</div>
        <button 
          onClick={() => router.back()}
          className="px-6 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition shadow-sm"
        >
          العودة للخلف
        </button>
      </div>
    );
  }

  const dateStyle = getStyle("date");
  const amountStyle = getStyle("amount");
  const wordsStyle = getStyle("words");
  const descStyle = getStyle("desc");
  const bankStyle = getStyle("bank");
  const fxRateStyle = getStyle("fxRate");
  const receivedByStyle = getStyle("receivedBy");
  const beneficiaryStyle = getStyle("beneficiary");
  const notesStyle = getStyle("notes");
  const voucherNoStyle = getStyle("voucherNo");
  const currencyMarkStyle = getStyle("currencyMark");

  return (
    <MotionConfig transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className={`min-h-screen bg-[#f8f9fa] ${cairo.className}`}>
        <AnimatePresence mode="wait">
          {isActuallyLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md"
            >
              <div className="relative flex flex-col items-center">
                <div className="relative h-20 w-20">
                  <div className="absolute inset-0 rounded-full border-[3px] border-gray-100" />
                  <motion.div 
                    className="absolute inset-0 rounded-full border-[3px] border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  />
                  <motion.div 
                    className="absolute inset-2 rounded-full border-[2px] border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent"
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
                </div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-6 flex flex-col items-center gap-1"
                >
                  <span className="text-lg font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    جاري تحضير الوصل
                  </span>
                  <span className="text-xs font-bold text-gray-400">يرجى الانتظار لحظات...</span>
                </motion.div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {selectedCompany && voucher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 py-6"
          >
            <motion.div
              key="viewer"
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
            {useOldTemplate ? (
              <motion.div
                key="viewer-old"
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-full max-w-5xl rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.45)] overflow-hidden"
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 18, opacity: 0 }}
                >
                  <div className="flex items-center justify-between px-5 py-4 bg-white/25">
                    <div className="text-sm font-extrabold text-gray-900">
                      {mode === "payment" ? "وصل صرف" : "وصل قبض"} — {selectedCompany.name}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">
                      {!editMode ? (
                        <button
                          onClick={() => setEditMode(true)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white shadow-sm font-extrabold hover:bg-blue-700 hover:shadow-md active:scale-[0.97] transition-all duration-150"
                        >
                          <FiEdit2 className="text-lg" />
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm font-extrabold hover:bg-emerald-700 hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-150"
                        >
                          <FiSave className={`text-lg ${isSaving ? "animate-spin" : ""}`} />
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      )}

                      <button
                        onClick={printCurrentPreviewA4}
                        disabled={isPrinting || isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/70 backdrop-blur ring-1 ring-black/5 shadow-sm font-extrabold text-gray-800 hover:bg-white hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-150"
                      >
                        <FiPrinter className={`text-lg ${isPrinting ? "animate-spin" : ""}`} />
                        {isPrinting ? "جاري الطباعة..." : "طباعة"}
                      </button>

                      <button
                        onClick={() => {
                          if (editMode) {
                            handleCancel();
                            return;
                          }
                          handleClose();
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 text-white shadow-sm font-extrabold hover:bg-red-700 hover:shadow-md active:scale-[0.97] transition-all duration-150"
                      >
                        <FiX className="text-lg" />
                        {editMode ? "Cancel" : "إغلاق"}
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 p-4">
                      <div className="w-full overflow-auto">
                        <div
                          ref={paperRef}
                          className={`relative bg-white rounded-2xl overflow-hidden ring-1 ring-black/5 ${cairo.className}`}
                          style={{ width: "100%", maxWidth: 1200, aspectRatio: "1200/800" }}
                        >
                          <img
                            src={currentImg}
                            alt="voucher"
                            onLoad={() => setImgReady(true)}
                            className="absolute inset-0 w-full h-full object-contain"
                            draggable={false}
                          />

                          <div className="absolute inset-0 pointer-events-none">
                          <div
  className={`absolute ${cairo.className}`}
  style={{
    ...pctStyle(currentPOS.date),
    width: "18%",
    height: "4%",
    fontSize: `${dateStyle.fontSize}px`,
    fontWeight: dateStyle.fontWeight,
    color: dateStyle.color,
  }}
>
  {useOldTemplate ? (
    <>
      <span
        style={{
          position: "absolute",
          left: "-5%",
          top: "8%",
        }}
      >
        {vDateYY || fallbackVoucherDate.yy}
      </span>

      <span
        style={{
          position: "absolute",
          left: "24%",
          top: "4%",
        }}
      >
        {vDateMM || fallbackVoucherDate.mm}
      </span>

      <span
        style={{
          position: "absolute",
          left: "50%",
          top: "4%",
        }}
      >
        {vDateDD || fallbackVoucherDate.dd}
      </span>
    </>
  ) : (
    <div className="grid grid-cols-3 w-full text-center">
      <span>{vDateYY || fallbackVoucherDate.yy}</span>
      <span>{vDateMM || fallbackVoucherDate.mm}</span>
      <span>{vDateDD || fallbackVoucherDate.dd}</span>
    </div>
  )}
</div>

                            <div
                              className={`absolute leading-none ${cairo.className}`}
                              style={{
                                ...pctStyle(
                                  vCurrency === "USD"
                                    ? currentPOS.currencyUSDBox
                                    : currentPOS.currencyIQDBox
                                ),
                                fontSize: `${currencyMarkStyle.fontSize}px`,
                                fontWeight: currencyMarkStyle.fontWeight,
                                color: currencyMarkStyle.color,
                              }}
                            >
                              ✓
                            </div>

                            {vAmount ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentPOS.amountFixed),
                                  fontSize: `${amountStyle.fontSize}px`,
                                  fontWeight: amountStyle.fontWeight,
                                  color: amountStyle.color,
                                }}
                              >
                                {vAmount}
                              </div>
                            ) : null}

                            {vWords ? (
                              <div
                                className={`absolute leading-tight ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentPOS.amountWords),
                                  width: `${currentPOS.amountWords.width}%`,
                                  fontSize: `${wordsStyle.fontSize}px`,
                                  fontWeight: wordsStyle.fontWeight,
                                  direction: "rtl",
                                  textAlign: "right",
                                  whiteSpace: "normal",
                                }}
                              >
                                <VoucherColoredText
                                  text={vWords}
                                  colorRuns={fieldColorRuns?.words}
                                  defaultColor={wordsStyle.color}
                                />
                              </div>
                            ) : null}

                            {vDesc ? (
                              <div
                                className={`absolute whitespace-pre-wrap ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentPOS.description),
                                  width: `${currentPOS.description.width}%`,
                                  maxHeight: `${currentPOS.description.height}%`,
                                  fontSize: `${descStyle.fontSize}px`,
                                  fontWeight: descStyle.fontWeight,
                                  overflow: "visible",
                                  direction: "rtl",
                                  textAlign: "right",
                                  lineHeight: 1.25,
                                  overflowWrap: "anywhere",
                                  wordBreak: "break-word",
                                }}
                              >
                                <VoucherColoredText
                                  text={vDesc}
                                  colorRuns={fieldColorRuns?.desc}
                                  defaultColor={descStyle.color}
                                />
                              </div>
                            ) : null}

                            {vBank ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.bank),
                                  width: `${currentEXTRA.bank.width}%`,
                                  maxHeight: `${currentEXTRA.bank.height}%`,
                                  fontSize: `${bankStyle.fontSize}px`,
                                  fontWeight: bankStyle.fontWeight,
                                  overflow: "visible",
                                  direction: "rtl",
                                  textAlign: "right",
                                }}
                              >
                                <VoucherColoredText
                                  text={vBank}
                                  colorRuns={fieldColorRuns?.bank}
                                  defaultColor={bankStyle.color}
                                />
                              </div>
                            ) : null}

                            {vFxRate ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.fxRate),
                                  width: `${currentEXTRA.fxRate.width}%`,
                                  maxHeight: `${currentEXTRA.fxRate.height}%`,
                                  fontSize: `${fxRateStyle.fontSize}px`,
                                  fontWeight: fxRateStyle.fontWeight,
                                  overflow: "visible",
                                  direction: "ltr",
                                  textAlign: "left",
                                }}
                              >
                                <VoucherColoredText
                                  text={vFxRate}
                                  colorRuns={fieldColorRuns?.fxRate}
                                  defaultColor={fxRateStyle.color}
                                />
                              </div>
                            ) : null}

                            {vReceivedBy ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.receivedBy),
                                  width: `${currentEXTRA.receivedBy.width}%`,
                                  maxHeight: `${currentEXTRA.receivedBy.height}%`,
                                  fontSize: `${receivedByStyle.fontSize}px`,
                                  fontWeight: receivedByStyle.fontWeight,
                                  overflow: "visible",
                                  direction: "rtl",
                                  textAlign: "right",
                                }}
                              >
                                <VoucherColoredText
                                  text={vReceivedBy}
                                  colorRuns={fieldColorRuns?.receivedBy}
                                  defaultColor={receivedByStyle.color}
                                />
                              </div>
                            ) : null}

                            {vBeneficiary ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.beneficiary),
                                  width: `${currentEXTRA.beneficiary.width}%`,
                                  maxHeight: `${currentEXTRA.beneficiary.height}%`,
                                  fontSize: `${beneficiaryStyle.fontSize}px`,
                                  fontWeight: beneficiaryStyle.fontWeight,
                                  overflow: "visible",
                                  direction: "rtl",
                                  textAlign: "right",
                                }}
                              >
                                <VoucherColoredText
                                  text={vBeneficiary}
                                  colorRuns={fieldColorRuns?.beneficiary}
                                  defaultColor={beneficiaryStyle.color}
                                />
                              </div>
                            ) : null}

                            {vNotes ? (
                              <div
                                className={`absolute whitespace-pre-wrap ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.notes),
                                  width: `${currentEXTRA.notes.width}%`,
                                  maxHeight: `${currentEXTRA.notes.height}%`,
                                  fontSize: `${notesStyle.fontSize}px`,
                                  fontWeight: notesStyle.fontWeight,
                                  overflow: "visible",
                                  direction: "rtl",
                                  textAlign: "right",
                                  lineHeight: 1.25,
                                  overflowWrap: "anywhere",
                                  wordBreak: "break-word",
                                }}
                              >
                                <VoucherColoredText
                                  text={vNotes}
                                  colorRuns={fieldColorRuns?.notes}
                                  defaultColor={notesStyle.color}
                                />
                              </div>
                            ) : null}

                            {vPhone && currentEXTRA.phone ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.phone),
                                  width: `${currentEXTRA.phone.width}%`,
                                  fontSize: `${phoneStyle.fontSize}px`,
                                  fontWeight: phoneStyle.fontWeight,
                                  color: phoneStyle.color,
                                  direction: "ltr",
                                  textAlign: "left",
                                }}
                              >
                                {vPhone}
                              </div>
                            ) : null}

                            {vNationalId && currentEXTRA.nationalId ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.nationalId),
                                  width: `${currentEXTRA.nationalId.width}%`,
                                  fontSize: `${nationalIdStyle.fontSize}px`,
                                  fontWeight: nationalIdStyle.fontWeight,
                                  color: nationalIdStyle.color,
                                  direction: "ltr",
                                  textAlign: "left",
                                }}
                              >
                                {vNationalId}
                              </div>
                            ) : null}

                            {vSanadNo && currentEXTRA.sanadNo ? (
                              <div
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.sanadNo),
                                  width: `${currentEXTRA.sanadNo.width}%`,
                                  fontSize: `${sanadNoStyle.fontSize}px`,
                                  fontWeight: sanadNoStyle.fontWeight,
                                  color: sanadNoStyle.color,
                                  direction: "ltr",
                                  textAlign: "left",
                                }}
                              >
                                {vSanadNo}
                              </div>
                            ) : null}

                            {cbOne ? (
                              <div
                                className={`absolute leading-none ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.cb1),
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
                                  ...pctStyle(currentEXTRA.cb2),
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
                                  fontSize: `${voucherNoStyle.fontSize}px`,
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
                          </div>

                          {editMode && (
                            <div className="absolute inset-0">
                              <div
                                className="absolute flex items-center gap-5"
                                style={{ ...pctStyle(currentPOS.date), width: "22%", height: "7%" }}
                              >
                                <input
                                  ref={yyRef}
                                  inputMode="numeric"
                                  value={vDateYY}
                                  onChange={onYYChange}
                                  maxLength={2}
                                  className="h-full"
                                  style={{
                                    width: "28px",
                                    opacity: 0,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                  }}
                                />
                                <input
                                  ref={mmRef}
                                  inputMode="numeric"
                                  value={vDateMM}
                                  onChange={onMMChange}
                                  onKeyDown={(e) => onDateKeyDown(e, "mm")}
                                  maxLength={2}
                                  className="h-full"
                                  style={{
                                    width: "28px",
                                    opacity: 0,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                  }}
                                />
                                <input
                                  ref={ddRef}
                                  inputMode="numeric"
                                  value={vDateDD}
                                  onChange={onDDChange}
                                  onKeyDown={(e) => onDateKeyDown(e, "dd")}
                                  maxLength={2}
                                  className="h-full"
                                  style={{
                                    width: "28px",
                                    opacity: 0,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => setVCurrency("USD")}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentPOS.currencyUSDBox),
                                  width: "7%",
                                  height: "7%",
                                  opacity: 0,
                                }}
                                aria-label="USD"
                              />

                              <button
                                type="button"
                                onClick={() => setVCurrency("IQD")}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentPOS.currencyIQDBox),
                                  width: "7%",
                                  height: "7%",
                                  opacity: 0,
                                }}
                                aria-label="IQD"
                              />

                              <input
                                ref={amountRef}
                                value={vAmount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentPOS.amountFixed),
                                  width: "22%",
                                  height: "7%",
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />

                              <input
                                ref={fxRef}
                                value={vFxRate}
                                onChange={(e) => setVFxRate(e.target.value)}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentEXTRA.fxRate),
                                  width: `${currentEXTRA.fxRate.width}%`,
                                  height: `${currentEXTRA.fxRate.height}%`,
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />

                              <input
                                ref={receivedByRef}
                                value={vReceivedBy}
                                onChange={(e) => setVReceivedBy(e.target.value)}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentEXTRA.receivedBy),
                                  width: `${currentEXTRA.receivedBy.width}%`,
                                  height: `${currentEXTRA.receivedBy.height}%`,
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />

                              <textarea
                                ref={wordsRef}
                                value={vWords}
                                onChange={(e) => setVWords(e.target.value)}
                                className="absolute resize-none"
                                style={{
                                  ...pctStyle(currentPOS.amountWords),
                                  width: `${currentPOS.amountWords.width}%`,
                                  height: "13%",
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />

                              <textarea
                                ref={descRef}
                                value={vDesc}
                                onChange={(e) => setVDesc(e.target.value)}
                                className="absolute resize-none"
                                style={{
                                  ...pctStyle(currentPOS.description),
                                  width: `${currentPOS.description.width}%`,
                                  height: `${currentPOS.description.height}%`,
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />

                              <label
                                className="absolute"
                                style={{
                                  ...pctStyle(currentEXTRA.cb1),
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
                                  style={{ width: "100%", height: "100%", margin: 0 }}
                                />
                              </label>

                              <label
                                className="absolute"
                                style={{
                                  ...pctStyle(currentEXTRA.cb2),
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
                                  style={{ width: "100%", height: "100%", margin: 0 }}
                                />
                              </label>

                              <input
                                ref={bankRef}
                                value={vBank}
                                onChange={(e) => setVBank(e.target.value)}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentEXTRA.bank),
                                  width: `${currentEXTRA.bank.width}%`,
                                  height: `${currentEXTRA.bank.height}%`,
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />
 
                              {currentEXTRA.phone && (
                                <input
                                  ref={phoneRef}
                                  value={vPhone}
                                  onChange={(e) => setVPhone(e.target.value)}
                                  className="absolute"
                                  style={{
                                    ...pctStyle(currentEXTRA.phone),
                                    width: `${currentEXTRA.phone.width}%`,
                                    height: "3%",
                                    opacity: 0,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                  }}
                                />
                              )}
 
                              {currentEXTRA.nationalId && (
                                <input
                                  ref={nationalIdRef}
                                  value={vNationalId}
                                  onChange={(e) => setVNationalId(e.target.value)}
                                  className="absolute"
                                  style={{
                                    ...pctStyle(currentEXTRA.nationalId),
                                    width: `${currentEXTRA.nationalId.width}%`,
                                    height: "3%",
                                    opacity: 0,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                  }}
                                />
                              )}
 
                              {currentEXTRA.sanadNo && (
                                <input
                                  ref={sanadRef}
                                  value={vSanadNo}
                                  onChange={(e) => setVSanadNo(e.target.value)}
                                  className="absolute"
                                  style={{
                                    ...pctStyle(currentEXTRA.sanadNo),
                                    width: `${currentEXTRA.sanadNo.width}%`,
                                    height: "3%",
                                    opacity: 0,
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                  }}
                                />
                              )}

                              <input
                                ref={beneficiaryRef}
                                value={vBeneficiary}
                                onChange={(e) => setVBeneficiary(e.target.value)}
                                className="absolute"
                                style={{
                                  ...pctStyle(currentEXTRA.beneficiary),
                                  width: `${currentEXTRA.beneficiary.width}%`,
                                  height: `${currentEXTRA.beneficiary.height}%`,
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />

                              <textarea
                                ref={notesRef}
                                value={vNotes}
                                onChange={(e) => setVNotes(e.target.value)}
                                className="absolute resize-none"
                                style={{
                                  ...pctStyle(currentEXTRA.notes),
                                  width: `${currentEXTRA.notes.width}%`,
                                  height: `${currentEXTRA.notes.height}%`,
                                  opacity: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-extrabold text-gray-700">
                          {editMode
                            ? "وضع التعديل مفعل"
                            : mode === "payment"
                            ? "عرض وصل صرف"
                            : "عرض وصل قبض"}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {editMode && (
                            <>
                              <button
                                type="button"
                                onClick={openDateModal}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                تعديل التاريخ
                              </button>
                              <button
                                type="button"
                                onClick={() => amountRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                مبلغ
                              </button>
                              <button
                                type="button"
                                onClick={() => wordsRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                مبلغ بالحروف
                              </button>
                              <button
                                type="button"
                                onClick={() => descRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                وصف
                              </button>
                              <button
                                type="button"
                                onClick={() => fxRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                سعر الصرف
                              </button>
                              <button
                                type="button"
                                onClick={() => receivedByRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                استلمت من
                              </button>
                              <button
                                type="button"
                                onClick={() => bankRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                بنك
                              </button>
                              <button
                                type="button"
                                onClick={() => beneficiaryRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                مستفيد
                              </button>
                              <button
                                type="button"
                                onClick={() => notesRef.current?.focus()}
                                className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                              >
                                ملاحظات
                              </button>
                            </>
                          )}

                          <div className="px-4 py-2 rounded-2xl bg-white/70 ring-1 ring-black/5 font-extrabold text-gray-800">
                            الشركة: {selectedCompany.name}
                          </div>

                          <div className="px-4 py-2 rounded-2xl bg-white/70 ring-1 ring-black/5 font-extrabold text-gray-800">
                            الرقم: {voucherNo !== null ? String(voucherNo).padStart(5, "0") : "-"}
                          </div>

                          <div className="px-4 py-2 rounded-2xl bg-white/70 ring-1 ring-black/5 font-extrabold text-gray-800">
                            العملة: {vCurrency || "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <VoucherDateModal
                    open={showDateModal}
                    tmpDate={tmpDate}
                    setTmpDate={setTmpDate}
                    only2Digits={only2Digits}
                    onClose={() => setShowDateModal(false)}
                    onSave={saveDateModal}
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="viewer-new"
                className="relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
              

              <VoucherCanvasDialog
  open={true}
  onClose={handleClose}
  onPrintOnly={printCurrentPreviewA4}
  isPrinting={isPrinting || isSaving}
  selectedCompany={selectedCompany}
  hasBeenCreated={true}
  printOnlyButtonText="طباعة"
  printingOnlyButtonText="جاري الطباعة..."
  isPayment={isPayment}
  isViewPage={true}
  editMode={editMode}
  onToggleEdit={() => setEditMode((prev) => !prev)}
  onSave={handleSave}
  isSaving={isSaving}
  paperRef={paperRef}
  currentImg={currentImg}
  POS={currentPOS}
  EXTRA={currentEXTRA}
  vDateYY={vDateYY}
  vDateMM={vDateMM}
  vDateDD={vDateDD}
  todayYY={todayYY}
  todayMM={todayMM}
  todayDD={todayDD}
  vCurrency={vCurrency}
  vAmount={vAmount}
  vWords={vWords}
  vDesc={vDesc}
  vBank={vBank}
  vFxRate={vFxRate}
  vReceivedBy={vReceivedBy}
  vBeneficiary={vBeneficiary}
  vNotes={vNotes}
  cbOne={cbOne}
  cbTwo={cbTwo}
  voucherNo={voucherNo}
  yyRef={yyRef}
  mmRef={mmRef}
  ddRef={ddRef}
  amountRef={amountRef}
  wordsRef={wordsRef}
  descRef={descRef}
  fxRef={fxRef}
  receivedByRef={receivedByRef}
  bankRef={bankRef}
  beneficiaryRef={beneficiaryRef}
  notesRef={notesRef}
  onYYChange={onYYChange}
  onMMChange={onMMChange}
  onDDChange={onDDChange}
  onDateKeyDown={onDateKeyDown}
  setVCurrency={guardSetter(setVCurrency)}
  setVAmount={guardSetter(setVAmount)}
  setVWords={guardSetter(setVWords)}
  setVDesc={guardSetter(setVDesc)}
  setVFxRate={guardSetter(setVFxRate)}
  setVReceivedBy={guardSetter(setVReceivedBy)}
  setVBank={guardSetter(setVBank)}
  setVBeneficiary={guardSetter(setVBeneficiary)}
  setVNotes={guardSetter(setVNotes)}
  setCbOne={guardSetter(setCbOne)}
  setCbTwo={guardSetter(setCbTwo)}
  vChequeNo={vChequeNo}
  chequeNoRef={chequeNoRef}
  setVChequeNo={guardSetter(setVChequeNo)}
  vNationalId={vNationalId}
  vPhone={vPhone}
  vSanadNo={vSanadNo}
  nationalIdRef={nationalIdRef}
  phoneRef={phoneRef}
  sanadRef={sanadRef}
  setVNationalId={guardSetter(setVNationalId)}
  setVPhone={guardSetter(setVPhone)}
  setVSanadNo={guardSetter(setVSanadNo)}
  cleanAmount={cleanAmount}
  formatAmount={formatAmount}
  globalTextStyle={globalTextStyle}
  setGlobalTextStyle={guardSetter(setGlobalTextStyle)}
  fieldStyles={fieldStyles}
  setFieldStyles={guardSetter(setFieldStyles)}
  fieldColorRuns={fieldColorRuns}
  setFieldColorRuns={guardSetter(setFieldColorRuns)}
  onImageLoad={() => setImgReady(true)}
/>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
      </div>
    </MotionConfig>
  );
}

export default function VoucherViewPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center font-bold text-slate-600" dir="rtl">
          جاري التحميل…
        </div>
      }
    >
      <VoucherViewPageContent />
    </Suspense>
  );
}