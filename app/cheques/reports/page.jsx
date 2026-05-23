"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  const openCheque = useCallback((row) => {
    if (!row?._id) return;
    window.open(
      `/cheques/view?id=${encodeURIComponent(String(row._id))}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, []);

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-gradient-to-l from-slate-50 to-emerald-50/80 border-b border-slate-200">
                {[
                  "عرض",
                  "#",
                  "نوع الصك",
                  "رقم الصك",
                  "رقم الحساب",
                  "تاريخ الصك",
                  "بموجب الأمر",
                  "المبلغ",
                  "المبلغ كتابة",
                  "أنشئ بواسطة",
                  "تاريخ الحفظ",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3.5 text-right text-[11px] font-extrabold text-slate-600 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-slate-500 font-bold">
                    جاري التحميل…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-slate-500 font-bold">
                    لا توجد صكوك مطابقة
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r._id}
                    onClick={() => openCheque(r)}
                    className={`border-b border-slate-100 cursor-pointer transition-colors duration-150 ${
                      idx % 2 === 0 ? "bg-white/50" : "bg-slate-50/30"
                    } hover:bg-emerald-50/50`}
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
                    <td className="px-3 py-3 font-bold text-slate-500 tabular-nums">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-3 py-3 font-extrabold text-slate-800 max-w-[140px]">
                      <span className="line-clamp-2">{r.templateName || r.templateKey}</span>
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-800 tabular-nums">
                      {r.chequeNumber || "—"}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-700 tabular-nums">
                      {r.accountNumber || "—"}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      {formatChequeDateParts(r.dateParts)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-800 max-w-[160px]">
                      {truncate(r.payee, 40)}
                    </td>
                    <td className="px-3 py-3 font-extrabold text-emerald-800 whitespace-nowrap">
                      {formatChequeAmount(r.amountNumeric, r.currency)}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-600 max-w-[200px]">
                      {truncate(r.amountWords, 55)}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-600">{r.createdBy || "—"}</td>
                    <td className="px-3 py-3 font-semibold text-slate-500 whitespace-nowrap text-[12px]">
                      {formatSavedAt(r.createdAt)}
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
    </div>
  );
}
