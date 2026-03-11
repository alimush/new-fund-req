"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useRef, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import { Cairo } from "next/font/google";
import { FiPrinter, FiX } from "react-icons/fi";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

function format2(n) {
  const x = Number(n || 0);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(x);
}

function toArabicWords(amount, currency) {
  const n = Math.floor(Number(amount || 0));
  if (!n) return "صفر";

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

  const join = (a, b) => (a && b ? `${a} و${b}` : a || b);

  const twoDigits = (x) => {
    x = x % 100;
    if (x === 0) return "";
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10);
    const u = x % 10;
    return u ? `${ones[u]} و${tens[t]}` : tens[t];
  };

  const threeDigits = (x) => {
    x = x % 1000;
    if (x === 0) return "";
    const h = Math.floor(x / 100);
    const r = x % 100;
    return join(hundreds[h], twoDigits(r));
  };

  const scaleName = (count, singular, dual, plural, many) => {
    if (count === 1) return singular;
    if (count === 2) return dual;
    if (count >= 3 && count <= 10) return plural;
    return many;
  };

  const chunk = (num, div) => Math.floor((num / div) % 1000);

  const million = chunk(n, 1_000_000);
  const thousand = chunk(n, 1_000);
  const rest = n % 1000;

  let words = "";

  if (million) {
    const mWords = threeDigits(million);
    const mScale = scaleName(million, "مليون", "مليونان", "ملايين", "مليون");
    words = join(words, million === 1 ? "مليون" : million === 2 ? "مليونان" : `${mWords} ${mScale}`);
  }

  if (thousand) {
    const tWords = threeDigits(thousand);
    const tScale = scaleName(thousand, "ألف", "ألفان", "آلاف", "ألف");
    const part = thousand === 1 ? "ألف" : thousand === 2 ? "ألفان" : `${tWords} ${tScale}`;
    words = join(words, part);
  }

  if (rest) {
    words = join(words, threeDigits(rest));
  }

  const curr = currency === "USD" ? "دولار" : "دينار";
  return `${words} ${curr} فقط لا غير`;
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

