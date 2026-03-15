// /app/vouchers/view/page.jsx
"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { FiPrinter, FiX, FiEdit2, FiSave } from "react-icons/fi";
import { toPng } from "html-to-image";
import { Cairo } from "next/font/google";
import VoucherDateModal from "@/components/VoucherDateModal";
const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

const companies = [
  {
    key: "Al-Ghadeer",
    name: "شركة الغدير",
    logo: "/الغدير.png",
    paymentImg: "/voucher.jpg",
    receiptImg: "/receipt.jpg",
  },
  {
    key: "Badur-Baghdad",
    name: "شركة بدور بغداد",
    logo: "/بدور_بغداد.png",
    paymentImg: "/voucher2.jpg",
    receiptImg: "/receipt2.jpg",
  },
];

const POS = {
  date: { top: 19.2, left: 74.8 },
  amountFixed: { top: 13.6, left: 9.0 },
  currencyUSDBox: { top: 8.0, left: 22.3 },
  currencyIQDBox: { top: 8.0, left: 13.0 },
  amountWords: { top: 37.6, left: -2.0, width: 75.0 },
  description: { top: 53.5, left: 10, width: 80, height: 15.0 },
};

const EXTRA = {
  bank: { top: 70, left: -20, width: 54.2, height: 6.0 },
  fxRate: { top: 20, left: 12.0, width: 30.0, height: 6.0 },
  receivedBy: { top: 29.2, left: 18.8, width: 54.2, height: 6.0 },
  beneficiary: { top: 85.8, left: -20, width: 54.2, height: 6.0 },
  notes: { top: 84.0, left: 50.0, width: 40.2, height: 8.0 },
  cb1: { top: 71.7, left: 81.2 },
  cb2: { top: 71.7, left: 70.3 },
};

const pctStyle = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });
const only2Digits = (val) => String(val || "").replace(/[^\d]/g, "").slice(0, 2);

async function waitForImages(node) {
  if (!node) return;
  const imgs = Array.from(node.querySelectorAll("img"));

  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    })
  );

  await Promise.all(
    imgs.map((img) =>
      typeof img.decode === "function"
        ? img.decode().catch(() => {})
        : Promise.resolve()
    )
  );
}

