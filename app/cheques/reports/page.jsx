"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import {
  FiArrowRight,
  FiSearch,
  FiRotateCcw,
  FiDownload,
  FiFileText,
  FiHash,
  FiCalendar,
  FiFilter,
  FiPieChart,
  FiEye,
  FiPrinter,
  FiAlertTriangle,
  FiSlash,
} from "react-icons/fi";
import { CHEQUE_TEMPLATES } from "@/lib/cheques/templates";
import {
  formatChequeAmount,
  formatChequeDateParts,
  formatSavedAt,
} from "@/lib/cheques/formatCheque";
import TablePagination from "@/components/TablePagination";
import { useToast } from "@/components/ui/ToastProvider";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";
import { attachmentOpenHref } from "@/lib/s3/browserOpenAttachment";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

const PAGE_SIZE = 25;

const templateOptions = [
  { value: "all", label: "كل أنواع الصكوك" },
  ...CHEQUE_TEMPLATES.map((t) => ({
    value: t.key,
    label: t.name,
  })),
];

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 44,
    borderRadius: 12,
    borderColor: "#e2e8f0",
    fontWeight: 700,
    fontSize: 13,
  }),
  menu: (base) => ({ ...base, borderRadius: 12, overflow: "hidden", zIndex: 50 }),
  option: (base, state) => ({
    ...base,
    fontWeight: 800,
    fontSize: 13,
    backgroundColor: state.isSelected ? "#0f766e" : state.isFocused ? "#ecfdf5" : "white",
    color: state.isSelected ? "white" : "#0f172a",
  }),
};

