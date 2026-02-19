"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";

import {
  FiFilter,
  FiCalendar,
  FiUser,
  FiHome,
  FiRotateCcw,
  FiSearch,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiXCircle,
  FiLayers,
  FiShield,
  FiDownload,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

import TablePagination from "@/components/TablePagination";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

export default function ReportsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // meta from server
  const PAGE_SIZE = 25;
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [page, setPage] = useState(1);

  // Filters options from API
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [codeOptions, setCodeOptions] = useState([]);
  const [amountOptions, setAmountOptions] = useState([]);
const [amountFilter, setAmountFilter] = useState(null); // {value,label} أو null
useEffect(() => {
  const set = new Set();
  (requests || []).forEach((r) => {
    const n = Number(getAmount(r));
    if (Number.isFinite(n)) set.add(n);
  });

  const opts = Array.from(set)
    .sort((a, b) => a - b)
    .map((n) => ({
      value: String(n),
      label: new Intl.NumberFormat("en-US").format(n),
    }));

  setAmountOptions(opts);
}, [requests]);

  // Selected filters
  const [companyFilter, setCompanyFilter] = useState([]);
  const [userFilter, setUserFilter] = useState([]);
  const [currencyFilter, setCurrencyFilter] = useState({ value: "all", label: "كل العملات" });
  const [statusFilter, setStatusFilter] = useState({ value: "all", label: "كل الحالات" });
  const [pendingFilter, setPendingFilter] = useState({ value: "all", label: "الكل" });

  const [codeOption, setCodeOption] = useState(null);
  const [date, setDate] = useState({ from: "", to: "" });

  const [codeQ, setCodeQ] = useState("");
  

  // حتى ما يسوي fetch أول ما يفتح الصفحة
  const hasSearchedRef = useRef(false);

  const router = useRouter();
const { permissions } = usePermissions();

const canViewReports =
  Array.isArray(permissions) &&
  permissions.includes(PERMISSIONS.VIEW_REPORTS);

  useEffect(() => {
    // ننتظر لحد ما تنزل الصلاحيات
    if (!Array.isArray(permissions)) return;
  
    if (!canViewReports) {
      router.replace("/home");
    }
  }, [permissions, canViewReports, router]);

  // ✅ Fix portal target (for react-select)
  const [menuTarget, setMenuTarget] = useState(null);
  useEffect(() => {
    setMenuTarget(document.body);
  }, []);

  const selectMenuProps = useMemo(
    () => ({
      menuPortalTarget: menuTarget,
      menuPosition: "fixed",
    }),
    [menuTarget]
  );

  // ✅ تنسيقات react-select + اخفاء separator
  const selectStyles = useMemo(
    () => ({
      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      menu: (base) => ({ ...base, zIndex: 9999, borderRadius: 14, overflow: "hidden" }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "#111827" : state.isFocused ? "#f3f4f6" : "white",
        color: state.isSelected ? "white" : "#334155",
        cursor: "pointer",
      }),
      control: (base, state) => ({
        ...base,
        borderRadius: 14,
        borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
        boxShadow: "none",
        minHeight: 44,
        backgroundColor: "rgba(255,255,255,0.92)",
        transition: "border-color 120ms ease",
        ":hover": { borderColor: "#cbd5e1" },
      }),
      multiValue: (base) => ({ ...base, borderRadius: 999 }),
      placeholder: (base) => ({ ...base, color: "#94a3b8" }),
      indicatorSeparator: (base) => ({ ...base, display: "none" }),
    }),
    []
  );

  // ✅ مكوّنات لإخفاء الـ X (ClearIndicator) حسب السيليكت اللي تريده
  const noClearComponents = useMemo(
    () => ({
      IndicatorSeparator: () => null,
      ClearIndicator: () => null,
    }),
    []
  );

  // ✅ Stats (من الـ meta.total حتى يكون صحيح مع paging)
  const stats = useMemo(() => {
    return {
      total: meta.total || 0,
      approved: requests.filter((x) => x.status === "Approved").length,
      pending: requests.filter((x) => x.status === "Pending").length,
      rejected: requests.filter((x) => x.status === "Rejected").length,
      cancelled: requests.filter((x) => x.status === "Cancelled").length,
    };
  }, [requests, meta.total]);

  // ✅ تحميل الفلاتر مرة وحدة فقط (ثابتة)
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch("/api/reports?filters=1");
        const json = await res.json();
        if (!json?.success) return;

        const f = json.filters || {};

        setCompanies((f.companies || []).map((c) => ({ value: c, label: c })));

        setUsers([
          { value: "all", label: "كل المستخدمين" },
          ...(f.users || []).map((u) => ({ value: u, label: u })),
        ]);

        const currList = Array.from(
          new Set(
            (f.currencies || [])
              .map((c) => (typeof c === "object" && c !== null ? c.value || c.label : c))
              .filter(Boolean)
          )
        );

        setCurrencies([
          { value: "all", label: "كل العملات" },
          ...currList.map((c) => ({ value: c, label: c })),
        ]);

        const st = (f.statuses || ["Pending", "Approved", "Rejected", "Cancelled"]).map((s) => ({
          value: s,
          label: s === "Pending" ? "قيد الانتظار"
            : s === "Approved" ? "مقبول"
            : s === "Rejected" ? "مرفوض"
            : s === "Cancelled" ? "ملغي"
            : s,
        }));

        setStatuses([{ value: "all", label: "كل الحالات" }, ...st]);

        setPendingUsers([
          { value: "all", label: "الكل" },
          ...(f.pendingUsers || []),
        ]);
      } catch (err) {
        console.error("❌ Error loading reports filters:", err);
      }
    };
    loadFilters();
  }, []);

  // ✅ اقتراحات Request Code (global) مع بحث
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("codes", "1");
        if (codeQ.trim()) params.set("q", codeQ.trim());

        const res = await fetch(`/api/reports?${params.toString()}`);
        const json = await res.json();
        if (json?.success) setCodeOptions(json.data || []);
      } catch (e) {
        // ignore
      }
    }, 250);

    return () => clearTimeout(t);
  }, [codeQ]);

  // ✅ Prevent mixing "All" in multi (for users only)
  const handleMultiAll = (selected, setter, allLabel) => {
    if (!selected) return setter([]);
    if (selected.some((s) => s.value === "all")) {
      setter([{ value: "all", label: allLabel }]);
    } else {
      setter(selected.filter((s) => s.value !== "all"));
    }
  };

  const buildParams = useCallback(
    (pageValue) => {
      const params = new URLSearchParams();

      params.set(
        "company",
        companyFilter.length === 0 ? "all" : companyFilter.map((c) => c.value).join(",")
      );

      params.set(
        "user",
        userFilter.length === 0 || userFilter.some((u) => u.value === "all")
          ? "all"
          : userFilter.map((u) => u.value).join(",")
      );

      params.set("status", statusFilter?.value || "all");
      params.set("currency", currencyFilter?.value || "all");
      params.set("pending", pendingFilter?.value || "all");
      if (amountFilter?.value) params.set("amount", amountFilter.value);
      if (date.from) params.set("from", date.from);
      if (date.to) params.set("to", date.to);

      if (codeOption?.value) params.set("code", codeOption.value);

      params.set("page", String(pageValue));
      params.set("pageSize", String(PAGE_SIZE));

      return params;
    },
    [companyFilter, userFilter, statusFilter, currencyFilter, pendingFilter, date, codeOption , amountFilter]
  );

  const fetchPage = useCallback(
    async (pageValue) => {
      setLoading(true);
      try {
        const params = buildParams(pageValue);
        const res = await fetch(`/api/reports?${params.toString()}`);
        const json = await res.json();

        if (json?.success) {
          setRequests(json.data || []);
          setMeta(json.meta || { total: 0, totalPages: 0, page: pageValue, pageSize: PAGE_SIZE });
        } else {
          setRequests([]);
          setMeta({ total: 0, totalPages: 0, page: pageValue, pageSize: PAGE_SIZE });
        }
      } catch (err) {
        console.error("❌ Error fetching reports:", err);
        setRequests([]);
        setMeta({ total: 0, totalPages: 0, page: pageValue, pageSize: PAGE_SIZE });
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  const handleSearch = async () => {
    hasSearchedRef.current = true;
    setPage(1);
    await fetchPage(1);
  };

  useEffect(() => {
    if (!hasSearchedRef.current) return;
    fetchPage(page);
  }, [page, fetchPage]);

  const handleReset = () => {
    setCompanyFilter([]);
    setUserFilter([]);
    setCurrencyFilter({ value: "all", label: "كل العملات" });
    setStatusFilter({ value: "all", label: "كل الحالات" });
    setPendingFilter({ value: "all", label: "الكل" });
    setDate({ from: "", to: "" });
    setCodeOption(null);
    setRequests([]);
    setMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
    setPage(1);
    setAmountFilter(null);
    hasSearchedRef.current = false;
  };

  const badge = (status) => {
    const base = "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border";
    if (status === "Approved")
      return (
        <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
          <FiCheckCircle /> مقبول
        </span>
      );
    if (status === "Rejected")
      return (
        <span className={`${base} bg-red-50 text-red-700 border-red-200`}>
          <FiXCircle /> مرفوض
        </span>
      );
    if (status === "Cancelled")
      return (
        <span className={`${base} bg-gray-100 text-gray-700 border-gray-200`}>
          <FiXCircle /> ملغي
        </span>
      );
    return (
      <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>
        <FiClock /> قيد الانتظار
      </span>
    );
  };

  const fmtAmount = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return new Intl.NumberFormat("en-US").format(n);
  };

  // ✅ حاول نجيب المبلغ من أكثر من حقل (حسب موديلك)
  const getAmount = (r) =>
    r.amount ??
    r.totalAmount ??
    r.total ??
    r.grandTotal ??
    r.netTotal ??
    r.requestAmount ??
    r.value ??
    null;

  const handleExportExcel = () => {
    const rows = (requests || []).map((r) => ({
      "الشركة": r.companyKey || "-",
      "الكود": r.requestCode || "-",
      "النوع": r.requestType || "-",
      "الطالب": r.createdBy || "-",
      "الحالة": r.status || "-",
      "قيد الانتظار عند": Array.isArray(r.pendingWithNames) ? r.pendingWithNames.join(", ") : "-",
      "القسم": r.department || "-",
      "العملة": r.currency || "-",
      "المبلغ": (() => {
        const v = getAmount(r);
        const n = Number(v);
        return Number.isFinite(n) ? n : "";
      })(),
      "الوصف": r.description || "-",
      "التاريخ": r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-IQ") : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // تنسيق آلاف لعمود المبلغ (اختياري)
    // نخلي فورمات رقم
    const amountCol = Object.keys(rows[0] || {}).indexOf("المبلغ");
    if (amountCol >= 0) {
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        const cellAddr = XLSX.utils.encode_cell({ r: R, c: amountCol });
        if (ws[cellAddr] && typeof ws[cellAddr].v === "number") {
          ws[cellAddr].z = "#,##0";
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقارير");
    XLSX.writeFile(wb, `تقارير_الطلبات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const Card = ({ icon: Icon, title, value }) => (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
      </div>

      <div className="relative px-5 py-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-sm">
          <Icon className="text-xl" />
        </div>
        <div>
          <div className="text-xs text-gray-500">{title}</div>
          <div className="text-xl font-extrabold text-gray-900">{value}</div>
        </div>
      </div>
    </motion.div>
  );
if (!Array.isArray(permissions)) return null;
if (!canViewReports) return null;
  return (
    <motion.div
      className="min-h-screen p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5"
      >
        <div className="text-right">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center justify-end gap-3">
            <FiFilter className="text-blue-600" /> تقارير الطلبات
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            فلترة ومتابعة الطلبات حسب الصلاحيات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSearch}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border ${
              loading
                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                : "bg-gray-900 text-white border-gray-900 hover:bg-black"
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FiSearch /> بحث
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleReset}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-white/80 backdrop-blur border border-gray-200 text-gray-900 flex items-center gap-2 shadow-sm hover:bg-white"
          >
            <FiRotateCcw /> مسح الفلاتر
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleExportExcel}
            disabled={loading || requests.length === 0}
            className={`px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border ${
              loading || requests.length === 0
                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                : "bg-white/80 backdrop-blur border-gray-200 text-gray-900 hover:bg-white"
            }`}
          >
            <FiDownload /> اكسل
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card icon={FiLayers} title="الكل" value={stats.total} />
        <Card icon={FiCheckCircle} title="مقبول (الصفحة)" value={stats.approved} />
        <Card icon={FiClock} title="قيد الانتظار (الصفحة)" value={stats.pending} />
        <Card icon={FiXCircle} title="مرفوض (الصفحة)" value={stats.rejected} />
        <Card icon={FiXCircle} title="ملغي (الصفحة)" value={stats.cancelled} />
      </div>

      {/* Filters Card */}
      <motion.div
        className="rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur shadow-sm p-5 md:p-6 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        whileHover={{ y: -1 }}
      >
        <div className="flex items-center justify-end gap-2 text-gray-900 font-semibold mb-4">
          <FiShield className="text-gray-700" />
          الفلاتر
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* الشركة */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiHome /> الشركة
            </label>
            <Select
              {...selectMenuProps}
              options={companies}
              isMulti
              placeholder="اختر الشركة"
              value={companyFilter}
              onChange={(v) => setCompanyFilter(v || [])}
              styles={selectStyles}
            />
          </div>

          {/* مقدم الطلب */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiUser /> مقدم الطلب
            </label>
            <Select
              {...selectMenuProps}
              options={users}
              isMulti
              placeholder="اختر مقدم الطلب"
              value={userFilter}
              onChange={(v) => handleMultiAll(v, setUserFilter, "كل المستخدمين")}
              styles={selectStyles}
            />
          </div>

          {/* الحالة */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiCheckCircle /> الحالة
            </label>
            <Select
              {...selectMenuProps}
              options={statuses}
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || { value: "all", label: "كل الحالات" })}
              styles={selectStyles}
              isSearchable
              components={noClearComponents} // ✅ بدون X
            />
          </div>

          {/* العملة */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiDollarSign /> العملة
            </label>
            <Select
              {...selectMenuProps}
              options={currencies}
              placeholder="كل العملات"
              value={currencyFilter}
              onChange={(v) => setCurrencyFilter(v || { value: "all", label: "كل العملات" })}
              styles={selectStyles}
              isSearchable
              components={noClearComponents} // ✅ بدون X
            />
          </div>

          {/* قيد الانتظار عند */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiClock /> قيد الانتظار عند
            </label>
            <Select
              {...selectMenuProps}
              options={pendingUsers}
              placeholder="الكل"
              value={pendingFilter}
              onChange={(v) => setPendingFilter(v || { value: "all", label: "الكل" })}
              styles={selectStyles}
              isSearchable
              components={noClearComponents} // ✅ بدون X
            />
          </div>

          {/* من */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiCalendar /> من
            </label>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white/90 text-gray-900 outline-none"
            />
          </div>

          {/* الى */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
              <FiCalendar /> الى
            </label>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white/90 text-gray-900 outline-none focus:border-gray-300 transition"
            />
          </div>

          {/* كود الطلب */}
          <div className="text-right">
            <label className="text-sm text-gray-600 mb-1">كود الطلب</label>
            <Select
              {...selectMenuProps}
              options={codeOptions}
              value={codeOption}
              onChange={(v) => setCodeOption(v || null)}
              onInputChange={(val, meta) => {
                if (meta.action === "input-change") setCodeQ(val);
              }}
              isSearchable
              placeholder="ابحث عن كود الطلب..."
              styles={selectStyles}
              components={noClearComponents} // ✅ بدون X
            />
          </div>
          {/* المبلغ */}
<div className="text-right">
  <label className="text-sm text-gray-600 mb-1 flex items-center justify-end gap-2">
    <FiDollarSign /> المبلغ
  </label>
  <Select
    {...selectMenuProps}
    options={amountOptions}
    value={amountFilter}
    onChange={(v) => setAmountFilter(v || null)}
    onInputChange={(val, meta) => {
      if (meta.action === "input-change") {
        const cleaned = String(val || "").replace(/[^\d]/g, "");
        if (cleaned) setAmountFilter({ value: cleaned, label: new Intl.NumberFormat("en-US").format(Number(cleaned)) });
        else setAmountFilter(null);
      }
    }}
    isSearchable
    placeholder="اكتب مبلغ أو اختار..."
    styles={selectStyles}
  />
</div>
        </div>
      </motion.div>

    {/* Table */}
<AnimatePresence mode="wait">
  {loading ? (
    <motion.div className="flex flex-col items-center py-20">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="mt-4 text-gray-600">جاري التحميل...</p>
    </motion.div>
  ) : requests.length > 0 ? (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="
        relative overflow-hidden rounded-3xl border border-white/30
        bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.35)]
      "
    >
      {/* glass glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm text-slate-700">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white/70 backdrop-blur border-b border-white/40">
              {[
                "الشركة",
                "الكود",
                "النوع",
                "مقدم الطلب",
                "الحالة",
                "قيد الانتظار عند",
                "القسم",
                "العملة",
                "المبلغ",
                "الوصف",
                "التاريخ",
              ].map((h) => (
                <th
                  key={h}
                  className="
                    px-6 py-3 text-right text-[12px] font-extrabold tracking-wide
                    text-slate-700 whitespace-nowrap
                  "
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/30">
            {requests.map((r, idx) => (
              <motion.tr
                key={r._id}
                whileHover={{ backgroundColor: "rgba(2,132,199,0.07)" }}
                transition={{ duration: 0.12 }}
                onClick={() => window.open(`/requests/${r.companyKey}/${r._id}`, "_blank")}
                className={`
                  cursor-pointer
                  ${idx % 2 === 0 ? "bg-white/30" : "bg-white/20"}
                  hover:bg-white/45
                `}
              >
                <td className="px-6 py-4 text-right font-bold text-slate-900 whitespace-nowrap">
                  {r.companyKey || "-"}
                </td>

                <td className="px-6 py-4 text-right font-mono text-slate-900 whitespace-nowrap">
                  {r.requestCode || "-"}
                </td>

                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {r.requestType || "-"}
                </td>

                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {r.createdBy || "-"}
                </td>

                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {badge(r.status)}
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="max-w-[240px] truncate">
                    {Array.isArray(r.pendingWithNames) && r.pendingWithNames.length > 0
                      ? r.pendingWithNames.join(", ")
                      : "-"}
                  </div>
                </td>

                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {r.department || "-"}
                </td>

                <td className="px-6 py-4 text-right whitespace-nowrap font-semibold">
                  {r.currency || "-"}
                </td>

                <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                  {(() => {
                    const v = getAmount(r);
                    return v == null ? "-" : fmtAmount(v);
                  })()}
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="max-w-[320px] truncate text-slate-700">
                    {r.description || "-"}
                  </div>
                </td>

                <td className="px-6 py-4 text-right whitespace-nowrap text-slate-600">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-IQ") : "-"}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="relative px-5 py-4 bg-white/55 backdrop-blur border-t border-white/30 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          المجموع: <span className="font-extrabold text-slate-900">{meta.total}</span>
          {"  "} | الصفحة: <span className="font-extrabold text-slate-900">{meta.page}</span>
          {" / "}
          <span className="font-extrabold text-slate-900">{meta.totalPages || 1}</span>
        </div>

        <TablePagination page={page} totalPages={meta.totalPages || 1} onPage={setPage} />
      </div>
    </motion.div>
  ) : (
    <motion.div
      key="empty"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center text-slate-600 italic py-16 rounded-3xl border border-white/30 bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.25)]"
    >
      لا يوجد طلبات حسب الفلاتر
    </motion.div>
  )}
</AnimatePresence>
</motion.div>
  );
}