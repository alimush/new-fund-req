"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiPlus, FiTrash2, FiImage, FiCheck, FiPaperclip, FiFileText , FiPrinter } from "react-icons/fi";
import { Cairo } from "next/font/google";

import { getExForm } from "@/lib/exForms/registry";

const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700", "800"] });

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

const fmtInt = (n) =>
  new Intl.NumberFormat("en-US").format(Number(String(n || "0").replace(/,/g, "") || 0));

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin"
      aria-label="loading"
    />
  );
}

function numberToArabicWordsIQD(input) {
  const n = Number(String(input || "").replace(/[^\d]/g, ""));
  if (!n) return "صفر دينار عراقي فقط لا غير";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
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
  const hundreds = ["", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة", "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة"];

  const twoDigits = (x) => {
    x = Number(x);
    if (x === 0) return "";
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    const t = Math.floor(x / 10);
    const o = x % 10;
    return o ? `${ones[o]} و ${tens[t]}` : tens[t];
  };
  const threeDigits = (x) => {
    x = Number(x);
    if (x === 0) return "";
    const h = Math.floor(x / 100);
    const r = x % 100;

    const hPart = hundreds[h] || "";
    const rPart = twoDigits(r);

    if (hPart && rPart) return `${hPart} و ${rPart}`;
    return hPart || rPart || "";
  };

  const groupName = (idx, val) => {
    val = Number(val);
    if (idx === 0) return "";

    if (idx === 1) {
      if (val === 1) return "ألف";
      if (val === 2) return "ألفان";
      if (val >= 3 && val <= 10) return "آلاف";
      return "ألف";
    }

    if (idx === 2) {
      if (val === 1) return "مليون";
      if (val === 2) return "مليونان";
      if (val >= 3 && val <= 10) return "ملايين";
      return "مليون";
    }

    if (idx === 3) {
      if (val === 1) return "مليار";
      if (val === 2) return "ملياران";
      if (val >= 3 && val <= 10) return "مليارات";
      return "مليار";
    }

    return "";
  };

  const s = String(n);
  const groups = [];
  for (let i = s.length; i > 0; i -= 3) {
    groups.push(Number(s.substring(Math.max(0, i - 3), i)));
  }

  const parts = [];
  for (let idx = groups.length - 1; idx >= 0; idx--) {
    const gVal = groups[idx];
    if (!gVal) continue;

    const words = threeDigits(gVal);
    const name = groupName(idx, gVal);

    if (idx === 0) {
      parts.push(words);
    } else {
      if (gVal === 1) parts.push(name);
      else if (gVal === 2) parts.push(name);
      else parts.push(`${words} ${name}`.trim());
    }
  }

  const result = parts.join(" و ").replace(/\s+/g, " ").trim();
  return `${result} دينار عراقي فقط لا غير`;
}

export default function ReplaceBookingTransferGenerator({
  open = true,
  onClose,
  initialForm = null,
  onCreate,
  formKey = "replace-booking-transfer", // ✅ داينمك
}) {
  const close = () => onClose?.();

  const getCurrentUsername = () =>
    (typeof window !== "undefined" && (localStorage.getItem("username") || "")) || "";

  // ✅ config from registry
  const cfg = useMemo(() => getExForm(formKey), [formKey]);

  const TEMPLATE_IMG = cfg?.template?.url || cfg?.template?.img || "/replace-booking-transfer-a4.jpg";
  const POS = cfg?.pos || {};
  const FIELDS = Array.isArray(cfg?.fields) ? cfg.fields : [];
  const isAttachmentOnly = formKey === "attachment-only" || cfg?.key === "attachment-only";

  // steps ثابتة
  const steps = useMemo(
    () =>
      isAttachmentOnly
    ? [
        { key: "Header", label: "بيانات المعاملة" },
        { key: "Attachment", label: "Attachment" },
      ]
        : [
            { key: "Header", label: "Header" },
            { key: "Review", label: "Review" },
            { key: "Attachment", label: "Attachment" },
          ],
    [isAttachmentOnly]
  );

  const [activeTab, setActiveTab] = useState("Header");
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  const [attachment, setAttachment] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  // ✅ init form dynamically from FIELDS
  const makeInitialForm = () => {
    const base = {};
    for (const f of FIELDS) {
      base[f.name] = initialForm?.[f.name] ?? "";
    }
    if ("salesEmp" in base && !base.salesEmp) base.salesEmp = getCurrentUsername();
    if ("createdBy" in base && !base.createdBy) base.createdBy = getCurrentUsername();
    if ("dateDMY" in base && !base.dateDMY) base.dateDMY = todayStrDMY();
    return base;
  };

  const [form, setForm] = useState(() => makeInitialForm());

  // ✅ re-init when formKey changes
  useEffect(() => {
    setForm(makeInitialForm());
    setAttachment([]);
    setServerMsg("");
    setActiveTab("Header");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, isAttachmentOnly]);

  const resetAll = () => {
    setForm(makeInitialForm());
    setAttachment([]);
    setServerMsg("");
    setActiveTab("Header");
  };

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

    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
      return;
    }

    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const pageRef = useRef(null);

  const buildPagePng = async () => {
    const node = pageRef.current;
    if (!node) return null;

    await waitForImages(node);

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#ffffff",
    });

    return dataUrl;
  };

  function printAllPngs(pngs) {
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
  
    const imgsHtml = pngs.map((src) => `<div class="page"><img src="${src}" /></div>`).join("");
  
    doc.open();
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print</title>
          <style>
            @page { size: A4; margin: 0; }
            html, body { margin:0; padding:0; }
            .page { width: 210mm; height: 297mm; page-break-after: always; }
            img { width: 210mm; height: 297mm; display:block; }
          </style>
        </head>
        <body>
          ${imgsHtml}
          <script>
            const imgs = Array.from(document.images);
            let loaded = 0;
            function done(){
              window.focus();
              window.print();
            }
            if(!imgs.length){ done(); }
            imgs.forEach(im=>{
              if(im.complete){ loaded++; if(loaded===imgs.length) done(); return; }
              im.onload = ()=>{ loaded++; if(loaded===imgs.length) done(); };
              im.onerror = ()=>{ loaded++; if(loaded===imgs.length) done(); };
            });
          </script>
        </body>
      </html>
    `);
    doc.close();
  
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }, 2500);
  }
  
  const doPrint = async () => {
    const png = await buildPagePng();
    if (!png) return;
    printAllPngs([png]);
  };
  const currentStepIndex = steps.findIndex((s) => s.key === activeTab);
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  // helper: find words field for IQD
  const wordsFieldName = useMemo(() => {
    const f = FIELDS.find((x) => x.type === "arabicWordsIQD");
    return f?.name || "";
  }, [FIELDS]);

  const handleCreate = async () => {

    // ✅ المرفق إجباري
    if (!attachment || attachment.length === 0) {
      setServerMsg("⚠️ يجب إضافة مرفق واحد على الأقل قبل إنشاء الطلب");
      setActiveTab("Attachment");
      return;
    }
  
    setServerMsg("");
    setSubmitting(true);

    try {
      const uploadedAttachments = [];

      if (attachment?.length > 0) {
        for (const file of attachment) {
          const presignRes = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              prefix: cfg?.key || formKey, // ✅ داينمك
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

      // ✅ payload dynamic from fields
      const payload = {
        pageKey: cfg?.key || formKey,
        attachments: uploadedAttachments,
      };

      for (const f of FIELDS) {
        payload[f.name] = form?.[f.name] ?? "";
      }

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
        <div ref={pageRef} className="relative bg-white overflow-hidden" style={{ width: 900, aspectRatio: "210/297" }}>
        {TEMPLATE_IMG ? (
  <img
    src={TEMPLATE_IMG}
    alt="template"
    className="absolute inset-0 w-full h-full object-contain"
    draggable={false}
  />
) : (
  <div className="absolute inset-0 bg-white" />
)}

          <div className="absolute inset-0 text-gray-900">
            {/* ✅ overlay dynamic from cfg.pos + cfg.fields */}
            {FIELDS.map((f) => {
              const v = form?.[f.name];
              if (!v) return null;

              const p = POS?.[f.name];
              if (!p) return null;

              const text = f.type === "moneyIQD" ? fmtInt(v) : String(v);

              const style = {
                ...pct(p),
                width: `${p.width ?? 20}%`,
                height: p.height ? `${p.height}%` : undefined,
                fontSize: p.fontSize ?? 16,
                direction: p.dir || "rtl",
                textAlign: p.align || (p.dir === "ltr" ? "left" : "right"),
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                paddingLeft: p.pinLeft ? 8 : 0,
                paddingRight: p.pinLeft ? 0 : 8,
                lineHeight: 1.4,
              };

              return (
                <div key={f.name} className="absolute font-extrabold" style={style}>
                  {text}
                </div>
              );
            })}
          </div>
        </div>
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
                <h2 className="text-base sm:text-lg font-semibold">{cfg?.title || "Ex Form"} — Inputs</h2>
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
                          className={`flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl border text-sm transition
                            ${
                              active
                                ? "bg-gray-800 text-white border-gray-800"
                                : done
                                ? "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                            }`}
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
                {/* ================= Header tab (dynamic fields) ================= */}
                {activeTab === "Header" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FIELDS.map((f) => {
                      const val = form?.[f.name] ?? "";

                      // dateDMY
                      if (f.type === "dateDMY") {
                        return (
                          <input
                            key={f.name}
                            type="date"
                            value={dmyToYMD(val)}
                            onChange={(e) => setField(f.name, ymdToDMY(e.target.value))}
                            readOnly={!!f.readOnly}
                            disabled={!!f.readOnly}
                            className={`border border-gray-300 rounded-lg p-2 text-gray-800 ${
                              f.readOnly ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                            } ${f.fullWidth ? "sm:col-span-2" : ""}`}
                          />
                        );
                      }

                      // moneyIQD
                      if (f.type === "moneyIQD") {
                        return (
                          <input
                            key={f.name}
                            type="text"
                            placeholder={f.label}
                            value={val}
                            onChange={(e) => {
                              const numeric = String(e.target.value || "").replace(/[^\d]/g, "");

                              if (!numeric) {
                                setField(f.name, "");
                                if (wordsFieldName) setField(wordsFieldName, "");
                                return;
                              }

                              const formatted = new Intl.NumberFormat("en-US").format(Number(numeric));
                              setField(f.name, formatted);

                              if (wordsFieldName) setField(wordsFieldName, numberToArabicWordsIQD(numeric));
                            }}
                            inputMode="numeric"
                            readOnly={!!f.readOnly}
                            disabled={!!f.readOnly}
                            className={`border border-gray-300 rounded-lg p-2 text-gray-800 ${
                              f.readOnly ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                            } ${f.fullWidth ? "sm:col-span-2" : ""}`}
                          />
                        );
                      }

                      // arabicWordsIQD
                      if (f.type === "arabicWordsIQD") {
                        return (
                          <input
                            key={f.name}
                            type="text"
                            placeholder={f.label}
                            value={val}
                            readOnly
                            disabled
                            className={`border border-gray-300 rounded-lg p-2 bg-gray-100 text-gray-800 cursor-not-allowed ${
                              f.fullWidth ? "sm:col-span-2" : ""
                            }`}
                          />
                        );
                      }

                      // default text
                      return (
                        <input
                          key={f.name}
                          type="text"
                          placeholder={f.label}
                          value={val}
                          onChange={(e) => setField(f.name, e.target.value)}
                          readOnly={!!f.readOnly}
                          disabled={!!f.readOnly}
                          className={`border border-gray-300 rounded-lg p-2 text-gray-800 ${
                            f.readOnly ? "bg-gray-100 cursor-not-allowed" : "bg-white"
                          } ${f.fullWidth ? "sm:col-span-2" : ""}`}
                        />
                      );
                    })}

                    {/* <div className="sm:col-span-2 text-right text-xs text-gray-500 font-bold">
                      ✅ التاريخ رح ينعرض بالصورة بصيغة dd/mm/yyyy
                    </div> */}
                  </div>
                )}

                {/* ================= Attachment tab (same) ================= */}
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
                      className={`rounded-2xl border border-black/10 bg-white/55 shadow-sm p-4 transition ${
                        dragOver ? "ring-2 ring-blue-300 bg-white/75" : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOver(false);
                      }}
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
                                  <div className="text-xs text-gray-500">
                                    {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}
                                  </div>
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

                {/* ================= Review tab (dynamic) ================= */}
                {activeTab === "Review" && (
                  <div className="space-y-4">
                    {serverMsg && (
                      <div className="rounded-xl border border-black/10 bg-white/80 p-3 text-sm font-bold text-gray-800">
                        {serverMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {FIELDS.map((f) => {
                        const val = form?.[f.name];

                        const shown =
                          f.type === "moneyIQD" ? (val ? fmtInt(val) : "-") : val ? String(val) : "-";

                        return (
                          <div
                            key={f.name}
                            className={`p-3 rounded-xl bg-white/70 border border-black/10 ${
                              f.fullWidth ? "sm:col-span-2" : ""
                            }`}
                          >
                            <div className="text-xs text-gray-500">{f.label}</div>
                            <div className="font-extrabold text-gray-800 break-words">{shown}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-xl bg-white/70 border border-black/10">
                      <div className="text-xs text-gray-500">عدد المرفقات</div>
                      <div className="font-extrabold text-gray-800">{attachment?.length || 0}</div>
                      {attachment.length === 0 && (
  <div className="text-xs text-red-600 font-bold mt-1">
    يجب إضافة مرفق واحد على الأقل
  </div>
)}
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
      disabled={submitting || (attachment?.length || 0) === 0}
      className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-extrabold text-white ${
        submitting || (attachment?.length || 0) === 0
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
      whileHover={{ scale: 1.03 }}
      className="px-5 py-2.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800 font-extrabold"
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