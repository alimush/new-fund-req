"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Cairo } from "next/font/google";
import { motion, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS, hasPermission } from "@/lib/permission";
import { toPng } from "html-to-image";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
import {
  FiChevronLeft,
  FiFileText,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiMove,
  FiFolder,
  FiCheck,
} from "react-icons/fi";

// Shared imports
import { 
  only2Digits, 
  cleanAmount, 
  formatAmount, 
  amountToArabicVoucherWords, 
  waitForImages 
} from "@/lib/voucher/utils";

import {
  DEFAULT_GLOBAL_TEXT_STYLE,
  DEFAULT_FIELD_STYLES
} from "@/lib/voucher/styles";

import {
  COMPANIES,
  POS_NEW,
  emptyCategoryChecks,
  getCompanyCategoryChecklist,
  getCompanyExtra,
  VOUCHER_FUND_GROUPS,
} from "@/lib/voucher/companies";
import {
  prefetchVoucherLayout,
  prefetchVoucherLayouts,
} from "@/lib/voucher/voucherLayoutCache";

/** صناديق MIB — تُعرض كما هي بفاصل أسفل باقي الشركات */
const MIB_FUND_KEYS = new Set(["Badur-Elite-MIB", "Badur-Baghdad-MIB"]);

const COMPANY_GROUPS = VOUCHER_FUND_GROUPS;
const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700", "800"] });

const MOTION_EASE = [0.22, 1, 0.36, 1];
const panelMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: MOTION_EASE },
};

const pageClass = "min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-9";
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";

function VoucherHeading({ children, subtitle }) {
  return (
    <header className={`mb-6 flex flex-wrap items-center gap-3 p-4 sm:min-h-28 sm:gap-4 sm:px-6 ${panelClass}`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-sky-200 bg-sky-100 text-sky-700 sm:size-14">
        <FiFileText aria-hidden="true" size={25} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">إدارة الوصولات</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}

function CompanyLogo({ src, className = "" }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full min-h-0 object-contain p-1" />
    </span>
  );
}

function CompanyTile({ group, active, onClick }) {
  const count = group.funds.length;
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`relative flex min-h-32 min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center shadow-sm transition-colors ${focusClass} ${
        active
          ? "border-sky-400 bg-sky-50 ring-1 ring-sky-400"
          : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/40"
      }`}
    >
      {active && (
        <span className="absolute end-2 top-2 grid size-5 place-items-center rounded-full bg-sky-700 text-white">
          <FiCheck aria-hidden="true" size={13} />
        </span>
      )}
      <CompanyLogo src={group.logo} className="h-14 w-24 max-w-full" />
      <span className="text-sm font-extrabold text-slate-900 sm:text-base">{group.title}</span>
      <span className="text-xs text-slate-600">
        {count === 1 ? "صندوق واحد" : count === 2 ? "صندوقان" : `${count} صناديق`}
      </span>
    </motion.button>
  );
}

function FundRow({ fund, active, onClick }) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      className={`relative flex min-h-13 w-full items-center gap-2.5 border-b border-slate-200 px-3 py-2 text-start transition-colors last:border-b-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600 ${
        active ? "bg-sky-50 before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-sky-500" : "hover:bg-slate-50"
      }`}
    >
      <FiFolder aria-hidden="true" className={active ? "shrink-0 text-sky-700" : "shrink-0 text-slate-500"} size={18} />
      <span className="flex-1 text-sm font-bold text-slate-900">
        {fund.shortLabel === "الرئيسي" ? "الصندوق الرئيسي" : fund.shortLabel}
      </span>
      {fund.company.receiptOnly && <span className="text-xs font-semibold text-sky-800">قبض فقط</span>}
      <span className={`rounded-md px-2 py-1 text-xs font-bold ${active ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}`}>
        {fund.role === "main" ? "رئيسي" : "فرعي"}
      </span>
      {active
        ? <FiCheck aria-hidden="true" className="shrink-0 text-sky-700" size={16} />
        : <FiChevronLeft aria-hidden="true" className="shrink-0 text-slate-500" size={16} />}
    </motion.button>
  );
}

function VoucherAction({ payment = false, onClick }) {
  const Icon = payment ? FiArrowUpCircle : FiArrowDownCircle;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-start font-extrabold transition-colors ${focusClass} ${
        payment
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100"
          : "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300 hover:bg-blue-100"
      }`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${payment ? "bg-emerald-100 text-teal-700" : "bg-blue-100 text-blue-700"}`}>
        <Icon aria-hidden="true" size={20} />
      </span>
      <span className="flex-1">{payment ? "وصل صرف" : "وصل قبض"}</span>
      <FiChevronLeft aria-hidden="true" size={17} />
    </motion.button>
  );
}

