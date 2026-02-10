"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useRef, useState, useEffect } from "react";

import { toPng } from "html-to-image";
import jsPDF from "jspdf";

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

const BASE_W = 1200;
const BASE_H = 800;

const POS = {
  date: { top: 240, left: 920 },
  recipient: { top: 190, left: 160, width: 860 },
  amountWords: { top: 368, left: 640, width: 900 },
  description: { top: 438, left: 300, width: 650, height: 120 },
};

const AMOUNT_POS = {
  USD: {
    amountUSD: { top: 117, left: 358 },
    amountIQD: { top: 155, left: 460 },
  },
  IQD: {
    amountUSD: { top: 117, left: 183 },
    amountIQD: { top: 155, left: 460 },
  },
};

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
    imgs.map((img) => (typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve()))
  );
}

function isArabicText(s = "") {
  const str = String(s);
  const ar = (str.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const en = (str.match(/[A-Za-z]/g) || []).length;
  return ar >= en && ar > 0;
}

export default function VoucherModal({ open, onClose, request, companyKey, requestId, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);

  const paperRef = useRef(null);

  const [bgDataUrl, setBgDataUrl] = useState("");
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setBgReady(false);
    setBgDataUrl("");

    (async () => {
      try {
        const res = await fetch("/voucher.jpg", { cache: "no-store" });
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
  }, [open]);

  const total = useMemo(() => {
    const items = Array.isArray(request?.items) ? request.items : [];
    return items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  }, [request]);

  const currency = String(request?.currency || "IQD").toUpperCase();

  const date = useMemo(() => {
    const d = request?.createdAt ? new Date(request.createdAt) : new Date();
    return d.toISOString().slice(0, 10);
  }, [request]);

  const description = request?.description || "";
  const amountWords = useMemo(() => toArabicWords(total, currency), [total, currency]);

  const descIsArabic = useMemo(() => isArabicText(description), [description]);
  const descDir = descIsArabic ? "rtl" : "ltr";
  const descAlign = descIsArabic ? "right" : "left";

  const saveVoucher = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ company: companyKey, requestId }),
      });

      const json = await res.json();
      if (!json?.success) {
        alert(json?.error || "Failed to generate voucher");
        return;
      }

      onSaved?.(json.data);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const downloadAsPdf = async () => {
    if (!paperRef.current) return;

    if (!bgReady) {
      alert("خلي ثواني… دا أحمل صورة الوصل");
      return;
    }

    setDownloadingPdf(true);
    try {
      await waitForImages(paperRef.current);
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => requestAnimationFrame(() => r()));

      const dataUrl = await toPng(paperRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const ratio = Math.min(pageW / img.width, pageH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;

      pdf.addImage(dataUrl, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, "FAST");
      pdf.save(`voucher_${request?.requestCode || requestId}_${currency}.pdf`);
    } catch (e) {
      console.error(e);
      alert("تعذر تحويل الوصل إلى PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ✅ Print: CSS داخل body (جوه) + توسيط كامل + بدون قص
  const printVoucher = async () => {
    if (!paperRef.current) return;
  
    if (!bgReady) {
      alert("خلي ثواني… دا أحمل صورة الوصل");
      return;
    }
  
    setPrinting(true);
    try {
      await waitForImages(paperRef.current);
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => requestAnimationFrame(() => r()));
  
      const dataUrl = await toPng(paperRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
  
      // ✅ خليها Portrait (مثل نافذة الطباعة عندك)
      const PAGE_W_MM = 210;
      const PAGE_H_MM = 297;
  
      // ✅ تريد تنزّل الصورة؟ غيّر هذا
      const EXTRA_DOWN_MM = 20;
  
      // ✅ نزغر شوي حتى نضمن 100% صفحة وحدة (مهم)
      const SAFE_SCALE = 0.94;
  
      // ✅ نحسب القياس حتى يدخل داخل A4 بدون ما يطلع برا
      const ratio = Math.min(PAGE_W_MM / BASE_W, PAGE_H_MM / BASE_H) * SAFE_SCALE;
      const printW = BASE_W * ratio;
      const printH = BASE_H * ratio;
  
      // ✅ توسيط
      const offsetX = (PAGE_W_MM - printW) / 2;
      const offsetY = (PAGE_H_MM - printH) / 2;
  
      // ✅ أهم سطر: امنع النزول يخليها تتجاوز جوه (حتى ما تصير Page 2)
      const maxDown = PAGE_H_MM - (offsetY + printH); // المساحة الباقية تحت
      const down = Math.min(EXTRA_DOWN_MM, maxDown);
      const topMm = offsetY + down;
  
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
        alert("تعذر فتح الطباعة.");
        return;
      }
  
      doc.open();
      doc.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Voucher</title>
          </head>
          <body>
            <style>
              @page { size: A4 portrait; margin: 0; }
              html, body { margin: 0; padding: 0; background: #fff; height: ${PAGE_H_MM}mm; overflow: hidden; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .sheet {
                width: ${PAGE_W_MM}mm;
                height: ${PAGE_H_MM}mm;
                position: relative;
                overflow: hidden; /* ✅ يمنع أي صفحة ثانية */
                background: #fff;
              }
              img.v {
                position: absolute;
                left: ${offsetX}mm;
                top: ${topMm}mm;
                width: ${printW}mm;
                height: ${printH}mm;
                display: block;
              }
            </style>
  
            <div class="sheet">
              <img class="v" id="v" />
            </div>
  
            <script>
              const img = document.getElementById("v");
              img.src = ${JSON.stringify(dataUrl)};
              img.onload = () => setTimeout(() => { window.focus(); window.print(); }, 120);
              setTimeout(() => { window.focus(); window.print(); }, 700);
              window.onafterprint = () => window.close();
            </script>
          </body>
        </html>
      `);
      doc.close();
  
      // تنظيف
      setTimeout(() => {
        try { iframe.remove(); } catch {}
      }, 5000);
    } catch (e) {
      console.error(e);
      alert("تعذر طباعة الوصل.");
    } finally {
      setPrinting(false);
    }
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

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadAsPdf}
                  disabled={downloadingPdf}
                  className="px-4 py-2 rounded-2xl bg-red-700 text-white font-extrabold hover:bg-red-800 disabled:opacity-60"
                >
                  {downloadingPdf ? "جاري التحويل..." : "تحميل PDF"}
                </button>

                {/* <button
                  onClick={saveVoucher}
                  disabled={saving}
                  className="px-4 py-2 rounded-2xl bg-gray-900 text-white font-extrabold hover:bg-black disabled:opacity-60"
                >
                  {saving ? "جاري الحفظ..." : "توليد/حفظ الوصل"}
                </button> */}

                <button
                  onClick={printVoucher}
                  disabled={printing}
                  className="px-4 py-2 rounded-2xl bg-white/50 ring-1 ring-white/25 font-bold hover:bg-white/70 disabled:opacity-60"
                >
                  {printing ? "جاري الطباعة..." : "طباعة"}
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-2xl bg-white/50 ring-1 ring-white/25 font-bold hover:bg-white/70"
                >
                  إغلاق
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 p-4">
                <div className="w-full overflow-auto">
                  <div
                    ref={paperRef}
                    className="relative bg-white rounded-2xl overflow-hidden ring-1 ring-black/5"
                    style={{
                      width: "100%",
                      maxWidth: BASE_W,
                      aspectRatio: `${BASE_W}/${BASE_H}`,
                      margin: "0 auto",
                    }}
                  >
                    <img
                      src={bgDataUrl || "/voucher.jpg"}
                      alt="voucher"
                      className="absolute inset-0 w-full h-full object-contain"
                      draggable={false}
                    />

                    <div className="absolute inset-0">
                      <div
                        className="absolute text-[14px] font-bold text-gray-900"
                        style={{
                          top: `${(POS.date.top / BASE_H) * 100}%`,
                          left: `${(POS.date.left / BASE_W) * 100}%`,
                        }}
                      >
                        {date}
                      </div>

                      <div
                        className="absolute text-[14px] font-extrabold text-gray-900"
                        style={{
                          top: `${(
                            (currency === "USD" ? AMOUNT_POS.USD.amountUSD.top : AMOUNT_POS.IQD.amountUSD.top) /
                            BASE_H
                          ) * 100}%`,
                          left: `${(
                            (currency === "USD" ? AMOUNT_POS.USD.amountUSD.left : AMOUNT_POS.IQD.amountUSD.left) /
                            BASE_W
                          ) * 100}%`,
                        }}
                      >
                        {format2(total)}
                      </div>

                      <div
                        className="absolute text-[13px] font-bold text-gray-900 leading-tight"
                        style={{
                          top: `${(POS.amountWords.top / BASE_H) * 100}%`,
                          left: `${(POS.amountWords.left / BASE_W) * 100}%`,
                          width: `${(POS.amountWords.width / BASE_W) * 100}%`,
                        }}
                      >
                        {amountWords}
                      </div>

                      <div
                        className="absolute text-[13px] font-semibold text-gray-900 whitespace-pre-wrap"
                        style={{
                          top: `${(POS.description.top / BASE_H) * 100}%`,
                          left: `${(POS.description.left / BASE_W) * 100}%`,
                          width: `${((POS.description.width || 900) / BASE_W) * 100}%`,
                          maxHeight: POS.description.height
                            ? `${(POS.description.height / BASE_H) * 100}%`
                            : "auto",
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
                    </div>
                  </div>
                </div>

                {!bgReady && <div className="mt-3 text-xs text-gray-600">جاري تحميل صورة الوصل…</div>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}