function truncate(str, max = 48) {
  const s = String(str || "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function chequeStatusLabel(status) {
  if (status === "void") return "باطل";
  if (status === "draft") return "مسودة";
  return "صادر";
}

export default function ChequeReportsPage() {
  const { showToast } = useToast();
  const { canUseCheques, ready } = useChequeAccess();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const [templateFilter, setTemplateFilter] = useState(templateOptions[0]);
  const [chequeNumber, setChequeNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payee, setPayee] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [attachmentsModal, setAttachmentsModal] = useState({
    open: false,
    rowId: null,
    rowName: "",
    attachments: [],
  });
  const [deleteAttConfirm, setDeleteAttConfirm] = useState({
    open: false,
    rowId: null,
    att: null,
  });
  const [deletingAttKey, setDeletingAttKey] = useState(null);
  const [voidingId, setVoidingId] = useState(null);
  const [voidModal, setVoidModal] = useState({
    open: false,
    row: null,
    file: null,
  });
  const fileInputRefs = useRef({});
  const openCheque = useCallback((row) => {
    if (!row?._id) return;
    window.open(
      `/cheques/view?id=${encodeURIComponent(String(row._id))}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

  const openAttachmentsModal = useCallback((row) => {
    setAttachmentsModal({
      open: true,
      rowId: row._id,
      rowName: row.chequeNumber || row.branchName || row.templateName || "—",
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    });
  }, []);

  const closeAttachmentsModal = useCallback(() => {
    setAttachmentsModal({
      open: false,
      rowId: null,
      rowName: "",
      attachments: [],
    });
  }, []);

  const attachmentMatches = useCallback((a, att) => {
    if (!a || !att) return false;
    const k = String(att.key || "").trim();
    const u = String(att.url || "").trim();
    if (k && String(a.key || "").trim() === k) return true;
    if (u && String(a.url || "").trim() === u) return true;
    return false;
  }, []);

  const requestDeleteAttachment = useCallback((rowId, att) => {
    if (!rowId || !att) return;
    const key = String(att.key || "").trim();
    const url = String(att.url || "").trim();
    if (!key && !url) {
      showToast("لا يمكن تحديد هذا الاتاج للحذف.", "warning");
      return;
    }
    setDeleteAttConfirm({ open: true, rowId, att });
  }, [showToast]);

  const handleDeleteAttachmentConfirmed = useCallback(async () => {
    const { rowId, att } = deleteAttConfirm;
    if (!rowId || !att) return;

    const deleteKey = String(att.key || "").trim();
    const deleteUrl = String(att.url || "").trim();
    const matchId = deleteKey || deleteUrl;
    if (!matchId) return;

    try {
      setDeletingAttKey(matchId);
      const res = await fetch(`/api/cheques/${encodeURIComponent(String(rowId))}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(deleteKey ? { deleteAttachmentKey: deleteKey } : {}),
          ...(deleteUrl ? { deleteAttachmentUrl: deleteUrl } : {}),
        }),
      });

      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.error || "فشل حذف الاتاج");
      }

      setRows((prev) =>
        prev.map((x) =>
          String(x._id) === String(rowId)
            ? {
                ...x,
                attachments: (Array.isArray(x.attachments) ? x.attachments : []).filter(
                  (a) => !attachmentMatches(a, att)
                ),
              }
            : x
        )
      );

      setAttachmentsModal((prev) => ({
        ...prev,
        attachments: (Array.isArray(prev.attachments) ? prev.attachments : []).filter(
          (a) => !attachmentMatches(a, att)
        ),
      }));

      setDeleteAttConfirm({ open: false, rowId: null, att: null });
      showToast("تم حذف الاتاج", "success");
    } catch (err) {
      console.error("Delete cheque attachment error:", err);
      showToast(err.message || "فشل حذف الاتاج", "error");
    } finally {
      setDeletingAttKey(null);
    }
  }, [deleteAttConfirm, attachmentMatches, showToast]);

  const triggerAttachmentPick = useCallback((rowId) => {
    const ref = fileInputRefs.current[rowId];
    if (ref) ref.click();
  }, []);

  const handleUploadAttachments = useCallback(
    async (row, files) => {
      if (!row?._id || !files?.length) return;

      try {
        setUploadingId(row._id);
        const uploadedAttachments = [];
        const branchPart = String(row.branchKey || "main").trim() || "main";
        const templatePart = String(row.templateKey || "cheque").trim();

        for (const file of files) {
          const presignRes = await fetch("/api/upload/presign", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
              prefix: `cheques/${templatePart}/${branchPart}/${row._id}`,
            }),
          });

          const presignJson = await presignRes.json();
          if (!presignJson?.success) {
            throw new Error(presignJson?.error || "تعذر إنشاء رابط الرفع");
          }

          const uploadUrl = presignJson.url;
          const fileKey = presignJson.key;
          const fileUrl = presignJson.getUrl || "";

          if (!uploadUrl || !fileKey) {
            throw new Error("استجابة الرفع ناقصة");
          }

          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });

          if (!uploadRes.ok) {
            throw new Error(`فشل رفع ${file.name}`);
          }

          const attachment = {
            key: fileKey,
            name: file.name,
            url: fileUrl,
            contentType: file.type || "application/octet-stream",
            size: file.size || 0,
            uploadedAt: new Date().toISOString(),
          };

          const saveRes = await fetch(`/api/cheques/${encodeURIComponent(String(row._id))}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attachment }),
          });

          const saveJson = await saveRes.json();
          if (!saveJson?.success) {
            throw new Error(saveJson?.error || `تعذر حفظ ${file.name}`);
          }

          uploadedAttachments.push(attachment);
        }

        setRows((prev) =>
          prev.map((x) =>
            x._id === row._id
              ? {
                  ...x,
                  attachments: [
                    ...(Array.isArray(x.attachments) ? x.attachments : []),
                    ...uploadedAttachments,
                  ],
                }
              : x
          )
        );

        showToast("تم رفع الاتاجات بنجاح", "success");
      } catch (err) {
        console.error("Upload cheque attachments error:", err);
        showToast(err.message || "فشل رفع الاتاجات", "error");
      } finally {
        setUploadingId(null);
      }
    },
    [showToast]
  );

  const closeVoidModal = useCallback(() => {
    if (voidingId) return;
    setVoidModal({ open: false, row: null, file: null });
  }, [voidingId]);

  const handleVoidChequeConfirmed = useCallback(async () => {
    const row = voidModal.row;
    const file = voidModal.file;
    if (!row?._id || voidingId) return;

    try {
      setVoidingId(row._id);
      let attachment = null;

      if (file) {
        const branchPart = String(row.branchKey || "main").trim() || "main";
        const templatePart = String(row.templateKey || "cheque").trim();

        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            prefix: `cheques/${templatePart}/${branchPart}/${row._id}/void`,
          }),
        });
        const presignJson = await presignRes.json();
        if (!presignJson?.success || !presignJson.url || !presignJson.key) {
          throw new Error(presignJson?.error || "تعذر إنشاء رابط رفع مرفق التبطيل");
        }

        const uploadRes = await fetch(presignJson.url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`فشل رفع ${file.name}`);

        attachment = {
          key: presignJson.key,
          name: file.name,
          url: presignJson.getUrl || "",
          contentType: file.type || "application/octet-stream",
          size: file.size || 0,
          uploadedAt: new Date().toISOString(),
        };
      }

      const saveRes = await fetch(`/api/cheques/${encodeURIComponent(String(row._id))}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voidCheque: true,
          ...(attachment ? { attachment } : {}),
        }),
      });
      const saveJson = await saveRes.json();
      if (!saveJson?.success) {
        throw new Error(saveJson?.error || "تعذر تبطيل الصك");
      }

      setRows((prev) =>
        prev.map((item) =>
          String(item._id) === String(row._id)
            ? {
                ...item,
                status: "void",
                voidAttachment:
                  saveJson.data?.voidAttachment || attachment || item.voidAttachment,
                voidedAt: saveJson.data?.voidedAt || new Date().toISOString(),
              }
            : item
        )
      );
      setVoidModal({ open: false, row: null, file: null });
      showToast("تم تبطيل الصك بنجاح", "success");
    } catch (err) {
      console.error("Void cheque error:", err);
      showToast(err.message || "فشل تبطيل الصك", "error");
    } finally {
      setVoidingId(null);
    }
  }, [voidModal, voidingId, showToast]);

  const buildQuery = useCallback((p, overrides = null) => {
    const tpl = overrides?.templateFilter ?? templateFilter;
    const cn = overrides?.chequeNumber ?? chequeNumber;
    const acc = overrides?.accountNumber ?? accountNumber;
    const py = overrides?.payee ?? payee;
    const query = overrides?.q ?? q;
    const from = overrides?.dateFrom ?? dateFrom;
    const to = overrides?.dateTo ?? dateTo;

    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    if (tpl?.value && tpl.value !== "all") {
      params.set("templateKey", tpl.value);
    }
    if (String(cn).trim()) params.set("chequeNumber", String(cn).trim());
    if (String(acc).trim()) params.set("accountNumber", String(acc).trim());
    if (String(py).trim()) params.set("payee", String(py).trim());
    if (String(query).trim()) params.set("q", String(query).trim());
    if (from) params.set("dateFrom", from);
    if (to) params.set("dateTo", to);
    return params.toString();
  }, [templateFilter, chequeNumber, accountNumber, payee, q, dateFrom, dateTo]);

  const fetchReports = useCallback(
    async (p = 1, overrides = null) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cheques/reports?${buildQuery(p, overrides)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!json?.success) {
          showToast(json?.error || "تعذر تحميل التقارير", "error");
          return;
        }
        setRows(json.data || []);
        setMeta(json.meta || { total: 0, totalPages: 0, page: p, pageSize: PAGE_SIZE });
        setPage(p);
      } catch {
        showToast("خطأ في الاتصال", "error");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, showToast]
  );

  useEffect(() => {
    fetchReports(1);
  }, []);

  const resetFilters = () => {
    setTemplateFilter(templateOptions[0]);
    setChequeNumber("");
    setAccountNumber("");
    setPayee("");
    setQ("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    fetchReports(1, {
      templateFilter: templateOptions[0],
      chequeNumber: "",
      accountNumber: "",
      payee: "",
      q: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  const handleSearch = (e) => {
    e?.preventDefault?.();
    fetchReports(1);
  };

  const exportExcel = () => {
    if (!rows.length) {
      showToast("لا توجد بيانات للتصدير", "warning");
      return;
    }
    const sheet = rows.map((r, i) => ({
      "#": i + 1,
      "نوع الصك": r.templateName || r.templateKey,
      "رقم الصك": r.chequeNumber || "",
      "رقم الحساب": r.accountNumber || "",
      "تاريخ الصك": formatChequeDateParts(r.dateParts),
      "ادفعوا بموجب الأمر": r.payee || "",
      "المبلغ": r.amountNumeric || 0,
      "المبلغ كتابة": r.amountWords || "",
      "العملة": r.currency || "IQD",
      "الحالة": chequeStatusLabel(r.status),
      "أنشئ بواسطة": r.createdBy || "",
      "تاريخ الحفظ": formatSavedAt(r.createdAt),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sheet);
    XLSX.utils.book_append_sheet(wb, ws, "صكوك");
    XLSX.writeFile(wb, `cheques-report-${Date.now()}.xlsx`);
  };

  const statsLabel = useMemo(() => {
    if (!meta.total) return "لا توجد نتائج";
    return `${meta.total.toLocaleString("en-US")} صك محفوظ`;
  }, [meta.total]);

  if (!ready || !canUseCheques) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/cheques"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-800 mb-3 transition"
          >
            <FiArrowRight className="rotate-180" />
            نظام الصكوك
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
              <FiPieChart size={22} />
            </span>
            تقارير الصكوك
          </h1>
          <p className="mt-2 text-slate-600 font-semibold text-[15px]">
            بحث وفلترة — {statsLabel}
            <span className="text-violet-700"> · انقر على أي صف لفتح الصك في نافذة جديدة</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <FiDownload />
            Excel
          </button>
          <Link
            href="/cheques/reports/prints"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <FiPrinter />
            سجل الطباعة
          </Link>
          <Link
            href="/cheques"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-md hover:shadow-lg transition"
          >
            <FiFileText />
            إصدار صك
          </Link>
        </div>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSearch}
        className="rounded-3xl border border-white/70 bg-white/80 backdrop-blur-xl p-5 md:p-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.25)] mb-6"
      >
        <div className="flex items-center gap-2 mb-4 text-slate-800 font-extrabold text-sm">
          <FiFilter className="text-emerald-600" />
          فلاتر البحث
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">نوع الصك</label>
            <Select
              value={templateFilter}
              onChange={setTemplateFilter}
              options={templateOptions}
              styles={selectStyles}
              isSearchable={false}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">رقم الصك</label>
            <div className="relative">
              <FiHash className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="مطابقة تامة"
                className="w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 py-2.5 text-sm font-bold"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">رقم الحساب</label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="بحث جزئي"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
              ادفعوا بموجب الأمر
            </label>
            <input
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="بحث جزئي"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">بحث عام</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="رقم، حساب، مستفيد، مبلغ كتابة…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">من تاريخ</label>
              <div className="relative">
                <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pr-10 pl-2 py-2.5 text-sm font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">إلى تاريخ</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <FiSearch />
            {loading ? "جاري البحث…" : "بحث"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
          >
            <FiRotateCcw />
            إعادة ضبط
          </button>
        </div>
      </motion.form>

      <div className="rounded-3xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_-30px_rgba(0,0,0,0.2)] overflow-hidden">
        <div>
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="bg-gradient-to-l from-slate-50 to-emerald-50/80 border-b border-slate-200">
                {[
                  ["عرض", "w-[44px]"],
                  ["#", "w-[36px]"],
                  ["نوع الصك", "w-[9%]"],
                  ["رقم الصك", "w-[6%]"],
                  ["رقم الحساب", "w-[8%]"],
                  ["تاريخ الصك", "w-[7%]"],
                  ["بموجب الأمر", "w-[10%]"],
                  ["المبلغ", "w-[9%]"],
                  ["المبلغ كتابة", "w-[13%]"],
                  ["أنشئ بواسطة", "w-[7%]"],
                  ["تاريخ الحفظ", "w-[8%]"],
                  ["الحالة", "w-[5%]"],
                  ["الاتاجات", "w-[9%]"],
                  ["تبطيل الصك", "w-[9%]"],
                ].map(([h, w]) => (
                  <th
                    key={h}
                    className={`px-2 py-3.5 text-[11px] font-extrabold text-slate-600 ${w} ${
                      ["الاتاجات", "تبطيل الصك", "الحالة", "عرض"].includes(h)
                        ? "text-center"
                        : "text-right"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-16 text-center text-slate-500 font-bold">
                    جاري التحميل…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-16 text-center text-slate-500 font-bold">
                    لا توجد صكوك مطابقة
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r._id}
                    onClick={() => openCheque(r)}
                    className={`border-b cursor-pointer transition-colors duration-150 ${
                      r.status === "void"
                        ? "border-rose-200 bg-rose-50/80 hover:bg-rose-100/80"
                        : `border-slate-100 ${
                            idx % 2 === 0 ? "bg-white/50" : "bg-slate-50/30"
                          } hover:bg-emerald-50/50`
                    }`}
                  >
                    <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openCheque(r)}
                        title="معاينة الصك"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-800 hover:bg-violet-200 transition"
                      >
                        <FiEye size={16} />
                      </button>
                    </td>
                    <td className="px-2 py-3 font-bold text-slate-500 tabular-nums">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-2 py-3 font-extrabold text-slate-800 break-words">
                      <span className="line-clamp-2">
                        {r.branchName || r.templateName || r.templateKey}
                      </span>
                      {r.branchName && r.templateName && r.branchName !== r.templateName ? (
                        <span className="mt-0.5 block text-[11px] font-semibold text-slate-500 line-clamp-1">
                          {r.templateName}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 font-bold text-slate-800 tabular-nums break-words">
                      {r.chequeNumber || "—"}
                    </td>
                    <td className="px-2 py-3 font-bold text-slate-700 tabular-nums break-words">
                      {r.accountNumber || "—"}
                    </td>
                    <td className="px-2 py-3 font-semibold text-slate-700">
                      {formatChequeDateParts(r.dateParts)}
                    </td>
                    <td className="px-2 py-3 font-semibold text-slate-800 break-words">
                      {truncate(r.payee, 40)}
                    </td>
                    <td className="px-2 py-3 font-extrabold text-emerald-800 break-words">
                      {formatChequeAmount(r.amountNumeric, r.currency)}
                    </td>
                    <td className="px-2 py-3 font-semibold text-slate-600 break-words">
                      {truncate(r.amountWords, 55)}
                    </td>
                    <td className="px-2 py-3 font-bold text-slate-600 break-words">
                      {r.createdBy || "—"}
                    </td>
                    <td className="px-2 py-3 font-semibold text-slate-500 text-[11px]">
                      {formatSavedAt(r.createdAt)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                          r.status === "void"
                            ? "bg-rose-600 text-white"
                            : r.status === "draft"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {chequeStatusLabel(r.status)}
                      </span>
                    </td>
                    <td
                      className="px-2 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="file"
                        hidden
                        multiple
                        ref={(el) => {
                          fileInputRefs.current[r._id] = el;
                        }}
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length) handleUploadAttachments(r, files);
                          e.target.value = "";
                        }}
                      />

                      <div className="flex w-full flex-col items-stretch gap-1.5">
                        <button
                          type="button"
                          onClick={() => triggerAttachmentPick(r._id)}
                          disabled={uploadingId === r._id}
                          className={`w-full rounded-xl border px-2 py-1.5 text-center text-[11px] font-extrabold transition ${
                            uploadingId === r._id
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                              : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          {uploadingId === r._id ? "جاري الرفع…" : "رفع مرفق"}
                        </button>

                        {Array.isArray(r.attachments) && r.attachments.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => openAttachmentsModal(r)}
                            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-2 py-1.5 text-center text-[11px] font-extrabold text-blue-700 hover:bg-blue-100"
                          >
                            عرض الاتاجات ({r.attachments.length})
                          </button>
                        ) : (
                          <span className="text-center text-[11px] text-slate-400">
                            لا يوجد
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-2 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex w-full flex-col items-stretch gap-1.5">
                        {r.status === "void" ? (
                          <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-100 px-2 py-1.5 text-[11px] font-extrabold text-rose-500">
                            <FiSlash size={12} />
                            الصك باطل
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setVoidModal({ open: true, row: r, file: null })
                            }
                            disabled={voidingId === r._id}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-rose-600 px-2 py-1.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
                          >
                            <FiSlash size={12} />
                            تبطيل الصك
                          </button>
                        )}

                        {r.status === "void" && r.voidAttachment?.url ? (
                          <a
                            href={attachmentOpenHref(r.voidAttachment)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full rounded-xl border border-rose-300 bg-rose-50 px-2 py-1.5 text-center text-[11px] font-extrabold text-rose-800 hover:bg-rose-100"
                          >
                            مرفق التبطيل
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <TablePagination
            page={page}
            totalPages={meta.totalPages}
            onPage={(p) => fetchReports(p)}
          />
        </div>
      </div>

      <AnimatePresence>
        {voidModal.open && voidModal.row && (
          <motion.div
            className="fixed inset-0 z-[100000] bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeVoidModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-6 text-right shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <FiAlertTriangle size={22} />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">تبطيل الصك</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    رقم الصك: {voidModal.row.chequeNumber || "—"}
                  </p>
                </div>
              </div>

              <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-7 text-rose-900">
                بعد التأكيد ستصبح حالة الصك «باطل». يمكن إرفاق ملف للتبطيل
                اختيارياً.
              </p>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-extrabold text-slate-800">
                  مرفق التبطيل{" "}
                  <span className="font-bold text-slate-400">(اختياري)</span>
                </span>
                <input
                  type="file"
                  disabled={Boolean(voidingId)}
                  onChange={(e) =>
                    setVoidModal((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                  className="block w-full cursor-pointer rounded-xl border border-rose-200 bg-rose-50/60 p-2 text-sm font-bold text-slate-700 file:ml-3 file:rounded-lg file:border-0 file:bg-rose-600 file:px-4 file:py-2 file:font-extrabold file:text-white"
                />
              </label>

              {voidModal.file ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  الملف المختار: {voidModal.file.name}
                </div>
              ) : null}

              <div className="mt-6 flex flex-row-reverse gap-3">
                <button
                  type="button"
                  disabled={Boolean(voidingId)}
                  onClick={handleVoidChequeConfirmed}
                  className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-extrabold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {voidingId
                    ? voidModal.file
                      ? "جاري رفع المرفق والتبطيل…"
                      : "جاري التبطيل…"
                    : "تأكيد تبطيل الصك"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(voidingId)}
                  onClick={closeVoidModal}
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attachmentsModal.open && (
          <motion.div
            className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAttachmentsModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={closeAttachmentsModal}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold hover:bg-slate-50"
                >
                  إغلاق
                </button>

                <div className="text-right">
                  <div className="text-lg font-extrabold text-slate-900">الاتاجات</div>
                  <div className="text-sm text-slate-500 font-bold">
                    الصك: {attachmentsModal.rowName}
                  </div>
                </div>
              </div>

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
                {attachmentsModal.attachments.length > 0 ? (
                  attachmentsModal.attachments.map((att, idx) => (
                    <div
                      key={`${att.key || att.name}-${idx}`}
                      className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={Boolean(deletingAttKey)}
                          onClick={() =>
                            requestDeleteAttachment(attachmentsModal.rowId, att)
                          }
                          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[13px] font-extrabold hover:bg-red-100 disabled:opacity-50"
                        >
                          حذف الاتاج
                        </button>
                        <a
                          href={attachmentOpenHref(att)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[13px] font-extrabold hover:bg-blue-100"
                        >
                          فتح
                        </a>
                      </div>

                      <div className="text-right min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">
                          {att.name || `ملف ${idx + 1}`}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {att.contentType || "—"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 font-extrabold py-8">
                    لا توجد اتاجات
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteAttConfirm.open && deleteAttConfirm.att && (
          <motion.div
            className="fixed inset-0 z-[100000] bg-black/45 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() =>
              !deletingAttKey &&
              setDeleteAttConfirm({ open: false, rowId: null, att: null })
            }
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-right"
            >
              <h3 className="text-lg font-extrabold text-slate-900">تأكيد حذف الاتاج</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                هل تريد حذف الملف التالي من هذا الصك؟ لا يمكن التراجع عن هذه العملية.
              </p>
              <p className="mt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-900 truncate">
                {deleteAttConfirm.att.name || "ملف مرفق"}
              </p>
              <div className="mt-6 flex flex-row-reverse gap-3">
                <button
                  type="button"
                  disabled={Boolean(deletingAttKey)}
                  onClick={handleDeleteAttachmentConfirmed}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingAttKey ? "جاري الحذف…" : "تأكيد الحذف"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingAttKey)}
                  onClick={() =>
                    setDeleteAttConfirm({ open: false, rowId: null, att: null })
                  }
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
