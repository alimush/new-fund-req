"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
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
  FiArrowLeft,
} from "react-icons/fi";

import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import TablePagination from "@/components/TablePagination";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

const FORM_FILTER_ALL_LABEL = "كل النماذج";

const PAYMENT_PLAN_LIST_KEY = "exceptions";

function openExDetail(row) {
  if (!row?._id) return;
  const company = String(row.exCompanyKey || "").trim();
  const qCompany = company ? `&company=${encodeURIComponent(company)}` : "";

  if (row.isPaymentPlan) {
    window.open(
      `/ex/payment-plan/${row._id}?key=${encodeURIComponent(
        PAYMENT_PLAN_LIST_KEY
      )}${qCompany}`,
      "_blank"
    );
    return;
  }

  const pk = String(row.pageKey || row.detailRouteKey || "").trim();
  if (!pk) return;

  window.open(
    `/ex/${encodeURIComponent(pk)}/${row._id}?key=${encodeURIComponent(
      pk
    )}${qCompany}`,
    "_blank"
  );
}

export default function ExReportsPage() {
  const [rows, setRows] = useState([]);
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
  const [formOptions, setFormOptions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

  const [companyFilter, setCompanyFilter] = useState([]);
  const [userFilter, setUserFilter] = useState([]);
  const [formFilter, setFormFilter] = useState([]);
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

  const hasSearchedRef = useRef(false);

  const { permissions } = usePermissions();

  const canViewReports =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.VIEW_REPORTS);

  const canViewAllReports =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS);

  const canExReports =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.EX_REPORTS);

  const canOpenReports = canViewReports || canViewAllReports || canExReports;

  useEffect(() => setPortalReady(true), []);

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
      approved: rows.filter((x) => x.status === "Approved").length,
      pending: rows.filter((x) => x.status === "Pending").length,
      rejected: rows.filter((x) => x.status === "Rejected").length,
      cancelled: rows.filter((x) => x.status === "Cancelled").length,
    };
  }, [rows, meta.total]);

  const resetUiState = useCallback(() => {
    setCompanyFilter([]);
    setFormFilter([]);
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

    setRows([]);
    setMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
    setPage(1);
    hasSearchedRef.current = false;
  }, [canViewAllReports]);

  useEffect(() => {
    if (!canOpenReports) return;

    const loadFilters = async () => {
      try {
        const res = await fetch(`/api/reports/ex?filters=1`, { cache: "no-store" });
        const json = await res.json();
        if (!json?.success) return;

        const f = json.filters || {};

        const rawCompanies = f.companyOptions || f.companies || [];
        setCompanies(
          rawCompanies.map((c) =>
            typeof c === "object" && c !== null && c.value != null
              ? { value: String(c.value), label: String(c.label ?? c.value) }
              : { value: String(c), label: String(c) }
          )
        );

        const ft = (f.formTypes || []).map((x) => ({
          value: x.value,
          label: x.label || x.value,
        }));
        setFormOptions([
          { value: "all", label: FORM_FILTER_ALL_LABEL },
          ...ft.filter((x) => x.value),
        ]);

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

        const statusLabels = {
          Pending: "قيد الانتظار",
          Approved: "مقبول",
          Rejected: "مرفوض",
          Cancelled: "ملغى",
        };

        const st = (f.statuses || ["Pending", "Approved", "Rejected", "Cancelled"]).map(
          (s) => ({
            value: s,
            label: statusLabels[s] || s,
          })
        );

        setStatuses([{ value: "all", label: "كل الحالات" }, ...st]);

        setPendingUsers([
          { value: "all", label: "الكل" },
          ...(f.pendingUsers || []),
        ]);
      } catch (err) {
        console.error("❌ Error loading EX reports filters:", err);
      }
    };

    loadFilters();
  }, [canOpenReports, canViewAllReports]);

  const isDigitsOnly = (s) =>
    /^\d+$/.test(String(s || "").replace(/,/g, "").trim());

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

    if (isDigitsOnly(q)) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    setSuggestLoading(true);
    try {
      const res = await fetch(
        `/api/reports/ex?suggest=1&q=${encodeURIComponent(q)}`
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
  }, [smartInput, recalcSuggestPos]);

  useEffect(() => {
    const q = smartInput.trim();

    if (!q) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    if (/^\d+$/.test(q.replace(/,/g, "").trim())) {
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

  const handleMultiAll = (selected, setter, allLabel) => {
    if (!selected) return setter([]);
    if (selected.some((s) => s.value === "all")) {
      setter([{ value: "all", label: allLabel }]);
    } else {
      setter(selected.filter((s) => s.value !== "all"));
    }
  };

  const formsParamValue = useCallback(() => {
    if (
      formFilter.length === 0 ||
      formFilter.some((f) => f.value === "all")
    ) {
      return "all";
    }
    return formFilter.map((f) => f.value).join(",");
  }, [formFilter]);

  const buildParams = useCallback(
    (pageValue) => {
      const params = new URLSearchParams();

      const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
      if (q) params.set("q", q);

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
      params.set("pending", pendingFilter?.value || "all");
      params.set("forms", formsParamValue());

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
      pendingFilter,
      date,
      smartInput,
      smartPicked,
      canViewAllReports,
      formsParamValue,
    ]
  );

  const fetchPage = useCallback(
    async (pageValue) => {
      setLoading(true);
      try {
        const params = buildParams(pageValue);
        const res = await fetch(`/api/reports/ex?${params.toString()}`);
        const json = await res.json();

        if (json?.success) {
          setRows(json.data || []);
          setMeta(
            json.meta || {
              total: 0,
              totalPages: 0,
              page: pageValue,
              pageSize: PAGE_SIZE,
            }
          );
        } else {
          setRows([]);
          setMeta({
            total: 0,
            totalPages: 0,
            page: pageValue,
            pageSize: PAGE_SIZE,
          });
        }
      } catch (err) {
        console.error("❌ Error fetching EX reports:", err);
        setRows([]);
        setMeta({
          total: 0,
          totalPages: 0,
          page: pageValue,
          pageSize: PAGE_SIZE,
        });
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const handleSearch = async () => {
    hasSearchedRef.current = true;
    if (page !== 1) {
      setPage(1);
      return;
    }
    await fetchPage(1);
  };

  useEffect(() => {
    if (!hasSearchedRef.current) return;
    fetchPageRef.current(page);
  }, [page]);

  const handleReset = () => {
    resetUiState();
  };

  const badge = (status) => {
    const base =
      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-extrabold border";

    if (status === "Approved") {
      return (
        <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
          <FiCheckCircle /> مقبول
        </span>
      );
    }

    if (status === "Rejected") {
      return (
        <span className={`${base} bg-red-50 text-red-700 border-red-200`}>
          <FiXCircle /> مرفوض
        </span>
      );
    }

    if (status === "Cancelled") {
      return (
        <span className={`${base} bg-slate-100 text-slate-700 border-slate-200`}>
          <FiXCircle /> ملغى
        </span>
      );
    }

    return (
      <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>
        <FiClock /> قيد الانتظار
      </span>
    );
  };

  const EXPORT_PAGE_SIZE = 200;

  const buildParamsExport = useCallback(
    (pageValue) => {
      const params = new URLSearchParams();

      const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
      if (q) params.set("q", q);

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
      params.set("pending", pendingFilter?.value || "all");
      params.set("forms", formsParamValue());

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
      pendingFilter,
      date,
      canViewAllReports,
      formsParamValue,
    ]
  );

  const fetchAllForExport = useCallback(async () => {
    const firstParams = buildParamsExport(1);
    const firstRes = await fetch(`/api/reports/ex?${firstParams.toString()}`);
    const firstJson = await firstRes.json();

    if (!firstJson?.success) return { all: [], totalPages: 0 };

    const totalPages = Number(firstJson?.meta?.totalPages || 1);
    const all = [...(firstJson.data || [])];

    for (let p = 2; p <= totalPages; p++) {
      const params = buildParamsExport(p);
      const res = await fetch(`/api/reports/ex?${params.toString()}`);
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

      const sheetRows = all.map((r) => ({
        Company: r.exCompanyKey || "-",
        Code: r.requestCode || "-",
        Form: r.formTitleAr || "-",
        Customer: r.customerSummary || "-",
        Unit: r.unitSummary || "-",
        Requester: r.createdBy || "-",
        Status: r.status || "-",
        "Pending With": Array.isArray(r.pendingWithNames)
          ? r.pendingWithNames.join(", ")
          : "-",
        Date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "-",
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Booking reports");
      XLSX.writeFile(
        wb,
        `Booking_reports_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e) {
      console.error("❌ EX export error:", e);
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
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
      </div>

      <div className="relative px-5 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-sm">
          <Icon className="text-xl" />
        </div>

        <div>
          <div className="text-[14px] font-extrabold text-gray-500">{title}</div>
          <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        </div>
      </div>
    </motion.div>
  );

  if (!Array.isArray(permissions)) return null;
  if (!canOpenReports) return null;

  return (
    <motion.div
      className="min-h-screen p-5 md:p-7 text-[14px] md:text-[15px] font-bold"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 md:mb-7 space-y-5"
      >
        <div className="mx-auto max-w-3xl text-center space-y-2.5 px-1">
          <h1 className="flex flex-wrap items-center justify-center gap-2.5 md:gap-3 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            <FiLayers className="text-blue-600 shrink-0 text-[1.35em] md:text-[1.1em]" aria-hidden />
            <span>تقارير طلبات الحجز</span>
          </h1>
          <p className="text-sm md:text-[15px] text-gray-600 font-bold leading-relaxed">
            استبدال حجز، تنازل، إلغاء، تحويل وحدة، مرفقات، والاستثناءات — حسب صلاحياتك.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/ex/ex-home"
            className="group inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-extrabold text-slate-800 shadow-sm ring-1 ring-slate-200/90 transition hover:bg-slate-50 hover:ring-slate-300 mx-auto sm:mx-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 transition group-hover:bg-white">
              <FiArrowLeft className="text-base" aria-hidden />
            </span>
            العودة للواجهة الرئيسية
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
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
              disabled={loading || rows.length === 0}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border font-extrabold text-[14px] ${
                loading || rows.length === 0
                  ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                  : "bg-white/80 backdrop-blur border border-gray-200 text-gray-900 hover:bg-white"
              }`}
            >
              <FiDownload /> Excel
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 mb-5">
        <Card icon={FiLayers} title="المجموع" value={stats.total} />
        <Card icon={FiCheckCircle} title="مقبول" value={stats.approved} />
        <Card icon={FiClock} title="قيد الانتظار" value={stats.pending} />
        <Card icon={FiXCircle} title="مرفوض" value={stats.rejected} />
        <Card icon={FiFilter} title="ملغى" value={stats.cancelled} />
      </div>

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

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiLayers /> نوع الفورم
            </label>
            <Select
              {...selectMenuProps}
              options={formOptions}
              isMulti
              placeholder={FORM_FILTER_ALL_LABEL}
              value={formFilter}
              onChange={(v) => handleMultiAll(v, setFormFilter, FORM_FILTER_ALL_LABEL)}
              styles={selectStyles}
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiUser /> مقدم الطلب
            </label>
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
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiCheckCircle /> الحالة
            </label>
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
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiClock /> قيد الانتظار عند
            </label>
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

          <div className="text-right lg:col-span-2">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiSearch /> بحث موحّد (كود / عميل / وحدة)
            </label>

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
                placeholder="اكتب للاقتراحات الذكية..."
                className="w-full rounded-xl px-4 py-2.5 border border-gray-200 bg-white text-gray-900 font-extrabold text-[16px] shadow-sm outline-none focus:border-gray-300"
              />
              {suggestLoading ? (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              ) : null}
            </div>
          </div>
        </div>
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
        : null}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div className="flex flex-col items-center py-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-700 font-extrabold text-lg">جاري التحميل</p>
          </motion.div>
        ) : rows.length > 0 ? (
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
                      "كود الطلب",
                      "الفورم",
                      "العميل",
                      "الوحدة",
                      "مقدم الطلب",
                      "الحالة",
                      "قيد الانتظار عند",
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

                <tbody className="divide-y divide-white/30">
                  {rows.map((r, idx) => (
                    <motion.tr
                      key={String(r._id)}
                      whileHover={{ backgroundColor: "rgba(2,132,199,0.08)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() => openExDetail(r)}
                      className={`cursor-pointer ${
                        idx % 2 === 0 ? "bg-white/30" : "bg-white/20"
                      } hover:bg-white/45`}
                    >
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {r.exCompanyKey || "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-900 whitespace-nowrap">
                        {r.requestCode || "-"}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.formTitleAr || "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[220px] truncate">{r.customerSummary || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[180px] truncate">{r.unitSummary || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.createdBy || "-"}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {badge(r.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[240px] truncate">
                          {Array.isArray(r.pendingWithNames) &&
                          r.pendingWithNames.length > 0
                            ? r.pendingWithNames.join(", ")
                            : "-"}
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

            <div className="relative px-5 py-4 bg-white/65 backdrop-blur border-t border-white/30 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-700 font-extrabold">
                Total: <span className="text-slate-900">{meta.total}</span>
                {"  "} | Page: <span className="text-slate-900">{meta.page}</span>
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
            className="text-center text-slate-700 font-extrabold py-16 rounded-3xl border border-white/30 bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.25)] text-lg"
          >
            لا توجد نتائج — اضغط بحث.
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