export default function VoucherViewPage() {
  const { permissions } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const companyKey = searchParams.get("company") || "";
  const mode = searchParams.get("mode") || "payment";
  const id = searchParams.get("id") || "";

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
  const [showDateModal, setShowDateModal] = useState(false);

  const [tmpDate, setTmpDate] = useState({
    yearShort: "",
    month: "",
    day: "",
  });
  const selectedCompany = useMemo(
    () => companies.find((c) => c.key === companyKey) || null,
    [companyKey]
  );

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return mode === "payment"
      ? selectedCompany.paymentImg
      : selectedCompany.receiptImg;
  }, [selectedCompany, mode]);

  const fillForm = useCallback((doc) => {
    if (!doc) return;

    setVoucher(doc);

    setVDateYY(doc?.vDateYY || "");
    setVDateMM(doc?.vDateMM || "");
    setVDateDD(doc?.vDateDD || "");

    setVAmount(String(doc?.vAmount ?? doc?.amount ?? ""));
   setVWords(doc?.amountWords || doc?.vWords || "");
    setVDesc(doc?.vDesc || doc?.description || "");
    setVCurrency(doc?.vCurrency || doc?.currency || "IQD");

    setVBank(doc?.vBank || doc?.bank || "");
    setVFxRate(doc?.vFxRate || "");
    setVReceivedBy(doc?.vReceivedBy || doc?.receivedBy || "");
    setVBeneficiary(doc?.vBeneficiary || doc?.beneficiary || "");
    setVNotes(doc?.vNotes || doc?.notes || "");

    setCbOne(Boolean(doc?.cbOne));
    setCbTwo(Boolean(doc?.cbTwo));

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

      const res = await fetch(
        `/api/vouchers/view?id=${encodeURIComponent(id)}`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

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
  }, [vCurrency, vAmount]);
  const onYYChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateYY(v);
    if (v.length === 2) mmRef.current?.focus();
  };
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
  const onMMChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateMM(v);
    if (v.length === 2) ddRef.current?.focus();
  };

  const cleanAmount = (value) => String(value || "").replace(/[^\d]/g, "");
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
const formatAmountInput = (value) => {
  const digits = cleanAmount(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
};

function numberToArabicWords(num) {
    num = parseInt(String(num).replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(num) || num === 0) return "";
  
    const ones = [
      "",
      "واحد",
      "اثنان",
      "ثلاثة",
      "أربعة",
      "خمسة",
      "ستة",
      "سبعة",
      "ثمانية",
      "تسعة",
    ];
  
    const teens = [
      "عشرة",
      "أحد عشر",
      "اثنا عشر",
      "ثلاثة عشر",
      "أربعة عشر",
      "خمسة عشر",
      "ستة عشر",
      "سبعة عشر",
      "ثمانية عشر",
      "تسعة عشر",
    ];
  
    const tens = [
      "",
      "",
      "عشرون",
      "ثلاثون",
      "أربعون",
      "خمسون",
      "ستون",
      "سبعون",
      "ثمانون",
      "تسعون",
    ];
  
    const hundreds = [
      "",
      "مائة",
      "مائتان",
      "ثلاثمائة",
      "أربعمائة",
      "خمسمائة",
      "ستمائة",
      "سبعمائة",
      "ثمانمائة",
      "تسعمائة",
    ];
  
    function below100(n) {
      if (n < 10) return ones[n];
      if (n === 10) return "عشرة";
      if (n > 10 && n < 20) return teens[n - 10];
      if (n % 10 === 0) return tens[Math.floor(n / 10)];
      return `${ones[n % 10]} و${tens[Math.floor(n / 10)]}`;
    }
  
    function below1000(n) {
      if (n < 100) return below100(n);
  
      const h = Math.floor(n / 100);
      const rest = n % 100;
  
      if (rest === 0) return hundreds[h];
      return `${hundreds[h]} و${below100(rest)}`;
    }
  
    function groupToWords(n, singular, dual, plural) {
      if (n === 0) return "";
      if (n === 1) return singular;
      if (n === 2) return dual;
      if (n >= 3 && n <= 10) return `${below1000(n)} ${plural}`;
      return `${below1000(n)} ${singular}`;
    }
  
    const billions = Math.floor(num / 1000000000);
    const millions = Math.floor((num % 1000000000) / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const rest = num % 1000;
  
    const parts = [];
  
    if (billions) {
      parts.push(groupToWords(billions, "مليار", "ملياران", "مليارات"));
    }
  
    if (millions) {
      parts.push(groupToWords(millions, "مليون", "مليونان", "ملايين"));
    }
  
    if (thousands) {
      parts.push(groupToWords(thousands, "ألف", "ألفان", "آلاف"));
    }
  
    if (rest) {
      parts.push(below1000(rest));
    }
  
    return parts.join(" و");
  }

  

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

  const onDDChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateDD(v);
  };

  const onDateKeyDown = (e, which) => {
    if (e.key !== "Backspace") return;
    if (which === "mm" && !vDateMM) yyRef.current?.focus();
    if (which === "dd" && !vDateDD) mmRef.current?.focus();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const res = await fetch("/api/vouchers/view", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
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
          cbOne,
          cbTwo,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "فشل حفظ التعديلات");
      }

      fillForm(json.data);
      setEditMode(false);
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "VOUCHER_UPDATED",
              payload: {
                id,
                companyKey,
                mode,
              },
            },
            "*"
          );
        }
      } catch (e) {
        console.error("Cannot notify opener:", e);
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
  
            .page {
  width: 210mm;
  height: 297mm;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
  background: #fff;
  padding-top: 5mm;   /* ينزل الوصل لتحت */
}
  
              img {
                width: 210mm;              /* بعدالة بعرض الصفحة */
                height: auto;
                max-height: 297mm;
                display: block;
                object-fit: contain;
                object-position: top center; /* فوك */
              }
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

  if (!Array.isArray(permissions)) return null;
  if (
    !permissions.includes("RECEIPTS") &&
    !permissions.includes("VIEW_REPORTS")
  ) {
    return null;
  }



  return (
    <MotionConfig transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
      <motion.div
        className="min-h-screen px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="rounded-3xl bg-white/80 backdrop-blur-xl px-8 py-7 shadow-xl text-center">
                <div className="w-12 h-12 mx-auto border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                <div className="mt-4 text-base font-extrabold text-gray-900">
                  جاري تحميل الوصل...
                </div>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-full max-w-xl rounded-3xl bg-white/90 backdrop-blur-xl p-8 shadow-xl text-center">
                <div className="text-xl font-extrabold text-red-600 mb-3">
                  تعذر فتح الوصل
                </div>
                <div className="text-gray-700 font-bold mb-6">{error}</div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={fetchVoucher}
                    className="px-5 py-2.5 rounded-2xl bg-gray-900 text-white font-extrabold"
                  >
                    إعادة المحاولة
                  </button>
                  <button
                    onClick={() => {
                      if (window.history.length > 1) router.back();
                      else window.close();
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-red-600 text-white font-extrabold"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          ) : selectedCompany && voucher ? (
            <motion.div
              key="viewer"
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
                        className="
                          flex items-center gap-2
                          px-5 py-2.5
                          rounded-2xl
                          bg-blue-600 text-white
                          shadow-sm
                          font-extrabold
                          hover:bg-blue-700 hover:shadow-md
                          active:scale-[0.97]
                          transition-all duration-150
                        "
                      >
                        <FiEdit2 className="text-lg" />
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="
                          flex items-center gap-2
                          px-5 py-2.5
                          rounded-2xl
                          bg-emerald-600 text-white
                          shadow-sm
                          font-extrabold
                          hover:bg-emerald-700 hover:shadow-md
                          active:scale-[0.97]
                          disabled:opacity-60
                          transition-all duration-150
                        "
                      >
                        <FiSave className={`text-lg ${isSaving ? "animate-spin" : ""}`} />
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    )}

                    <button
                      onClick={printCurrentPreviewA4}
                      disabled={isPrinting || isSaving}
                      className="
                        flex items-center gap-2
                        px-5 py-2.5
                        rounded-2xl
                        bg-white/70 backdrop-blur
                        ring-1 ring-black/5
                        shadow-sm
                        font-extrabold text-gray-800
                        hover:bg-white hover:shadow-md
                        active:scale-[0.97]
                        disabled:opacity-60
                        transition-all duration-150
                      "
                    >
                      <FiPrinter className={`text-lg ${isPrinting ? "animate-spin" : ""}`} />
                      {isPrinting ? "جاري الطباعة..." : "طباعة"}
                    </button>

                    <button
                      onClick={() => {
                        if (editMode) {
                          fillForm(voucher);
                          setEditMode(false);
                          return;
                        }
                        if (window.history.length > 1) router.back();
                        else window.close();
                      }}
                      className="
                        flex items-center gap-2
                        px-5 py-2.5
                        rounded-2xl
                        bg-red-600 text-white
                        shadow-sm
                        font-extrabold
                        hover:bg-red-700 hover:shadow-md
                        active:scale-[0.97]
                        transition-all duration-150
                      "
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
                          className="absolute inset-0 w-full h-full object-contain"
                          draggable={false}
                        />

                        {/* Overlay النصوص */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div
                            className={`absolute flex items-center gap-5 text-gray-900 font-extrabold ${cairo.className}`}
                            style={{ ...pctStyle(POS.date), fontSize: "18px" }}
                          >
                          <span style={{ transform: "translateX(-8px)" }}>
  {vDateYY || fallbackVoucherDate.yy}
</span>
<span>{vDateMM || fallbackVoucherDate.mm}</span>
<span>{vDateDD || fallbackVoucherDate.dd}</span>
                          </div>

                          <div
                            className={`absolute text-gray-900 font-extrabold leading-none ${cairo.className}`}
                            style={{
                              ...pctStyle(
                                vCurrency === "USD"
                                  ? POS.currencyUSDBox
                                  : POS.currencyIQDBox
                              ),
                              fontSize: "18px",
                            }}
                          >
                            ✓
                          </div>

                          {vAmount ? (
                            <div
                              className={`absolute text-gray-900 font-extrabold ${cairo.className}`}
                              style={{ ...pctStyle(POS.amountFixed), fontSize: "16px" }}
                            >
                             {vAmount && !isNaN(Number(String(vAmount).replace(/,/g, "")))
  ? Number(String(vAmount).replace(/,/g, "")).toLocaleString("en-US")
  : ""}
                            </div>
                          ) : null}

                          {vWords ? (
                            <div
                              className={`absolute text-gray-900 font-bold leading-tight ${cairo.className}`}
                              style={{
                                ...pctStyle(POS.amountWords),
                                width: `${POS.amountWords.width}%`,
                                fontSize: "16px",
                                direction: "rtl",
                                textAlign: "right",
                                whiteSpace: "normal",
                              }}
                            >
                              {vWords}
                            </div>
                          ) : null}

                          {vDesc ? (
                            <div
                              className={`absolute text-gray-900 font-bold whitespace-pre-wrap ${cairo.className}`}
                              style={{
                                ...pctStyle(POS.description),
                                width: `${POS.description.width}%`,
                                maxHeight: `${POS.description.height}%`,
                                fontSize: "16px",
                                overflow: "visible",
                                direction: "rtl",
                                textAlign: "right",
                                lineHeight: 1.25,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            >
                              {vDesc}
                            </div>
                          ) : null}

                          {vBank ? (
                            <div
                              className={`absolute text-gray-900 font-bold ${cairo.className}`}
                              style={{
                                ...pctStyle(EXTRA.bank),
                                width: `${EXTRA.bank.width}%`,
                                maxHeight: `${EXTRA.bank.height}%`,
                                fontSize: "16px",
                                overflow: "visible",
                                direction: "rtl",
                                textAlign: "right",
                              }}
                            >
                              {vBank}
                            </div>
                          ) : null}

                          {vFxRate ? (
                            <div
                              className={`absolute text-gray-900 font-bold ${cairo.className}`}
                              style={{
                                ...pctStyle(EXTRA.fxRate),
                                width: `${EXTRA.fxRate.width}%`,
                                maxHeight: `${EXTRA.fxRate.height}%`,
                                fontSize: "16px",
                                overflow: "visible",
                                direction: "ltr",
                                textAlign: "left",
                              }}
                            >
                              {vFxRate}
                            </div>
                          ) : null}

                          {vReceivedBy ? (
                            <div
                              className={`absolute text-gray-900 font-bold ${cairo.className}`}
                              style={{
                                ...pctStyle(EXTRA.receivedBy),
                                width: `${EXTRA.receivedBy.width}%`,
                                maxHeight: `${EXTRA.receivedBy.height}%`,
                                fontSize: "16px",
                                overflow: "visible",
                                direction: "rtl",
                                textAlign: "right",
                              }}
                            >
                              {vReceivedBy}
                            </div>
                          ) : null}

                          {vBeneficiary ? (
                            <div
                              className={`absolute text-gray-900 font-bold ${cairo.className}`}
                              style={{
                                ...pctStyle(EXTRA.beneficiary),
                                width: `${EXTRA.beneficiary.width}%`,
                                maxHeight: `${EXTRA.beneficiary.height}%`,
                                fontSize: "16px",
                                overflow: "visible",
                                direction: "rtl",
                                textAlign: "right",
                              }}
                            >
                              {vBeneficiary}
                            </div>
                          ) : null}

                          {vNotes ? (
                            <div
                              className={`absolute text-gray-900 font-bold whitespace-pre-wrap ${cairo.className}`}
                              style={{
                                ...pctStyle(EXTRA.notes),
                                width: `${EXTRA.notes.width}%`,
                                maxHeight: `${EXTRA.notes.height}%`,
                                fontSize: "16px",
                                overflow: "visible",
                                direction: "rtl",
                                textAlign: "right",
                                lineHeight: 1.25,
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            >
                              {vNotes}
                            </div>
                          ) : null}

                          {cbOne ? (
                            <div
                              className={`absolute text-gray-900 font-extrabold leading-none ${cairo.className}`}
                              style={{ ...pctStyle(EXTRA.cb1), fontSize: "18px" }}
                            >
                              ✓
                            </div>
                          ) : null}

                          {cbTwo ? (
                            <div
                              className={`absolute text-gray-900 font-extrabold leading-none ${cairo.className}`}
                              style={{ ...pctStyle(EXTRA.cb2), fontSize: "18px" }}
                            >
                              ✓
                            </div>
                          ) : null}

                          {voucherNo !== null ? (
                            <div
                              className={`absolute text-gray-900 font-extrabold ${cairo.className}`}
                              style={{
                                top: "24%",
                                left: "46%",
                                fontSize: "20px",
                                direction: "ltr",
                                textAlign: "left",
                                letterSpacing: "1px",
                              }}
                            >
                              NO:{String(voucherNo).padStart(5, "0")}
                            </div>
                          ) : null}
                        </div>

                        {/* Inputs التعديل */}
                        {editMode && (
                          <div className="absolute inset-0">
                            <div
                              className="absolute flex items-center gap-5"
                              style={{ ...pctStyle(POS.date), width: "22%", height: "7%" }}
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
                                  textAlign: "center",
                                  caretColor: "black",
                                  fontFamily: "inherit",
                                  fontSize: "18px",
                                  fontWeight: 800,
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
                                  textAlign: "center",
                                  caretColor: "black",
                                  fontFamily: "inherit",
                                  fontSize: "18px",
                                  fontWeight: 800,
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
                                  textAlign: "center",
                                  caretColor: "black",
                                  fontFamily: "inherit",
                                  fontSize: "18px",
                                  fontWeight: 800,
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setVCurrency("USD")}
                              className="absolute"
                              style={{
                                ...pctStyle(POS.currencyUSDBox),
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
                                ...pctStyle(POS.currencyIQDBox),
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
                                ...pctStyle(POS.amountFixed),
                                width: "22%",
                                height: "7%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "ltr",
                                textAlign: "left",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 800,
                              }}
                            />

                            <input
                              ref={fxRef}
                              value={vFxRate}
                              onChange={(e) => setVFxRate(e.target.value)}
                              className="absolute"
                              style={{
                                ...pctStyle(EXTRA.fxRate),
                                width: `${EXTRA.fxRate.width}%`,
                                height: `${EXTRA.fxRate.height}%`,
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "ltr",
                                textAlign: "left",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 800,
                              }}
                            />

                            <input
                              ref={receivedByRef}
                              value={vReceivedBy}
                              onChange={(e) => setVReceivedBy(e.target.value)}
                              className="absolute"
                              style={{
                                ...pctStyle(EXTRA.receivedBy),
                                width: `${EXTRA.receivedBy.width}%`,
                                height: `${EXTRA.receivedBy.height}%`,
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "rtl",
                                textAlign: "right",
                                unicodeBidi: "plaintext",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 600,
                                lineHeight: 1.25,
                              }}
                            />

                            <textarea
                              ref={wordsRef}
                              value={vWords}
                              onChange={(e) => setVWords(e.target.value)}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(POS.amountWords),
                                width: `${POS.amountWords.width}%`,
                                height: "13%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "rtl",
                                textAlign: "right",
                                unicodeBidi: "plaintext",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 700,
                                lineHeight: 1.25,
                              }}
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
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "rtl",
                                textAlign: "right",
                                unicodeBidi: "plaintext",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 600,
                                lineHeight: 1.25,
                              }}
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
                                style={{ width: "100%", height: "100%", margin: 0 }}
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
                                style={{ width: "100%", height: "100%", margin: 0 }}
                              />
                            </label>

                            <input
                              ref={bankRef}
                              value={vBank}
                              onChange={(e) => setVBank(e.target.value)}
                              className="absolute"
                              style={{
                                ...pctStyle(EXTRA.bank),
                                width: `${EXTRA.bank.width}%`,
                                height: `${EXTRA.bank.height}%`,
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "rtl",
                                textAlign: "right",
                                unicodeBidi: "plaintext",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 700,
                                padding: "0 10px",
                              }}
                            />

                            <input
                              ref={beneficiaryRef}
                              value={vBeneficiary}
                              onChange={(e) => setVBeneficiary(e.target.value)}
                              className="absolute"
                              style={{
                                ...pctStyle(EXTRA.beneficiary),
                                width: `${EXTRA.beneficiary.width}%`,
                                height: `${EXTRA.beneficiary.height}%`,
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "rtl",
                                textAlign: "right",
                                unicodeBidi: "plaintext",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 700,
                              }}
                            />

                            <textarea
                              ref={notesRef}
                              value={vNotes}
                              onChange={(e) => setVNotes(e.target.value)}
                              className="absolute resize-none"
                              style={{
                                ...pctStyle(EXTRA.notes),
                                width: `${EXTRA.notes.width}%`,
                                height: `${EXTRA.notes.height}%`,
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                direction: "rtl",
                                textAlign: "right",
                                unicodeBidi: "plaintext",
                                caretColor: "black",
                                fontFamily: "inherit",
                                fontSize: "16px",
                                fontWeight: 600,
                                lineHeight: 1.25,
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
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <VoucherDateModal
  open={showDateModal}
  tmpDate={tmpDate}
  setTmpDate={setTmpDate}
  only2Digits={only2Digits}
  onClose={() => setShowDateModal(false)}
  onSave={saveDateModal}
/>
      </motion.div>
    </MotionConfig>
  );
}