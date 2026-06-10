"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiPlus, FiTrash2, FiCheck, FiImage } from "react-icons/fi";
import { Cairo } from "next/font/google";
import PaymentPlanA4Sheets from "@/components/ex/PaymentPlanA4Sheets";
import { PAYMENT_PLAN_TEMPLATE } from "@/lib/ex/paymentPlanTemplate";
import { fieldsFromPaymentPlanTemplate } from "@/lib/ex/paymentPlanLayoutMerge";
import {
  formatMoneyInput,
  parseMoneyNumber,
  formatPayPercent,
} from "@/lib/ex/formatMoneyInput";
import { usePermissions } from "@/context/PermissionContext";

const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700", "800"] });

const fmtInt = (n) => new Intl.NumberFormat("en-US").format(Number(n || 0));
const MAX_ROWS_PER_PAGE = 15;

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

function dataUrlToFile(dataUrl, fileName) {
  const [header, base64] = dataUrl.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: mime });
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
  }) {
  const close = () => onClose?.();
  const { user } = usePermissions();
  const currentUsername = useMemo(
    () => String(user?.username || user?.name || "").trim(),
    [user]
  );

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
  const [showPreview, setShowPreview] = useState(false);
  const [previewPngs, setPreviewPngs] = useState([]);
  const [building, setBuilding] = useState(false);

const steps = useMemo(
  () => [
    { key: "Header", label: "Header" },
    { key: "Table", label: "Table" },
    { key: "Footer", label: "Footer" },
    { key: "Review", label: "Review" },
  ],
  []
);

  // ✅ حذفنا signature من الفورم
  const [form, setForm] = useState(() => ({
    salesEmp: initialForm?.salesEmp || "",
    customer: initialForm?.customer || "",
    unitNo: initialForm?.unitNo || "",
    dateDMY: initialForm?.dateDMY || todayStrDMY(),
    discount: initialForm?.discount ? formatMoneyInput(initialForm.discount) : "",
    rows:
      Array.isArray(initialForm?.rows) && initialForm.rows.length
        ? initialForm.rows.map((r, i) => ({
            payType: r.payType || defaultPayType(i),
            amount: r.amount ? formatMoneyInput(r.amount) : "",
            payDateYMD: r.payDateYMD || "",
            payPercent: r.payPercent || "",
          }))
        : [{ payType: defaultPayType(0), amount: "", payDateYMD: "", payPercent: "" }],
  }));

  const [layoutFields, setLayoutFields] = useState(() =>
    fieldsFromPaymentPlanTemplate()
  );
  const [tableRowHeight, setTableRowHeight] = useState(
    PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight
  );

  const loadLayout = useCallback(async () => {
    try {
      const res = await fetch("/api/ex/payment-plan-layout", { cache: "no-store" });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setLayoutFields(json.data);
        setTableRowHeight(
          Number(json.tableRowHeight) || PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight
        );
      }
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    if (open) loadLayout();
  }, [open, loadLayout]);

  useEffect(() => {
    if (!open || !currentUsername) return;
    setForm((p) => ({
      ...p,
      salesEmp: initialForm?.salesEmp?.trim() || currentUsername,
    }));
  }, [open, currentUsername, initialForm?.salesEmp]);

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
          { payType: defaultPayType(nextIndex), amount: "", payDateYMD: "", payPercent: "" },
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
      salesEmp: currentUsername,
      customer: "",
      unitNo: "",
      dateDMY: todayStrDMY(),
      discount: "",
      rows: [{ payType: defaultPayType(0), amount: "", payDateYMD: "", payPercent: "" }],
    });
    setServerMsg("");
    setActiveTab("Header");
  };

  const totalAmount = useMemo(() => {
    return (form.rows || []).reduce(
      (sum, r) => sum + parseMoneyNumber(r.amount),
      0
    );
  }, [form.rows]);

  const rowsWithPercent = useMemo(() => {
    return (form.rows || []).map((r) => ({
      ...r,
      payPercent: formatPayPercent(r.amount, totalAmount),
    }));
  }, [form.rows, totalAmount]);

  const pages = useMemo(() => {
    const chunks = [];
    const all = rowsWithPercent;
    for (let i = 0; i < all.length; i += MAX_ROWS_PER_PAGE) {
      chunks.push(all.slice(i, i + MAX_ROWS_PER_PAGE));
    }
    return chunks.length ? chunks : [[]];
  }, [rowsWithPercent]);

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

  const currentStepIndex = steps.findIndex((s) => s.key === activeTab);
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  // ✅ تنظيف rows + حساب مجموع
  const cleanedRows = useMemo(() => {
    return rowsWithPercent
      .map((r) => ({
        payType: String(r.payType || "").trim(),
        amount: String(r.amount || "").trim(),
        payDateYMD: String(r.payDateYMD || "").trim(),
        payPercent: String(r.payPercent || "").trim(),
      }))
      .filter((r) => r.payType || r.amount || r.payDateYMD);
  }, [rowsWithPercent]);

  const openPreview = async () => {
    setShowPreview(true);
    setPreviewPngs([]);
    setBuilding(true);
    try {
      const pngs = await buildPagePngs();
      setPreviewPngs(pngs);
    } catch (e) {
      console.error(e);
      setServerMsg(e?.message || "تعذر تجهيز المعاينة.");
    } finally {
      setBuilding(false);
    }
  };

  const handleCreate = async () => {
    setServerMsg("");
    setSubmitting(true);

    try {
      const pngs = await buildPagePngs();
      if (!pngs.length) {
        throw new Error("تعذر توليد صورة الفورم.");
      }

      const uploadedAttachments = [];

      for (let i = 0; i < pngs.length; i++) {
        const file = dataUrlToFile(pngs[i], `payment-plan-page-${i + 1}.png`);
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            prefix: "payment-plans",
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

      const payload = {
        salesEmp: form.salesEmp,
        customer: form.customer,
        unitNo: form.unitNo,
        dateDMY: form.dateDMY,
        discount: form.discount,
        rows: cleanedRows,
        attachments: uploadedAttachments,
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
      <div className="sr-only" aria-hidden="true">
        <PaymentPlanA4Sheets
          form={form}
          layoutFields={layoutFields}
          tableRowHeight={tableRowHeight}
          pages={pages}
          setPageRef={setPageRef}
          totalAmount={totalAmount}
        />
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
                          className={`flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl border text-sm transition
                            ${
                              active
                                ? "bg-gray-800 text-white border-gray-800"
                                : done
                                ? "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                            }
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
                      placeholder="اسم موظف المبيعات"
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
                                <th className="text-center px-3 py-3 font-semibold">اسم الدفعة</th>
                                <th className="text-center px-3 py-3 font-semibold">التاريخ</th>
                                <th className="text-center px-3 py-3 font-semibold">القيمة المالية</th>
                                <th className="text-center px-3 py-3 font-semibold">نسبة الدفعة</th>
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
                                      placeholder="الدفعة الأولى"
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

                                  <td className="px-3 py-2">
                                    <input
                                      value={r.amount}
                                      onChange={(e) =>
                                        setRow(i, "amount", formatMoneyInput(e.target.value))
                                      }
                                      className="w-full border border-gray-200 rounded-lg p-2 bg-white text-center"
                                      placeholder="1,500,000"
                                      inputMode="numeric"
                                    />
                                  </td>

                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-block w-full rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-sm font-bold text-gray-700">
                                      {formatPayPercent(r.amount, totalAmount) || "—"}
                                    </span>
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

                {activeTab === "Footer" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="الخصم"
                      value={form.discount}
                      onChange={(e) =>
                        setField("discount", formatMoneyInput(e.target.value))
                      }
                      className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                      inputMode="numeric"
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
                      <div className="px-4 py-3 border-b bg-white/60 font-extrabold text-gray-800">
                        صفوف الدفعات: {cleanedRows.length}
                      </div>

                      <div className="overflow-x-auto">
                        <div className="max-h-[420px] overflow-y-auto">
                          <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-10 bg-gray-100/90 backdrop-blur-xl text-gray-700">
                              <tr>
                                <th className="text-center px-4 py-2 font-semibold">اسم الدفعة</th>
                                <th className="text-center px-4 py-2 font-semibold">التاريخ</th>
                                <th className="text-center px-4 py-2 font-semibold">المبلغ</th>
                                <th className="text-center px-4 py-2 font-semibold">نسبة الدفعة</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white/70">
                              {cleanedRows.length ? (
                                cleanedRows.map((r, i) => (
                                  <tr key={i} className="border-t border-gray-200/60">
                                    <td className="px-4 py-2 text-center">{r.payType || "-"}</td>
                                    <td className="px-4 py-2 text-center">
                                      {r.payDateYMD ? ymdToDMY(r.payDateYMD) : "-"}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {r.amount ? fmtInt(String(r.amount).replace(/,/g, "")) : "-"}
                                    </td>
                                    <td className="px-4 py-2 text-center">{r.payPercent || "-"}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
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

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-right text-xs text-gray-500 font-bold">
                        عند الإنشاء تُولَّد صورة الفورم تلقائياً وترسل كاتاج للورك فلو.
                      </div>
                      <button
                        type="button"
                        onClick={openPreview}
                        disabled={building || submitting}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-extrabold hover:bg-blue-700 disabled:opacity-50"
                      >
                        <FiImage />
                        Preview
                      </button>
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

                  {activeTab === "Review" ? (
                    <button
                      onClick={handleCreate}
                      disabled={submitting}
                      className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-extrabold text-white ${
                        submitting
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
                      className="px-5 py-2.5 rounded-lg font-extrabold bg-gray-700 text-white hover:bg-gray-800"
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

      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md sm:max-w-2xl lg:max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 140, damping: 18 }}
            >
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-black text-gray-900 flex items-center gap-2">
                  <FiImage /> Preview (A4)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewPngs([]);
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-2"
                >
                  <FiX /> Close
                </button>
              </div>

              <div className="flex-1 bg-gray-50 overflow-y-auto">
                {building && !previewPngs.length ? (
                  <div className="h-48 flex items-center justify-center text-gray-600 font-bold">
                    جارِ تجهيز المعاينة…
                  </div>
                ) : previewPngs.length ? (
                  <div className="p-2 space-y-3">
                    {previewPngs.map((src, i) => (
                      <div
                        key={i}
                        className="w-full bg-white rounded-xl shadow overflow-hidden aspect-[210/297]"
                      >
                        <img
                          src={src}
                          alt={`page_${i + 1}`}
                          className="w-full h-full object-contain block"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-600 font-bold">
                    ماكو معاينة — تأكد من البيانات
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}