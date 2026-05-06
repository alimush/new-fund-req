"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { toPng } from "html-to-image";
import { POS, EXTRA } from "@/components/voucherConfig";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
import {
  FiPrinter,
  FiChevronRight,
  FiFileText,
  FiArrowUpCircle,
  FiArrowDownCircle,
} from "react-icons/fi";

// Shared imports
import { 
  only2Digits, 
  cleanAmount, 
  formatAmount, 
  numberToArabicWords, 
  waitForImages 
} from "@/lib/voucher/utils";

import {
  DEFAULT_GLOBAL_TEXT_STYLE,
  DEFAULT_FIELD_STYLES
} from "@/lib/voucher/styles";

import {
  COMPANIES
} from "@/lib/voucher/companies";

export default function VoucherPage() {
  const { permissions } = usePermissions();
  const router = useRouter();
  const checkedOnceRef = useRef(false);
  const isSuperAdmin = Array.isArray(permissions) && permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);
  const hasAnyCompanyPerm =
    Array.isArray(permissions) &&
    COMPANIES.some((c) => c.permission && permissions.includes(c.permission));
  const canEnter =
    isSuperAdmin ||
    hasAnyCompanyPerm ||
    (Array.isArray(permissions) && permissions.includes(PERMISSIONS.RECEIPTS));

  useEffect(() => {
    if (!Array.isArray(permissions)) return;
    if (checkedOnceRef.current) return;
    checkedOnceRef.current = true;

    if (!canEnter) {
      router.replace("/home");
    }
  }, [permissions, router, canEnter]);

  if (!Array.isArray(permissions)) return null;
  if (!canEnter) return null;

  const [selectedKey, setSelectedKey] = useState(null);

  const filteredCompanies = useMemo(() => {
    if (!Array.isArray(permissions)) return [];
    
    return COMPANIES.filter((c) => {
      if (isSuperAdmin) {
        if (String(c.key).trim() === "010") {
          return c.permission && permissions.includes(c.permission);
        }
        return true;
      }
      if (c.permission && permissions.includes(c.permission)) return true;
      return false;
    });
  }, [permissions]);

  const selectedCompany = useMemo(
    () => filteredCompanies.find((c) => c.key === selectedKey) || null,
    [selectedKey, filteredCompanies]
  );

  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState("payment");
  const isPayment = mode === "payment";

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
  const [voucherNo, setVoucherNo] = useState(null);

  const [cbOne, setCbOne] = useState(false);
  const [cbTwo, setCbTwo] = useState(false);

  const [activeField, setActiveField] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);

  const [vChequeNo, setVChequeNo] = useState("");
  const [vNationalId, setVNationalId] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vSanadNo, setVSanadNo] = useState("");

  const [globalTextStyle, setGlobalTextStyle] = useState(DEFAULT_GLOBAL_TEXT_STYLE);
  const [fieldStyles, setFieldStyles] = useState(DEFAULT_FIELD_STYLES);

  const chequeNoRef = useRef(null);
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
  const nationalIdRef = useRef(null);
  const phoneRef = useRef(null);
  const sanadRef = useRef(null);
  const paperRef = useRef(null);

  const today = new Date();
  const todayYY = String(today.getFullYear()).slice(-2);
  const todayMM = String(today.getMonth() + 1).padStart(2, "0");
  const todayDD = String(today.getDate()).padStart(2, "0");

  useEffect(() => {
    if (!pendingPrint) return;
    if (voucherNo == null) return;

    const run = async () => {
      try {
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 80));
        await printCurrentPreviewA4();
      } finally {
        setPendingPrint(false);
      }
    };

    run();
  }, [pendingPrint, voucherNo]);

  useEffect(() => {
    const cleaned = cleanAmount(vAmount);
    if (!cleaned) {
      setVWords("");
      return;
    }

    const words = numberToArabicWords(cleaned);
    const currencyText = vCurrency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير";
    setVWords(words ? `${words} ${currencyText}` : "");
  }, [vAmount, vCurrency]);

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

    setVBank("");
    setVFxRate("");
    setVReceivedBy("");
    setVBeneficiary("");
    setVNotes("");

    setVChequeNo("");
    setVNationalId("");
    setVPhone("");
    setVSanadNo("");

    setCbOne(false);
    setCbTwo(false);

    setActiveField("");
    setIsPrinting(false);
    setVoucherNo(null);
    setPendingPrint(false);

    setGlobalTextStyle(DEFAULT_GLOBAL_TEXT_STYLE);
    setFieldStyles(DEFAULT_FIELD_STYLES);
  }, [selectedKey]);

  const handleCreateOnly = async () => {
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

          vChequeNo,
          vNationalId,
          vPhone,
          vSanadNo,

          cbOne,
          cbTwo,

          globalTextStyle,
          fieldStyles,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "فشل إنشاء الوصل");
      }

      setVoucherNo(data.data.seq);
      setPendingPrint(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر إنشاء الوصل");
    } finally {
      setIsPrinting(false);
    }
  };

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

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      let lastHTML = "";
      let stableCount = 0;

      for (let i = 0; i < 10; i++) {
        await new Promise((r) => requestAnimationFrame(r));

        const currentHTML = paperRef.current.innerHTML;

        if (currentHTML === lastHTML) {
          stableCount++;
          if (stableCount >= 2) break;
        } else {
          stableCount = 0;
        }

        lastHTML = currentHTML;
      }

      await new Promise((r) => setTimeout(r, 200));

      const dataUrl = await toPng(paperRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
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
        background: #ffffff;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      body {
        width: 210mm;
        height: 297mm;
      }

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
    </style>
  </head>

  <body>
    <div class="page">
      <img src=${JSON.stringify(dataUrl)} />
    </div>

    <script>
      const img = document.querySelector("img");

      img.onload = () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 200);
      };

      img.onerror = () => {
        try {
          parent.postMessage({ type: "IFRAME_PRINT_DONE" }, "*");
        } catch (e) {}
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
        }, 80);

        setIsPrinting(false);
      };

      window.addEventListener("message", onMsg);
    } catch (e) {
      console.error(e);
      alert("تعذر طباعة الوصل.");
      setIsPrinting(false);
    }
  };

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

          vChequeNo,
          vNationalId,
          vPhone,
          vSanadNo,

          cbOne,
          cbTwo,

          globalTextStyle,
          fieldStyles,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "فشل إنشاء الوصل");
      }

      setVoucherNo(data.data.seq);
      setPendingPrint(true);
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر إنشاء الوصل");
      setPendingPrint(false);
      setIsPrinting(false);
    }
  }

  const openPayment = () => {
    if (!selectedCompany) return;
    setMode("payment");
    setOpenModal(true);
    setActiveField("date");
    setTimeout(() => yyRef.current?.focus(), 50);
  };

  const openReceipt = () => {
    if (!selectedCompany) return;
    setMode("receipt");
    setOpenModal(true);
    setActiveField("date");
    setTimeout(() => yyRef.current?.focus(), 50);
  };

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

  const CompanyCard = ({ company }) => {
    const active = selectedKey === company.key;

    return (
      <motion.button
        type="button"
        variants={card}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.997 }}
        onClick={() => setSelectedKey(company.key)}
        className={[
          "group relative w-full h-full min-h-[156px] text-right rounded-2xl p-5 md:p-6 outline-none transition-shadow duration-200",
          "bg-white/90 backdrop-blur-md shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]",
          "ring-1 ring-slate-200/90 hover:ring-slate-300 hover:shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18)]",
          active
            ? "ring-2 ring-indigo-500/80 shadow-[0_12px_36px_-14px_rgba(79,70,229,0.35)] bg-white"
            : "",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-l from-indigo-500/0 via-indigo-400/40 to-violet-500/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {active ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-l from-indigo-500 to-violet-500" />
        ) : null}

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="flex items-center gap-4 sm:flex-1 sm:min-w-0">
            <div
              className={[
                "mx-auto shrink-0 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl bg-slate-50 shadow-inner ring-1 transition-colors duration-200 sm:mx-0",
                active ? "ring-indigo-200 bg-indigo-50/50" : "ring-slate-200/80 group-hover:bg-white",
              ].join(" ")}
            >
              <img
                src={company.logo}
                alt={company.name}
                className="h-full w-full object-contain p-3"
                draggable={false}
              />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-right">
              <div className="text-base font-extrabold leading-snug text-slate-900 md:text-lg">
                {company.name}
              </div>
              <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-slate-500 md:text-sm">
                اختيار الشركة ثم طباعة وصل صرف أو قبض
              </p>

              <AnimatePresence>
                {active ? (
                  <motion.div
                    variants={panel}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-extrabold text-indigo-800 ring-1 ring-indigo-100"
                  >
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden />
                    مختارة
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl text-lg font-bold transition-colors duration-200 sm:self-auto",
              active
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 group-hover:bg-slate-900 group-hover:text-white group-hover:ring-slate-900",
            ].join(" ")}
            aria-hidden
          >
            <FiChevronRight className="text-xl opacity-90" />
          </div>
        </div>
      </motion.button>
    );
  };

  const ActionButton = ({ title, subtitle, onClick, accent }) => {
    if (!selectedCompany) return null;

    const barGradient =
      accent === "payment" ? "from-emerald-400 to-teal-600" : "from-sky-400 to-blue-600";
    const iconGradient =
      accent === "payment"
        ? "from-emerald-500 to-teal-600 shadow-emerald-600/35"
        : "from-sky-500 to-blue-600 shadow-blue-600/35";

    const Icon = accent === "payment" ? FiArrowUpCircle : FiArrowDownCircle;

    return (
      <motion.button
        type="button"
        onClick={onClick}
        variants={card}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.997 }}
        className={[
          "relative w-full overflow-hidden rounded-2xl p-5 text-right outline-none md:p-6",
          "bg-white shadow-[0_2px_14px_-4px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/90",
          "transition-all duration-200 hover:ring-slate-300 hover:shadow-[0_14px_44px_-18px_rgba(15,23,42,0.2)]",
        ].join(" ")}
      >
        <div
          className={`pointer-events-none absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b ${barGradient}`}
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 ps-2">
          <div className="flex items-center gap-4 sm:flex-1">
            <div
              className={`mx-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-2 ring-white/60 sm:mx-0 ${iconGradient}`}
            >
              <Icon className="text-2xl" strokeWidth={2} />
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-right">
              <div className="text-base font-extrabold text-slate-900 md:text-[17px]">{title}</div>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-slate-500 md:text-sm">
                {subtitle}
              </p>
            </div>
          </div>

          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center self-center rounded-xl bg-gradient-to-br text-white shadow-md sm:self-auto ${iconGradient}`}
          >
            <FiPrinter className="text-lg" strokeWidth={2} />
          </div>
        </div>
      </motion.button>
    );
  };

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return isPayment ? selectedCompany.paymentImg : selectedCompany.receiptImg;
  }, [selectedCompany, isPayment]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: t.dur, ease: t.ease }}>
      <motion.div
        variants={wrap}
        initial="hidden"
        animate="show"
        className="min-h-screen bg-gradient-to-b from-slate-100/90 via-white to-slate-50/80 px-4 py-8 sm:px-6 sm:py-10"
      >
        <div className="mx-auto max-w-5xl">
          <motion.div
            variants={panel}
            initial="hidden"
            animate="show"
            className="mb-8 flex items-center gap-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_8px_40px_-20px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:gap-5 sm:p-7"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-white/90 sm:h-14 sm:w-14">
              <FiFileText className="text-xl sm:text-2xl" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                إدارة الوصولات
              </h1>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
                اختر الشركة ثم اطبع وصل صرف أو قبض بحجم A5
              </p>
            </div>
          </motion.div>

          <p className="mb-4 text-right text-xs font-extrabold uppercase tracking-wider text-slate-400">
            الشركات
          </p>
          <motion.div
            variants={list}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 xl:gap-5 auto-rows-fr"
          >
            {filteredCompanies.map((company) => (
              <CompanyCard key={company.key} company={company} />
            ))}
          </motion.div>

          <div className="mt-8">
            <AnimatePresence mode="wait" initial={false}>
              {!selectedCompany ? (
                <motion.div
                  key="hint"
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/90 px-5 py-8 text-center"
                >
                  <p className="mx-auto max-w-md text-sm font-bold leading-relaxed text-slate-600">
                    اختر شركة من الأعلى لتفعيل أزرار طباعة وصل الصرف والقبض
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  variants={panel}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-[0_12px_48px_-24px_rgba(15,23,42,0.18)] backdrop-blur-sm md:p-7"
                >
                  <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-right">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                        الشركة المفعّلة
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">{selectedCompany.name}</p>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.995 }}
                      className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-800 ring-1 ring-slate-200/90 transition hover:bg-white"
                    >
                      تغيير الشركة
                    </motion.button>
                  </div>

                  <p className="mb-4 text-right text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    الطباعة
                  </p>
                  <motion.div
                    variants={list}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5"
                  >
                    <ActionButton
                      accent="payment"
                      title="وصل صرف"
                      subtitle="نافذة الإدخال ثم الطباعة بحجم A5"
                      onClick={openPayment}
                    />
                    <ActionButton
                      accent="receipt"
                      title="وصل قبض"
                      subtitle="نفس خطوات الصرف ثم الطباعة بحجم A5"
                      onClick={openReceipt}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <VoucherCanvasDialog
          open={openModal}
          onClose={() => setOpenModal(false)}
          onPrint={saveVoucherAndPrint}
          onReset={() => {
            setVoucherNo(null);
            setPendingPrint(false);

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

            setVChequeNo("");
            setVNationalId("");
            setVPhone("");
            setVSanadNo("");

            setCbOne(false);
            setCbTwo(false);

            setGlobalTextStyle(DEFAULT_GLOBAL_TEXT_STYLE);
            setFieldStyles(DEFAULT_FIELD_STYLES);

            setActiveField("date");
            yyRef.current?.focus();
          }}
          isPrinting={isPrinting}
          selectedCompany={selectedCompany}
          isPayment={isPayment}
          paperRef={paperRef}
          currentImg={currentImg}
          POS={POS}
          EXTRA={EXTRA}
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
          mode={mode}
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
          setVCurrency={setVCurrency}
          setVAmount={setVAmount}
          setVWords={setVWords}
          setVDesc={setVDesc}
          setVFxRate={setVFxRate}
          setVReceivedBy={setVReceivedBy}
          setVBank={setVBank}
          setVBeneficiary={setVBeneficiary}
          setVNotes={setVNotes}
          setCbOne={setCbOne}
          setCbTwo={setCbTwo}
          vChequeNo={vChequeNo}
          chequeNoRef={chequeNoRef}
          setVChequeNo={setVChequeNo}
          vNationalId={vNationalId}
          vPhone={vPhone}
          vSanadNo={vSanadNo}
          nationalIdRef={nationalIdRef}
          phoneRef={phoneRef}
          sanadRef={sanadRef}
          setVNationalId={setVNationalId}
          setVPhone={setVPhone}
          setVSanadNo={setVSanadNo}
          cleanAmount={cleanAmount}
          formatAmount={formatAmount}
          hasBeenCreated={!!voucherNo}
          onCreate={handleCreateOnly}
          onPrintOnly={printCurrentPreviewA4}
          createButtonText="إنشاء"
          creatingButtonText="جاري الإنشاء..."
          printOnlyButtonText="طباعة"
          printingOnlyButtonText="جاري الطباعة..."
          globalTextStyle={globalTextStyle}
          setGlobalTextStyle={setGlobalTextStyle}
          fieldStyles={fieldStyles}
          setFieldStyles={setFieldStyles}
        />
      </motion.div>
    </MotionConfig>
  );
}