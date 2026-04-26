
"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
import { POS as POS_NEW, EXTRA as EXTRA_NEW } from "@/components/voucherConfig";

const TEMPLATE_SWITCH_DATE = new Date("2026-04-18T13:40:06.558+03:00");

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
    key: "010",
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

function only2Digits(val) {
  return String(val || "").replace(/[^\d]/g, "").slice(0, 2);
}

function cleanAmount(value) {
  return String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
}

function formatAmount(value) {
  const cleaned = cleanAmount(value);
  if (!cleaned) return "";

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";

  return n.toLocaleString("en-US", {
    maximumFractionDigits: 3,
  });
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

function buildEffectiveDate(existingVoucher, yy, mm, dd) {
  const y = String(yy || "").trim();
  const m = String(mm || "").trim();
  const d = String(dd || "").trim();

  if (y && m && d) {
    const fullYear = Number(y) >= 50 ? `19${y}` : `20${y}`;
    const dt = new Date(`${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const raw = existingVoucher?.voucherDate || existingVoucher?.createdAt;
  if (!raw) return new Date();

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

export default function VoucherModal({
  open,
  onClose,
  request,
  companyKey,
  requestId,
  onSaved,
}) {
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

  const [requestData, setRequestData] = useState(request || null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  const [existingVoucher, setExistingVoucher] = useState(null);
  const [voucherNo, setVoucherNo] = useState(null);

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

  const [vChequeNo, setVChequeNo] = useState("");
  const [vNationalId, setVNationalId] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vSanadNo, setVSanadNo] = useState("");

  const [cbOne, setCbOne] = useState(false);
  const [cbTwo, setCbTwo] = useState(false);

  const [globalTextStyle, setGlobalTextStyle] = useState(DEFAULT_GLOBAL_TEXT_STYLE);
  const [fieldStyles, setFieldStyles] = useState(DEFAULT_FIELD_STYLES);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.key === companyKey) || null,
    [companyKey]
  );

  const today = useMemo(() => new Date(), []);
  const todayYY = String(today.getFullYear()).slice(-2);
  const todayMM = String(today.getMonth() + 1).padStart(2, "0");
  const todayDD = String(today.getDate()).padStart(2, "0");

  const fillFromRequest = useCallback(
    (reqDoc) => {
      if (!reqDoc) return;

      const items = Array.isArray(reqDoc?.items) ? reqDoc.items : [];
      const total = items.reduce(
        (sum, it) => sum + (Number(it?.qty) || 0) * (Number(it?.price) || 0),
        0
      );

      const currency = String(reqDoc?.currency || "IQD").toUpperCase();
      const formattedAmount = formatAmount(total);
      const words = `${numberToArabicWords(total)} ${
        currency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير"
      }`.trim();

      setVAmount(formattedAmount);
      setVWords(words);
      setVDesc(reqDoc?.description || "");
      setVCurrency(currency);

      if (!existingVoucher?._id) {
        setVDateYY(todayYY);
        setVDateMM(todayMM);
        setVDateDD(todayDD);
      }
    },
    [existingVoucher?._id, todayYY, todayMM, todayDD]
  );

  useEffect(() => {
    setRequestData(request || null);
  }, [request]);

  useEffect(() => {
    if (!open || !requestId || request) return;

    let cancelled = false;

    const loadRequest = async () => {
      try {
        setLoadingRequest(true);

        // إذا عندك endpoint ثاني للريكوست بدله هنا
        const res = await fetch(`/api/requests/view?id=${encodeURIComponent(requestId)}`, {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok) {
          const doc = json?.data || json?.request || null;
          if (doc) setRequestData(doc);
        }
      } catch (err) {
        console.error("Failed to load request:", err);
      } finally {
        if (!cancelled) setLoadingRequest(false);
      }
    };

    loadRequest();

    return () => {
      cancelled = true;
    };
  }, [open, requestId, request]);

  useEffect(() => {
    if (!open || !requestData) return;
    fillFromRequest(requestData);
  }, [open, requestData, fillFromRequest]);

  useEffect(() => {
    if (!open || !companyKey || !requestId) return;

    let cancelled = false;

    const loadExistingVoucher = async () => {
      try {
        setLoadingVoucher(true);

        const res = await fetch(
          `/api/vouchers?companyKey=${encodeURIComponent(companyKey)}&requestId=${encodeURIComponent(requestId)}&mode=payment`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && json?.success) {
          const doc = json.data || null;
          setExistingVoucher(doc);

          if (doc) {
            setVoucherNo(doc.seq ?? null);

            setVDateYY(doc?.vDateYY || "");
            setVDateMM(doc?.vDateMM || "");
            setVDateDD(doc?.vDateDD || "");

            setVAmount(
              doc?.vAmount !== undefined && doc?.vAmount !== null
                ? formatAmount(doc.vAmount)
                : ""
            );
            setVWords(doc?.vWords || "");
            setVDesc(doc?.vDesc || "");
            setVCurrency(String(doc?.vCurrency || "IQD").toUpperCase());

            setVBank(doc?.bank || doc?.vBank || "");
            setVFxRate(doc?.fxRate || doc?.vFxRate || "");
            setVReceivedBy(doc?.receivedBy || doc?.vReceivedBy || "");
            setVBeneficiary(doc?.beneficiary || doc?.vBeneficiary || "");
            setVNotes(doc?.notes || doc?.vNotes || "");

            setVChequeNo(doc?.chequeNo || doc?.vChequeNo || "");
            setVNationalId(doc?.nationalId || doc?.vNationalId || "");
            setVPhone(doc?.phone || doc?.vPhone || "");
            setVSanadNo(doc?.sanadNo || doc?.vSanadNo || "");

            setCbOne(Boolean(doc?.cbOne));
            setCbTwo(Boolean(doc?.cbTwo));

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
          } else {
            setExistingVoucher(null);
            setVoucherNo(null);
          }
        }
      } catch (err) {
        console.error("Failed to load existing voucher:", err);
      } finally {
        if (!cancelled) setLoadingVoucher(false);
      }
    };

    loadExistingVoucher();

    return () => {
      cancelled = true;
    };
  }, [open, companyKey, requestId]);

  const effectiveDate = useMemo(() => {
    return buildEffectiveDate(existingVoucher, vDateYY, vDateMM, vDateDD);
  }, [existingVoucher, vDateYY, vDateMM, vDateDD]);

  const useOldTemplate = useMemo(() => {
    if (!effectiveDate) return true;
    return effectiveDate < TEMPLATE_SWITCH_DATE;
  }, [effectiveDate]);

  const currentPOS = useMemo(() => (useOldTemplate ? POS_OLD : POS_NEW), [useOldTemplate]);
  const currentEXTRA = useMemo(() => (useOldTemplate ? EXTRA_OLD : EXTRA_NEW), [useOldTemplate]);

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return useOldTemplate
      ? selectedCompany.paymentImgJpg
      : selectedCompany.paymentImgPng;
  }, [selectedCompany, useOldTemplate]);

  const onYYChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateYY(v);
    if (v.length === 2) mmRef.current?.focus();
  };

  const onMMChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateMM(v);
    if (v.length === 2) ddRef.current?.focus();
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

  const clearExtras = useCallback(() => {
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
  }, []);

  const handleReset = useCallback(() => {
    if (requestData) fillFromRequest(requestData);
    clearExtras();

    if (!existingVoucher?._id) {
      setVoucherNo(null);
      setGlobalTextStyle(DEFAULT_GLOBAL_TEXT_STYLE);
      setFieldStyles(DEFAULT_FIELD_STYLES);
    }
  }, [requestData, fillFromRequest, clearExtras, existingVoucher?._id]);

  const printCurrentPreviewA4 = async () => {
    if (!paperRef.current) return;

    try {
      setPrinting(true);

      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      await waitForImages(paperRef.current);

      const dataUrl = await toPng(paperRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const printStyles = useOldTemplate
        ? `
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
        `
        : `
          .page {
            width: 210mm;
            height: 297mm;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            overflow: hidden;
            background: #fff;
            padding-top: 0;
          }
          img {
            width: 210mm;
            height: 297mm;
            display: block;
            object-fit: fill;
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
        setPrinting(false);
        iframe.remove();
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

        setPrinting(false);
      };

      window.addEventListener("message", onMsg);
    } catch (e) {
      console.error(e);
      alert("تعذر طباعة الوصل.");
      setPrinting(false);
    }
  };

  const buildPayload = () => {
    const amountCleaned = cleanAmount(vAmount);
    const amountNumber = amountCleaned ? Number(amountCleaned) : 0;
  
    return {
      companyKey,
      companyName: selectedCompany?.name || companyKey,
      mode: "payment",
      requestId,
  
      vDateYY,
      vDateMM,
      vDateDD,
  
      amount: amountNumber,
      vAmount: amountNumber,
  
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
      fontSizeAmount: String(fieldStyles?.amount?.fontSize || 16),
      fontSizeWords: String(fieldStyles?.words?.fontSize || 16),
      fontSizeDesc: String(fieldStyles?.desc?.fontSize || 16),
      fontSizeExtra: String(fieldStyles?.bank?.fontSize || 16),
      fontColorMain: fieldStyles?.amount?.color || "#111827",
      fontColorAccent: fieldStyles?.bank?.color || "#111827",
    };
  };

  const createVoucher = async () => {
    try {
      setSaving(true);

      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to create voucher");
      }

      const doc = json.data || null;
      setExistingVoucher(doc);
      setVoucherNo(doc?.seq ?? null);

      await onSaved?.(doc);
      await printCurrentPreviewA4();
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر إنشاء الوصل");
    } finally {
      setSaving(false);
    }
  };

  const saveEditedVoucher = async () => {
    if (!existingVoucher?._id) return;

    try {
      setSaving(true);

      const res = await fetch("/api/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: existingVoucher._id,
          ...buildPayload(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save voucher");
      }

      const doc = json.data || null;
      setExistingVoucher(doc);
      setVoucherNo(doc?.seq ?? voucherNo);

      await onSaved?.(doc);
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    if (!existingVoucher?._id && !vDateYY && !vDateMM && !vDateDD) {
      setVDateYY(todayYY);
      setVDateMM(todayMM);
      setVDateDD(todayDD);
    }
  }, [open, existingVoucher?._id, vDateYY, vDateMM, vDateDD, todayYY, todayMM, todayDD]);

  useEffect(() => {
    if (!open) return;
    const cleaned = cleanAmount(vAmount);
    if (!cleaned) {
      setVWords("");
      return;
    }
    const currencyText = vCurrency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير";
    setVWords(`${numberToArabicWords(cleaned)} ${currencyText}`.trim());
  }, [open, vAmount, vCurrency]);

  if (!open || !selectedCompany) return null;

  return (
    <VoucherCanvasDialog
      open={open}
      onClose={onClose}
      onPrintOnly={printCurrentPreviewA4}
      onReset={handleReset}
      isPrinting={printing || saving || loadingVoucher || loadingRequest}
      selectedCompany={selectedCompany}
      hasBeenCreated={Boolean(existingVoucher?._id)}
      printOnlyButtonText="طباعة"
      printingOnlyButtonText="جاري الطباعة..."
      createButtonText="إنشاء"
      creatingButtonText="جاري الإنشاء..."
      isPayment={true}
      isViewPage={false}
      editMode={true}
      onToggleEdit={() => {}}
      onSave={saveEditedVoucher}
      isSaving={saving}
      onCreate={createVoucher}
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
      globalTextStyle={globalTextStyle}
      setGlobalTextStyle={setGlobalTextStyle}
      fieldStyles={fieldStyles}
      setFieldStyles={setFieldStyles}
    />
  );
}
