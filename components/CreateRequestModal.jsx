"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function CreateRequestModal({
  open,
  onClose,
  companyKey,

  // permissions (حتى تتحكم اذا تريد)
  canCreate = true,

  // بعد النجاح
  onCreated,
}) {
  // تبويبات نموذج الإنشاء + الأيقونات
  const steps = [
    { key: "Basic Info", label: "Basic Info", icon: null },
    { key: "Financial", label: "Financial", icon: null },
    { key: "Items", label: "Items", icon: null },
    { key: "Attachment", label: "Attachment", icon: null },
    { key: "Review", label: "Review", icon: null },
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

  const [attachment, setAttachment] = useState(null);
  

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
    setDepartment("");
    setItems([]);
    setNewItem({ desc: "", qty: "", price: "" });
    setAttachment(null);
    setActiveTab(steps[0].key);
  };

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
      { desc: newItem.desc, qty: Number(newItem.qty), price: Number(newItem.price) },
    ]);
    setNewItem({ desc: "", qty: "", price: "" });
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ✅ POST create request (presigned URL upload)
  const handleCreate = async () => {
    // 1) Upload files directly to S3 via presigned URLs
    const uploadedAttachments = [];

    if (attachment?.length > 0) {
      for (const file of attachment) {
        // Get presigned URL from API
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

        // Upload file directly to S3
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

    // 2) Create request with attachment metadata (no files in body)
    const userId = localStorage.getItem("userId");

    const res = await fetch(`/api/requests?company=${companyKey}`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId || "",   // ✅ هذا المهم حتى يشتغل MARKETING
      },
      body: JSON.stringify({
        company: companyKey,
        requestType,
        description,
        currency,
        department,
        createdBy: localStorage.getItem("username"),
        items,
        attachments: uploadedAttachments,
      }),
    });

    if (!res.ok) throw new Error("Create failed");

    return true;
  };

  const currentStepIndex = steps.findIndex((s) => s.key === activeTab);
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-white via-gray-50 to-gray-100 backdrop-blur-xl"
            initial={{ y: 36, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 text-white">
              <h2 className="text-base sm:text-lg font-semibold">Create Request</h2>
              <button
                onClick={() => {
                  if (isCreating) return;
                  onClose?.();
                }}
                className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
              >
                <FiX />
              </button>
            </div>

            {/* Stepper (نفس منطقك) */}
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
                        aria-current={active ? "step" : undefined}
                      >
                        <span className="hidden sm:inline">{s.label}</span>
                      </button>

                      {idx < steps.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab(steps[idx + 1].key)}
                          className="flex-1 h-1 rounded bg-gray-200 overflow-hidden group/link"
                          title="Go to next step"
                        >
                          <div
                            className={`h-full transition-all duration-300
                              ${idx < currentStepIndex ? "bg-gray-700 w-full" : "bg-transparent w-0"}`}
                          />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 h-2 w-full bg-gray-200 rounded">
                <div
                  className="h-2 bg-gray-800 rounded transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
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
              {/* Basic Info */}
              {activeTab === "Basic Info" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={companyKey}
                    readOnly
                    className="border border-gray-300 rounded-lg p-2 bg-gray-100 text-gray-800"
                  />

<select
  value={requestType}
  onChange={(e) => setRequestType(e.target.value)}
  className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
>
  <option value="">حدد نوع الطلب</option>

  <option value="تسديد مستحقات">تسديد مستحقات</option>
  <option value="موجودات">موجودات</option>
  <option value="تمويل">تمويل</option>
  <option value="سلفة شخصية">سلفة شخصية</option>
  <option value="تبرعات">تبرعات</option>
  <option value="دفعة">دفعة</option>
  <option value="حقوق">حقوق</option>
  <option value="تعويض">تعويض</option>
  <option value="مصارف">مصارف</option>
  <option value="ارجاع قرضة">ارجاع قرضة</option>
  <option value="قرضة">قرضة</option>
  <option value="شخصي">شخصي</option>
  <option value="سلفة مستدامة">سلفة مستدامة</option>
  <option value="سلفة لأغراض النشاط">سلفة لأغراض النشاط</option>
  <option value="مصاريف مقر شركة">مصاريف مقر شركة</option>
  <option value="قرض شخصي">قرض شخصي</option>
  <option value="سلفة">سلفة</option>
</select>

                  <textarea
                    placeholder="الوصف"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="sm:col-span-2 border border-gray-300 rounded-lg p-3 bg-white text-gray-800"
                    rows={3}
                  />
                </div>
              )}

              {/* Financial */}
              {activeTab === "Financial" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                  >
                    <option value="">حدد العملة</option>
                    <option value="USD">USD</option>
                    <option value="IQD">IQD</option>
                  </select>
                  <select
  value={department}
  onChange={(e) => setDepartment(e.target.value)}
  className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
>
  <option value="">حدد القسم</option>

  <option value="تكنولوجيا المعلومات">تكنولوجيا المعلومات</option>
  <option value="المكتب التنفيذي">المكتب التنفيذي</option>
  <option value="الموارد البشرية">الموارد البشرية</option>
  <option value="خدمة العملاء">خدمة العملاء</option>
  <option value="التسويق">التسويق</option>
  <option value="العمليات">العمليات</option>
  <option value="المبيعات">المبيعات</option>
  <option value="العقود">العقود</option>
  <option value="الحسابات">الحسابات</option>
  <option value="الادارة">الادارة</option>
  <option value="المشتريات">المشتريات</option>
  <option value="القروض">القروض</option>
</select>
                </div>
              )}

              {/* Items */}
              {activeTab === "Items" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="وصف المادة"
                      value={newItem.desc}
                      onChange={(e) => setNewItem({ ...newItem, desc: e.target.value })}
                      className="sm:col-span-6 border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />
                    <input
                      type="number"
                      placeholder="العدد"
                      value={newItem.qty}
                      onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                      className="sm:col-span-2 border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />
                    <input
                      type="number"
                      placeholder="المبلغ"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      className="sm:col-span-2 border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={addItem}
                      className="sm:col-span-2 rounded-lg bg-gray-800 text-white px-3 py-2 hover:bg-gray-900"
                    >
                      اضف
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/55 backdrop-blur-xl shadow-sm">
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      {/* Header */}
      <thead className="sticky top-0 z-10 bg-white/70 backdrop-blur-xl text-gray-700 border-b border-black/10">
        <tr>
          <th className="text-left px-4 py-3 font-semibold">الوصف</th>
          <th className="text-right px-4 py-3 font-semibold">العدد</th>
          <th className="text-right px-4 py-3 font-semibold">السعر</th>
          <th className="text-right px-4 py-3 font-semibold">المبلغ الكلي</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>

      {/* Body */}
      <tbody className="text-gray-800">
        {items.length > 0 ? (
          items.map((it, i) => {
            const qty = Number(it.qty) || 0;
            const price = Number(it.price) || 0;
            const sub = qty * price;

            return (
              <tr
                key={i}
                className="border-b border-black/5 hover:bg-white/60 transition"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{it.desc}</div>
                </td>

                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {fmt.format(qty)}
                </td>

                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {fmt.format(price)}
                </td>

                <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                  {fmt.format(sub)}
                </td>

                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-gray-800 text-white px-3 py-1.5 text-xs shadow-sm hover:bg-gray-900 active:scale-[0.98] transition"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td className="px-4 py-10 text-center text-gray-500" colSpan={5}>
              <div className="inline-flex flex-col items-center gap-2">
                <div className="h-10 w-10 rounded-2xl border border-black/10 bg-white/70 backdrop-blur flex items-center justify-center text-gray-400">
                  —
                </div>
                <div className="text-sm font-medium">No items added</div>
                <div className="text-xs text-gray-400">Add items to see them here</div>
              </div>
            </td>
          </tr>
        )}
      </tbody>

      {/* Footer */}
      {items.length > 0 && (
        <tfoot>
          <tr className="bg-white/70 backdrop-blur-xl border-t border-black/10">
            <td className="px-4 py-3 font-semibold text-gray-700" colSpan={3}>
              المجموع
            </td>
            <td className="px-4 py-3 text-right font-extrabold text-gray-900 tabular-nums">
              {fmt.format(itemsTotal)}
            </td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  </div>
</div>
                </div>
              )}

            {/* Attachment */}
{activeTab === "Attachment" && (
  <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-gray-800">المرفقات</div>
        <div className="text-xs text-gray-500">
        pdf  يمكنك إرفاق ملفات مثل اكسل أو صور او  
        </div>
      </div>

      {attachment?.length > 0 && (
        <span className="text-xs px-2.5 py-1 rounded-full border border-black/10 bg-white/60 backdrop-blur text-gray-700">
          {attachment.length} file(s)
        </span>
      )}
    </div>

    {/* Upload Card */}
    <div className="rounded-2xl border border-black/10 bg-white/55 backdrop-blur-xl shadow-sm p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-black/10 bg-white/70 backdrop-blur flex items-center justify-center text-gray-600">
            <FiPaperclip className="text-lg" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-800">رفع مرفق</div>
            <div className="text-xs text-gray-500">
            "Add Files" لاختيار الملفات من جهازك اضغط على
            </div>
          </div>
        </div>

        <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white text-sm shadow-sm cursor-pointer hover:bg-gray-900 active:scale-[0.99] transition">
          <FiPlus className="text-base" />
          Add Files
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setAttachment((prev) => [...(prev || []), ...files]);
              e.target.value = ""; // مهم حتى تقدر تختار نفس الملف مرة ثانية
            }}
          />
        </label>
      </div>

      {/* Files List */}
      {attachment?.length > 0 ? (
        <div className="mt-4 space-y-2">
          {attachment.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-black/10 bg-white/65 backdrop-blur shadow-sm hover:bg-white/80 transition"
            >
              <div className="min-w-0 flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl border border-black/10 bg-white/70 flex items-center justify-center text-gray-600">
                  <FiFileText />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAttachment((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-black/10 bg-white/70 text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
                title="Remove file"
              >
                <FiTrash2 className="text-[14px]" />
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-black/10 bg-white/60 backdrop-blur p-5 text-center">
          <div className="mx-auto mb-2 h-10 w-10 rounded-2xl border border-black/10 bg-white/70 flex items-center justify-center text-gray-400">
            <FiPaperclip />
          </div>
          <div className="text-sm font-medium text-gray-700">No files added yet</div>
          <div className="text-xs text-gray-500 mt-1">
            Use “Add Files” to attach documents
          </div>
        </div>
      )}
    </div>
  </div>
)}
            {/* Review */}
{activeTab === "Review" && (
  <div
    className="space-y-5 overflow-y-auto pr-1"
    style={{
      maxHeight: "60vh",
      WebkitOverflowScrolling: "touch",
    }}
  >

    {/* ================= Summary Cards ================= */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

      {[
        { icon: FiBriefcase, label: "الشركة", value: companyKey || "-" },
        { icon: FiTag, label: "نوع الطلب", value: requestType || "-" },
        { icon: FiDollarSign, label: "العملة", value: currency || "-" },
        { icon: FiLayers, label: "القسم", value: department || "-" },
      ].map((c, i) => (
        <div
          key={i}
          className="group relative flex items-center gap-3 p-3 rounded-xl
                     border border-white/40
                     bg-white/70 backdrop-blur-xl
                     shadow-sm hover:shadow-md transition"
        >
          {/* Icon */}
          <div
            className="h-9 w-9 rounded-lg
                       bg-white/90 border border-gray-200
                       flex items-center justify-center
                       text-gray-700 group-hover:text-gray-900 transition"
          >
            <c.icon size={16} />
          </div>

          {/* Text */}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-gray-500">
              {c.label}
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {c.value}
            </span>
          </div>

          {/* subtle glow */}
          <div className="pointer-events-none absolute inset-0 rounded-xl
                          opacity-0 group-hover:opacity-100 transition
                          bg-gradient-to-br from-white/40 to-transparent" />
        </div>
      ))}

      {/* ================= Description ================= */}
      <div
        className="sm:col-span-2 relative flex gap-3 p-3 rounded-xl
                   border border-white/40
                   bg-white/70 backdrop-blur-xl
                   shadow-sm
                   transition-all duration-200
                   hover:bg-white/80
                   hover:shadow-md
                   hover:-translate-y-[1px]
                   group"
      >
        {/* Icon */}
        <div
          className="h-9 w-9 rounded-lg
                     bg-white/90 border border-gray-200
                     flex items-center justify-center
                     text-gray-700
                     transition
                     group-hover:bg-white
                     group-hover:shadow"
        >
          <FiFileText size={16} />
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
            الوصف
          </div>

          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {description || "-"}
          </div>

          <div
            className="pointer-events-none absolute inset-0 rounded-lg
                       opacity-0 group-hover:opacity-100 transition
                       bg-gradient-to-br from-white/40 to-transparent"
          />
        </div>
      </div>

      {/* ================= Attachments ================= */}
      <div
        className="sm:col-span-2 rounded-2xl p-4
                   border border-white/40
                   bg-white/70 backdrop-blur-xl
                   shadow-sm space-y-3"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg
                       bg-white/90 border border-gray-200
                       flex items-center justify-center
                       text-gray-700 shadow-sm"
          >
            <FiPaperclip size={16} />
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-800">
              المرفقات
            </div>
            <div className="text-xs text-gray-500">
              {attachment?.length
                ? `${attachment.length} file(s) attached`
                : "No attachments added"}
            </div>
          </div>
        </div>

        {/* List */}
        {attachment?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {attachment.map((file, i) => (
              <div
                key={i}
                className="group flex items-center gap-2 p-2 rounded-xl
                           border border-gray-200
                           bg-white/90
                           shadow-sm hover:shadow-md transition"
              >
                <div
                  className="h-8 w-8 rounded-lg
                             bg-gray-100 border
                             flex items-center justify-center
                             text-gray-600"
                >
                  <FiFileText size={14} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-800 truncate">
                    {file.name}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500 text-center py-3 border border-dashed rounded-xl">
          لا توجد مرفقات
          </div>
        )}
      </div>
    </div>

    {/* ================= Items Summary ================= */}
    <div
      className="rounded-2xl
                 border border-white/40
                 bg-white/70 backdrop-blur-xl
                 shadow-sm
                 overflow-hidden
                 transition-all duration-200
                 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white/60">
        <div
          className="h-9 w-9 rounded-lg
                     bg-white/90 border border-gray-200
                     flex items-center justify-center
                     text-gray-700 shadow-sm"
        >
          <FiShoppingCart size={16} />
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-800">
            Items Summary
          </div>
          <div className="text-xs text-gray-500">
            List of requested items
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100/70 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">الوصف</th>
              <th className="text-right px-4 py-2 font-semibold">العدد</th>
              <th className="text-right px-4 py-2 font-semibold">المبلغ</th>
              <th className="text-right px-4 py-2 font-semibold">المبلغ الكلي</th>
            </tr>
          </thead>

          <tbody className="bg-white/70">
            {items.length > 0 ? (
              items.map((it, i) => {
                const qty = Number(it.qty) || 0;
                const price = Number(it.price) || 0;
                const sub = qty * price;

                return (
                  <tr
                    key={i}
                    className="border-t border-gray-200/60
                               transition hover:bg-white/80"
                  >
                    <td className="px-4 py-2 text-gray-800">{it.desc}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {fmt.format(qty)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {fmt.format(price)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      {fmt.format(sub)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No items added
                </td>
              </tr>
            )}
          </tbody>

          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50/80 border-t">
                <td colSpan={3} className="px-4 py-2 font-semibold text-gray-700">
                  المجموع
                </td>
                <td className="px-4 py-2 text-right font-bold text-gray-900">
                  {fmt.format(itemsTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  </div>
)}
            </motion.div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  if (isCreating) return;
                  onClose?.();
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              >
                الغاء
              </button>

              {activeTab === "Review" ? (
                <motion.button
                  onClick={async () => {
                    if (!canCreate) return;
                    setIsCreating(true);
                    try {
                      await handleCreate();
                      onClose?.();
                      onCreated?.(); // ✅ يرجّع يجلب البيانات بالصفحة
                    } catch (e) {
                      alert("❌ فشل إنشاء الريكويست");
                    } finally {
                      setIsCreating(false);
                    }
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={isCreating || !canCreate}
                  className={`px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
                    isCreating || !canCreate
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-gray-800 hover:bg-gray-900 text-white"
                  }`}
                >
                  {isCreating ? (
                    <>
                      <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      إنشاء طلب...
                    </>
                  ) : (
                    "Create"
                  )}
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => {
                    const idx = steps.findIndex((s) => s.key === activeTab);
                    setActiveTab(steps[Math.min(idx + 1, steps.length - 1)].key);
                  }}
                  whileHover={{ scale: 1.03 }}
                  className="px-5 py-2.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
                >
                  التالي →
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}