"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiInfo,
  FiDollarSign,
  FiList,
  FiCheckCircle,
  FiTrash2,
  FiX,
  FiPaperclip
} from "react-icons/fi";
import { useRouter } from "next/navigation";

// تبويبات نموذج الإنشاء + الأيقونات
const steps = [
  { key: "Basic Info", label: "Basic Info", icon: FiInfo },
  { key: "Financial", label: "Financial", icon: FiDollarSign },
  { key: "Items", label: "Items", icon: FiList },
  { key: "Attachment", label: "Attachment", icon: FiPaperclip }, 
  { key: "Review", label: "Review", icon: FiCheckCircle },
  
];



// فورماتر الأرقام (فواصل آلاف)
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function RequestsPage({ companyKey }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(steps[0].key);

  // تفاصيل ريكويست (عرض + حذف)
  const [selectedRequest, setSelectedRequest] = useState(null);

  // حالات نموذج الإنشاء
  const [company, setCompany] = useState("");
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

  // جلب الطلبات
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/requests?company=${companyKey}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRequests(data.data);
      } else {
        setRequests([]);
      }
    } catch (e) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // إضافة عنصر للجدول
  const addItem = () => {
    if (!newItem.desc || !newItem.qty || !newItem.price) return;
    setItems((prev) => [
      ...prev,
      { desc: newItem.desc, qty: Number(newItem.qty), price: Number(newItem.price) },
    ]);
    setNewItem({ desc: "", qty: "", price: "" });
  };

  // حذف عنصر من الجدول
  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // إنشاء ريكويست
  // إنشاء ريكويست
const handleCreate = async () => {
  const fd = new FormData();
  fd.append("company", companyKey);
  fd.append("requestType", requestType);
  fd.append("description", description);
  fd.append("currency", currency);
  fd.append("department", department);
  fd.append("createdBy", localStorage.getItem("username"));
  fd.append("items", JSON.stringify(items));

  if (attachment?.length > 0) {
    attachment.forEach((file) => {
      fd.append("attachments", file); // 🔹 append كل ملف بنفس الـ key
    });
  }

  const res = await fetch(`/api/requests?company=${companyKey}`, {
    method: "POST",
    body: fd,
  });

  if (res.ok) {
    setIsCreateOpen(false);
    resetForm();
    fetchRequests();
  } else {
    alert("❌ فشل إنشاء الريكويست");
  }
};
  // حذف ريكويست من نافذة التفاصيل أو من الكارد
  const handleDelete = async (id) => {
    if (!confirm("هل تريد حذف هذا الطلب؟")) return;
    await fetch(`/api/requests?id=${id}&company=${companyKey}`, { method: "DELETE" });
    setSelectedRequest(null);
    fetchRequests();
  };

  // تصفير نموذج الإنشاء
  const resetForm = () => {
    setCompany("");
    setRequestType("");
    setDescription("");
    setCurrency("");
    setDepartment("");
    setItems([]);
    setNewItem({ desc: "", qty: "", price: "" });
    setActiveTab(steps[0].key);
  };

  // أنيميشن كروت الريكويستات
  const gridContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
  };
  const gridItem = {
    hidden: { opacity: 0, y: 18, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: "easeOut" } },
  };

  // مؤشر التقدّم
  const currentStepIndex = steps.findIndex((s) => s.key === activeTab);
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      {/* الهيدر */}
      <div className="flex justify-between items-center mb-8">
      <h1 className="text-3xl font-bold ...">
  Requests Dashboard — {companyKey}
