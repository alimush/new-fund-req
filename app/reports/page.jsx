"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

import {
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
} from "react-icons/fi";

import { FaMoneyBillWave } from "react-icons/fa6";

import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import TablePagination from "@/components/TablePagination";
import StatusBadge from "@/components/StatusBadge";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

export default function ReportsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const PAGE_SIZE = 25;
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [page, setPage] = useState(1);

  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

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

  const [smartInput, setSmartInput] = useState("");
  const [smartPicked, setSmartPicked] = useState(null);
  const [smartOptions, setSmartOptions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const inputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });
  const [portalReady, setPortalReady] = useState(false);

  const [dataSource, setDataSource] = useState({
    value: "new",
    label: "new data",
  });

  const dataSourceOptions = [
    { value: "new", label: "new data" },
    { value: "old", label: "old data" },
  ];

  const hasSearchedRef = useRef(false);
  const fetchAbortRef = useRef(null);

  const { permissions } = usePermissions();

  const canViewReports =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VIEW_REPORTS);

  const canViewAllReports =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);

    const canViewNewOldData =
  Array.isArray(permissions) &&
  permissions.includes(PERMISSIONS.VIEW_NEW_OLD_DATA);

  const canOpenReports = canViewReports || canViewAllReports;

  useEffect(() => setPortalReady(true), []);
  useEffect(() => {
    if (!canViewNewOldData) {
      setDataSource({ value: "new", label: "new data" });
    }
  }, [canViewNewOldData]);
  const [menuTarget, setMenuTarget] = useState(null);
  useEffect(() => setMenuTarget(document.body), []);

  const selectMenuProps = useMemo(
    () => ({
      menuPortalTarget: menuTarget,
      menuPosition: "fixed",
    }),
    [menuTarget]
  );

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

  const stats = useMemo(() => {
    return {
      total: meta.total || 0,
      approved: requests.filter((x) => x.status === "Approved").length,
      pending: requests.filter((x) => x.status === "Pending").length,
      rejected: requests.filter((x) => x.status === "Rejected").length,
    };
  }, [requests, meta.total]);

  const resetUiState = useCallback(() => {
    setCompanyFilter([]);
    setCurrencyFilter({ value: "all", label: "كل العملات" });
    setStatusFilter({ value: "all", label: "كل الحالات" });
    setPendingFilter({ value: "all", label: "الكل" });
    setDate({ from: "", to: "" });

    setSmartInput("");
    setSmartPicked(null);
    setSmartOptions([]);
    setShowSuggest(false);
    setActiveIdx(-1);

    if (canViewAllReports) {
      setUserFilter([]);
    }

    setRequests([]);
    setMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
    setPage(1);
    hasSearchedRef.current = false;
  }, [canViewAllReports]);

  useEffect(() => {
    if (!canOpenReports) return;

    const loadFilters = async () => {
      try {
        const res = await fetch(
          `/api/reports?filters=1&source=${encodeURIComponent(
            dataSource?.value || "new"
          )}`,
          { cache: "no-store" }
        );

        const json = await res.json();
        if (!json?.success) return;

        const f = json.filters || {};

        setCompanies((f.companies || []).map((c) => ({ value: c, label: c })));

        const userOptions = canViewAllReports
          ? [
              { value: "all", label: "كل المستخدمين" },
              ...(f.users || []).map((u) => ({ value: u, label: u })),
            ]
          : (f.users || []).map((u) => ({ value: u, label: u }));

        setUsers(userOptions);

        if (!canViewAllReports) {
          const me = (f.users || [])[0];
          if (me) {
            setUserFilter([{ value: me, label: me }]);
          } else {
            setUserFilter([]);
          }
        }

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

        const st = (f.statuses || ["Pending", "Approved", "Rejected"]).map(
          (s) => ({
            value: s,
            label:
              s === "Pending"
                ? "قيد الانتظار"
                : s === "Approved"
                ? "مقبول"
                : s === "Rejected"
                ? "مرفوض"
                : s,
          })
        );

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
  }, [canOpenReports, canViewAllReports, dataSource]);

  useEffect(() => {
    resetUiState();
  }, [dataSource, resetUiState]);

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

    setSuggestLoading(true);
    try {
      const res = await fetch(
        `/api/reports?suggest=1&q=${encodeURIComponent(q)}&source=${encodeURIComponent(
          dataSource?.value || "new"
        )}`
      );
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
      //
    } finally {
      setSuggestLoading(false);
    }
  }, [smartInput, recalcSuggestPos, dataSource]);

  useEffect(() => {
    const q = smartInput.trim();

    if (!q) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    const t = setTimeout(() => {
      fetchSuggestions();
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

  const pickSuggestion = useCallback((opt) => {
    if (!opt) return;
    setSmartPicked(opt);
    setSmartInput(String(opt.value || opt.label || ""));
    setShowSuggest(false);
    setActiveIdx(-1);
  }, []);

  const onSmartKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        if (showSuggest && smartOptions.length > 0 && activeIdx >= 0 && smartOptions[activeIdx]) {
          e.preventDefault();
          pickSuggestion(smartOptions[activeIdx]);
        }
        return;
      }

      if (!showSuggest || smartOptions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, smartOptions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        setShowSuggest(false);
        setActiveIdx(-1);
      }
    },
    [showSuggest, smartOptions, activeIdx, pickSuggestion]
  );

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

      const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
      if (q) params.set("q", q);

      params.set("source", dataSource?.value || "new");

      params.set(
        "company",
        companyFilter.length === 0
          ? "all"
          : companyFilter.map((c) => c.value).join(",")
      );

      params.set(
        "user",
        canViewAllReports
          ? userFilter.length === 0 || userFilter.some((u) => u.value === "all")
            ? "all"
            : userFilter.map((u) => u.value).join(",")
          : userFilter.length > 0
          ? userFilter.map((u) => u.value).join(",")
          : "all"
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
      canViewAllReports,
      dataSource,
    ]
  );

  const fetchPage = useCallback(
    async (pageValue) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setLoading(true);
      try {
        const params = buildParams(pageValue);
        const res = await fetch(`/api/reports?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = await res.json();

        if (json?.success) {
          setRequests(json.data || []);
          setMeta(
            json.meta || {
              total: 0,
              totalPages: 0,
              page: pageValue,
              pageSize: PAGE_SIZE,
            }
          );
        } else {
          setRequests([]);
          setMeta({
            total: 0,
            totalPages: 0,
            page: pageValue,
            pageSize: PAGE_SIZE,
          });
        }
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("❌ Error fetching reports:", err);
        setRequests([]);
        setMeta({
          total: 0,
          totalPages: 0,
          page: pageValue,
          pageSize: PAGE_SIZE,
        });
      } finally {
        if (fetchAbortRef.current === controller) {
          setLoading(false);
        }
      }
    },
    [buildParams]
  );

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const handleSearch = useCallback(async () => {
    hasSearchedRef.current = true;
    setShowSuggest(false);
    setActiveIdx(-1);
    if (page !== 1) {
      setPage(1);
      return;
    }
    await fetchPage(1);
  }, [page, fetchPage]);

  const onSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (loading) return;
      handleSearch();
    },
    [loading, handleSearch]
  );

  useEffect(() => {
    return () => fetchAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!hasSearchedRef.current) return;
    fetchPageRef.current(page);
  }, [page]);

  const handleReset = () => {
    resetUiState();
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

  const LINK_COL = "رابط الطلب";

  const buildRequestReportUrl = useCallback(
    (r, source = "new") => {
      const company = String(r?.companyKey || "").trim();
      const id = String(r?._id || "").trim();
      if (!company || !id) return "";
      const path = `/requests/${encodeURIComponent(company)}/${encodeURIComponent(id)}?source=${encodeURIComponent(source)}`;
      if (typeof window !== "undefined" && window.location?.origin) {
        return `${window.location.origin}${path}`;
      }
      return path;
    },
    []
  );

  const EXPORT_PAGE_SIZE = 200;

  const buildParamsExport = useCallback(
    (pageValue) => {
      const params = new URLSearchParams();

      const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
      if (q) params.set("q", q);

      params.set("source", dataSource?.value || "new");

      params.set(
        "company",
        companyFilter.length === 0
          ? "all"
          : companyFilter.map((c) => c.value).join(",")
      );

      params.set(
        "user",
        canViewAllReports
          ? userFilter.length === 0 || userFilter.some((u) => u.value === "all")
            ? "all"
            : userFilter.map((u) => u.value).join(",")
          : userFilter.length > 0
          ? userFilter.map((u) => u.value).join(",")
          : "all"
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
      canViewAllReports,
      dataSource,
    ]
  );

  const fetchAllForExport = useCallback(async () => {
    const firstParams = buildParamsExport(1);
    const firstRes = await fetch(`/api/reports?${firstParams.toString()}`);
    const firstJson = await firstRes.json();

    if (!firstJson?.success) return { all: [], totalPages: 0 };

    const totalPages = Number(firstJson?.meta?.totalPages || 1);
    const all = [...(firstJson.data || [])];

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

  const handleExportExcel = useCallback(async () => {
    try {
      setLoading(true);

      const { all } = await fetchAllForExport();
      if (!all || all.length === 0) return;

      const XLSX = await import("xlsx");
      const source = dataSource?.value || "new";
      const rows = all.map((r) => ({
        Company: r.companyKey || "-",
        Code: r.requestCode || "-",
        [LINK_COL]: buildRequestReportUrl(r, source) || "-",
        Type: r.requestType || "-",
        Requester: r.createdBy || "-",
        Status: r.status || "-",
        "Pending With": Array.isArray(r.pendingWithNames)
          ? r.pendingWithNames.join(", ")
          : "-",
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

      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
      const amountCol = Object.keys(rows[0] || {}).indexOf("Amount");
      const linkCol = Object.keys(rows[0] || {}).indexOf(LINK_COL);

      if (amountCol >= 0) {
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: amountCol });
          if (ws[cellAddr] && typeof ws[cellAddr].v === "number") {
            ws[cellAddr].z = "#,##0";
          }
        }
      }

      if (linkCol >= 0) {
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: linkCol });
          const url = ws[cellAddr]?.v;
          if (typeof url === "string" && url.startsWith("http")) {
            ws[cellAddr].l = { Target: url, Tooltip: "فتح الطلب" };
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reports");
      XLSX.writeFile(
        wb,
        `Requests_Reports_${dataSource?.value || "new"}_${
          new Date().toISOString().slice(0, 10)
        }.xlsx`
      );
    } catch (e) {
      console.error("❌ Export all pages error:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchAllForExport, dataSource, buildRequestReportUrl]);

  const Card = ({ icon, title, value, iconColor = "text-blue-600" }) => (
    <KpiCard label={title} value={value} icon={icon} iconColor={iconColor} />
  );

  if (!Array.isArray(permissions)) return null;
  if (!canOpenReports) return null;

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 text-[14px] md:text-[15px] font-bold"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* Hero */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600/90">
                التقارير
              </p>
              <h1 className="mt-1 flex items-center justify-end gap-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                تقارير الطلبات
                <ColoredIcon color="text-purple-600">
                  <FiLayers />
                </ColoredIcon>
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                فلترة ومتابعة الطلبات حسب الصلاحيات
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <motion.button
                type="submit"
                form="reports-search-form"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                  loading
                    ? "cursor-not-allowed bg-slate-300 text-slate-500"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <FiSearch className="text-base" />
                )}
                بحث
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleReset}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200/90 transition hover:bg-white hover:shadow-sm disabled:opacity-60"
              >
                <FiRotateCcw className="text-base" />
                مسح الفلاتر
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleExportExcel}
                disabled={loading || requests.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                  loading || requests.length === 0
                    ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
                    : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 hover:bg-emerald-100"
                }`}
              >
                <FiDownload className="text-base" />
                Excel
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* KPI */}
        <motion.div
          className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <Card icon={<FiLayers />} title="المجموع" value={stats.total} iconColor="text-indigo-600" />
          <Card icon={<FiCheckCircle />} title="مقبول" value={stats.approved} iconColor="text-emerald-600" />
          <Card icon={<FiClock />} title="قيد الانتظار" value={stats.pending} iconColor="text-amber-600" />
          <Card icon={<FiXCircle />} title="مرفوض" value={stats.rejected} iconColor="text-red-600" />
        </motion.div>

        {/* Filters */}
        <motion.div
          className="relative z-20 mb-6 rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-4 flex items-center justify-end gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">الفلاتر</h2>
            <ColoredIcon color="text-blue-600">
              <FiShield />
            </ColoredIcon>
          </div>

          <form
            id="reports-search-form"
            onSubmit={onSearchSubmit}
            className="grid grid-cols-1 gap-4 lg:grid-cols-4"
          >
            <div className="text-right">
              <FilterLabel icon={<FiHome className="text-sm" />} iconColor="text-blue-600">
                الشركة
              </FilterLabel>
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

          <div className="text-right">
            <FilterLabel icon={<FiUser className="text-sm" />} iconColor="text-indigo-600">
              مقدم الطلب
            </FilterLabel>
            <Select
              {...selectMenuProps}
              options={users}
              isMulti
              placeholder={canViewAllReports ? "كل المستخدمين" : "مقدم الطلب الحالي"}
              value={userFilter}
              onChange={(v) => handleMultiAll(v, setUserFilter, "كل المستخدمين")}
              styles={selectStyles}
              isDisabled={!canViewAllReports}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiCheckCircle className="text-sm" />} iconColor="text-emerald-600">
              الحالة
            </FilterLabel>
            <Select
              {...selectMenuProps}
              options={statuses}
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(v) =>
                setStatusFilter(v || { value: "all", label: "كل الحالات" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FaMoneyBillWave className="text-sm" />} iconColor="text-emerald-600">
              العملة
            </FilterLabel>
            <Select
              {...selectMenuProps}
              options={currencies}
              placeholder="كل العملات"
              value={currencyFilter}
              onChange={(v) =>
                setCurrencyFilter(v || { value: "all", label: "كل العملات" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiClock className="text-sm" />} iconColor="text-amber-600">
              قيد الانتظار عند
            </FilterLabel>
            <Select
              {...selectMenuProps}
              options={pendingUsers}
              placeholder="الكل"
              value={pendingFilter}
              onChange={(v) =>
                setPendingFilter(v || { value: "all", label: "الكل" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiCalendar className="text-sm" />} iconColor="text-purple-600">
              From
            </FilterLabel>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-900 outline-none ring-1 ring-slate-200/80 focus:ring-2 focus:ring-blue-200/80"
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiCalendar className="text-sm" />} iconColor="text-purple-600">
              To
            </FilterLabel>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-900 outline-none ring-1 ring-slate-200/80 focus:ring-2 focus:ring-blue-200/80"
            />
          </div>

          {canViewNewOldData && (
            <div className="text-right">
              <FilterLabel icon={<FiLayers className="text-sm" />} iconColor="text-indigo-600">
                مصدر البيانات
              </FilterLabel>
              <Select
                {...selectMenuProps}
                options={dataSourceOptions}
                placeholder="اختر المصدر"
                value={dataSource}
                onChange={(v) =>
                  setDataSource(v || { value: "new", label: "new data" })
                }
                styles={selectStyles}
                isSearchable={false}
                components={noClearComponents}
              />
            </div>
          )}

          <div className="text-right lg:col-span-2">
            <FilterLabel icon={<FiSearch className="text-sm" />} iconColor="text-blue-600">
              بحث موحّد (كود / وصف / مبلغ)
            </FilterLabel>

            <div className="relative flex gap-2">
              <input
                ref={inputRef}
                value={smartInput}
                onChange={(e) => {
                  setSmartInput(e.target.value);
                  setSmartPicked(null);
                  setShowSuggest(false);
                  setActiveIdx(-1);
                }}
                onKeyDown={onSmartKeyDown}
                placeholder="كود أو وصف أو مبلغ..."
                className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-base font-extrabold text-slate-900 shadow-sm outline-none ring-1 ring-slate-200/80 focus:ring-2 focus:ring-blue-200/80"
              />
            </div>
          </div>
          </form>
        </motion.div>

      {portalReady && showSuggest && smartOptions.length > 0
        ? createPortal(
            <div
              ref={suggestBoxRef}
              style={{
                position: "fixed",
                left: suggestPos.left,
                top: suggestPos.top,
                width: suggestPos.width,
                zIndex: 99999,
              }}
              className="rounded-2xl border border-slate-200/90 bg-white shadow-xl overflow-hidden"
            >
              {smartOptions.slice(0, 12).map((opt, idx) => (
                <button
                  key={`${opt.type || "x"}-${opt.value}-${idx}`}
                  type="button"
                  onClick={() => pickSuggestion(opt)}
                  className={`w-full px-4 py-3 text-right text-[15px] font-extrabold transition ${
                    idx === activeIdx ? "bg-slate-100" : "bg-white"
                  } hover:bg-slate-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}

      <AnimatePresence mode="wait">
        {loading ? (
          <ReportsSearchLoading />
        ) : requests.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 shadow-sm ring-1 ring-slate-200/50"
          >
            <div className="relative overflow-x-auto">
              <table className="min-w-[1100px] w-full text-[15px] font-bold text-slate-800 md:text-[16px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
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
                        key={`${h}-${i}`}
                        className="px-6 py-4 text-right text-[13px] md:text-[14px] font-extrabold tracking-wide text-slate-900 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/60">
                  {requests.map((r, idx) => (
                    <motion.tr
                      key={r._id}
                      whileHover={{ backgroundColor: "rgba(248,250,252,0.95)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() =>
                        window.open(
                          `/requests/${r.companyKey}/${r._id}?source=${encodeURIComponent(
                            dataSource?.value || "new"
                          )}`,
                          "_blank"
                        )
                      }
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        idx % 2 === 0 ? "bg-white/50" : "bg-white/30"
                      }`}
                    >
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
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
                        <StatusBadge status={r.status} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[240px] truncate">
                          {Array.isArray(r.pendingWithNames) &&
                          r.pendingWithNames.length > 0
                            ? r.pendingWithNames.join(", ")
                            : "-"}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.department || "-"}
                      </td>
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
                        <div className="max-w-[320px] truncate text-slate-700">
                          {r.description || "-"}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap text-slate-700">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-white/80 px-5 py-4 backdrop-blur">
              <div className="text-sm font-extrabold text-slate-700">
                Total: <span className="text-slate-900">{meta.total}</span>
                {"  "}| Page: <span className="text-slate-900">{meta.page}</span>
                {" / "}
                <span className="text-slate-900">{meta.totalPages || 1}</span>
              </div>

              <TablePagination
                page={page}
                totalPages={meta.totalPages || 1}
                onPage={setPage}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-3xl border border-slate-200/70 bg-white/75 py-16 text-center text-lg font-extrabold text-slate-600 shadow-sm ring-1 ring-slate-200/50"
          >
            لا توجد نتائج — اضغط «بحث»
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ReportsSearchLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 ring-1 ring-slate-200/50"
    >
      <div className="pointer-events-none space-y-3 p-5 opacity-40">
        <div className="h-12 animate-pulse rounded-xl bg-slate-100/90" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100/80" />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mx-4 w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white/95 px-8 py-9 text-center shadow-[0_24px_60px_-24px_rgba(59,130,246,0.2)] ring-1 ring-slate-200/60"
        >
          <div className="relative mx-auto h-14 w-14">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-200/90 border-t-blue-600" />
            <span
              className="absolute inset-2.5 animate-spin rounded-full border-[3px] border-slate-100 border-b-indigo-500"
              style={{ animationDirection: "reverse", animationDuration: "0.85s" }}
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <ColoredIcon color="text-blue-600" size="sm">
                <FiSearch />
              </ColoredIcon>
            </span>
          </div>

          <p className="mt-5 text-base font-extrabold text-slate-900">جاري البحث</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-500">يرجى الانتظار...</p>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-blue-500/80"
                animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1, 0.85] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ColoredIcon({ color = "text-blue-600", children, size = "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const ic = size === "sm" ? "text-sm" : "text-base";
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200/90 shadow-sm ${color} ${ic}`}
    >
      {children}
    </span>
  );
}

function KpiCard({ label, value, icon, iconColor = "text-blue-600" }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/75 p-4 ring-1 ring-slate-200/70 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.15)] hover:ring-slate-300/80">
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/90 shadow-sm transition duration-300 group-hover:scale-105">
          <span className={`text-lg ${iconColor}`}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-base font-extrabold text-slate-900 sm:text-lg">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterLabel({ icon, iconColor = "text-slate-600", children }) {
  return (
    <label className="mb-1.5 flex items-center justify-end gap-1.5 text-[13px] font-extrabold text-slate-700">
      {children}
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-white ring-1 ring-slate-200/90 ${iconColor}`}>
        {icon}
      </span>
    </label>
  );
}