"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { usePermissions } from "@/context/PermissionContext";
import { FiPrinter, FiX, FiEdit2, FiSave } from "react-icons/fi";
import { toPng } from "html-to-image";
import { Cairo } from "next/font/google";
import VoucherDateModal from "@/components/VoucherDateModal";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
import { POS as POS_NEW, EXTRA as EXTRA_NEW } from "@/components/voucherConfig";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

const TEMPLATE_SWITCH_DATE = new Date("2026-04-18T02:00:00");
const companies = [
  {
    key: "Al-Ghadeer",
    name: "شركة الغدير",
    logo: "/الغدير.png",
    paymentImgJpg: "/voucher.jpg",
    receiptImgJpg: "/receipt.jpg",
    paymentImgPng: "/voucher.png",
    receiptImgPng: "/receipt.png",
  },
  {
    key: "Badur-Baghdad",
    name: "شركة بدور بغداد",
    logo: "/بدور_بغداد.png",
    paymentImgJpg: "/voucher2.jpg",
    receiptImgJpg: "/receipt2.jpg",
    paymentImgPng: "/voucher2.png",
    receiptImgPng: "/receipt2.png",
  },
];

const POS_OLD = {
  date: { top: 19.2, left: 74.8 },
  amountFixed: { top: 13.6, left: 9.0 },
  currencyUSDBox: { top: 8.0, left: 22.3 },
  currencyIQDBox: { top: 8.0, left: 13.0 },
  amountWords: { top: 37.6, left: -2.0, width: 75.0 },
  description: { top: 53.5, left: 10, width: 80, height: 15.0 },
};

