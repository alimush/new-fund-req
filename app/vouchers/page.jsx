"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS, hasPermission } from "@/lib/permission";
import { toPng } from "html-to-image";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
import {
  FiChevronRight,
  FiChevronLeft,
  FiChevronDown,
  FiFileText,
  FiArrowUpCircle,
  FiArrowDownCircle,
  FiMove,
  FiLayers,
  FiX,
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
const ALL_GROUP_IDS = COMPANY_GROUPS.map((g) => g.id);

const MOTION_EASE = [0.22, 1, 0.36, 1];

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: MOTION_EASE },
  },
};

function FundPickCard({ company, active, onSelect }) {
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(company.key)}
      dir="rtl"
      className={[
        "group w-full rounded-2xl p-4 text-right outline-none transition-[box-shadow,background-color,ring-color] duration-150",
        "bg-white ring-1",
        active
          ? "bg-sky-50/70 ring-sky-300 shadow-[0_6px_20px_-12px_rgba(14,165,233,0.35)]"
          : "ring-slate-200/90 shadow-sm hover:ring-sky-200 hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className={[
            "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1",
            active ? "bg-white ring-sky-200" : "bg-slate-50 ring-slate-200/80",
          ].join(" ")}
        >
          <img
            src={company.logo}
            alt={company.name}
            className="h-full w-full object-contain p-1.5"
            draggable={false}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold text-slate-900">
            {company.name}
          </div>
          <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
            طباعة وصل صرف أو قبض
          </p>
        </div>

        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150",
            active
              ? "bg-sky-500 text-white"
              : "bg-slate-100 text-slate-400 group-hover:bg-sky-500 group-hover:text-white",
          ].join(" ")}
        >
          <FiChevronLeft className="text-base" />
        </div>
      </div>
    </motion.button>
  );
}

