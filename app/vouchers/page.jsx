"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { toPng } from "html-to-image";
import { POS, EXTRA } from "@/components/voucherConfig";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";

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

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return isPayment ? selectedCompany.paymentImg : selectedCompany.receiptImg;
  }, [selectedCompany, isPayment]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: t.dur, ease: t.ease }}>
      <motion.div variants={wrap} initial="hidden" animate="show" className="min-h-screen px-5 py-10">
        <div className="mx-auto max-w-4xl">
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

          <motion.div variants={list} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2">
            {filteredCompanies.map((company) => (
              <CompanyCard key={company.key} company={company} />
            ))}
          </motion.div>

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