const EXTRA_OLD = {
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

function cleanAmount(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function formatAmount(value) {
  const cleaned = cleanAmount(value);
  if (!cleaned) return "";
  return Number(cleaned).toLocaleString("en-US");
}

function clampFontSize(value, fallback = 16) {
  const n = String(value ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  return Math.max(8, Math.min(72, Number(n)));
}

function clampFontWeight(value, fallback = 700) {
  const n = String(value ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  const num = Number(n);
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  return steps.reduce((prev, curr) =>
    Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
  );
}

function normalizeHexColor(value, fallback = "#111827") {
  const s = String(value || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

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
  voucherNo: { fontSize: 11, fontWeight: 800, color: "#111827" },
  currencyMark: { fontSize: 16, fontWeight: 800, color: "#111827" },
};

function normalizeGlobalTextStyle(input = {}) {
  return {
    fontSize: clampFontSize(input?.fontSize, DEFAULT_GLOBAL_TEXT_STYLE.fontSize),
    fontWeight: clampFontWeight(input?.fontWeight, DEFAULT_GLOBAL_TEXT_STYLE.fontWeight),
    color: normalizeHexColor(input?.color, DEFAULT_GLOBAL_TEXT_STYLE.color),
  };
}

function normalizeFieldStyles(input = {}, fallbackGlobal = DEFAULT_GLOBAL_TEXT_STYLE) {
  const out = {};
  for (const key of Object.keys(DEFAULT_FIELD_STYLES)) {
    const src = input?.[key] || {};
    const base = DEFAULT_FIELD_STYLES[key];
    out[key] = {
      fontSize: clampFontSize(src?.fontSize, base.fontSize ?? fallbackGlobal.fontSize),
      fontWeight: clampFontWeight(src?.fontWeight, base.fontWeight ?? fallbackGlobal.fontWeight),
      color: normalizeHexColor(src?.color, base.color ?? fallbackGlobal.color),
    };
  }
  return out;
}

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

function numberToArabicWords(num) {
  num = parseInt(String(num).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(num) || num === 0) return "";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
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
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

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
  if (billions) parts.push(groupToWords(billions, "مليار", "ملياران", "مليارات"));
  if (millions) parts.push(groupToWords(millions, "مليون", "مليونان", "ملايين"));
  if (thousands) parts.push(groupToWords(thousands, "ألف", "ألفان", "آلاف"));
  if (rest) parts.push(below1000(rest));

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

export default function VoucherViewPage() {
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

  const fillForm = useCallback((doc) => {
    if (!doc) return;

    setVoucher(doc);

    setVDateYY(doc?.vDateYY || doc?.dateParts?.yy || "");
    setVDateMM(doc?.vDateMM || doc?.dateParts?.mm || "");
    setVDateDD(doc?.vDateDD || doc?.dateParts?.dd || "");

    setVAmount(String(doc?.vAmount ?? doc?.amountText ?? doc?.amount ?? ""));
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

  const effectiveDate = useMemo(
    () =>
      buildEffectiveDate(
        voucher,
        vDateYY || fallbackVoucherDate.yy,
        vDateMM || fallbackVoucherDate.mm,
        vDateDD || fallbackVoucherDate.dd
      ),
    [voucher, vDateYY, vDateMM, vDateDD, fallbackVoucherDate]
  );

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
          window.opener.postMessage(
            {
              type: "VOUCHER_UPDATED",
              payload: { id, companyKey, mode },
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

  const handleClose = () => {
    if (editMode) {
      handleCancel();
      return;
    }
    if (window.history.length > 1) router.back();
    else window.close();
  };

  if (!Array.isArray(permissions)) return null;
  if (!permissions.includes("RECEIPTS") && !permissions.includes("VIEW_REPORTS")) {
    return null;
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
                    onClick={handleClose}
                    className="px-5 py-2.5 rounded-2xl bg-red-600 text-white font-extrabold"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          ) : selectedCompany && voucher ? (
            useOldTemplate ? (
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
                                {vAmount && !isNaN(Number(String(vAmount).replace(/,/g, "")))
                                  ? Number(String(vAmount).replace(/,/g, "")).toLocaleString("en-US")
                                  : ""}
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
                                  color: wordsStyle.color,
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
                                className={`absolute whitespace-pre-wrap ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentPOS.description),
                                  width: `${currentPOS.description.width}%`,
                                  maxHeight: `${currentPOS.description.height}%`,
                                  fontSize: `${descStyle.fontSize}px`,
                                  fontWeight: descStyle.fontWeight,
                                  color: descStyle.color,
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
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.bank),
                                  width: `${currentEXTRA.bank.width}%`,
                                  maxHeight: `${currentEXTRA.bank.height}%`,
                                  fontSize: `${bankStyle.fontSize}px`,
                                  fontWeight: bankStyle.fontWeight,
                                  color: bankStyle.color,
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
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.fxRate),
                                  width: `${currentEXTRA.fxRate.width}%`,
                                  maxHeight: `${currentEXTRA.fxRate.height}%`,
                                  fontSize: `${fxRateStyle.fontSize}px`,
                                  fontWeight: fxRateStyle.fontWeight,
                                  color: fxRateStyle.color,
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
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.receivedBy),
                                  width: `${currentEXTRA.receivedBy.width}%`,
                                  maxHeight: `${currentEXTRA.receivedBy.height}%`,
                                  fontSize: `${receivedByStyle.fontSize}px`,
                                  fontWeight: receivedByStyle.fontWeight,
                                  color: receivedByStyle.color,
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
                                className={`absolute ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.beneficiary),
                                  width: `${currentEXTRA.beneficiary.width}%`,
                                  maxHeight: `${currentEXTRA.beneficiary.height}%`,
                                  fontSize: `${beneficiaryStyle.fontSize}px`,
                                  fontWeight: beneficiaryStyle.fontWeight,
                                  color: beneficiaryStyle.color,
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
                                className={`absolute whitespace-pre-wrap ${cairo.className}`}
                                style={{
                                  ...pctStyle(currentEXTRA.notes),
                                  width: `${currentEXTRA.notes.width}%`,
                                  maxHeight: `${currentEXTRA.notes.height}%`,
                                  fontSize: `${notesStyle.fontSize}px`,
                                  fontWeight: notesStyle.fontWeight,
                                  color: notesStyle.color,
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
  onReset={editMode ? handleCancel : () => {}}
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
/>
              </motion.div>
            )
          ) : null}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}