function VouchersLoadingShell({ message }) {
  return (
    <div dir="rtl" className={`${pageClass} ${cairo.className}`} role="status" aria-busy="true">
      <div className="mx-auto max-w-[1240px]">
        <VoucherHeading subtitle={message} />
        <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-32 motion-safe:animate-pulse ${panelClass}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VoucherPage() {
  const { permissions, permissionsLoaded } = usePermissions();
  const router = useRouter();
  const isSuperAdmin =
    permissionsLoaded &&
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);
  const canLayoutFields = hasPermission(permissions, PERMISSIONS.VOUCHERS_FIELD_LAYOUT);
  const hasCategoryFunds = useMemo(
    () => COMPANIES.some((c) => getCompanyCategoryChecklist(c).length > 0),
    []
  );
  const hasAnyCompanyPerm =
    permissionsLoaded &&
    Array.isArray(permissions) &&
    COMPANIES.some((c) => c.permission && permissions.includes(c.permission));
  const canEnter =
    isSuperAdmin ||
    hasAnyCompanyPerm ||
    (permissionsLoaded &&
      Array.isArray(permissions) &&
      permissions.includes(PERMISSIONS.RECEIPTS));

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!canEnter) {
      router.replace("/home");
    }
  }, [permissionsLoaded, canEnter, router]);

  const permissionsReady = permissionsLoaded;
  const accessDenied = permissionsReady && !canEnter;

  const [chosenKey, setChosenKey] = useState(null);
  const [focusIssue, setFocusIssue] = useState(false);
  const issueHeadingRef = useRef(null);

  const filteredCompanies = useMemo(() => {
    if (!Array.isArray(permissions)) return [];
    
    return COMPANIES.filter((c) => {
      if (isSuperAdmin) {
        if (String(c.key).trim() === "Badur-Baghdad-Safebox-Istishar") {
          return c.permission && permissions.includes(c.permission);
        }
        if (String(c.key).trim() === "Badur-Baghdad-Elite") {
          return c.permission && permissions.includes(c.permission);
        }
        if (String(c.key).trim() === "Badur-Signature") {
          return c.permission && permissions.includes(c.permission);
        }
        if (String(c.key).trim() === "Badur-Elite-MIB") {
          return c.permission && permissions.includes(c.permission);
        }
        if (String(c.key).trim() === "Badur-Baghdad-MIB") {
          return c.permission && permissions.includes(c.permission);
        }
        if (String(c.key).trim() === "010") {
          return c.permission && permissions.includes(c.permission);
        }
        return true;
      }
      if (c.permission && permissions.includes(c.permission)) return true;
      return false;
    });
  }, [permissions, isSuperAdmin]);

  const companyByKey = useMemo(() => {
    const map = new Map();
    for (const c of filteredCompanies) map.set(String(c.key).trim(), c);
    return map;
  }, [filteredCompanies]);

  const companyGroups = useMemo(() => {
    return COMPANY_GROUPS.map((group) => {
      const funds = group.funds
        .map((f) => {
          const company = companyByKey.get(String(f.key).trim());
          if (!company) return null;
          return { ...f, company };
        })
        .filter(Boolean);
      if (!funds.length) return null;
      return {
        ...group,
        funds,
      };
    }).filter(Boolean);
  }, [companyByKey]);

  const mibCompanies = useMemo(
    () =>
      filteredCompanies.filter((c) => MIB_FUND_KEYS.has(String(c.key).trim())),
    [filteredCompanies]
  );

  const selectedMib = mibCompanies.find((company) => company.key === chosenKey)
    || (!companyGroups.length ? mibCompanies[0] : null);
  const isMibSelected = Boolean(selectedMib);
  const activeGroup = companyGroups.find((group) => group.funds.some((fund) => fund.key === chosenKey))
    || companyGroups[0];
  const activeFund = !isMibSelected
    ? activeGroup?.funds.find((fund) => fund.key === chosenKey) || activeGroup?.funds[0]
    : null;
  const selectedCompany = selectedMib || activeFund?.company || null;
  const selectedKey = selectedCompany?.key;

  useEffect(() => {
    if (!focusIssue) return;
    issueHeadingRef.current?.focus();
    setFocusIssue(false);
  }, [focusIssue]);

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
  const [categoryChecks, setCategoryChecks] = useState({});

  const categoryChecklist = useMemo(
    () => getCompanyCategoryChecklist(selectedCompany),
    [selectedCompany]
  );

  const dialogPOS = POS_NEW;
  const dialogEXTRA = useMemo(
    () => getCompanyExtra(selectedCompany, false),
    [selectedCompany]
  );

  const toggleCategoryCheck = (key, checked) => {
    setCategoryChecks((prev) => ({ ...prev, [key]: Boolean(checked) }));
  };

  useEffect(() => {
    setCategoryChecks(emptyCategoryChecks(categoryChecklist));
    setCbOne(false);
    setCbTwo(false);
  }, [selectedKey, categoryChecklist]);

  // جهّز تخطيط الحقول مسبقاً حتى ما يتعطل فتح الوصل
  useEffect(() => {
    const keys = (filteredCompanies || []).map((c) => c.key).filter(Boolean);
    if (keys.length) void prefetchVoucherLayouts(keys);
  }, [filteredCompanies]);

  useEffect(() => {
    if (!selectedKey) return;
    // مركز المبيعات وغيرها: force ليأخذ مواضع المصدر (طيبة الرئيسي)
    void prefetchVoucherLayout(selectedKey, { force: true });
  }, [selectedKey]);

  const [activeField, setActiveField] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);

  const [vChequeNo, setVChequeNo] = useState("");
  const [chequeId, setChequeId] = useState(null);
  const [vNationalId, setVNationalId] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vSanadNo, setVSanadNo] = useState("");

  const [globalTextStyle, setGlobalTextStyle] = useState(DEFAULT_GLOBAL_TEXT_STYLE);
  const [fieldStyles, setFieldStyles] = useState(DEFAULT_FIELD_STYLES);
  const [fieldColorRuns, setFieldColorRuns] = useState({});

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

    setVWords(amountToArabicVoucherWords(cleaned, vCurrency));
    setFieldColorRuns((prev) => ({ ...prev, words: [] }));
  }, [vAmount, vCurrency]);

  useEffect(() => {
    setOpenModal(false);
    setMode(selectedCompany?.receiptOnly ? "receipt" : "payment");

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
    setChequeId(null);
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
  }, [selectedKey, selectedCompany?.receiptOnly]);

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
          chequeId,

          vNationalId,
          vPhone,
          vSanadNo,

          cbOne,
          cbTwo,
          categoryChecks,

          globalTextStyle,
          fieldStyles,
          fieldColorRuns,
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
        filter: (node) =>
          !(node?.classList && node.classList.contains("voucher-ui-only")),
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
          chequeId,

          vNationalId,
          vPhone,
          vSanadNo,

          cbOne,
          cbTwo,
          categoryChecks,

          globalTextStyle,
          fieldStyles,
          fieldColorRuns,
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
    if (selectedCompany.receiptOnly) return;
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

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return isPayment ? selectedCompany.paymentImg : selectedCompany.receiptImg;
  }, [selectedCompany, isPayment]);

  if (!permissionsReady || accessDenied) {
    return (
      <MotionConfig reducedMotion="user">
        <VouchersLoadingShell
          message={accessDenied ? "جاري التحويل…" : "جاري التحميل…"}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={pageClass}>
        <main dir="rtl" className={`mx-auto max-w-[1240px] ${cairo.className}`}>
          <VoucherHeading subtitle="اختر الشركة والصندوق لإصدار وصل قبض أو صرف">
            {canLayoutFields && hasCategoryFunds && (
              <button
                type="button"
                onClick={() => router.push("/vouchers/category-layout")}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-sky-800 transition-colors hover:bg-sky-50 ${focusClass}`}
              >
                <FiMove aria-hidden="true" /> جيك بوكس الفئة
              </button>
            )}
          </VoucherHeading>

          {companyGroups.length > 0 && (
            <section aria-labelledby="voucher-companies">
              <h2 id="voucher-companies" className="mb-3 text-lg font-extrabold">الشركات</h2>
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(var(--company-count),minmax(0,1fr))]"
                style={{ "--company-count": Math.min(companyGroups.length, 6) }}
              >
                {companyGroups.map((group) => (
                  <CompanyTile
                    key={group.id}
                    group={group}
                    active={!isMibSelected && activeGroup?.id === group.id}
                    onClick={() => setChosenKey(activeGroup?.id === group.id && activeFund ? activeFund.key : group.funds[0].key)}
                  />
                ))}
              </div>
            </section>
          )}

          {selectedCompany && (
            <div className={`mt-5 grid gap-4 ${activeGroup && !isMibSelected ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
              {activeGroup && !isMibSelected && (
                <section className={`p-4 sm:p-5 ${panelClass}`} aria-labelledby="voucher-funds">
                  <motion.div key={activeGroup.id} {...panelMotion}>
                    <h2 id="voucher-funds" className="mb-3 flex items-center gap-2 text-lg font-extrabold">
                      <FiFolder aria-hidden="true" className="text-sky-700" />
                      صناديق {activeGroup.title}
                    </h2>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      {activeGroup.funds.map((fund) => (
                        <FundRow
                          key={fund.key}
                          fund={fund}
                          active={selectedKey === fund.key}
                          onClick={() => setChosenKey(fund.key)}
                        />
                      ))}
                    </div>
                  </motion.div>
                </section>
              )}

              <section className={`overflow-hidden ${panelClass}`} aria-labelledby="voucher-issue">
                <div className="flex items-center gap-3 border-b border-sky-100 bg-sky-50 px-4 py-3 sm:px-5">
                  <CompanyLogo src={selectedCompany.logo} className="h-10 w-12 border border-sky-100" />
                  <div className="min-w-0">
                    <h2 id="voucher-issue" ref={issueHeadingRef} tabIndex={-1} className="text-lg font-extrabold">
                      إصدار وصل
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {isMibSelected ? "صناديق MIB" : activeGroup?.title}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div aria-live="polite">
                    <motion.div key={selectedKey} {...panelMotion} className="flex flex-wrap items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-800">
                        <FiCheck aria-hidden="true" size={16} />
                      </span>
                      <span className="min-w-0 text-sm font-extrabold text-slate-900">
                        {activeFund?.shortLabel === "الرئيسي" ? "الصندوق الرئيسي" : activeFund?.shortLabel || selectedCompany.name}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        الصندوق المحدد
                      </span>
                    </motion.div>
                  </div>
                  <div className={`grid gap-2.5 ${selectedCompany.receiptOnly ? "" : "min-[420px]:grid-cols-2 md:grid-cols-1 lg:grid-cols-2"}`}>
                    <VoucherAction onClick={openReceipt} />
                    {!selectedCompany.receiptOnly && <VoucherAction payment onClick={openPayment} />}
                  </div>
                </div>
              </section>
            </div>
          )}

          {mibCompanies.length > 0 && (
            <section className="mt-6" aria-labelledby="voucher-mib">
              <h2 id="voucher-mib" className="mb-3 text-lg font-extrabold">صناديق <bdi>MIB</bdi></h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {mibCompanies.map((company) => (
                  <motion.button
                    key={company.key}
                    type="button"
                    aria-pressed={selectedKey === company.key}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setChosenKey(company.key);
                      setFocusIssue(true);
                    }}
                    className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2 text-start shadow-sm transition-colors ${focusClass} ${
                      selectedKey === company.key ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white hover:border-sky-300"
                    }`}
                  >
                    <CompanyLogo src={company.logo} className="h-10 w-14" />
                    <span className="flex-1 text-sm font-extrabold">{company.name}</span>
                    {company.receiptOnly && <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">قبض فقط</span>}
                    <FiChevronLeft aria-hidden="true" className="shrink-0 text-slate-500" size={17} />
                  </motion.button>
                ))}
              </div>
            </section>
          )}

          {!selectedCompany && (
            <p className={`px-5 py-8 text-center text-sm text-slate-600 ${panelClass}`}>
              ما عندك صلاحية على أي صندوق حالياً.
            </p>
          )}
        </main>

        <VoucherCanvasDialog
          open={openModal && Boolean(selectedCompany)}
          onClose={() => setOpenModal(false)}
          onPrint={saveVoucherAndPrint}
          isPrinting={isPrinting}
          selectedCompany={selectedCompany}
          isPayment={isPayment}
          paperRef={paperRef}
          currentImg={currentImg}
          POS={dialogPOS}
          EXTRA={dialogEXTRA}
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
          categoryChecklist={categoryChecklist}
          categoryChecks={categoryChecks}
          onToggleCategoryCheck={toggleCategoryCheck}
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
          chequeId={chequeId}
          setChequeId={setChequeId}
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
          fieldColorRuns={fieldColorRuns}
          setFieldColorRuns={setFieldColorRuns}
        />
      </div>
    </MotionConfig>
  );
}