function isArabicText(s = "") {
  const str = String(s);
  const ar = (str.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const en = (str.match(/[A-Za-z]/g) || []).length;
  return ar >= en && ar > 0;
}

/** ✅ POS نسبية */
const POS = {
  date: { top: 19.2, left: 75.0 },
  amountFixed: { top: 13.6, left: 12.0 },
  currencyUSDBox: { top: 8.0, left: 22.3 },
  currencyIQDBox: { top: 8.0, left: 13.0 },
  amountWords: { top: 38.0, left: -2.0, width: 75.0 },
  description: { top: 53.5, left: 35.0, width: 54.2, height: 15.0 },
};

/** ✅ حقول إضافية (نفس فكرة الكود السابق) — عدّل top/left حسب صورتك */
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


export default function VoucherModal({ open, onClose, request, companyKey, requestId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const paperRef = useRef(null);

  const [bgDataUrl, setBgDataUrl] = useState("");
  const [bgReady, setBgReady] = useState(false);
  const [voucherNo, setVoucherNo] = useState(null);
  const [existingVoucher, setExistingVoucher] = useState(null);
const [loadingVoucher, setLoadingVoucher] = useState(false);
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

      const json = await res.json();

      if (!cancelled && res.ok && json?.success) {
        const doc = json.data || null;
        setExistingVoucher(doc);

        if (doc) {
          setVoucherNo(doc.seq ?? null);
          setVBank(doc.bank || "");
          setVFxRate(doc.fxRate || "");
          setVReceivedBy(doc.receivedBy || "");
          setVBeneficiary(doc.beneficiary || "");
          setVNotes(doc.notes || "");
          setCbOne(Boolean(doc.cbOne));
          setCbTwo(Boolean(doc.cbTwo));
        } else {
          setVoucherNo(null);
          setVBank("");
          setVFxRate("");
          setVReceivedBy("");
          setVBeneficiary("");
          setVNotes("");
          setCbOne(false);
          setCbTwo(false);
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

const resetAllLocal = () => {
  setExistingVoucher(null);
  setVoucherNo(null);

  setVBank("");
  setVFxRate("");
  setVReceivedBy("");
  setVBeneficiary("");
  setVNotes("");
  setCbOne(false);
  setCbTwo(false);
};
  const voucherImg = companyKey === "Badur-Baghdad" ? "/voucher2.jpg" : "/voucher.jpg";

  // ✅ تحميل الخلفية كـ dataUrl حتى html-to-image يكون ثابت
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setBgReady(false);
    setBgDataUrl("");

    (async () => {
      try {
        const res = await fetch(voucherImg, { cache: "no-store" });
        const blob = await res.blob();

        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (!cancelled) {
          setBgDataUrl(String(dataUrl));
          setBgReady(true);
        }
      } catch (e) {
        console.error("Failed to load voucher background:", e);
        if (!cancelled) setBgReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, voucherImg]);

  /** ✅ بيانات “من الريكوست” بدون تعديل */
  const total = useMemo(() => {
    const items = Array.isArray(request?.items) ? request.items : [];
    return items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  }, [request]);

  const currency = String(request?.currency || "IQD").toUpperCase();
  const isUSD = currency === "USD";

  const dateParts = useMemo(() => {
    const d = request?.createdAt ? new Date(request.createdAt) : new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const yearShort = String(d.getFullYear()).slice(-2);
    return { day, month, yearShort };
  }, [request]);

  const description = request?.description || "";
  const amountWords = useMemo(() => toArabicWords(total, currency), [total, currency]);

  const descIsArabic = useMemo(() => isArabicText(description), [description]);
  const descDir = descIsArabic ? "rtl" : "ltr";
  const descAlign = descIsArabic ? "right" : "left";

  /** ✅ حقول تكتبها أنت (نفس الكود السابق) */
  const [vBank, setVBank] = useState("");
  const [vFxRate, setVFxRate] = useState("");
  const [vReceivedBy, setVReceivedBy] = useState("");
  const [vBeneficiary, setVBeneficiary] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [cbOne, setCbOne] = useState(false);
  const [cbTwo, setCbTwo] = useState(false);

  const bankRef = useRef(null);
  const fxRef = useRef(null);
  const receivedByRef = useRef(null);
  const beneficiaryRef = useRef(null);
  const notesRef = useRef(null);

  // ✅ كل ما يفتح المودال صفّر الإضافات (بدون لمس حقول الريكوست)
  useEffect(() => {
    if (!open) {
      resetAllLocal();
      return;
    }
    resetAllLocal();
    // optional: فوكس أول حقل
    setTimeout(() => fxRef.current?.focus(), 50);
  }, [open]);

  const saveVoucherAndPrint = async () => {
    if (!paperRef.current) return;
  
    if (!bgReady) {
      alert("خلي ثواني… دا أحمل صورة الوصل");
      return;
    }
  
    // إذا الوصل موجود مسبقاً -> لا تنشئ مرة ثانية
    if (existingVoucher?._id) {
      await printCurrentVoucher();
      return;
    }
  
    setSaving(true);
    setPrinting(true);
  
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyKey,
          companyName: companyKey,
          mode: "payment",
          requestId,
  
          vDateYY: dateParts.yearShort,
          vDateMM: dateParts.month,
          vDateDD: dateParts.day,
  
          vAmount: total,
          vWords: amountWords,
          vDesc: description,
          vCurrency: currency,
  
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
        throw new Error(json?.error || "Failed to create voucher");
      }
  
      setExistingVoucher(json.data || null);
      setVoucherNo(json.data?.seq ?? null);
  
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 120));
  
      await onSaved?.(json.data);
      await printCurrentVoucher();
    } catch (e) {
      console.error(e);
      alert(e.message || "تعذر إنشاء وطباعة الوصل");
      setSaving(false);
      setPrinting(false);
    } finally {
      setSaving(false);
    }
  };

  /** ✅ طباعة A5 landscape + تملي الورقة (bleed) */


  const printCurrentVoucher = async () => {
    if (!paperRef.current) return;
  
    if (!bgReady) {
      alert("خلي ثواني… دا أحمل صورة الوصل");
      return;
    }
  
    setPrinting(true);
  
    try {
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 120));
  
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
        iframe.remove();
        throw new Error("تعذر فتح نافذة الطباعة");
      }
  
      const BLEED_SCALE = 1.04;
  
      doc.open();
      doc.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Voucher</title>
            <style>
              @page { size: A5 landscape; margin: 0; }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm;
                height: 148mm;
                overflow: hidden;
                background: #fff;
              }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .sheet {
                width: 210mm;
                height: 148mm;
                overflow: hidden;
                background: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              img.v {
                width: 210mm;
                height: 148mm;
                display: block;
                object-fit: cover;
                transform: scale(${BLEED_SCALE});
                transform-origin: center center;
              }
            </style>
          </head>
          <body>
            <div class="sheet">
              <img class="v" id="v" alt="voucher" />
            </div>
            <script>
              const img = document.getElementById("v");
              img.src = ${JSON.stringify(dataUrl)};
              img.onload = () => {
                setTimeout(() => { window.focus(); window.print(); }, 120);
              };
              window.onafterprint = () => {
                try { parent.postMessage({ type: "IFRAME_PRINT_DONE" }, "*"); } catch(e){}
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
          try { iframe.remove(); } catch {}
        }, 50);
  
        setPrinting(false);
      };
  
      window.addEventListener("message", onMsg);
    } catch (e) {
      console.error(e);
      alert(e.message || "تعذر طباعة الوصل");
      setPrinting(false);
    }
  };
  

  const clearExtras = () => {
    setVBank("");
    setVFxRate("");
    setVReceivedBy("");
    setVBeneficiary("");
    setVNotes("");
    setCbOne(false);
    setCbTwo(false);

    // ركّز أول حقل إضافي
    setTimeout(() => fxRef.current?.focus(), 50);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
                وصل صرف — {companyKey} — {request?.requestCode || requestId}
              </div>

              <div className="flex items-center gap-3">
              <button
  onClick={saveVoucherAndPrint}
  disabled={printing || saving || !bgReady}
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
  <FiPrinter className={`text-lg ${(printing || saving) ? "animate-spin" : ""}`} />
  {printing || saving
  ? existingVoucher?._id
    ? "جاري الطباعة..."
    : "جاري الإنشاء والطباعة..."
  : existingVoucher?._id
  ? "طباعة الوصل"
  : "إنشاء وطباعة"}</button>

                <button
  onClick={() => {
    resetAllLocal(); // 🧹 يمسح رقم الوصل + extras
    onClose?.();     // ❌ يسكر المودال
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
                    style={{
                      width: "100%",
                      maxWidth: 1200,
                      aspectRatio: "1200/800",
                      margin: "0 auto",
                    }}
                  >
                    <img
                      src={bgDataUrl || voucherImg}
                      alt="voucher"
                      className="absolute inset-0 w-full h-full object-contain"
                      draggable={false}
                    />

                    {/* =======================
                        ✅ Overlay (البيانات)
                       ======================= */}
                    <div className="absolute inset-0 pointer-events-none">
                      {/* التاريخ (من الريكوست) */}
                      <div
                        className="absolute flex items-center gap-5 font-extrabold text-gray-900"
                        style={{ ...pctStyle(POS.date), fontSize: "18px" }}
                      >
                        <span style={{ transform: "translateX(-8px)" }}>{dateParts.yearShort}</span>
                        <span>{dateParts.month}</span>
                        <span>{dateParts.day}</span>
                      </div>

                      {/* ✓ العملة (من الريكوست) */}
                      <div
                        className="absolute text-[18px] font-extrabold text-gray-900 leading-none"
                        style={pctStyle(isUSD ? POS.currencyUSDBox : POS.currencyIQDBox)}
                      >
                        ✓
                      </div>

                      {/* المبلغ (من الريكوست) */}
                      <div
                        className="absolute text-[16px] font-extrabold text-gray-900"
                        style={pctStyle(POS.amountFixed)}
                      >
                        {format2(total)}
                      </div>

                      {/* المبلغ بالحروف (من الريكوست) */}
                      <div
                        className="absolute text-[16px] font-bold text-gray-900 leading-tight"
                        style={{
                          ...pctStyle(POS.amountWords),
                          width: `${POS.amountWords.width}%`,
                          direction: "rtl",
                          textAlign: "right",
                          whiteSpace: "normal",
                        }}
                      >
                        {amountWords}
                      </div>

                      {/* الوصف (من الريكوست) */}
                      <div
                        className="absolute text-[16px] font-semibold text-gray-900 whitespace-pre-wrap"
                        style={{
                          ...pctStyle(POS.description),
                          width: `${POS.description.width}%`,
                          maxHeight: POS.description.height ? `${POS.description.height}%` : "auto",
                          overflow: "hidden",
                          direction: descDir,
                          textAlign: descAlign,
                          lineHeight: 1.25,
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                      >
                        {description}
                      </div>

                      {/* ✅ حقول إضافية تكتبها أنت */}
                      {vFxRate ? (
                        <div
                          className="absolute text-gray-900 font-bold"
                          style={{
                            ...pctStyle(EXTRA.fxRate),
                            width: `${EXTRA.fxRate.width}%`,
                            maxHeight: `${EXTRA.fxRate.height}%`,
                            fontSize: "16px",
                            direction: "ltr",
                            textAlign: "left",
                          }}
                        >
                          {vFxRate}
                        </div>
                      ) : null}

                      {vReceivedBy ? (
                        <div
                          className="absolute text-gray-900 font-bold"
                          style={{
                            ...pctStyle(EXTRA.receivedBy),
                            width: `${EXTRA.receivedBy.width}%`,
                            maxHeight: `${EXTRA.receivedBy.height}%`,
                            fontSize: "16px",
                            direction: "rtl",
                            textAlign: "right",
                          }}
                        >
                          {vReceivedBy}
                        </div>
                      ) : null}

                      {vBank ? (
                        <div
                          className="absolute text-gray-900 font-bold"
                          style={{
                            ...pctStyle(EXTRA.bank),
                            width: `${EXTRA.bank.width}%`,
                            maxHeight: `${EXTRA.bank.height}%`,
                            fontSize: "16px",
                            direction: "rtl",
                            textAlign: "right",
                          }}
                        >
                          {vBank}
                        </div>
                      ) : null}

                      {vBeneficiary ? (
                        <div
                          className="absolute text-gray-900 font-bold"
                          style={{
                            ...pctStyle(EXTRA.beneficiary),
                            width: `${EXTRA.beneficiary.width}%`,
                            maxHeight: `${EXTRA.beneficiary.height}%`,
                            fontSize: "16px",
                            direction: "rtl",
                            textAlign: "right",
                          }}
                        >
                          {vBeneficiary}
                        </div>
                      ) : null}

                      {vNotes ? (
                        <div
                          className="absolute text-gray-900 font-bold whitespace-pre-wrap"
                          style={{
                            ...pctStyle(EXTRA.notes),
                            width: `${EXTRA.notes.width}%`,
                            maxHeight: `${EXTRA.notes.height}%`,
                            fontSize: "16px",
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

                      {/* شيك بوكسين */}
                      {cbOne ? (
                        <div
                          className="absolute text-gray-900 font-extrabold leading-none"
                          style={{ ...pctStyle(EXTRA.cb1), fontSize: "18px" }}
                        >
                          ✓
                        </div>
                      ) : null}

                      {cbTwo ? (
                        <div
                          className="absolute text-gray-900 font-extrabold leading-none"
                          style={{ ...pctStyle(EXTRA.cb2), fontSize: "18px" }}
                        >
                          ✓
                        </div>

                        
                      ) : null}

{voucherNo !== null ? (
  <div
    className="absolute text-gray-900 font-extrabold leading-none"
    style={{
      top: "24%",
      left: "46%",
      fontSize: "20px",
      direction: "ltr",
      textAlign: "left",
      letterSpacing: "1px",
    }}
  >
    {"NO:"}
    {String(voucherNo).padStart(5, "0")}
  </div>
) : null}
                    </div>

                    {/* =======================
                        ✅ Inputs (للكتابة)
                       ======================= */}
                    <div className="absolute inset-0">
                      {/* سعر الصرف */}
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

                      {/* استلمت من */}
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
                          fontWeight: 700,
                        }}
                      />

                      {/* على بنك */}
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

                      {/* المستفيد */}
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

                      {/* ملاحظات */}
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
                          fontWeight: 700,
                          lineHeight: 1.25,
                        }}
                      />

                      {/* شيك بوكسين */}
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

                {/* ✅ أزرار “أضف” مثل الكود السابق */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
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
                      onClick={clearExtras}
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

                  {!bgReady && <div className="text-xs text-gray-600">جاري تحميل صورة الوصل…</div>}
                </div>

                {/* (اختياري) زر حفظ إذا تحتاجه */}
                {/* <div className="mt-4">
                  <button
                    onClick={saveVoucher}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-2xl bg-gray-900 text-white font-extrabold disabled:opacity-60"
                  >
                    {saving ? "جاري الحفظ..." : "حفظ الوصل"}
                  </button>
                </div> */}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}