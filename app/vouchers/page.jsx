"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { FiPrinter, FiX } from "react-icons/fi";
import { toPng } from "html-to-image";
import { Cairo } from "next/font/google";
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

// ✅ نفس POS
const POS = {
  date: { top: 19.2, left: 74.8 },
  amountFixed: { top: 13.6, left: 9.0 },
  currencyUSDBox: { top: 8.0, left: 22.3 },
  currencyIQDBox: { top: 8.0, left: 13.0 },
  amountWords: { top: 37.6, left: -2.0, width: 75.0 },
  description: { top: 53.5, left: 10, width: 80, height: 15.0 },
};

// ✅ حقول جديدة (غيّر top/left حسب مكانها في صورة الوصل)
const EXTRA = {
  bank: { top: 70, left: -20, width: 54.2, height: 6.0 }, // على بنك
  fxRate: { top: 20, left: 12.0, width: 30.0, height: 6.0 }, // سعر الصرف
  receivedBy: { top: 29.2, left: 18.8, width: 54.2, height: 6.0 }, // استلم السيد
  beneficiary: { top: 85.8, left: -20, width: 54.2, height: 6.0 }, // المستفيد
  notes: { top: 84.0, left: 50.0, width: 40.2, height: 8.0 }, // ملاحظات (قد تحتاج تقللها)
  cb1: { top: 71.7, left: 81.2 }, // شيك بوكس 1
  cb2: { top: 71.7, left: 70.3 }, // شيك بوكس 2
};

const pctStyle = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });
const only2Digits = (val) => String(val || "").replace(/[^\d]/g, "").slice(0, 2);

function cleanAmount(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function formatAmount(value) {
  const cleaned = cleanAmount(value);
  if (!cleaned) return "";
  return Number(cleaned).toLocaleString("en-US");
}

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
      typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve()
    )
  );
}

export default function VoucherPage() {
  // ✅ صلاحية الدخول
  const { permissions } = usePermissions();
  const router = useRouter();

  const checkedOnceRef = useRef(false);

  useEffect(() => {
    if (!Array.isArray(permissions)) return;
    if (checkedOnceRef.current) return;
    checkedOnceRef.current = true;
  
    const ok = permissions.includes("RECEIPTS");
    if (!ok) router.replace("/home");
  }, [permissions, router]);

  if (!Array.isArray(permissions)) return null;
  if (!permissions.includes("RECEIPTS")) return null;

  const [selectedKey, setSelectedKey] = useState(null);
  const selectedCompany = useMemo(
    () => companies.find((c) => c.key === selectedKey) || null,
    [selectedKey]
  );

  // ✅ مودال واحد للـ صرف + قبض
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("payment"); // "payment" | "receipt"
  const isPayment = mode === "payment";

  // ✅ بيانات تكتبها أنت داخل الصورة
  const [vDateYY, setVDateYY] = useState(""); // سنة (رقمين)
  const [vDateMM, setVDateMM] = useState(""); // شهر (رقمين)
  const [vDateDD, setVDateDD] = useState(""); // يوم (رقمين)

  const [vAmount, setVAmount] = useState("");
  const [vWords, setVWords] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vCurrency, setVCurrency] = useState("IQD"); // IQD / USD

  // ✅ حقول جديدة (مبينة هسه — بعدين تخليها opacity:0 مثل القديمة)
  const [vBank, setVBank] = useState("");
  const [vFxRate, setVFxRate] = useState("");
  const [vReceivedBy, setVReceivedBy] = useState("");
  const [vBeneficiary, setVBeneficiary] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [voucherNo, setVoucherNo] = useState(null);

  // ✅ شيك بوكسين
  const [cbOne, setCbOne] = useState(false);
  const [cbTwo, setCbTwo] = useState(false);

  // ✅ لإظهار "خط التحديد" على مكان الكتابة
  const [activeField, setActiveField] = useState(""); // "date" | "amount" | "words" | "desc" ...
  const [isPrinting, setIsPrinting] = useState(false);

  // refs للتركيز والتنقل
  const yyRef = useRef(null);
  const mmRef = useRef(null);
  const ddRef = useRef(null);
  const amountRef = useRef(null);
  const wordsRef = useRef(null);
  const descRef = useRef(null);

  // ✅ refs جديدة
  const bankRef = useRef(null);
  const fxRef = useRef(null);
  const receivedByRef = useRef(null);
  const beneficiaryRef = useRef(null);
  const notesRef = useRef(null);
  const today = new Date();

