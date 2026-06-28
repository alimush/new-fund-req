"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/ToastProvider";
import { supportsExpenseType } from "@/lib/companies/expenseTypeCompanies";
import { FiX } from "react-icons/fi";
import {
    FiPaperclip,
    FiPlus,
    FiTrash2,
    FiFileText,
    FiBriefcase,
    FiTag,
    FiDollarSign,
    FiLayers,
    FiShoppingCart,

    
  } from "react-icons/fi";
  
// ✅ فورماتر الأرقام
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const modalShell =
  "rounded-3xl border border-slate-200/60 bg-white/95 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.35)] ring-1 ring-slate-200/50 backdrop-blur-xl";

const sectionCard =
  "overflow-hidden rounded-2xl border border-slate-200/50 bg-white/85 shadow-sm ring-1 ring-slate-200/40";

const requestCard =
  "rounded-2xl border border-slate-200/60 bg-white shadow-sm ring-1 ring-slate-200/50 transition-all duration-300 hover:border-slate-300 hover:shadow-md";

const fieldClass =
  "w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-[15px] font-semibold text-gray-900 shadow-sm outline-none placeholder:text-gray-500 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200/80";

const btnSecondary =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 font-extrabold text-gray-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60";

const btnPager =
  "rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[13px] font-extrabold text-gray-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 font-extrabold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500";

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1.5 block text-xs font-extrabold text-gray-600">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

function SectionBlock({ title, subtitle, icon: Icon, right, children }) {
  return (
    <div className={sectionCard}>
      <div className="border-b border-slate-200/60 bg-slate-50/80 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-gray-800 shadow-sm">
                <Icon className="text-xl" />
              </div>
            ) : null}
            <div className="min-w-0">
              <div className="text-base font-black text-gray-900">{title}</div>
              {subtitle ? (
                <div className="text-xs font-semibold text-gray-600">{subtitle}</div>
              ) : null}
            </div>
          </div>
          {right}
        </div>
      </div>
      <div className="bg-white p-4 sm:p-5">{children}</div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, tone = "slate", className = "" }) {
  const tones = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    indigo: "bg-indigo-50 text-indigo-600 ring-indigo-200",
    rose: "bg-rose-50 text-rose-600 ring-rose-200",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    blue: "bg-blue-50 text-blue-600 ring-blue-200",
  };

  return (
    <div className={`rounded-2xl border border-slate-200/50 bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/40 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500">{label}</p>
          <p className="mt-1 truncate text-base font-black text-gray-900 sm:text-lg">{value ?? "-"}</p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.slate}`}
        >
          <Icon className="text-xl" />
        </span>
      </div>
    </div>
  );
}

function EmptyBox({ text, hint }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/80 py-10 text-center">
      <p className="text-sm font-extrabold text-gray-700">{text}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-gray-500">{hint}</p> : null}
    </div>
  );
}

export default function CreateRequestModal({
  open,
  onClose,
  companyKey,
  canCreate = true,
  onCreated,

  mode = "create",       // create | edit
  initialData = null,    // بيانات الريكويست
  requestId = null,      // id عند التعديل
}) {
  const { showToast } = useToast();
  const steps = [
    { key: "Basic Info", label: "أساسي", icon: FiFileText },
    { key: "Financial", label: "مالي", icon: FiDollarSign },
    { key: "Items", label: "مواد", icon: FiShoppingCart },
    { key: "Attachment", label: "مرفقات", icon: FiPaperclip },
    { key: "Review", label: "مراجعة", icon: FiLayers },
  ];

  // ✅ حالات مودال الإنشاء
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState(steps[0].key);

  const [requestType, setRequestType] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("");
  const [department, setDepartment] = useState("");

  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ desc: "", qty: "", price: "" });
  const [projectName, setProjectName] = useState("");
  const [attachment, setAttachment] = useState([]);
  const [expenseType, setExpenseType] = useState("");
  // فوق داخل الكمبوننت (قبل return) خلي هاي الستايت:
const [dragOver, setDragOver] = useState(false);

