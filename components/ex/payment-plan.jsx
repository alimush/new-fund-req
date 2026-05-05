"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiPlus, FiTrash2, FiImage, FiCheck , FiPrinter} from "react-icons/fi";
import { Cairo } from "next/font/google";
import { useEffect } from "react";
import { FiPaperclip, FiFileText } from "react-icons/fi"; // فوق بالimports


const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700", "800"] });

const TEMPLATE_IMG = "/payment-plan-a4.jpg";
const pct = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    })
  );
}



function todayStrDMY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function ymdToDMY(v) {
  if (!v) return "";
  if (String(v).includes("/")) return v;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function dmyToYMD(v) {
  if (!v) return "";
  const s = String(v);
  if (s.includes("-")) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const fmtInt = (n) => new Intl.NumberFormat("en-US").format(Number(n || 0));
const MAX_ROWS_PER_PAGE = 15;

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin"
      aria-label="loading"
    />
  );
}

export default function PaymentPlanGenerator({
    open = true,
    onClose,
    initialForm = null,
    onCreate,
  }) {  const close = () => onClose?.();

    const getCurrentUsername = () =>
      (typeof window !== "undefined" && (localStorage.getItem("username") || "")) || "";

    const AR_ORDINALS = [
      "الأولى",
      "الثانية",
      "الثالثة",
      "الرابعة",
      "الخامسة",
      "السادسة",
      "السابعة",
      "الثامنة",
      "التاسعة",
      "العاشرة",
    ];
    
    function defaultPayType(index) {
      const n = index + 1;
      const ord = AR_ORDINALS[index] || String(n); // بعد العاشرة يكتب رقم
      return `الدفعة ${ord}`;
    }

  const [activeTab, setActiveTab] = useState("Header");
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

const [attachment, setAttachment] = useState([]);     // ملفات فعلية قبل الرفع
const [dragOver, setDragOver] = useState(false);
const [hasPrinted, setHasPrinted] = useState(false);

const addFiles = (filesArr) => {
  if (!filesArr?.length) return;

  setAttachment((prev) => {
    const current = prev || [];
    const map = new Map(current.map((f) => [`${f.name}_${f.size}`, f]));
    for (const f of filesArr) map.set(`${f.name}_${f.size}`, f);
    return Array.from(map.values());
  });
};

const openAttachment = (file) => {
  if (!file) return;

  // ✅ إذا جاي من السيرفر (signed url)
  if (file.url) {
    window.open(file.url, "_blank", "noopener,noreferrer");
    return;
  }

  // ✅ إذا ملف محلي قبل الرفع (File)
  const url = URL.createObjectURL(file);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const steps = useMemo(
  () => [
    { key: "Header", label: "Header" },
    { key: "Table", label: "Table" },
    { key: "Footer", label: "Footer" },
    { key: "Review", label: "Review" },
    { key: "Attachment", label: "Attachment" },
  ],
  []
);

  // ✅ حذفنا signature من الفورم
  const [form, setForm] = useState(() => ({
    salesEmp: initialForm?.salesEmp || getCurrentUsername(), // ✅ هنا
    customer: initialForm?.customer || "",
    unitNo: initialForm?.unitNo || "",
    dateDMY: initialForm?.dateDMY || todayStrDMY(),
    discount: initialForm?.discount || "",
    rows:
      Array.isArray(initialForm?.rows) && initialForm.rows.length
        ? initialForm.rows
       : [{ payType: defaultPayType(0), amount: "", payDateYMD: "" }],
  }));

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const setRow = (idx, key, val) => {
    setForm((p) => {
      const rows = [...p.rows];
      rows[idx] = { ...rows[idx], [key]: val };
      return { ...p, rows };
    });
  };

  const addRow = () => {
    setForm((p) => {
      const nextIndex = (p.rows?.length || 0);
      return {
        ...p,
        rows: [
          ...(p.rows || []),
          { payType: defaultPayType(nextIndex), amount: "", payDateYMD: "" },
        ],
      };
    });
  };

  const removeRow = (idx) => {
    setForm((p) => {
      const rows = (p.rows || [])
        .filter((_, i) => i !== idx)
        .map((r, i) => ({
          ...r,
          payType: r.payType?.trim() ? r.payType : defaultPayType(i), // إذا فارغ فقط
        }));
  
      // أو إذا تريد تفرض إعادة الترقيم دائمًا:
      // .map((r, i) => ({ ...r, payType: defaultPayType(i) }))
  
      return { ...p, rows };
    });
  };

  const resetAll = () => {
    setForm({
      salesEmp: "",
      customer: "",
      unitNo: "",
      dateDMY: todayStrDMY(),
      discount: "",
      rows: [{ payType: "", amount: "", payDateYMD: "" }],
    });
    setServerMsg("");
    setActiveTab("Header");
    setHasPrinted(false);
  };

  const POS = useMemo(
    () => ({
      salesEmp: { top: 10.5, left: 2.5, width: 28, height: 3.8 },
      date: { top: 10.5, left: 48, width: 18, height: 3.8 },
      customer: { top: 13.6, left: 3, width: 28, height: 3.8 },
      unitNo: { top: 13.6, left: 47.5, width: 18, height: 3.8 },

      table: {
        startTop: 30,
        rowH: 3.2,
        colPayType: { left: 9.5, width: 22, height: 1 },
        colAmount: { left: 33.0, width: 18, height: 1 },
        colDate: { left: 52.5, width: 15, height: 1 },
      },

      discount: { top: 79, left: 7, width: 39, height: 3.6 },
      // ✅ حذفنا signature من POS
    }),
    []
  );

  const rowTop = (i) => POS.table.startTop + i * POS.table.rowH;

  // ✅ Multi-page للطباعة: 15 سطر لكل صفحة
  const pages = useMemo(() => {
    const chunks = [];
    const all = form.rows || [];
    for (let i = 0; i < all.length; i += MAX_ROWS_PER_PAGE) {
      chunks.push(all.slice(i, i + MAX_ROWS_PER_PAGE));
    }
    return chunks.length ? chunks : [[]];
  }, [form.rows]);

  const pageRefs = useRef([]);
  pageRefs.current = [];
  const setPageRef = (i) => (el) => {
    if (el) pageRefs.current[i] = el;
  };

  const buildPagePngs = async () => {
    const nodes = pageRefs.current.filter(Boolean);
    if (!nodes.length) return [];

    for (const n of nodes) await waitForImages(n);

    const pngs = [];
    for (const node of nodes) {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });
      pngs.push(dataUrl);
    }
    return pngs;
  };

  function printAllPngs(pngs, onDone) {
    if (!pngs?.length) return;
  
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
  
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
  
    const imgsHtml = pngs
      .map((src) => `<div class="page"><img src="${src}" /></div>`)
      .join("");
  
    doc.open();
    const callbackName = 'onPrintDone_' + Date.now();
    window[callbackName] = () => {
      if (onDone) onDone();
      cleanup();
      delete window[callbackName];
    };

    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print</title>
          <style>
            @page { size: A4; margin: 0; }
            html, body { margin: 0; padding: 0; background: white; }
            .page {
              width: 210mm;
              height: 297mm;
              page-break-after: always;
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
            }
            img {
              width: 210mm;
              height: 297mm;
              display: block;
            }
          </style>
        </head>
        <body>
          ${imgsHtml}
          <script>
            const imgs = Array.from(document.images);
            let loaded = 0;
  
            window.addEventListener("afterprint", function() {
              if (window.parent && typeof window.parent["${callbackName}"] === "function") {
                window.parent["${callbackName}"]();
              }
            });

            function done() {
              window.focus();
              window.print();
            }
  
            if (!imgs.length) done();
  
            imgs.forEach((im) => {
              if (im.complete) {
                loaded++;
                if (loaded === imgs.length) done();
                return;
              }
  
              im.onload = () => {
                loaded++;
                if (loaded === imgs.length) done();
              };
  
              im.onerror = () => {
                loaded++;
                if (loaded === imgs.length) done();
              };
            });
          </script>
        </body>
      </html>
    `);
    doc.close();
  
    const cleanup = () => {
      try {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      } catch {}
    };

    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
      }
      cleanup();
    }, 1000 * 60 * 5);
  }
  
  const doPrint = async () => {
    const pngs = await buildPagePngs();
    if (!pngs.length) return;
    printAllPngs(pngs, () => {
      setHasPrinted(true);
    });
  };

  const currentStepIndex = steps.findIndex((s) => s.key === activeTab);
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  // ✅ تنظيف rows + حساب مجموع
  const cleanedRows = useMemo(() => {
    return (form.rows || [])
      .map((r) => ({
        payType: String(r.payType || "").trim(),
        amount: String(r.amount || "").trim(),
        payDateYMD: String(r.payDateYMD || "").trim(),
      }))
      .filter((r) => r.payType || r.amount || r.payDateYMD);
  }, [form.rows]);

  const totalAmount = useMemo(() => {
    return cleanedRows.reduce((sum, r) => {
      const n = Number(String(r.amount || "0").replace(/,/g, ""));
      return sum + (isFinite(n) ? n : 0);
    }, 0);
  }, [cleanedRows]);

  // ✅ زر الإنشاء: يدز إلى API ويخزن بالمونغو (بدون signature)
  const handleCreate = async () => {
    setServerMsg("");
  
    if (!attachment || attachment.length === 0) {
      setServerMsg("يرجى إضافة مرفق واحد على الأقل.");
      return;
    }
  
    setSubmitting(true);
  


  
    try {
      // 1) upload attachments to S3 (presigned)
      const uploadedAttachments = [];
  
      if (attachment?.length > 0) {
        for (const file of attachment) {
          const presignRes = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              prefix: `payment-plans`, // تقدر تخلي companyKey إذا عندك
            }),
          });
  
          if (!presignRes.ok) throw new Error("Failed to get upload URL");
          const { url, key, getUrl } = await presignRes.json();

          const uploadRes = await fetch(url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
          
          if (!uploadRes.ok) throw new Error("Failed to upload file");
          
          uploadedAttachments.push({ key, name: file.name, url: getUrl || "" });
        }
      }
  
      // 2) create payment plan payload
      const payload = {
        salesEmp: form.salesEmp,
        customer: form.customer,
        unitNo: form.unitNo,
        dateDMY: form.dateDMY,
        discount: form.discount,
        rows: cleanedRows,
        attachments: uploadedAttachments, // ✅ مهم
      };
  
      await onCreate?.(payload);
    } catch (e) {
      console.error(e);
      setServerMsg(e?.message || "صار خطأ أثناء الإنشاء.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${cairo.className}`}>
      {/* Hidden render area فقط للطباعة/الصور */}
      <div className="sr-only" aria-hidden="true">
        {pages.map((rowsChunk, pageIdx) => (
          <div
            key={pageIdx}
            ref={setPageRef(pageIdx)}
            className="relative bg-white overflow-hidden"
            style={{ width: 900, aspectRatio: "210/297" }}
          >
            <img
              src={TEMPLATE_IMG}
              alt="template"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />

            <div className="absolute inset-0 text-gray-900">
              {form.salesEmp && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.salesEmp),
                    width: `${POS.salesEmp.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.salesEmp}
                </div>
              )}

              {form.dateDMY && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.date),
                    width: `${POS.date.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.dateDMY}
                </div>
              )}

              {form.customer && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.customer),
                    width: `${POS.customer.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.customer}
                </div>
              )}

              {form.unitNo && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.unitNo),
                    width: `${POS.unitNo.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.unitNo}
                </div>
              )}

              {rowsChunk.map((r, i) => {
                const top = rowTop(i);
                return (
                  <div key={`${pageIdx}_${i}`}>
                    {r.payType && (
                      <div
                        className="absolute font-bold"
                        style={{
                          top: `${top}%`,
                          left: `${POS.table.colPayType.left}%`,
                          width: `${POS.table.colPayType.width}%`,
                          fontSize: 14,
                          direction: "rtl",
                          textAlign: "center",
                        }}
                      >
                        {r.payType}
                      </div>
                    )}

                    {r.amount && (
                      <div
                        className="absolute font-bold"
                        style={{
                          top: `${top}%`,
                          left: `${POS.table.colAmount.left}%`,
                          width: `${POS.table.colAmount.width}%`,
                          fontSize: 14,
                          direction: "ltr",
                          textAlign: "center",
                        }}
                      >
                        {fmtInt(String(r.amount).replace(/,/g, ""))}
                      </div>
                    )}

                    {r.payDateYMD && (
                      <div
                        className="absolute font-bold"
                        style={{
                          top: `${top}%`,
                          left: `${POS.table.colDate.left}%`,
                          width: `${POS.table.colDate.width}%`,
                          fontSize: 14,
                          direction: "rtl",
                          textAlign: "center",
                        }}
                      >
                        {ymdToDMY(r.payDateYMD)}
                      </div>
                    )}
                  </div>
                );
              })}

              {pageIdx === pages.length - 1 && (
                <>
                  {form.discount && (
                    <div
                      className="absolute font-extrabold"
                      style={{
                        ...pct(POS.discount),
                        width: `${POS.discount.width}%`,
                        fontSize: 15,
                        direction: "rtl",
                        textAlign: "center",
                      }}
                    >
                      {form.discount}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-white via-gray-50 to-gray-100 backdrop-blur-xl"
              initial={{ y: 36, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 text-white">
                <h2 className="text-base sm:text-lg font-semibold">Payment Plan — Inputs</h2>
                <button onClick={close} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20">
                  <FiX />
                </button>
              </div>

              {/* Stepper */}
              <div className="px-5 pt-4 pb-3 bg-gray-50/70 border-b">
                <div className="flex items-center justify-between gap-2">
                  {steps.map((s, idx) => {
                    const active = s.key === activeTab;
                    const done = idx < currentStepIndex;

                    return (
                      <div key={s.key} className="flex-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab(s.key)}
                          disabled={s.key === "Attachment" && !hasPrinted}
                          className={`flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl border text-sm transition
                            ${
                              active
                                ? "bg-gray-800 text-white border-gray-800"
                                : done
                                ? "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                            }
                            ${s.key === "Attachment" && !hasPrinted ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                        >
                          <span className="hidden sm:inline">{s.label}</span>
                          <span className="sm:hidden">{idx + 1}</span>
                        </button>

                        {idx < steps.length - 1 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab(steps[idx + 1].key)}
                            className="flex-1 h-1 rounded bg-gray-200 overflow-hidden"
                            title="Next"
                          >
                            <div
                              className={`h-full transition-all duration-300 ${
                                idx < currentStepIndex ? "bg-gray-700 w-full" : "bg-transparent w-0"
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 h-2 w-full bg-gray-200 rounded">
                  <div className="h-2 bg-gray-800 rounded transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>

                <div className="mt-1 text-right text-xs text-gray-500">
                  {currentStepIndex + 1} / {steps.length} — {progressPercent}%
                </div>
              </div>

              {/* Body */}
              <motion.div
                key={activeTab}
                className="p-6 space-y-5"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
              >
                {activeTab === "Header" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <input
  type="text"
  value={form.salesEmp}
  readOnly
  disabled
  className="border border-gray-300 rounded-lg p-2 bg-gray-100 text-gray-800 cursor-not-allowed"
/>

                    <input
                      type="date"
                      value={dmyToYMD(form.dateDMY)}
                      onChange={(e) => setField("dateDMY", ymdToDMY(e.target.value))}
                      className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />

                    <input
                      type="text"
                      placeholder="اسم الزبون"
                      value={form.customer}
                      onChange={(e) => setField("customer", e.target.value)}
                      className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />

                    <input
                      type="text"
                      placeholder="رقم الوحدة"
                      value={form.unitNo}
                      onChange={(e) => setField("unitNo", e.target.value)}
                      className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />

                    <div className="sm:col-span-2 text-right text-xs text-gray-500 font-bold">
                      ✅ التاريخ رح ينعرض بالصورة بصيغة dd/mm/yyyy
                    </div>
                  </div>
                )}

                {activeTab === "Table" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold text-gray-800">جدول الدفعات (Add Row بدون حد)</div>
                      <button
                        type="button"
                        onClick={addRow}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white hover:bg-gray-900"
                      >
                        <FiPlus /> Add Row
                      </button>
                    </div>

                    {/* ✅ سكرول للجدول + ارتفاع ثابت (أفضل بالموبايل/الديسكتوب) */}
                    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/55 backdrop-blur-xl shadow-sm">
                      <div className="overflow-x-auto">
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl text-gray-700 border-b border-black/10">
                              <tr>
                                <th className="text-center px-3 py-3 font-semibold">نوع الدفعة</th>
                                <th className="text-center px-3 py-3 font-semibold">القيمة المالية</th>
                                <th className="text-center px-3 py-3 font-semibold">التاريخ</th>
                                <th className="px-3 py-3" />
                              </tr>
                            </thead>

                            <tbody className="text-gray-800">
                              {form.rows.map((r, i) => (
                                <tr key={i} className="border-b border-black/5 hover:bg-white/60 transition">
                                  <td className="px-3 py-2">
                                    <input
                                      value={r.payType}
                                      onChange={(e) => setRow(i, "payType", e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg p-2 bg-white"
                                      placeholder="مثال: دفعة أولى"
                                    />
                                  </td>

                                  <td className="px-3 py-2">
                                    <input
                                      value={r.amount}
                                      onChange={(e) => setRow(i, "amount", e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg p-2 bg-white text-center"
                                      placeholder="مثال: 1,500,000"
                                      inputMode="numeric"
                                    />
                                  </td>

                                  <td className="px-3 py-2">
                                    <input
                                      type="date"
                                      value={r.payDateYMD || ""}
                                      onChange={(e) => setRow(i, "payDateYMD", e.target.value)}
                                      className="w-full border border-gray-200 rounded-lg p-2 bg-white text-center"
                                    />
                                  </td>

                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeRow(i)}
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 bg-white/70 text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
                                      title="Remove"
                                    >
                                      <FiTrash2 />
                                      حذف
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                  
                  </div>
                )}

{activeTab === "Attachment" && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-gray-800">المرفقات</div>
        <div className="text-xs text-gray-500">تقدر ترفع صور / PDF / Excel</div>
      </div>

      {attachment?.length > 0 && (
        <span className="text-xs px-2.5 py-1 rounded-full border border-black/10 bg-white/60 text-gray-700">
          {attachment.length} file(s)
        </span>
      )}
    </div>

    <div
      className={`rounded-2xl border border-black/10 bg-white/55 shadow-sm p-4 transition
        ${dragOver ? "ring-2 ring-blue-300 bg-white/75" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        addFiles(Array.from(e.dataTransfer.files || []));
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-black/10 bg-white/70 flex items-center justify-center text-gray-600">
            <FiPaperclip className="text-lg" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-800">رفع مرفق</div>
            <div className="text-xs text-gray-500">اختار أو Drag & Drop</div>
          </div>
        </div>

        <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white text-sm cursor-pointer hover:bg-gray-900 transition">
          <FiPlus className="text-base" />
          Add Files
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {attachment?.length > 0 ? (
        <div className="mt-4 space-y-2">
          {attachment.map((file, i) => (
            <div
              key={i}
              onClick={() => openAttachment(file)}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-black/10 bg-white/65 hover:bg-white/80 transition cursor-pointer"
            >
              <div className="min-w-0 flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl border border-black/10 bg-white/70 flex items-center justify-center text-gray-600">
                  <FiFileText />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{file.name}</div>
                  <div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAttachment((prev) => (prev || []).filter((_, idx) => idx !== i));
                }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-black/10 bg-white/70 text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
              >
                <FiTrash2 className="text-[14px]" />
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-black/10 bg-white/60 p-5 text-center text-xs text-gray-600">
          ماكو مرفقات بعد
        </div>
      )}
    </div>
  </div>
)}

                {activeTab === "Footer" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="الخصم"
                      value={form.discount}
                      onChange={(e) => setField("discount", e.target.value)}
                      className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />
                    <div className="sm:col-span-2 text-right text-xs text-gray-500 font-bold">
                      ✅ الخصم رح ينطبع فقط بآخر صفحة.
                    </div>
                  </div>
                )}

                {activeTab === "Review" && (
                  <div className="space-y-4">
                    {serverMsg && (
                      <div className="rounded-xl border border-black/10 bg-white/80 p-3 text-sm font-bold text-gray-800">
                        {serverMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                        <div className="text-xs text-gray-500">اسم موظف المبيعات</div>
                        <div className="font-extrabold text-gray-800">{form.salesEmp || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                        <div className="text-xs text-gray-500">التاريخ</div>
                        <div className="font-extrabold text-gray-800">{form.dateDMY || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                        <div className="text-xs text-gray-500">الزبون</div>
                        <div className="font-extrabold text-gray-800">{form.customer || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                        <div className="text-xs text-gray-500">رقم الوحدة</div>
                        <div className="font-extrabold text-gray-800">{form.unitNo || "-"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                        <div className="text-xs text-gray-500">الخصم</div>
                        <div className="font-extrabold text-gray-800">{form.discount || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                        <div className="text-xs text-gray-500">عدد الصفحات</div>
                        <div className="font-extrabold text-gray-800">{pages.length}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/10 bg-white/70 overflow-hidden">
                      <div className="px-4 py-3 border-b bg-white/60 font-extrabold text-gray-800 flex justify-between">
                        <span>صفوف الدفعات: {cleanedRows.length}</span>
                        <span>حد الطباعة للصفحة: {MAX_ROWS_PER_PAGE}</span>
                      </div>

                      {/* ✅ سكرول لتيبل الريفيو */}
                      <div className="overflow-x-auto">
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-gray-100/90 backdrop-blur-xl text-gray-700">
                              <tr>
                                <th className="text-center px-4 py-2 font-semibold">نوع</th>
                                <th className="text-center px-4 py-2 font-semibold">المبلغ</th>
                                <th className="text-center px-4 py-2 font-semibold">التاريخ</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white/70">
                              {cleanedRows.length ? (
                                cleanedRows.map((r, i) => (
                                  <tr key={i} className="border-t border-gray-200/60 hover:bg-white/80 transition">
                                    <td className="px-4 py-2 text-center">{r.payType || "-"}</td>
                                    <td className="px-4 py-2 text-center">
                                      {r.amount ? fmtInt(String(r.amount).replace(/,/g, "")) : "-"}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {r.payDateYMD ? ymdToDMY(r.payDateYMD) : "-"}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                                    ماكو صفوف مدخلة
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="px-4 py-3 border-t bg-white/60 text-right font-extrabold text-gray-800">
                        مجموع المبالغ: {fmtInt(totalAmount)}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Footer Buttons */}
              <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                <button
                  onClick={close}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                >
                  اغلاق
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetAll}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-extrabold disabled:opacity-50"
                  >
                    مسح الكل
                  </button>

                  {activeTab === "Review" && (
                    <button
                      onClick={doPrint}
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-lg flex items-center gap-2 font-extrabold bg-gray-700 hover:bg-gray-800 text-white disabled:opacity-50"
                    >
                      <FiPrinter /> طباعة
                    </button>
                  )}

                  {activeTab === "Attachment" ? (
                    <button
                      onClick={handleCreate}
                      disabled={submitting || attachment.length === 0}
                      className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-extrabold text-white ${
                        submitting || attachment.length === 0
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-gray-900 hover:bg-black"
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Spinner /> جارِ الإنشاء...
                        </>
                      ) : (
                        <>
                          <FiCheck /> إنشاء
                        </>
                      )}
                    </button>
                  ) : (
                    <motion.button
                      onClick={() => {
                        const idx = steps.findIndex((s) => s.key === activeTab);
                        setActiveTab(steps[Math.min(idx + 1, steps.length - 1)].key);
                      }}
                      disabled={activeTab === "Review" && !hasPrinted}
                      whileHover={{ scale: (activeTab === "Review" && !hasPrinted) ? 1 : 1.03 }}
                      className={`px-5 py-2.5 rounded-lg font-extrabold ${
                        (activeTab === "Review" && !hasPrinted)
                          ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                          : "bg-gray-700 text-white hover:bg-gray-800"
                      }`}
                    >
                      التالي →
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}