const todayYY = String(today.getFullYear()).slice(-2);
const todayMM = String(today.getMonth() + 1).padStart(2, "0");
const todayDD = String(today.getDate()).padStart(2, "0");

  // ✅ هذا هو اللي نطبع منه (صورة واحدة حتى ما يخربط XY)
  const paperRef = useRef(null);
  useEffect(() => {
    const cleaned = cleanAmount(vAmount);
  
    if (!cleaned) {
      setVWords("");
      return;
    }
  
    const words = numberToArabicWords(cleaned);
    const currencyText =
      vCurrency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير";
  
    setVWords(words ? `${words} ${currencyText}` : "");
  }, [vAmount, vCurrency]);
  // ✅ كل ما تتغير الشركة صفّر القيم
  useEffect(() => {
    setOpenModal(false);
    setMode("payment");

    setVDateYY("");
    setVDateMM("");
    setVDateDD("");

    setVAmount("");
    setVWords("");
    setVDesc("");
    setVCurrency("IQD");

    // ✅ reset الحقول الجديدة
    setVBank("");
    setVFxRate("");
    setVReceivedBy("");
    setVBeneficiary("");
    setVNotes("");

    setCbOne(false);
    setCbTwo(false);

    setActiveField("");
    setIsPrinting(false);
  }, [selectedKey]);

  // ✅ تاريخ: تنقل تلقائي
  const onYYChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateYY(v);
    setActiveField("date");
    if (v.length === 2) mmRef.current?.focus();
  };
  const onMMChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateMM(v);
    setActiveField("date");
    if (v.length === 2) ddRef.current?.focus();
  };
  const onDDChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateDD(v);
    setActiveField("date");
  };

  const onDateKeyDown = (e, which) => {
    if (e.key !== "Backspace") return;
    if (which === "mm" && !vDateMM) yyRef.current?.focus();
    if (which === "dd" && !vDateDD) mmRef.current?.focus();
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

  // ✅ طباعة (صورة وحدة من preview) حتى XY ما يتخربط
  // ✅ طباعة (تفتح Tab جديد + تطبع + تسد التاب + ترجع للتاب الاصلي + تسد البوب اب بدون refresh)
  async function saveVoucherAndPrint() {
    try {
      if (!selectedCompany) {
        alert("اختَر شركة أولاً");
        return;
      }
  
      setIsPrinting(true);
      setActiveField("");
  
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyKey: selectedCompany.key,
          companyName: selectedCompany.name,
          mode,
  
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
  
      const data = await res.json();
  
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "فشل إنشاء الوصل");
      }
  
      // خلي الرقم يظهر على المعاينة
      setVoucherNo(data.data.seq);
  
      // انتظر رندرة خفيفة حتى الرقم يثبت
      await new Promise((r) => setTimeout(r, 150));
  
      await printCurrentPreviewA4();
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر إنشاء الوصل");
      setIsPrinting(false);
    }
  }

  // ✅ فتح مودال صرف
  const openPayment = () => {
    if (!selectedCompany) return;
    setMode("payment");
    setOpenModal(true);
    setActiveField("date");
    setTimeout(() => yyRef.current?.focus(), 50);
  };

  // ✅ فتح مودال قبض
  const openReceipt = () => {
    if (!selectedCompany) return;
    setMode("receipt");
    setOpenModal(true);
    setActiveField("date");
    setTimeout(() => yyRef.current?.focus(), 50);
  };

  // ✅ أنيميشن خفيف وسريع
  const t = { dur: 0.18, ease: [0.2, 0.8, 0.2, 1] };
  const wrap = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: t.dur, ease: t.ease } },
  };
  const list = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
  };
  const card = {
    hidden: { opacity: 0, y: 10, scale: 0.995 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: t.dur, ease: t.ease } },
  };
  const panel = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: t.dur, ease: t.ease } },
    exit: { opacity: 0, y: 8, transition: { duration: 0.12, ease: t.ease } },
  };
  const resetForm = () => {
    setVoucherNo(null);
  
    setVDateYY("");
    setVDateMM("");
    setVDateDD("");
  
    setVAmount("");
    setVWords("");
    setVDesc("");
    setVCurrency("IQD");
  
    setVBank("");
    setVFxRate("");
    setVReceivedBy("");
    setVBeneficiary("");
    setVNotes("");
  
    setCbOne(false);
    setCbTwo(false);
  
    setActiveField("");
  };
  const CompanyCard = ({ company }) => {
    const active = selectedKey === company.key;

    return (
      <motion.button
        type="button"
        variants={card}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.995 }}
        onClick={() => setSelectedKey(company.key)}
        className={[
          "w-full text-right rounded-[28px] p-7 outline-none",
          "bg-white/70 backdrop-blur ring-1 ring-black/5 shadow-sm",
          "hover:shadow-md",
          active ? "ring-2 ring-black/20" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-5">
          <div className="h-16 w-16 rounded-3xl bg-white ring-1 ring-black/10 shadow-sm overflow-hidden flex items-center justify-center">
            <img
              src={company.logo}
              alt={company.name}
              className="h-full w-full object-contain p-2.5"
              draggable={false}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-lg font-extrabold text-gray-900 truncate">{company.name}</div>
            <div className="text-sm font-semibold text-gray-600 mt-1">
              اضغط للاختيار ثم اطبع وصل صرف أو قبض
            </div>

            <AnimatePresence>
              {active && (
                <motion.div
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-black/5 px-3.5 py-1.5 text-xs font-extrabold text-gray-800"
                >
                  ✅ تم اختيار الشركة
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-12 w-12 rounded-3xl bg-black text-white flex items-center justify-center font-black">
            ›
          </div>
        </div>
      </motion.button>
    );
  };

  const ActionButton = ({ title, subtitle, onClick }) => {
    if (!selectedCompany) return null;

    return (
      <motion.button
        type="button"
        onClick={onClick}
        variants={card}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.995 }}
        className={[
          "w-full rounded-[28px] p-7 text-right outline-none",
          "bg-white/80 backdrop-blur ring-1 ring-black/5 shadow-sm",
          "hover:shadow-md",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-5">
          <div className="h-14 w-14 rounded-3xl bg-gray-50 ring-1 ring-black/10 shadow-sm overflow-hidden flex items-center justify-center">
            <img
              src={selectedCompany.logo}
              alt={selectedCompany.name}
              className="h-full w-full object-contain p-2.5"
              draggable={false}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-base font-extrabold text-gray-900">{title}</div>
            <div className="text-sm font-semibold text-gray-600 mt-1">{subtitle}</div>
          </div>

          <div className="h-12 w-12 rounded-3xl bg-gray-900 text-white flex items-center justify-center">
            🖨️
          </div>
        </div>
      </motion.button>
    );
  };

  // ✅ مربع/خط التحديد (ينظهر فوق مكان الإدخال)
  const Highlight = ({ style, kind = "box" }) => {
    if (isPrinting) return null;
    return (
      <div className="absolute pointer-events-none" style={{ ...style, zIndex: 50 }}>
        {kind === "line" ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "8%",
              height: 2,
              background: "rgba(0,0,0,0.65)",
              borderRadius: 999,
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "2px solid rgba(0,0,0,0.55)",
              borderRadius: 14,
              boxShadow: "0 0 0 3px rgba(255,255,255,0.55) inset",
            }}
          />
        )}
      </div>
    );
  };

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return isPayment ? selectedCompany.paymentImg : selectedCompany.receiptImg;
  }, [selectedCompany, isPayment]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: t.dur, ease: t.ease }}>
      <motion.div variants={wrap} initial="hidden" animate="show" className="min-h-screen px-5 py-10">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div variants={panel} initial="hidden" animate="show" className="mb-8 flex items-center justify-between gap-3">
            <div className="text-right">
              <div className="text-3xl font-extrabold text-gray-900">إدارة الوصولات</div>
              <div className="text-base font-semibold text-gray-600 mt-2">
                اختر الشركة ثم اطبع وصل صرف / قبض بحجم A5
              </div>
            </div>

            <div className="h-12 w-12 rounded-3xl bg-white/70 ring-1 ring-black/5 shadow-sm flex items-center justify-center font-black text-gray-900">
              V
            </div>
          </motion.div>

          {/* Companies */}
          <motion.div variants={list} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2">
            {companies.map((company) => (
              <CompanyCard key={company.key} company={company} />
            ))}
          </motion.div>

          {/* Actions */}
          <div className="mt-7">
            <AnimatePresence mode="wait" initial={false}>
              {!selectedCompany ? (
                <motion.div
                  key="hint"
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="text-center text-base font-bold text-gray-700"
                >
                  👆 اختَر شركة حتى تظهر أزرار الطباعة
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="rounded-[30px] bg-white/70 backdrop-blur ring-1 ring-black/5 shadow-sm p-6"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-base font-extrabold text-gray-900">
                      الشركة المختارة: <span className="font-black">{selectedCompany.name}</span>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.995 }}
                      className="text-xs font-bold px-4 py-2.5 rounded-2xl bg-white hover:bg-gray-50 ring-1 ring-black/5"
                    >
                      تغيير الشركة
                    </motion.button>
                  </div>

                  <motion.div variants={list} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2">
                    <ActionButton
                      title="وصل صرف"
                      subtitle="يفتح بوب أب وتكتب داخل الوصل ثم تطبع (A5)"
                      onClick={openPayment}
                    />
                    <ActionButton
                      title="وصل قبض"
                      subtitle="يفتح بوب أب نفس الإدخالات ثم تطبع (A5)"
                      onClick={openReceipt}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* =======================
            ✅ Modal
           ======================= */}
        <AnimatePresence>
          {openModal && selectedCompany && (
            <motion.div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenModal(false)}
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-5xl rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.45)] overflow-hidden"
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 18, opacity: 0 }}
              >
                <div className="flex items-center justify-between px-5 py-4 bg-white/25">
                  <div className="text-sm font-extrabold text-gray-900">
                    {isPayment ? "وصل صرف" : "وصل قبض"} — {selectedCompany.name}
                  </div>

                  <div className="flex items-center gap-3">
                  <button
  onClick={saveVoucherAndPrint}
  disabled={isPrinting}
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
  {isPrinting ? "جاري الإنشاء والطباعة..." : "إنشاء وطباعة"}
