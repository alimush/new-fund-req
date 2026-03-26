"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";

import {
  FiFilter,
  FiCalendar,
  FiUser,
  FiHome,
  FiRotateCcw,
  FiSearch,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiLayers,
  FiShield,
  FiDownload,
  FiChevronDown,
} from "react-icons/fi";

import { FaMoneyBillWave } from "react-icons/fa6"; // ✅ ورقة فلوس


import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import TablePagination from "@/components/TablePagination";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

export default function ReportsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // meta
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

  // Selected filters
  const [companyFilter, setCompanyFilter] = useState([]);
  const [userFilter, setUserFilter] = useState([]);
  const [currencyFilter, setCurrencyFilter] = useState({
    value: "all",
    label: "كل العملات",
  });
  const [statusFilter, setStatusFilter] = useState({
    value: "all",
    label: "كل الحالات",
  });
  const [pendingFilter, setPendingFilter] = useState({
    value: "all",
    label: "الكل",
  });
  const [date, setDate] = useState({ from: "", to: "" });

  // ✅ Smart input (لا fetch أثناء الكتابة)
  const [smartInput, setSmartInput] = useState("");
  const [smartPicked, setSmartPicked] = useState(null); // {value,label,type}
  const [smartOptions, setSmartOptions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);

  // ✅ Portal positioning
  const inputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });
  const [portalReady, setPortalReady] = useState(false);

  // حتى ما يسوي fetch أول ما يفتح الصفحة
  const hasSearchedRef = useRef(false);


  const { permissions } = usePermissions();

  const canViewReports =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VIEW_REPORTS);

  

  useEffect(() => setPortalReady(true), []);

  // ✅ Fix portal target for react-select
  const [menuTarget, setMenuTarget] = useState(null);
  useEffect(() => setMenuTarget(document.body), []);

  const selectMenuProps = useMemo(
    () => ({
      menuPortalTarget: menuTarget,
      menuPosition: "fixed",
    }),
    [menuTarget]
  );

  // ✅ Smaller controls (الانبتات أصغر)
  const selectStyles = useMemo(
    () => ({
      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: 12,
        overflow: "hidden",
        fontSize: 13,
        fontWeight: 900,
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
          ? "#111827"
          : state.isFocused
          ? "#f3f4f6"
          : "white",
        color: state.isSelected ? "white" : "#0f172a",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 900,
        paddingTop: 9,
        paddingBottom: 9,
      }),
      control: (base, state) => ({
        ...base,
        borderRadius: 12,
        borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
        boxShadow: "none",
        minHeight: 42,
        backgroundColor: "rgba(255,255,255,0.94)",
        transition: "border-color 120ms ease",
        fontSize: 13,
        fontWeight: 900,
        ":hover": { borderColor: "#cbd5e1" },
      }),
      placeholder: (base) => ({ ...base, color: "#94a3b8", fontWeight: 900 }),
      indicatorSeparator: () => ({ display: "none" }),
      singleValue: (base) => ({ ...base, fontWeight: 900 }),
      input: (base) => ({ ...base, fontWeight: 900 }),
    }),
    []
  );

  const noClearComponents = useMemo(
    () => ({
      IndicatorSeparator: () => null,
      ClearIndicator: () => null,
    }),
    []
  );

  // ✅ stats
  const stats = useMemo(() => {
    return {
      total: meta.total || 0,
      approved: requests.filter((x) => x.status === "Approved").length,
      pending: requests.filter((x) => x.status === "Pending").length,
      rejected: requests.filter((x) => x.status === "Rejected").length,
    };
  }, [requests, meta.total]);

  // ✅ تحميل الفلاتر مرة وحدة فقط (هذا طبيعي)
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
              .map((c) =>
                typeof c === "object" && c !== null ? c.value || c.label : c
              )
              .filter(Boolean)
          )
        );

        setCurrencies([
          { value: "all", label: "كل العملات" },
          ...currList.map((c) => ({ value: c, label: c })),
        ]);

        const st = (f.statuses || ["Pending", "Approved", "Rejected"]).map((s) => ({
          value: s,
          label:
            s === "Pending"
              ? "قيد الانتظار"
              : s === "Approved"
              ? "مقبول"
              : s === "Rejected"
              ? "مرفوض"
              : s,
        }));
        setStatuses([{ value: "all", label: "كل الحالات" }, ...st]);

        setPendingUsers([{ value: "all", label: "الكل" }, ...(f.pendingUsers || [])]);
      } catch (err) {
        console.error("❌ Error loading reports filters:", err);
      }
    };
    loadFilters();
  }, []);

  // =========================
  // ✅ Suggestions: فقط user-triggered (زر الاقتراحات)
  // =========================
  const isDigitsOnly = (s) => /^\d+$/.test(String(s || "").replace(/,/g, "").trim());

  const recalcSuggestPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSuggestPos({
      left: r.left,
      top: r.bottom + 8,
      width: r.width,
    });
  }, []);

  const fetchSuggestions = useCallback(async () => {
    const q = smartInput.trim();
    if (!q) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    // ✅ أرقام؟ لا اقتراحات
    if (isDigitsOnly(q)) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    setSuggestLoading(true);
    try {
      const res = await fetch(`/api/reports?suggest=1&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json?.success) {
        const arr = Array.isArray(json.data) ? json.data : [];
        setSmartOptions(arr);
        if (arr.length > 0) {
          recalcSuggestPos();
          setShowSuggest(true);
          setActiveIdx(-1);
        } else {
          setShowSuggest(false);
          setActiveIdx(-1);
        }
      }
    } catch {
      // ignore
    } finally {
      setSuggestLoading(false);
    }
  }, [smartInput, recalcSuggestPos]);
// ✅ اقتراحات تلقائية أثناء الكتابة (بس مو بحث)
useEffect(() => {
  const q = smartInput.trim();

  // اذا فاضي
  if (!q) {
    setSmartOptions([]);
    setShowSuggest(false);
    setActiveIdx(-1);
    return;
  }

  // ✅ اذا أرقام فقط: لا اقتراحات
  if (/^\d+$/.test(q.replace(/,/g, "").trim())) {
    setSmartOptions([]);
    setShowSuggest(false);
    setActiveIdx(-1);
    return;
  }

  const t = setTimeout(() => {
    fetchSuggestions(); // هذا بس يجيب اقتراحات، ما يسوي بحث للجدول
  }, 250);

  return () => clearTimeout(t);
}, [smartInput, fetchSuggestions]);
  useEffect(() => {
    if (!showSuggest) return;
    recalcSuggestPos();

    const onScrollOrResize = () => recalcSuggestPos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showSuggest, recalcSuggestPos]);

  // ✅ اغلاق الاقتراحات اذا ضغط برا (يشمل portal)
  useEffect(() => {
    const onDown = (e) => {
      const inp = inputRef.current;
      const box = suggestBoxRef.current;

      const insideInput = inp && inp.contains(e.target);
      const insideBox = box && box.contains(e.target);

      if (!insideInput && !insideBox) {
        setShowSuggest(false);
        setActiveIdx(-1);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pickSuggestion = (opt) => {
    if (!opt) return;
    setSmartPicked(opt);
    setSmartInput(String(opt.value || opt.label || ""));
    setShowSuggest(false);
    setActiveIdx(-1);
  };

  const onSmartKeyDown = (e) => {
    if (!showSuggest || smartOptions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, smartOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && smartOptions[activeIdx]) {
        e.preventDefault();
        pickSuggestion(smartOptions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setShowSuggest(false);
      setActiveIdx(-1);
    }
  };

  // ✅ Prevent mixing "All" in multi (for users only)
  const handleMultiAll = (selected, setter, allLabel) => {
    if (!selected) return setter([]);
    if (selected.some((s) => s.value === "all")) setter([{ value: "all", label: allLabel }]);
    else setter(selected.filter((s) => s.value !== "all"));
  };

  const buildParams = useCallback(
    (pageValue) => {
      const params = new URLSearchParams();

      // ✅ q واحد فقط (وماكو fetch إلا بالبحث)
      const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
      if (q) params.set("q", q);

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

      if (date.from) params.set("from", date.from);
      if (date.to) params.set("to", date.to);

      params.set("page", String(pageValue));
      params.set("pageSize", String(PAGE_SIZE));

      return params;
    },
    [
      companyFilter,
      userFilter,
      statusFilter,
      currencyFilter,
      pendingFilter,
      date,
      smartInput,
      smartPicked,
    ]
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

  // ✅ البحث فقط من زر "بحث"
  const handleSearch = async () => {
    hasSearchedRef.current = true;
    setPage(1);
    await fetchPage(1);
  };

  useEffect(() => {
    if (!hasSearchedRef.current) return;
    fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleReset = () => {
    setCompanyFilter([]);
    setUserFilter([]);
    setCurrencyFilter({ value: "all", label: "كل العملات" });
    setStatusFilter({ value: "all", label: "كل الحالات" });
    setPendingFilter({ value: "all", label: "الكل" });
    setDate({ from: "", to: "" });

    setSmartInput("");
    setSmartPicked(null);
    setSmartOptions([]);
    setShowSuggest(false);
    setActiveIdx(-1);

    setRequests([]);
    setMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
    setPage(1);
    hasSearchedRef.current = false;
  };

  const badge = (status) => {
    const base =
      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-extrabold border";
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

  const getAmount = (r) =>
    r.amount ??
    r.totalAmount ??
    r.total ??
    r.grandTotal ??
    r.netTotal ??
    r.requestAmount ??
    r.value ??
    null;

  // ✅ API limit عندك
const EXPORT_PAGE_SIZE = 200;

// نفس فلترة buildParams بس للـ export وبـ pageSize أكبر
const buildParamsExport = useCallback(
  (pageValue) => {
    const params = new URLSearchParams();

    const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
    if (q) params.set("q", q);

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

    if (date.from) params.set("from", date.from);
    if (date.to) params.set("to", date.to);

    params.set("page", String(pageValue));
    params.set("pageSize", String(EXPORT_PAGE_SIZE));

    return params;
  },
  [
    smartPicked,
    smartInput,
    companyFilter,
    userFilter,
    statusFilter,
    currencyFilter,
    pendingFilter,
    date,
  ]
);

const fetchAllForExport = useCallback(async () => {
  // ✅ أول صفحة حتى نعرف عدد الصفحات
  const firstParams = buildParamsExport(1);
  const firstRes = await fetch(`/api/reports?${firstParams.toString()}`);
  const firstJson = await firstRes.json();

  if (!firstJson?.success) return { all: [], totalPages: 0 };

  const totalPages = Number(firstJson?.meta?.totalPages || 1);
  const all = [...(firstJson.data || [])];

  // ✅ باقي الصفحات
  for (let p = 2; p <= totalPages; p++) {
    const params = buildParamsExport(p);
    const res = await fetch(`/api/reports?${params.toString()}`);
    const json = await res.json();
    if (json?.success && Array.isArray(json.data)) {
      all.push(...json.data);
    }
  }

  return { all, totalPages };
}, [buildParamsExport]);

// ✅ استبدل handleExportExcel بهذا
const handleExportExcel = useCallback(async () => {
  try {
    setLoading(true);

    const { all } = await fetchAllForExport();
    if (!all || all.length === 0) return;

    const rows = all.map((r) => ({
      Company: r.companyKey || "-",
      Code: r.requestCode || "-",
      Type: r.requestType || "-",
      Requester: r.createdBy || "-",
      Status: r.status || "-",
      "Pending With": Array.isArray(r.pendingWithNames) ? r.pendingWithNames.join(", ") : "-",
      Department: r.department || "-",
      Currency: r.currency || "-",
      Amount: (() => {
        const v = getAmount(r);
        const n = Number(v);
        return Number.isFinite(n) ? n : "";
      })(),
      Description: r.description || "-",
      Date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    const amountCol = Object.keys(rows[0] || {}).indexOf("Amount");
    if (amountCol >= 0) {
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        const cellAddr = XLSX.utils.encode_cell({ r: R, c: amountCol });
        if (ws[cellAddr] && typeof ws[cellAddr].v === "number") ws[cellAddr].z = "#,##0";
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, `Requests_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) {
    console.error("❌ Export all pages error:", e);
  } finally {
    setLoading(false);
  }
}, [fetchAllForExport]);

const Card = ({ icon: Icon, title, value }) => (
  <motion.div
    whileHover={{ y: -3, scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    transition={{ duration: 0.18, ease: "easeOut" }}
    className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 backdrop-blur shadow-sm"
  >
    {/* ✅ نفس الهوفر القديم (glow) */}
    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
    </div>

    <div className="relative px-5 py-4 flex items-center gap-4">
      {/* ✅ كبرنا الأيقونة */}
      <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-sm">
        <Icon className="text-xl" />
      </div>

      <div>
        {/* ✅ كبرنا عنوان الكارد */}
        <div className="text-[14px] font-extrabold text-gray-500">{title}</div>

        {/* ✅ كبرنا الرقم */}
        <div className="text-2xl font-extrabold text-gray-900">{value}</div>
      </div>
    </div>
  </motion.div>
);

  if (!Array.isArray(permissions)) return null;
  if (!canViewReports) return null;

  return (
    <motion.div
      className="min-h-screen p-5 md:p-7 text-[14px] md:text-[15px] font-bold"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      {/* Header (مصغّر) */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5"
      >
        <div className="text-right">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center justify-end gap-3">
            <FiFilter className="text-blue-600" /> تقارير الطلبات
          </h1>
          <p className="text-sm text-gray-600 mt-1 font-bold">
            فلترة ومتابعة الطلبات حسب الصلاحيات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSearch}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border font-extrabold text-[14px] ${
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/80 backdrop-blur border border-gray-200 text-gray-900 flex items-center gap-2 shadow-sm hover:bg-white font-extrabold text-[14px]"
          >
            <FiRotateCcw /> مسح
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleExportExcel}
            disabled={loading || requests.length === 0}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border font-extrabold text-[14px] ${
              loading || requests.length === 0
                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                : "bg-white/80 backdrop-blur border-gray-200 text-gray-900 hover:bg-white"
            }`}
          >
            <FiDownload /> Excel
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 mb-5">
  <Card icon={FiLayers} title="المجموع" value={stats.total} />
  <Card icon={FiCheckCircle} title="مقبول" value={stats.approved} />
  <Card icon={FiClock} title="قيد الانتظار" value={stats.pending} />
  <Card icon={FiXCircle} title="مرفوض" value={stats.rejected} />
</div>
      {/* Filters */}
      <motion.div
        className="relative z-20 rounded-2xl border border-gray-200/80 bg-white/85 backdrop-blur shadow-sm p-5 md:p-6 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-end gap-2 text-gray-900 font-extrabold mb-4 text-base">
          <FiShield className="text-gray-700" />
          الفلاتر
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* الشركة */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiHome /> الشركة
            </label>
            <Select
              {...selectMenuProps}
              options={companies}
              isMulti
              placeholder="كل الشركات المسموحة"
              value={companyFilter}
              onChange={(v) => setCompanyFilter(v || [])}
              styles={selectStyles}
            />
          </div>

          {/* مقدم الطلب */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiUser /> مقدم الطلب
            </label>
            <Select
              {...selectMenuProps}
              options={users}
              isMulti
              placeholder="كل المستخدمين"
              value={userFilter}
              onChange={(v) => handleMultiAll(v, setUserFilter, "كل المستخدمين")}
              styles={selectStyles}
            />
          </div>

          {/* الحالة */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
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
              components={noClearComponents}
            />
          </div>

          {/* العملة */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FaMoneyBillWave /> العملة
            </label>
            <Select
              {...selectMenuProps}
              options={currencies}
              placeholder="كل العملات"
              value={currencyFilter}
              onChange={(v) => setCurrencyFilter(v || { value: "all", label: "كل العملات" })}
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          {/* قيد الانتظار عند */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
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
              components={noClearComponents}
            />
          </div>

          {/* From */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiCalendar /> From
            </label>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          {/* To */}
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiCalendar /> To
            </label>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          {/* ✅ Smart search */}
          <div className="text-right lg:col-span-2">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiSearch /> بحث موحّد (كود / وصف)
            </label>

            <div className="relative flex gap-2">
              <input
                ref={inputRef}
                value={smartInput}
                onChange={(e) => {
                  setSmartInput(e.target.value);
                  setSmartPicked(null);
                  // ✅ لا تسوي أي fetch هنا
                  setShowSuggest(false);
                  setActiveIdx(-1);
                }}
                onKeyDown={onSmartKeyDown}
                placeholder="اكتب كود أو وصف..."
                className="w-full rounded-xl px-4 py-2.5 border border-gray-200 bg-white text-gray-900 font-extrabold text-[16px] shadow-sm outline-none focus:border-gray-300"
              />

              
            </div>

           
          </div>
        </div>
      </motion.div>

      {/* ✅ Suggestions Portal */}
      {portalReady && showSuggest && smartOptions.length > 0 &&
        createPortal(
          <div
            ref={suggestBoxRef}
            style={{
              position: "fixed",
              left: suggestPos.left,
              top: suggestPos.top,
              width: suggestPos.width,
              zIndex: 99999,
            }}
            className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
          >
            {smartOptions.slice(0, 12).map((opt, idx) => (
              <button
                key={`${opt.type || "x"}-${opt.value}-${idx}`}
                type="button"
                onClick={() => pickSuggestion(opt)}
                className={`w-full text-right px-4 py-3 text-[15px] font-extrabold ${
                  idx === activeIdx ? "bg-gray-100" : "bg-white"
                } hover:bg-gray-100`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )
      }

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div className="flex flex-col items-center py-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-700 font-extrabold text-lg">جاري التحميل</p>
          </motion.div>
        ) : requests.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 overflow-hidden rounded-3xl border border-white/30 bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.35)]"
          >
            <div className="relative overflow-x-auto">
              <table className="min-w-[1100px] w-full text-[15px] md:text-[16px] text-slate-800 font-bold">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-white/80 backdrop-blur border-b border-white/40">
                  {[
  "الشركة",
  "كود الريكويست",
  "نوع الطلب",
  "مقدم الطلب",
  "الحالة",
  "قيد الانتظار عند",
  "القسم",
  "العملة",
  "المبلغ",
  "الوصف",
  "التاريخ",
].map((h, i) => (
  <th
    key={`${h}-${i}`}   // ✅ هسه يصير unique
    className="px-6 py-4 text-right text-[13px] md:text-[14px] font-extrabold tracking-wide text-slate-900 whitespace-nowrap"
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
                      whileHover={{ backgroundColor: "rgba(2,132,199,0.08)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() => window.open(`/requests/${r.companyKey}/${r._id}`, "_blank")}
                      className={`cursor-pointer ${idx % 2 === 0 ? "bg-white/30" : "bg-white/20"} hover:bg-white/45`}
                    >
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {r.companyKey || "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-900 whitespace-nowrap">
                        {r.requestCode || "-"}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">{r.requestType || "-"}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">{r.createdBy || "-"}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">{badge(r.status)}</td>

                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[240px] truncate">
                          {Array.isArray(r.pendingWithNames) && r.pendingWithNames.length > 0
                            ? r.pendingWithNames.join(", ")
                            : "-"}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">{r.department || "-"}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap font-extrabold">
                        {r.currency || "-"}
                      </td>

                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {(() => {
                          const v = getAmount(r);
                          return v == null ? "-" : fmtAmount(v);
                        })()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[320px] truncate text-slate-700">{r.description || "-"}</div>
                      </td>

                      {/* ✅ التاريخ EN */}
                      <td className="px-6 py-4 text-right whitespace-nowrap text-slate-700">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "-"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="relative px-5 py-4 bg-white/65 backdrop-blur border-t border-white/30 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-700 font-extrabold">
                Total: <span className="text-slate-900">{meta.total}</span>
                {"  "} | Page: <span className="text-slate-900">{meta.page}</span>
                {" / "}
                <span className="text-slate-900">{meta.totalPages || 1}</span>
              </div>

              <TablePagination page={page} totalPages={meta.totalPages || 1} onPage={setPage} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-slate-700 font-extrabold py-16 rounded-3xl border border-white/30 bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.25)] text-lg"
          >
            No data (press Search).
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}