</h1>

        <motion.button
          onClick={() => setIsCreateOpen(true)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white/80 text-gray-700 shadow-sm hover:bg-white"
        >
          + Create Request
        </motion.button>
      </div>

      {/* لودر قبل عرض الريكويستات */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 rounded-full border-4 border-gray-300 border-t-transparent animate-spin" />
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={gridContainer}
          initial="hidden"
          animate="show"
        >
          {requests.map((r) => (
            <motion.div
              key={r._id}
              variants={gridItem}
              whileHover={{ y: -4 }}
              className="group relative p-6 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-lg shadow-sm hover:shadow-lg  cursor-pointer"
              onClick={() => router.push(`/requests/${companyKey}/${r._id}`)}
            >
              <div className="absolute -top-6 -left-6 w-20 h-20 bg-gray-200/40 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-gray-300/40 rounded-full blur-2xl pointer-events-none" />

              <h3 className="text-lg font-semibold text-gray-800">{r.company || "-"}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{r.requestType || "-"}</p>
              <p className="text-xs text-gray-500 mt-1">
  By: {r.createdBy || "Unknown"}
</p>

              <p className="text-xs text-gray-500 mt-2 line-clamp-2">{r.description || "-"}</p>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span className="px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200">
                  {r.currency || "-"}
                </span>
                <span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</span>
              </div>

              {/* زر حذف سريع (من الكارد) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(r._id);
                }}
                className="absolute top-3 right-3 text-xs px-2 py-1 rounded-md bg-gray-700 text-white opacity-0 group-hover:opacity-100 transition flex items-center gap-1"
                title="Delete request"
              >
                <FiTrash2 className="text-[14px]" />
                Delete
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Popup تفاصيل الريكويست + حذف */}
      <AnimatePresence>
        {selectedRequest && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-white via-gray-50 to-gray-100"
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            >
              {/* هيدر رمادي */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 text-white">
                <h2 className="text-base sm:text-lg font-semibold">Request Details</h2>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                >
                  <FiX />
                </button>
              </div>

              {/* المحتوى */}
              <div className="p-6 space-y-4 text-sm text-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl border bg-white/70">
                    <div className="text-xs text-gray-500">Company</div>
                    <div className="font-medium">{selectedRequest.company || "-"}</div>
                  </div>
                  <div className="p-3 rounded-xl border bg-white/70">
                    <div className="text-xs text-gray-500">Type</div>
                    <div className="font-medium">{selectedRequest.requestType || "-"}</div>
                  </div>
                  <div className="p-3 rounded-xl border bg-white/70">
                    <div className="text-xs text-gray-500">Currency</div>
                    <div className="font-medium">{selectedRequest.currency || "-"}</div>
                  </div>
                  <div className="p-3 rounded-xl border bg-white/70">
                    <div className="text-xs text-gray-500">Department</div>
                    <div className="font-medium">{selectedRequest.department || "-"}</div>
                  </div>
                  <div className="sm:col-span-2 p-3 rounded-xl border bg-white/70">
                    <div className="text-xs text-gray-500 mb-1.5">Description</div>
                    <div className="text-gray-700 leading-relaxed">
                      {selectedRequest.description || "-"}
                    </div>
                  </div>
                  {selectedRequest.attachment?.url && (
  <div className="sm:col-span-2 p-3 rounded-xl border bg-white/70">
    <div className="text-xs text-gray-500 mb-1.5">Attachment</div>
    <a
      href={selectedRequest.attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-900"
    >
      <FiPaperclip className="text-lg" />
      Open Attachment
    </a>
  </div>
)}
                </div>

                {/* جدول العناصر */}
                <div className="mt-2">
                  <div className="text-sm font-semibold text-gray-800 mb-2">Items</div>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="text-left px-3 py-2">Description</th>
                          <th className="text-right px-3 py-2">Qty</th>
                          <th className="text-right px-3 py-2">Price</th>
                          <th className="text-right px-3 py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/80">
                        {Array.isArray(selectedRequest.items) && selectedRequest.items.length > 0 ? (
                          selectedRequest.items.map((it, i) => {
                            const qty = Number(it.qty) || 0;
                            const price = Number(it.price) || 0;
                            const sub = qty * price;
                            return (
                              <tr key={i} className="border-t">
                                <td className="px-3 py-2">{it.desc}</td>
                                <td className="px-3 py-2 text-right">{fmt.format(qty)}</td>
                                <td className="px-3 py-2 text-right">{fmt.format(price)}</td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {fmt.format(sub)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td className="px-3 py-3 text-gray-500" colSpan={4}>
                              No items
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {Array.isArray(selectedRequest.items) && selectedRequest.items.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-50 border-t">
                            <td className="px-3 py-2 font-semibold text-gray-700" colSpan={3}>
                              Total
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">
                              {fmt.format(
                                selectedRequest.items.reduce(
                                  (acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0),
                                  0
                                )
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* أزرار */}
              <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                <span className="text-xs text-gray-500">
                  Created at:{" "}
                  {selectedRequest.createdAt
                    ? new Date(selectedRequest.createdAt).toLocaleString()
                    : "-"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDelete(selectedRequest._id)}
                    className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800 flex items-center gap-2"
                  >
                    <FiTrash2 />
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Popup إنشاء ريكويست (تصميم رمادي أنيق + Stepper بأيقونات + Progress) */}
      <AnimatePresence>
        {isCreateOpen && (
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
              {/* Header رمادي أنيق */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 text-white">
                <h2 className="text-base sm:text-lg font-semibold">Create Request</h2>
                <button
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                >
                  <FiX />
                </button>
              </div>

              {/* Stepper بالأيقونات */}
             {/* Stepper بالأيقونات (الضغط على أي خطوة ينقلك مباشرة) */}
<div className="px-5 pt-4 pb-3 bg-gray-50/70 border-b">
  <div className="flex items-center justify-between gap-2">
    {steps.map((s, idx) => {
      const Icon = s.icon;
      const active = s.key === activeTab;
      const done = idx < currentStepIndex;

      return (
        <div key={s.key} className="flex-1 flex items-center gap-2">
          {/* زر الخطوة */}
          <button
            type="button"
            onClick={() => setActiveTab(s.key)}
            className={`flex items-center gap-2 px-3 py-2 w-full justify-center rounded-xl border text-sm transition
              ${active
                ? "bg-gray-800 text-white border-gray-800"
                : done
                ? "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
            aria-current={active ? "step" : undefined}
          >
            <Icon className="text-[16px]" />
            <span className="hidden sm:inline">{s.label}</span>
          </button>

          {/* الوصلة بين الخطوات – قابلة للنقر أيضاً */}
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

  {/* Progress bar */}
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


              {/* محتوى التبويب مع أنيميشن تنقّل */}
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
                      <option value="">Select type</option>
                      <option value="Purchase">Purchase</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Other">Other</option>
                    </select>

                    <textarea
                      placeholder="Description"
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
                      <option value="">Select currency</option>
                      <option value="USD">USD</option>
                      <option value="IQD">IQD</option>
                    </select>

                    <select
  value={department}
  onChange={(e) => setDepartment(e.target.value)}
  className="border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
>
  <option value="">Select department</option>
  <option value="IT">IT</option>
  <option value="Finance">Finance</option>
  <option value="HR">HR</option>
  <option value="Procurement">Procurement</option>
  <option value="Marketing">Marketing</option>
</select>

                  </div>
                )}

                {/* Items (جدول) */}
                {activeTab === "Items" && (
                  <div className="space-y-4">
                    {/* الإدخال */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        placeholder="Item description"
                        value={newItem.desc}
                        onChange={(e) => setNewItem({ ...newItem, desc: e.target.value })}
                        className="sm:col-span-6 border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={newItem.qty}
                        onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })}
                        className="sm:col-span-2 border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                        className="sm:col-span-2 border border-gray-300 rounded-lg p-2 bg-white text-gray-800"
                      />
                      <button
                        type="button"
                        onClick={addItem}
                        className="sm:col-span-2 rounded-lg bg-gray-800 text-white px-3 py-2 hover:bg-gray-900"
                      >
                        Add
                      </button>
                    </div>
                

                    {/* الجدول */}
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-gray-700">
                          <tr>
                            <th className="text-left px-3 py-2">Description</th>
                            <th className="text-right px-3 py-2">Qty</th>
                            <th className="text-right px-3 py-2">Price</th>
                            <th className="text-right px-3 py-2">Subtotal</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white/80">
                          {items.length > 0 ? (
                            items.map((it, i) => {
                              const qty = Number(it.qty) || 0;
                              const price = Number(it.price) || 0;
                              const sub = qty * price;
                              return (
                                <tr key={i} className="border-t">
                                  <td className="px-3 py-2">{it.desc}</td>
                                  <td className="px-3 py-2 text-right">{fmt.format(qty)}</td>
                                  <td className="px-3 py-2 text-right">{fmt.format(price)}</td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {fmt.format(sub)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => removeItem(i)}
                                      className="text-xs px-2 py-1 rounded-md bg-gray-700 text-white hover:bg-gray-800"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="px-3 py-3 text-gray-500" colSpan={5}>
                                No items added
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {items.length > 0 && (
                          <tfoot>
                            <tr className="bg-gray-50 border-t">
                              <td className="px-3 py-2 font-semibold text-gray-700" colSpan={3}>
                                Total
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                {fmt.format(itemsTotal)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
  {/* ✨ Attachment */}
{activeTab === "Attachment" && (
  <div className="space-y-4">
    <label className="block text-sm font-medium text-gray-700">
      Upload Attachments
    </label>

    <label className="inline-flex items-center px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow cursor-pointer hover:bg-gray-900">
      + Add Attachments
      <input
        type="file"
        className="hidden"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files);
          setAttachment((prev) => [...(prev || []), ...files]);
        }}
      />
    </label>

    {attachment?.length > 0 && (
      <div className="mt-3 space-y-2">
        {attachment.map((file, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3 py-2 rounded-lg border bg-white text-sm shadow-sm"
          >
            <span className="text-gray-700 flex items-center gap-2">
              📎 {file.name}
            </span>
            <button
              type="button"
              onClick={() =>
                setAttachment(attachment.filter((_, idx) => idx !== i))
              }
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}

                {/* Review */}
                {activeTab === "Review" && (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl border bg-white/70">
                        <div className="text-xs text-gray-500">Company</div>
                        <div className="font-medium text-gray-800">{company || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl border bg-white/70">
                        <div className="text-xs text-gray-500">Type</div>
                        <div className="font-medium text-gray-800">{requestType || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl border bg-white/70">
                        <div className="text-xs text-gray-500">Currency</div>
                        <div className="font-medium text-gray-800">{currency || "-"}</div>
                      </div>
                      <div className="p-3 rounded-xl border bg-white/70">
                        <div className="text-xs text-gray-500">Department</div>
                        <div className="font-medium text-gray-800">{department || "-"}</div>
                      </div>
                      <div className="sm:col-span-2 p-3 rounded-xl border bg-white/70">
                        <div className="text-xs text-gray-500 mb-1.5">Description</div>
                        <div className="text-gray-700">{description || "-"}</div>
                      </div>

                      <div className="sm:col-span-2 p-3 rounded-xl border bg-white/70">
      <div className="text-xs text-gray-500">Attachment</div>
      <div className="font-medium text-gray-800">
        {attachment ? attachment.name : "-"}
      </div>
    </div>
                    </div>

                    {/* جدول العناصر الملخص */}
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-gray-700">
                          <tr>
                            <th className="text-left px-3 py-2">Description</th>
                            <th className="text-right px-3 py-2">Qty</th>
                            <th className="text-right px-3 py-2">Price</th>
                            <th className="text-right px-3 py-2">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white/80">
                          {items.length > 0 ? (
                            items.map((it, i) => {
                              const qty = Number(it.qty) || 0;
                              const price = Number(it.price) || 0;
                              const sub = qty * price;
                              return (
                                <tr key={i} className="border-t">
                                  <td className="px-3 py-2">{it.desc}</td>
                                  <td className="px-3 py-2 text-right">{fmt.format(qty)}</td>
                                  <td className="px-3 py-2 text-right">{fmt.format(price)}</td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {fmt.format(sub)}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="px-3 py-3 text-gray-500" colSpan={4}>
                                No items
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {items.length > 0 && (
                          <tfoot>
                            <tr className="bg-gray-50 border-t">
                              <td className="px-3 py-2 font-semibold text-gray-700" colSpan={3}>
                                Total
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                {fmt.format(itemsTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* أزرار أسفل البوب أب */}
              <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>

                {activeTab === "Review" ? (
                 <motion.button
                 onClick={async () => {
                   setIsCreating(true); // ✅ نبدأ التحميل
                   try {
                     await handleCreate(); // الدالة الأصلية لإنشاء الطلب
                   } finally {
                     setIsCreating(false); // ✅ نرجع الحالة بعد التنفيذ
                   }
                 }}
                 whileHover={{ scale: 1.03 }}
                 whileTap={{ scale: 0.97 }}
                 disabled={isCreating} // 🔒 يمنع الضغط أثناء الإنشاء
                 className={`px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${
                   isCreating
                     ? "bg-gray-400 cursor-not-allowed text-white"
                     : "bg-gray-800 hover:bg-gray-900 text-white"
                 }`}
               >
                 {isCreating ? (
                   <>
                     <motion.div
                       className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                     ></motion.div>
                     Creating...
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
                    Next →
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