</button>

                    <button
  onClick={() => {
    resetForm();     // 🧹 يمسح كلشي
    setOpenModal(false);  // ❌ يسد المودال
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
  إغلاق
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

                        {/* ✅ Overlay (يبين النص) */}
                        <div className="absolute inset-0 pointer-events-none">
  {/* التاريخ */}
  <div
  className={`absolute flex items-center gap-5 text-gray-900 font-extrabold ${cairo.className}`}
  style={{ ...pctStyle(POS.date), fontSize: "18px" }}
>
<span style={{ transform: "translateX(-8px)" }}>{vDateYY || todayYY}</span>
<span>{vDateMM || todayMM}</span>
<span>{vDateDD || todayDD}</span>
</div>

  {/* ✓ العملة */}
  <div
    className={`absolute text-gray-900 font-extrabold leading-none ${cairo.className}`}
    style={{
      ...pctStyle(vCurrency === "USD" ? POS.currencyUSDBox : POS.currencyIQDBox),
      fontSize: "18px",
    }}
  >
    ✓
  </div>

  {/* المبلغ */}
  {vAmount ? (
    <div
  className={`absolute text-gray-900 font-extrabold ${cairo.className}`}
  style={{ ...pctStyle(POS.amountFixed), fontSize: "16px" }}
>
{vAmount && !isNaN(Number(vAmount.replace(/,/g, "")))
  ? Number(vAmount.replace(/,/g, "")).toLocaleString("en-US")
  : ""}
</div>
  ) : null}

  {/* بالحروف */}
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

  {/* الوصف */}
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

  {/* ✅ الحقول الجديدة */}
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

  {/* ✅ شيك بوكسين (علامة ✓) */}
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
    {mode === "payment" ? "NO:" : "NO:"}
    {String(voucherNo).padStart(5, "0")}
  </div>
) : null}
</div>

                        {/* ✅ Inputs داخل الصورة (مبينة هسه) */}
                        <div className="absolute inset-0">
  {/* =======================
      1) تاريخ (يمين فوق)
     ======================= */}
  <div
    className="absolute flex items-center gap-5"
    style={{ ...pctStyle(POS.date), width: "22%", height: "7%" }}
    onMouseDown={() => setActiveField("date")}
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

  {/* =======================
      2) العملة (فوك يسار)
     ======================= */}
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

  {/* =======================
      3) المبلغ رقمًا (يسار فوق)
     ======================= */}