// دالة تضيف ملفات (تمنع التكرار بالاسم+الحجم):
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

  if (isExistingAttachment(file) && file.url) {
    window.open(file.url, "_blank", "noopener,noreferrer");
    return;
  }

  if (file instanceof File) {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
};
  const nfInt = new Intl.NumberFormat("en-US");
const nf2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const stripNumber = (v) => String(v || "").replace(/,/g, "").replace(/[^\d.]/g, "");

const isExistingAttachment = (file) => {
  return file && typeof file === "object" && !!file.key && !(file instanceof File);
};
const formatInputMoney = (v) => {
  const clean = stripNumber(v);
  if (!clean) return "";

  const [i, d] = clean.split(".");
  const intPart = nfInt.format(Number(i || 0));

  if (d === undefined) return intPart;
  return `${intPart}.${d.slice(0, 2)}`; // نخلي حد اقصى 2 decimals
};

  // إجمالي العناصر
  const itemsTotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      return acc + qty * price;
    }, 0);
  }, [items]);

  const resetForm = () => {
    setRequestType("");
    setDescription("");
    setCurrency("");
    setProjectName("");
    setDepartment("");
    setExpenseType("");
    setItems([]);
    setNewItem({ desc: "", qty: "", price: "" });
    setAttachment([]);
    setActiveTab(steps[0].key);
  };
  useEffect(() => {
    if (!open) return;
  
    if (mode === "edit" && initialData) {
      setRequestType(initialData.requestType || "");
      setDescription(initialData.description || "");
      setCurrency(initialData.currency || "");
      setProjectName(
        initialData.projectName || initialData._oldProjectName || ""
      );
      setDepartment(initialData.department || "");
      setItems(Array.isArray(initialData.items) ? initialData.items : []);
      setNewItem({ desc: "", qty: "", price: "" });
      setExpenseType(initialData.expenseType || "");
  
      // بالمود edit نخلّي المرفقات القديمة كـ metadata objects
      setAttachment(
        Array.isArray(initialData.attachments) ? initialData.attachments : []
      );
  
      setActiveTab(steps[0].key);
    }
  
    if (mode === "create" && open) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialData]);
  // ✅ لما ينغلق المودال يرجّع فورم نظيف
  useEffect(() => {
    if (!open) {
      resetForm();
      setIsCreating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // إضافة عنصر
  const addItem = () => {
    if (!newItem.desc || !newItem.qty || !newItem.price) return;
    setItems((prev) => [
      ...prev,
      {
        desc: newItem.desc,
        qty: Number(stripNumber(newItem.qty)) || 0,
        price: Number(stripNumber(newItem.price)) || 0,
      },
    ]);
    setNewItem({ desc: "", qty: "", price: "" });
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ✅ POST create request (presigned URL upload)
  const handleCreate = async () => {
    const uploadedAttachments = [];
  
    // نرفع فقط الملفات الجديدة
    const newFiles = (attachment || []).filter((f) => f instanceof File);
    const existingAttachments = (attachment || []).filter((f) => isExistingAttachment(f));
  
    if (newFiles.length > 0) {
      for (const file of newFiles) {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            prefix: `requests/${companyKey}`,
          }),
        });
  
        if (!presignRes.ok) throw new Error("Failed to get upload URL");
        const { url, key } = await presignRes.json();
  
        const uploadRes = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
  
        if (!uploadRes.ok) throw new Error("Failed to upload file");
  
        uploadedAttachments.push({
          key,
          name: file.name,
          type: file.type || "",
          size: file.size || 0,
        });
      }
    }
  
    const finalAttachments = [
      ...existingAttachments.map((f) => ({
        key: f.key,
        name: f.name || "",
        type: f.type || "",
        size: f.size || 0,
      })),
      ...uploadedAttachments,
    ];
  
    const payload = {
      company: companyKey,
      requestType,
      projectName,
      description,
      currency,
      expenseType,
      department,
      items,
      attachments: finalAttachments,
    };
  
    // CREATE
    if (mode === "create") {
      const res = await fetch(`/api/requests?company=${companyKey}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
  
      if (!res.ok) throw new Error("Create failed");
      return true;
    }
  
    // EDIT
    if (mode === "edit") {
      const res = await fetch(`/api/requests/${requestId}?company=${companyKey}`, {
        method: "PUT",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          ...payload,
        }),
      });
  
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Update failed");
      }
  
      return true;
    }
  
    throw new Error("Invalid mode");
  };

  const currentStepIndex = steps.findIndex((s) => s.key === activeTab);
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);
  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex >= steps.length - 1;

  const goNext = () => {
    setActiveTab(steps[Math.min(currentStepIndex + 1, steps.length - 1)].key);
  };

  const goPrev = () => {
    setActiveTab(steps[Math.max(currentStepIndex - 1, 0)].key);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isCreating) onClose?.();
          }}
        >
          <motion.section
            className={`flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden text-[15px] font-bold text-slate-900 ${modalShell}`}
            initial={{ y: 28, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — نفس هيكل RequestsPage */}
            <div className="border-b border-slate-200/60 bg-slate-50/90 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-gray-800 shadow-sm">
                    <FiFileText className="text-xl" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      Fund Requests
                    </p>
                    <h2 className="mt-0.5 text-xl font-black text-gray-900 sm:text-2xl">
                      {mode === "edit" ? "تعديل الطلب" : "إنشاء طلب جديد"}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-gray-600">طلبات {companyKey}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isCreating) return;
                    onClose?.();
                  }}
                  className={btnSecondary}
                >
                  <FiX /> إغلاق
                </button>
              </div>
            </div>

            {/* Stepper */}
            <div className="border-b border-slate-200/60 bg-white px-4 py-3 sm:px-5">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {steps.map((s, idx) => {
                  const active = s.key === activeTab;
                  const done = idx < currentStepIndex;
                  const Icon = s.icon;

                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActiveTab(s.key)}
                      className={[
                        "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-extrabold shadow-sm transition",
                        active
                          ? "border-gray-900 bg-gray-900 text-white"
                          : done
                            ? "border-slate-200/80 bg-white text-gray-900 hover:bg-slate-50"
                            : "border-slate-200/70 bg-slate-50 text-gray-700 hover:bg-white",
                      ].join(" ")}
                      aria-current={active ? "step" : undefined}
                    >
                      <Icon className="text-sm" />
                      <span className="hidden sm:inline">{s.label}</span>
                      <span className="sm:hidden">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-slate-200/60 bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="shrink-0 text-[13px] font-extrabold text-gray-700">
                  {currentStepIndex + 1}/{steps.length}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain bg-white">
              <motion.div
                key={activeTab}
                className="space-y-4 p-4 sm:p-5"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28 }}
              >
              {activeTab === "Basic Info" && (
                <>
                  <p className="mb-3 text-xs font-extrabold text-gray-600">المعلومات الأساسية</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>الشركة</FieldLabel>
                      <input
                        type="text"
                        value={companyKey}
                        readOnly
                        className={`${fieldClass} bg-slate-50 text-gray-700`}
                      />
                    </div>

                    <div>
                      <FieldLabel required>نوع الطلب</FieldLabel>
                      <select
                        value={requestType}
                        onChange={(e) => setRequestType(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">حدد نوع الطلب</option>
                        <option value="تسديد مستحقات">تسديد مستحقات</option>
                        <option value="موجودات">موجودات</option>
                        <option value="تمويل">تمويل</option>
                        <option value="سلفة شخصية">سلفة شخصية</option>
                        <option value="تبرعات">تبرعات</option>
                        <option value="دفعة">دفعة</option>
                        <option value="حقوق">حقوق</option>
                        <option value="مصاريف">مصاريف</option>
                        <option value="تعويض">تعويض</option>
                        <option value="ارجاع قرضة">ارجاع قرضة</option>
                        <option value="قرضة">قرضة</option>
                        <option value="شخصي">شخصي</option>
                        <option value="سلفة مستدامة">سلفة مستدامة</option>
                        <option value="سلفة لأغراض النشاط">سلفة لأغراض النشاط</option>
                        <option value="مصاريف مقر شركة">مصاريف مقر شركة</option>
                        <option value="قرض شخصي">قرض شخصي</option>
                        <option value="سلفة">سلفة</option>
                      </select>
                    </div>

                    {supportsExpenseType(companyKey) ? (
                      <div className="sm:col-span-2">
                        <FieldLabel>نوع المصروف</FieldLabel>
                        <select
                          value={expenseType}
                          onChange={(e) => setExpenseType(e.target.value)}
                          className={fieldClass}
                        >
                          <option value="">حدد نوع المصروف</option>
                          <option value="مصروف">مصروف</option>
                          <option value="غير مصروف">غير مصروف</option>
                        </select>
                      </div>
                    ) : null}

                    <div className="sm:col-span-2">
                      <FieldLabel>اسم المشروع</FieldLabel>
                      <input
                        type="text"
                        placeholder="اسم المشروع"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <FieldLabel>الوصف</FieldLabel>
                      <textarea
                        placeholder="اكتب وصف الطلب..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`${fieldClass} min-h-[96px] resize-y`}
                        rows={3}
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "Financial" && (
                <>
                  <p className="mb-3 text-xs font-extrabold text-gray-600">المعلومات المالية</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>العملة</FieldLabel>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">حدد العملة</option>
                        <option value="USD">USD</option>
                        <option value="IQD">IQD</option>
                      </select>
                    </div>
                    <div>
                      <FieldLabel required>القسم</FieldLabel>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="">حدد القسم</option>
                        <option value="تكنولوجيا المعلومات">تكنولوجيا المعلومات</option>
                        <option value="الموارد البشرية">الموارد البشرية</option>
                        <option value="خدمة العملاء">خدمة العملاء</option>
                        <option value="التسويق">التسويق</option>
                        <option value="قسم العمليات التنفيذية">قسم العمليات التنفيذية</option>
                        <option value="قسم عمليات البيع">قسم عمليات البيع</option>
                        <option value="المبيعات">المبيعات</option>
                        <option value="العقود">العقود</option>
                        <option value="الحسابات">الحسابات</option>
                        <option value="الادارة">الادارة</option>
                        <option value="المشتريات">المشتريات</option>
                        <option value="القروض">القروض</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "Items" && (
                <div className="space-y-4">
                  <div>
                    <p className="mb-3 text-xs font-extrabold text-gray-600">إضافة مادة</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <input
                        type="text"
                        placeholder="وصف المادة"
                        value={newItem.desc}
                        onChange={(e) => setNewItem({ ...newItem, desc: e.target.value })}
                        className={`sm:col-span-6 ${fieldClass}`}
                      />
                      <input
                        type="number"
                        placeholder="العدد"
                        value={newItem.qty}
                        onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                        className={`sm:col-span-2 ${fieldClass}`}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="المبلغ"
                        value={newItem.price}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            price: formatInputMoney(e.target.value),
                          }))
                        }
                        className={`sm:col-span-2 ${fieldClass}`}
                      />
                      <button type="button" onClick={addItem} className={`sm:col-span-2 ${btnPrimary}`}>
                        <FiPlus /> إضافة
                      </button>
                    </div>
                  </div>

                  <SectionBlock
                    title="قائمة المواد"
                    subtitle={items.length ? `${items.length} مادة` : "لا توجد مواد بعد"}
                    icon={FiShoppingCart}
                  >
                    {items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="border-b border-slate-200/60 bg-slate-50 text-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left font-extrabold">الوصف</th>
                              <th className="px-4 py-3 text-right font-extrabold">العدد</th>
                              <th className="px-4 py-3 text-right font-extrabold">السعر</th>
                              <th className="px-4 py-3 text-right font-extrabold">المبلغ الكلي</th>
                              <th className="px-4 py-3" />
                            </tr>
                          </thead>
                          <tbody className="text-gray-800">
                            {items.map((it, i) => {
                              const qty = Number(it.qty) || 0;
                              const price = Number(it.price) || 0;
                              const sub = qty * price;
                              return (
                                <tr key={i} className="border-b border-slate-200/50 transition hover:bg-slate-50/80">
                                  <td className="px-4 py-3 font-semibold text-gray-900">{it.desc}</td>
                                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt.format(qty)}</td>
                                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt.format(price)}</td>
                                  <td className="px-4 py-3 text-right font-extrabold tabular-nums text-gray-900">{fmt.format(sub)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeItem(i)}
                                      className={`${btnSecondary} !px-3 !py-1.5 text-xs hover:bg-rose-50 hover:text-rose-600`}
                                    >
                                      حذف
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200/60 bg-slate-50">
                              <td className="px-4 py-3 font-extrabold text-gray-700" colSpan={3}>
                                المجموع
                              </td>
                              <td className="px-4 py-3 text-right font-black tabular-nums text-gray-900">
                                {fmt.format(itemsTotal)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <EmptyBox text="لا توجد مواد مضافة" hint="أضف مواداً لتظهر هنا" />
                    )}
                  </SectionBlock>
                </div>
              )}

              {activeTab === "Attachment" && (
                <SectionBlock
                  title="المرفقات"
                  subtitle="PDF، Excel، صور أو أي ملفات داعمة"
                  icon={FiPaperclip}
                  right={
                    attachment?.length > 0 ? (
                      <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-gray-700">
                        {attachment.length} ملف
                      </span>
                    ) : null
                  }
                >
                  <div
                    className={`rounded-xl border p-4 transition ${
                      dragOver
                        ? "border-indigo-300 bg-indigo-50/50 ring-2 ring-indigo-200/80"
                        : "border-slate-200/70 bg-slate-50/60"
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-indigo-600 shadow-sm">
                          <FiPaperclip className="text-lg" />
                        </div>
                        <div>
                          <div className="text-sm font-extrabold text-gray-900">رفع مرفق</div>
                          <div className="text-xs font-semibold text-gray-600">
                            اختر ملفات أو اسحبها وأفلتها هنا
                          </div>
                        </div>
                      </div>
                      <label className={`cursor-pointer ${btnPrimary}`}>
                        <FiPlus className="text-base" />
                        إضافة ملفات
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

                    <div className="mt-3 rounded-xl border border-dashed border-slate-300/80 bg-white p-3 text-center text-xs font-semibold text-gray-600">
                      اسحب الملفات وأفلتها هنا
                    </div>

                    {attachment?.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {attachment.map((file, i) => (
                          <div
                            key={i}
                            onClick={() => openAttachment(file)}
                            title="فتح المرفق"
                            className={`flex cursor-pointer items-center justify-between gap-3 p-3 ${requestCard}`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-gray-800">
                                <FiFileText />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold text-gray-900">{file.name}</div>
                                <div className="text-xs font-semibold text-gray-500">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAttachment((prev) => (prev || []).filter((_, idx) => idx !== i));
                              }}
                              className={`${btnSecondary} !px-3 !py-1.5 text-xs hover:bg-rose-50 hover:text-rose-600`}
                              title="حذف الملف"
                            >
                              <FiTrash2 className="text-[14px]" />
                              حذف
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4">
                        <EmptyBox
                          text="لا توجد مرفقات بعد"
                          hint="اضغط «إضافة ملفات» أو اسحب الملف وأفلته هنا"
                        />
                      </div>
                    )}
                  </div>
                </SectionBlock>
              )}

              {activeTab === "Review" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <StatBox icon={FiBriefcase} label="الشركة" value={companyKey} tone="indigo" />
                    <StatBox icon={FiTag} label="نوع الطلب" value={requestType} tone="amber" />
                    <StatBox icon={FiDollarSign} label="العملة" value={currency} tone="emerald" />
                    <StatBox icon={FiLayers} label="القسم" value={department} tone="slate" />
                    <StatBox
                      icon={FiLayers}
                      label="اسم المشروع"
                      value={projectName}
                      tone="indigo"
                      className="sm:col-span-2"
                    />
                    {supportsExpenseType(companyKey) ? (
                      <StatBox
                        icon={FiDollarSign}
                        label="نوع المصروف"
                        value={expenseType}
                        tone="rose"
                        className="sm:col-span-2"
                      />
                    ) : null}
                    <div className="sm:col-span-2 rounded-2xl border border-slate-200/50 bg-white p-4 shadow-sm ring-1 ring-slate-200/40">
                      <p className="text-[11px] font-bold text-gray-500">الوصف</p>
                      <p className="mt-1 whitespace-pre-line text-base font-black leading-relaxed text-gray-900 sm:text-lg">
                        {description || "-"}
                      </p>
                    </div>
                  </div>

                  <SectionBlock
                    title="المرفقات"
                    subtitle={attachment?.length ? `${attachment.length} مرفق` : "لا توجد مرفقات"}
                    icon={FiPaperclip}
                  >
                    {attachment?.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {attachment.map((file, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => openAttachment(file)}
                            className={`flex w-full items-center gap-2 p-3 text-right ${requestCard}`}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-gray-800">
                              <FiFileText size={14} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-extrabold text-gray-900">{file.name}</span>
                              <span className="text-[10px] font-semibold text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyBox text="لا توجد مرفقات" />
                    )}
                  </SectionBlock>

                  <SectionBlock title="ملخص المواد" subtitle="قائمة المواد المطلوبة" icon={FiShoppingCart}>
                    {items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="border-b border-slate-200/60 bg-slate-50 text-gray-700">
                            <tr>
                              <th className="px-4 py-2 text-left font-extrabold">الوصف</th>
                              <th className="px-4 py-2 text-right font-extrabold">العدد</th>
                              <th className="px-4 py-2 text-right font-extrabold">المبلغ</th>
                              <th className="px-4 py-2 text-right font-extrabold">المبلغ الكلي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, i) => {
                              const qty = Number(it.qty) || 0;
                              const price = Number(it.price) || 0;
                              return (
                                <tr key={i} className="border-t border-slate-200/50 transition hover:bg-slate-50/80">
                                  <td className="px-4 py-2 font-semibold text-gray-900">{it.desc}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{fmt.format(qty)}</td>
                                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{fmt.format(price)}</td>
                                  <td className="px-4 py-2 text-right font-extrabold tabular-nums text-gray-900">
                                    {fmt.format(qty * price)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200/60 bg-slate-50">
                              <td colSpan={3} className="px-4 py-2 font-extrabold text-gray-700">
                                المجموع
                              </td>
                              <td className="px-4 py-2 text-right font-black tabular-nums text-gray-900">
                                {fmt.format(itemsTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <EmptyBox text="لا توجد مواد مضافة" />
                    )}
                  </SectionBlock>
                </div>
              )}
            </motion.div>
            </div>

            {/* Footer — نفس أسلوب Pager في RequestsPage */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 bg-slate-50/90 px-4 py-4 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  if (isCreating) return;
                  onClose?.();
                }}
                className={btnSecondary}
              >
                إلغاء
              </button>

              <div className="flex items-center gap-2">
                {!isFirstStep ? (
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={isCreating}
                    className={btnPager}
                  >
                    السابق
                  </button>
                ) : null}

                {isLastStep ? (
                  <motion.button
                    type="button"
                    onClick={async () => {
                      if (!canCreate) return;
                      setIsCreating(true);
                      try {
                        await handleCreate();
                        onClose?.();
                        onCreated?.();
                        showToast(
                          mode === "edit" ? "تم حفظ التغييرات بنجاح" : "تم إنشاء الطلب بنجاح",
                          "success"
                        );
                      } catch (e) {
                        console.error(e);
                        showToast(
                          mode === "edit" ? "فشل تعديل الطلب" : "فشل إنشاء الطلب",
                          "error"
                        );
                      } finally {
                        setIsCreating(false);
                      }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isCreating || !canCreate}
                    className={btnPrimary}
                  >
                    {isCreating ? (
                      <>
                        <span className="relative inline-flex h-4 w-4 items-center justify-center">
                          <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        </span>
                        {mode === "edit" ? "جاري الحفظ..." : "جاري الإنشاء..."}
                      </>
                    ) : mode === "edit" ? (
                      "حفظ التعديل"
                    ) : (
                      "إنشاء الطلب"
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={goNext}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={btnPrimary}
                  >
                    التالي
                  </motion.button>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}