function CompanyGroupCard({
  group,
  open,
  selectedKey,
  onToggle,
  onSelectFund,
}) {
  const hasActive = group.funds.some((f) => f.key === selectedKey);
  const summaryParts = [];
  if (group.mainCount) summaryParts.push(`${group.mainCount} رئيسي`);
  if (group.subCount) summaryParts.push(`${group.subCount} فرعي`);

  return (
    <motion.div
      variants={fadeUp}
      className={[
        "overflow-hidden rounded-2xl bg-white ring-1 transition-[box-shadow,ring-color] duration-200",
        hasActive
          ? "ring-sky-300/80 shadow-[0_8px_28px_-16px_rgba(14,165,233,0.22)]"
          : "ring-slate-200/90 shadow-[0_2px_12px_-6px_rgba(15,23,42,0.08)]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onToggle(group.id)}
        className="flex w-full items-center gap-3 p-4 text-right outline-none sm:gap-4 sm:p-4"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/80 sm:h-14 sm:w-14">
          <img
            src={group.logo}
            alt={group.title}
            className="h-full w-full object-contain p-2"
            draggable={false}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <h2 className="text-[15px] font-extrabold text-slate-900 sm:text-base">
              {group.title}
            </h2>
            {hasActive ? (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 ring-1 ring-sky-200/80">
                نشط
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
            {summaryParts.join(" · ") || `${group.funds.length} صندوق`}
          </p>
        </div>
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
            open
              ? "bg-sky-500 text-white"
              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
          ].join(" ")}
        >
          <FiChevronDown
            className={`text-base transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="funds"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: MOTION_EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-slate-100 bg-slate-50/70 px-3 pb-3 pt-2 sm:px-3">
              {group.funds.map((fund) => {
                const active = selectedKey === fund.key;
                const isMain = fund.role === "main";
                return (
                  <motion.button
                    key={fund.key}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onSelectFund(fund.key)}
                    className={[
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right transition-[background-color,box-shadow,ring-color] duration-150",
                      active
                        ? "bg-sky-50 shadow-sm ring-2 ring-sky-400/70"
                        : "bg-white/90 ring-1 ring-slate-200/80 hover:bg-white hover:ring-sky-200",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1",
                        active
                          ? "bg-white ring-sky-200"
                          : "bg-slate-50 ring-slate-200/70",
                      ].join(" ")}
                    >
                      <img
                        src={fund.company.logo}
                        alt=""
                        className="h-full w-full object-contain p-1"
                        draggable={false}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className="text-[13px] font-extrabold text-slate-900">
                          {fund.company.name}
                        </span>
                        <span
                          className={[
                            "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ring-1",
                            isMain
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                              : "bg-amber-50 text-amber-700 ring-amber-200/80",
                          ].join(" ")}
                        >
                          {isMain ? "رئيسي" : "فرعي"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                        {fund.shortLabel}
                        {fund.company.receiptOnly ? " · قبض فقط" : ""}
                      </p>
                    </div>
                    <div
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                        active
                          ? "bg-sky-500 text-white"
                          : "bg-slate-100 text-slate-400",
                      ].join(" ")}
                    >
                      <FiChevronRight className="text-sm" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function VouchersLoadingShell({ message }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: MOTION_EASE }}
          className="mb-7 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-500/25 sm:h-14 sm:w-14">
            <FiFileText className="text-xl sm:text-2xl" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              إدارة الوصولات
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{message}</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.06 + i * 0.05,
                ease: MOTION_EASE,
              }}
              className="h-[88px] overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <div className="h-full w-full animate-pulse bg-gradient-to-l from-slate-100 via-white to-slate-100" />
            </motion.div>
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

  const [selectedKey, setSelectedKey] = useState(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const selectFund = (key) => {
    setSelectedKey(key);
    setShowTypePicker(true);
  };

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
        mainCount: funds.filter((f) => f.role === "main").length,
        subCount: funds.filter((f) => f.role === "sub").length,
      };
    }).filter(Boolean);
  }, [companyByKey]);

  const mibCompanies = useMemo(
    () =>
      filteredCompanies.filter((c) => MIB_FUND_KEYS.has(String(c.key).trim())),
    [filteredCompanies]
  );

  const [expandedGroups, setExpandedGroups] = useState(
    () => new Set(ALL_GROUP_IDS)
  );

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    setShowTypePicker(false);
    setActiveField("date");
    setTimeout(() => yyRef.current?.focus(), 50);
  };

  const openReceipt = () => {
    if (!selectedCompany) return;
    setMode("receipt");
    setOpenModal(true);
    setShowTypePicker(false);
    setActiveField("date");
    setTimeout(() => yyRef.current?.focus(), 50);
  };

  const closeTypePicker = () => {
    setShowTypePicker(false);
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
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: MOTION_EASE }}
            className="mb-7 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:gap-5 sm:p-6"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-500/25 sm:h-14 sm:w-14">
              <FiFileText className="text-xl sm:text-2xl" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                إدارة الوصولات
              </h1>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">
                اختر الشركة ثم الصندوق واطبع وصل صرف أو قبض
              </p>
              {companyGroups.length > 0 || mibCompanies.length > 0 ? (
                <p className="mt-2 inline-flex flex-wrap items-center justify-end gap-2 text-[11px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 ring-1 ring-slate-200">
                    <FiLayers className="text-slate-400" />
                    {companyGroups.length} شركة
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 ring-1 ring-slate-200">
                    {filteredCompanies.filter((c) => !MIB_FUND_KEYS.has(c.key)).length} صندوق
                  </span>
                  {mibCompanies.length > 0 ? (
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-100">
                      {mibCompanies.length} MIB
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            {canLayoutFields && hasCategoryFunds ? (
              <button
                type="button"
                onClick={() => router.push("/vouchers/category-layout")}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-sky-700"
              >
                <FiMove />
                جيك بوكس الفئة
              </button>
            ) : null}
          </motion.div>

          {companyGroups.length > 0 ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.05 }}
                className="mb-3 flex items-end justify-between gap-3"
                dir="rtl"
              >
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-400">
                    الشركات والصناديق
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                    رئيسي وفرعي حسب صلاحياتك
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups(new Set(companyGroups.map((g) => g.id)))
                    }
                    className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-sky-50 hover:text-sky-800 hover:ring-sky-200"
                  >
                    فتح الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedGroups(new Set())}
                    className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    طي الكل
                  </button>
                </div>
              </motion.div>
              <motion.div
                variants={listStagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4"
              >
                {companyGroups.map((group) => (
                  <CompanyGroupCard
                    key={group.id}
                    group={group}
                    open={expandedGroups.has(group.id)}
                    selectedKey={showTypePicker ? null : selectedKey}
                    onToggle={toggleGroup}
                    onSelectFund={selectFund}
                  />
                ))}
              </motion.div>
            </>
          ) : null}

          {mibCompanies.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.12, ease: MOTION_EASE }}
              className={companyGroups.length > 0 ? "mt-8" : ""}
            >
              <div className="mb-3 flex items-center gap-3" dir="rtl">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="shrink-0 text-center">
                  <p className="text-sm font-extrabold text-slate-800">صناديق MIB</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    بدور ايليت وبدور بغداد
                  </p>
                </div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <motion.div
                variants={listStagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {mibCompanies.map((company) => (
                  <FundPickCard
                    key={company.key}
                    company={company}
                    active={!showTypePicker && selectedKey === company.key}
                    onSelect={selectFund}
                  />
                ))}
              </motion.div>
            </motion.div>
          ) : null}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.18 }}
            className="mt-5 text-center text-[12px] font-semibold text-slate-400"
          >
            اختر صندوقاً لفتح نافذة صرف أو قبض
          </motion.p>
        </div>

        {/* بوب أب اختيار صرف / قبض — ظهور فوري بدون AnimatePresence لتفادي وميض الإغلاق */}
        {showTypePicker && selectedCompany ? (
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
            >
              <button
                type="button"
                aria-label="إغلاق"
                className="absolute inset-0 bg-slate-900/40"
                onClick={closeTypePicker}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="voucher-type-picker-title"
                className="relative z-10 w-full max-w-xl overflow-hidden rounded-t-3xl bg-white shadow-[0_24px_64px_-24px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/90 sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-5">
                  <button
                    type="button"
                    onClick={closeTypePicker}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-200/80"
                  >
                    <FiX className="text-lg" />
                  </button>

                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-[11px] font-extrabold tracking-wide text-slate-400">
                      اختيار نوع الوصل
                    </p>
                    <h2
                      id="voucher-type-picker-title"
                      className="mt-0.5 truncate text-lg font-black text-slate-900"
                    >
                      {selectedCompany.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
                      {(() => {
                        const meta = COMPANY_GROUPS.flatMap((g) =>
                          g.funds.map((f) => ({ ...f, groupTitle: g.title }))
                        ).find((f) => f.key === selectedCompany.key);
                        if (!meta) {
                          return MIB_FUND_KEYS.has(selectedCompany.key) ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 ring-1 ring-slate-200">
                              MIB
                            </span>
                          ) : null;
                        }
                        return (
                          <>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10px] font-extrabold ring-1",
                                meta.role === "main"
                                  ? "bg-slate-100 text-slate-700 ring-slate-200"
                                  : "bg-slate-100 text-slate-600 ring-slate-200",
                              ].join(" ")}
                            >
                              {meta.role === "main" ? "رئيسي" : "فرعي"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              {meta.groupTitle}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200/80">
                    <img
                      src={selectedCompany.logo}
                      alt=""
                      className="h-full w-full object-contain p-2"
                      draggable={false}
                    />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50/50 p-4 sm:p-5">
                  <p className="text-center text-[12px] font-bold text-slate-500">
                    {selectedCompany.receiptOnly
                      ? "هذا الصندوق يدعم وصل القبض فقط"
                      : "اختر نوع الوصل — نافذة الإدخال ثم الطباعة بحجم A5"}
                  </p>

                  <div
                    className={`grid grid-cols-1 gap-3 ${
                      selectedCompany.receiptOnly ? "max-w-md mx-auto w-full" : "sm:grid-cols-2"
                    }`}
                  >
                    {!selectedCompany.receiptOnly ? (
                      <button
                        type="button"
                        onClick={openPayment}
                        className="group relative w-full overflow-hidden rounded-2xl bg-white p-5 text-right shadow-[0_2px_14px_-4px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/90 transition hover:-translate-y-0.5 hover:ring-slate-300 hover:shadow-[0_14px_44px_-18px_rgba(15,23,42,0.16)]"
                      >
                        <div className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600" />
                        <div className="relative flex items-center gap-4 ps-2">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-white/60">
                            <FiArrowUpCircle className="text-xl" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-extrabold text-slate-900">وصل صرف</p>
                            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                              نافذة الإدخال ثم الطباعة بحجم A5
                            </p>
                          </div>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 transition group-hover:bg-slate-900 group-hover:text-white group-hover:ring-slate-900">
                            <FiChevronRight className="text-lg" />
                          </div>
                        </div>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={openReceipt}
                      className="group relative w-full overflow-hidden rounded-2xl bg-white p-5 text-right shadow-[0_2px_14px_-4px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/90 transition hover:-translate-y-0.5 hover:ring-slate-300 hover:shadow-[0_14px_44px_-18px_rgba(15,23,42,0.16)]"
                    >
                      <div className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b from-sky-400 to-blue-600" />
                      <div className="relative flex items-center gap-4 ps-2">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-white/60">
                          <FiArrowDownCircle className="text-xl" strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-extrabold text-slate-900">وصل قبض</p>
                          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                            نافذة الإدخال ثم الطباعة بحجم A5
                          </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 transition group-hover:bg-slate-900 group-hover:text-white group-hover:ring-slate-900">
                          <FiChevronRight className="text-lg" />
                        </div>
                      </div>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeTypePicker}
                    className="w-full rounded-2xl bg-white py-3 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200/90 transition hover:bg-slate-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        <VoucherCanvasDialog
          open={openModal}
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