<input
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

  {/* =======================
      4) سعر الصرف (تحت المبلغ رقمًا)
     ======================= */}
  <input
    ref={fxRef}
    value={vFxRate}
    onChange={(e) => setVFxRate(e.target.value)}
    className="absolute"
    placeholder="سعر الصرف"
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

  {/* =======================
      5) استلمت من السيد/ة (يمين)
     ======================= */}
     
  <input
    ref={receivedByRef}
    value={vReceivedBy}
    onChange={(e) => setVReceivedBy(e.target.value)}
    className="absolute"
    placeholder="استلمت من السيد/ة"
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

  {/* =======================
      6) مبلغًا وقدره فقط (سطر الحروف)
     ======================= */}
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

  {/* =======================
      7) وذلك عن (المربع الكبير/الوصف)
     ======================= */}
  <textarea
    ref={descRef}
    value={vDesc}
    onChange={(e) => setVDesc(e.target.value)}
    dir="rtl"
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

  {/* =======================
      8) بموجب (نقداً / شيك) — شيك بوكسين
     ======================= */}
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

  {/* =======================
      9) على بنك (يسار تحت)
     ======================= */}
  <input
    ref={bankRef}
    value={vBank}
    onChange={(e) => setVBank(e.target.value)}
    className="absolute"
    placeholder="على بنك"
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

  {/* =======================
      10) المستفيد (يسار تحت)
     ======================= */}
  <input
    ref={beneficiaryRef}
    value={vBeneficiary}
    onChange={(e) => setVBeneficiary(e.target.value)}
    className="absolute"
    placeholder="المستفيد"
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

  {/* =======================
      11) ملاحظات (المربع اليمين تحت)
     ======================= */}
  <textarea
    ref={notesRef}
    value={vNotes}
    onChange={(e) => setVNotes(e.target.value)}
    className="absolute resize-none"
    placeholder="ملاحظات"
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
                      </div>
                    </div>

                    {/* مساعدات */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      

                      <div className="flex items-center gap-2">
                        

                        <div className="flex flex-wrap items-center gap-2">

<button
  type="button"
  onClick={() => yyRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف تاريخ
</button>

<button
  type="button"
  onClick={() => amountRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف مبلغ
</button>

<button
  type="button"
  onClick={() => wordsRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف مبلغ بالحروف
</button>

<button
  type="button"
  onClick={() => descRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف وصف
</button>

<button
  type="button"
  onClick={() => fxRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف سعر الصرف
</button>

<button
  type="button"
  onClick={() => receivedByRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف استلمت من
</button>

<button
  type="button"
  onClick={() => bankRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف بنك
</button>

<button
  type="button"
  onClick={() => beneficiaryRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف مستفيد
</button>

<button
  type="button"
  onClick={() => notesRef.current?.focus()}
  className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
>
  أضف ملاحظات
</button>
<button
  type="button"
  onClick={() => {
    setVDateYY("");
    setVDateMM("");
    setVDateDD("");
    setVAmount("");
    setVWords("");
    setVDesc("");
    setVCurrency("IQD");

    setVBank("");
    setVFxRate("");
    setVReceivedBy("");
    setVBeneficiary("");
    setVNotes("");
    setCbOne(false);
    setCbTwo(false);

    setActiveField("date");
    yyRef.current?.focus();
  }}
  className="
    px-5 py-2.5
    rounded-2xl
    bg-red-50
    text-red-600
    ring-1 ring-red-200
    font-extrabold
    shadow-sm
    hover:bg-red-100
    hover:ring-red-300
    active:scale-[0.96]
    transition-all duration-150
  "
>
  🗑️ مسح البيانات
</button>

</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}