"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

import {
  FiSearch,
  FiFilter,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiRotateCcw,
  FiLayers,
  FiShield,
  FiHome,
  FiUser,
  FiAlertCircle,
} from "react-icons/fi";

import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

function fmtAmount(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB");
}

export default function ReceiptsDisbursementPage() {
  const router = useRouter();
  const { permissions, companies, user } = usePermissions();

  const canView =
    Boolean(user?.id) &&
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.RECEIPTS);

  const canDelegateFilter =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);
  const [canFilterUsers, setCanFilterUsers] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (!Array.isArray(permissions) || !permissions.includes(PERMISSIONS.RECEIPTS)) {
      router.replace("/home");
    }
  }, [user?.id, permissions, router]);

  const disbursementFilterOptions = useMemo(
    () => [
      { value: "all", label: "الكل" },
      { value: "done", label: "مصروف" },
      { value: "pending", label: "غير مصروف" },
    ],
    []
  );

  const [companyFilter, setCompanyFilter] = useState({
    value: "all",
    label: "كل الشركات",
  });
  const [disbursementFilter, setDisbursementFilter] = useState({
    value: "all",
    label: "الكل",
  });
  const [processorFilter, setProcessorFilter] = useState(null);
  const [processorOptions, setProcessorOptions] = useState([]);
  const [viewMode, setViewMode] = useState("regular");
  const [q, setQ] = useState("");
  const [date, setDate] = useState({ from: "", to: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metaCompanies, setMetaCompanies] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const filtersRef = useRef({ q: "", from: "", to: "", processorUser: "", tab: "all" });
  const suggestAbortRef = useRef(null);
  const fetchAbortRef = useRef(null);
  const [usersLoading, setUsersLoading] = useState(true);

  const [portalReady, setPortalReady] = useState(false);
  const [smartOptions, setSmartOptions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const inputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });

  const [menuTarget, setMenuTarget] = useState(null);
  useEffect(() => {
    setMenuTarget(document.body);
  }, []);
  useEffect(() => {
    setPortalReady(true);
  }, []);

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
        borderRadius: 10,
        borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
        boxShadow: "none",
        minHeight: 36,
        backgroundColor: "rgba(255,255,255,0.94)",
        transition: "border-color 120ms ease",
        fontSize: 12,
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

  const companyOptions = useMemo(() => {
    const set = new Set([
      ...(Array.isArray(companies) ? companies : []),
      ...(Array.isArray(metaCompanies) ? metaCompanies : []),
    ]);
    const keys = Array.from(set).filter(Boolean).sort();
    return [
      { value: "all", label: "كل الشركات" },
      ...keys.map((c) => ({ value: c, label: c })),
    ];
  }, [companies, metaCompanies]);

  const lockedProcessorOption = useMemo(() => {
    const id = String(user?.id || "");
    const label = String(user?.username || user?.name || id || "أنا");
    return id ? { value: id, label } : null;
  }, [user?.id, user?.username, user?.name]);

  const processorSelectOptions = useMemo(() => {
    const fromApi = (processorOptions || []).map((u) => ({
      value: u.id,
      label: u.username || u.id,
    }));
    if (canDelegateFilter) {
      return [{ value: "all", label: "كل المخوّلين" }, ...fromApi];
    }
    return fromApi.length ? fromApi : lockedProcessorOption ? [lockedProcessorOption] : [];
  }, [canDelegateFilter, lockedProcessorOption, processorOptions]);

  const processorSelectValue = useMemo(() => {
    if (!canFilterUsers && !canDelegateFilter) return lockedProcessorOption;
    if (processorFilter) {
      return (
        processorSelectOptions.find((o) => o.value === processorFilter.value) ||
        processorFilter
      );
    }
    if (canDelegateFilter) return processorSelectOptions[0] || null;
    return lockedProcessorOption;
  }, [
    canFilterUsers,
    canDelegateFilter,
    lockedProcessorOption,
    processorFilter,
    processorSelectOptions,
  ]);

  const stats = useMemo(() => {
    const disbursed = rows.filter((r) => r.isDisbursed).length;
    const pending = rows.filter((r) => !r.isDisbursed).length;
    return { total: rows.length, disbursed, pending };
  }, [rows]);

  const buildProcessorParam = useCallback(() => {
    let pu = String(processorFilter?.value || "").trim();
    if (!pu) {
      if (canDelegateFilter) pu = "all";
      else if (user?.id) pu = String(user.id);
    }
    return pu;
  }, [processorFilter, canDelegateFilter, user?.id]);

  const loadAuthorizedUsers = useCallback(async () => {
    if (!canView) return;
    setUsersLoading(true);
    try {
      const res = await fetch("/api/receipts/disbursement-report?filterUsers=1", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.success) {
        setProcessorOptions(Array.isArray(json.data) ? json.data : []);
        setCanFilterUsers(Boolean(json.meta?.canFilterUsers));
        if (json.meta?.viewMode) setViewMode(json.meta.viewMode);
      }
    } catch (e) {
      console.error("loadAuthorizedUsers:", e);
    } finally {
      setUsersLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    loadAuthorizedUsers();
  }, [loadAuthorizedUsers]);

  useEffect(() => {
    if (usersLoading) return;
    if (canDelegateFilter) {
      setProcessorFilter({ value: "all", label: "كل المخوّلين" });
      filtersRef.current.processorUser = "all";
    } else if (lockedProcessorOption) {
      setProcessorFilter(lockedProcessorOption);
      filtersRef.current.processorUser = lockedProcessorOption.value;
    }
  }, [usersLoading, canDelegateFilter, lockedProcessorOption]);

  const fetchData = useCallback(async () => {
    if (!canView) return;

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

    const { q: qv, from: fv, to: tv, processorUser: pu, tab: tabv } = filtersRef.current;
    const company = companyFilter?.value || "all";
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (company && company !== "all") params.set("company", company);
      if (tabv && tabv !== "all") params.set("tab", tabv);
      if (qv.trim()) params.set("q", qv.trim());
      if (fv) params.set("from", fv);
      if (tv) params.set("to", tv);
      if (pu) params.set("processorUser", pu);
      else if (canDelegateFilter) params.set("processorUser", "all");
      else if (user?.id) params.set("processorUser", String(user.id));

      const res = await fetch(`/api/receipts/disbursement-report?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        signal: ac.signal,
      });
      const json = await res.json();
      if (!json?.success) {
        setRows([]);
        throw new Error(json?.error || "تعذر التحميل");
      }
      setRows(Array.isArray(json.data) ? json.data : []);
      if (Array.isArray(json.meta?.companies)) setMetaCompanies(json.meta.companies);
      if (json.meta?.viewMode) setViewMode(json.meta.viewMode);
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error(e);
      alert(e?.message || "تعذر التحميل");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [canView, companyFilter, canDelegateFilter, user?.id]);

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
    const query = q.trim();
    if (query.length < 2 || !canView) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    if (suggestAbortRef.current) suggestAbortRef.current.abort();
    const ac = new AbortController();
    suggestAbortRef.current = ac;

    try {
      setSuggestLoading(true);
      const company = companyFilter?.value || "all";
      const params = new URLSearchParams();
      params.set("suggest", "1");
      params.set("q", query);
      if (date.from) params.set("from", date.from);
      if (date.to) params.set("to", date.to);
      if (company && company !== "all") params.set("company", company);
      const tabv = filtersRef.current.tab;
      if (tabv && tabv !== "all") params.set("tab", tabv);
      const pu = filtersRef.current.processorUser;
      if (pu) params.set("processorUser", pu);
      else if (canDelegateFilter) params.set("processorUser", "all");
      else if (user?.id) params.set("processorUser", String(user.id));

      const res = await fetch(`/api/receipts/disbursement-report?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        signal: ac.signal,
      });
      const json = await res.json();
      if (ac.signal.aborted) return;
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
    } catch (err) {
      if (err?.name !== "AbortError") console.error("disbursement suggest:", err);
    } finally {
      if (!ac.signal.aborted) setSuggestLoading(false);
    }
  }, [q, canView, companyFilter, canDelegateFilter, user?.id, date.from, date.to, recalcSuggestPos]);

  useEffect(() => {
    const query = q.trim();
    if (!query || query.length < 2) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }
    const t = setTimeout(() => {
      fetchSuggestions();
    }, 450);
    return () => clearTimeout(t);
  }, [q, fetchSuggestions, processorFilter?.value, companyFilter?.value, disbursementFilter?.value]);

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
    setQ(String(opt.value || opt.label || ""));
    setShowSuggest(false);
    setActiveIdx(-1);
  };

  const onSmartKeyDown = (e) => {
    if (!showSuggest || smartOptions.length === 0) {
      if (e.key === "Enter") return;
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, smartOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
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

  const handleSearch = () => {
    const pu = buildProcessorParam();
    filtersRef.current = {
      q: q.trim(),
      from: date.from,
      to: date.to,
      processorUser: pu,
      tab: disbursementFilter?.value || "all",
    };
    setHasSearched(true);
    setShowSuggest(false);
    setActiveIdx(-1);
    fetchData();
  };

  const handleReset = () => {
    setCompanyFilter({ value: "all", label: "كل الشركات" });
    setDisbursementFilter({ value: "all", label: "الكل" });
    setProcessorFilter(canDelegateFilter ? null : lockedProcessorOption);
    setQ("");
    setDate({ from: "", to: "" });
    filtersRef.current = { q: "", from: "", to: "", processorUser: "", tab: "all" };
    setRows([]);
    setHasSearched(false);
    setSmartOptions([]);
    setShowSuggest(false);
    setActiveIdx(-1);
  };

  const Card = ({ icon: Icon, title, value }) => (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 backdrop-blur shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
      </div>

      <div className="relative flex items-center gap-4 px-5 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-sm">
          <Icon className="text-xl" />
        </div>

        <div>
          <div className="text-[14px] font-extrabold text-gray-500">{title}</div>
          <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        </div>
      </div>
    </motion.div>
  );

  if (!user?.id) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-sm font-extrabold text-gray-600">جاري التحميل…</p>
      </div>
    );
  }

  if (!canView) return null;

  return (
    <motion.div
      className="min-h-screen p-5 text-[14px] font-bold md:p-7 md:text-[15px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div className="text-right">
          <h1 className="flex items-center justify-end gap-3 text-2xl font-extrabold text-gray-900 md:text-3xl">
            <FiFilter className="text-blue-600" /> تتبع صرف الطلبات
          </h1>
          <p className="mt-1 text-sm font-bold text-gray-600">
            {canDelegateFilter
              ? "مصروف وغير مصروف عبر التخويل — اختر المخوّل ثم ابحث عن الوصولات."
              : "مصروف (أخضر) وغير مصروف (أحمر) — المخوّلون فقط في القائمة."}
          </p>
          <div className="mt-2 flex flex-wrap justify-end gap-2 text-[11px] font-extrabold">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">مصروف</span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">غير مصروف</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSearch}
            disabled={loading}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] font-extrabold shadow-sm ${
              loading
                ? "cursor-not-allowed border-gray-200 bg-gray-200 text-gray-500"
                : "border-gray-900 bg-gray-900 text-white hover:bg-black"
            }`}
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-[14px] font-extrabold text-gray-900 shadow-sm backdrop-blur hover:bg-white"
          >
            <FiRotateCcw /> مسح
          </motion.button>
        </div>
      </motion.div>

      {hasSearched && !loading ? (
        <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <Card icon={FiLayers} title="المجموع" value={stats.total} />
          <Card icon={FiAlertCircle} title="غير مصروف" value={stats.pending} />
          <Card icon={FiCheckCircle} title="مصروف" value={stats.disbursed} />
        </div>
      ) : null}

      <motion.div
        className="relative z-20 mb-4 rounded-xl border border-gray-200/80 bg-white/85 p-3 shadow-sm backdrop-blur md:p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-2.5 flex items-center justify-end gap-1.5 text-[13px] font-extrabold text-gray-800">
          <FiShield className="text-gray-600" />
          الفلاتر
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="text-right">
            <label className="mb-0.5 flex items-center justify-end gap-1 text-[11px] font-extrabold text-gray-600">
              <FiUser className="text-[12px]" />
              المخوّل
            </label>
            <Select
              {...selectMenuProps}
              options={processorSelectOptions}
              value={processorSelectValue}
              onChange={(v) => {
                if (!canFilterUsers && !canDelegateFilter) return;
                setProcessorFilter(v || null);
                filtersRef.current.processorUser = String(v?.value || "");
              }}
              isDisabled={usersLoading || (!canFilterUsers && !canDelegateFilter)}
              isLoading={usersLoading}
              styles={selectStyles}
              isSearchable
              openMenuOnFocus
              filterOption={(option, raw) => {
                const t = String(raw || "").trim().toLowerCase();
                if (!t) return true;
                return String(option.label || "").toLowerCase().includes(t);
              }}
              placeholder="مخوّل…"
              noOptionsMessage={() => "لا يوجد"}
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="mb-0.5 flex items-center justify-end gap-1 text-[11px] font-extrabold text-gray-600">
              <FiHome className="text-[12px]" />
              الشركة
            </label>
            <Select
              {...selectMenuProps}
              options={companyOptions}
              placeholder="الكل"
              value={companyFilter}
              onChange={(v) =>
                setCompanyFilter(v || { value: "all", label: "كل الشركات" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="mb-0.5 flex items-center justify-end gap-1 text-[11px] font-extrabold text-gray-600">
              <FiCheckCircle className="text-[12px]" />
              حالة الصرف
            </label>
            <Select
              {...selectMenuProps}
              options={disbursementFilterOptions}
              placeholder="الكل"
              value={disbursementFilter}
              onChange={(v) => {
                const next = v || { value: "all", label: "الكل" };
                setDisbursementFilter(next);
                filtersRef.current.tab = next.value;
              }}
              styles={selectStyles}
              isSearchable={false}
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="mb-0.5 flex items-center justify-end gap-1 text-[11px] font-extrabold text-gray-600">
              <FiCalendar className="text-[12px]" />
              من
            </label>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-extrabold text-gray-900 outline-none focus:border-gray-300"
            />
          </div>

          <div className="text-right">
            <label className="mb-0.5 flex items-center justify-end gap-1 text-[11px] font-extrabold text-gray-600">
              <FiCalendar className="text-[12px]" />
              إلى
            </label>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[12px] font-extrabold text-gray-900 outline-none focus:border-gray-300"
            />
          </div>
        </div>

        <div className="mt-2 text-right">
          <label className="mb-0.5 flex items-center justify-end gap-1 text-[11px] font-extrabold text-gray-600">
            <FiSearch className="text-[12px]" />
            بحث
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => {
                if (smartOptions.length > 0) {
                  recalcSuggestPos();
                  setShowSuggest(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (!showSuggest || activeIdx < 0)) {
                  e.preventDefault();
                  handleSearch();
                  return;
                }
                onSmartKeyDown(e);
              }}
              placeholder="رمز طلب، وصل، وصف…"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-extrabold text-gray-900 outline-none focus:border-gray-300"
            />
            {suggestLoading && (
              <span className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            )}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-1.5 border-t border-gray-100 pt-2 md:hidden">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-extrabold text-gray-800"
          >
            <FiRotateCcw className="inline" /> مسح
          </button>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50"
          >
            {loading ? "…" : "بحث"}
          </button>
        </div>
      </motion.div>

      {portalReady &&
        showSuggest &&
        smartOptions.length > 0 &&
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
            className="max-h-[min(70vh,320px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            {smartOptions.slice(0, 14).map((opt, idx) => (
              <button
                key={`${opt.type || "x"}-${opt.value}-${idx}`}
                type="button"
                onClick={() => pickSuggestion(opt)}
                className={`w-full px-4 py-3 text-right text-[14px] font-extrabold ${
                  idx === activeIdx ? "bg-gray-100" : "bg-white"
                } hover:bg-gray-100`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div className="flex flex-col items-center py-20" key="loading">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="mt-4 text-lg font-extrabold text-gray-700">جاري التحميل</p>
          </motion.div>
        ) : rows.length > 0 ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 overflow-hidden rounded-3xl border border-white/30 bg-white/55 shadow-[0_18px_55px_-28px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <div className="relative overflow-x-auto">
              <table className="min-w-[1120px] w-full text-[15px] font-bold text-slate-800 md:text-[16px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/40 bg-white/80 backdrop-blur">
                    {[
                      "الحالة",
                      "الشركة",
                      "كود الطلب",
                      "رقم الوصل",
                      "نوع الطلب",
                      "المبلغ",
                      "الوصف",
                      "مقدم الطلب",
                      viewMode === "delegate" ? "المُصرف" : "المُصرف / التاريخ",
                      "التاريخ",
                    ].map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="whitespace-nowrap px-6 py-4 text-right text-[13px] font-extrabold tracking-wide text-slate-900 md:text-[14px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/30">
                  {rows.map((r, idx) => {
                    const rowTint = r.isDisbursed
                      ? "bg-emerald-50/90 hover:bg-emerald-100/90"
                      : "bg-red-50/90 hover:bg-red-100/90";
                    return (
                    <motion.tr
                      key={`${r.companyKey}-${r._id}`}
                      whileHover={{ scale: 1.001 }}
                      transition={{ duration: 0.12 }}
                      onClick={() =>
                        window.open(
                          `/requests/${encodeURIComponent(r.companyKey)}/${encodeURIComponent(r._id)}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className={`cursor-pointer ${rowTint} ${
                        idx % 2 === 0 ? "" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${
                            r.isDisbursed
                              ? "bg-emerald-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {r.isDisbursed ? "مصروف" : "غير مصروف"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-extrabold text-slate-900">
                        {r.companyKey || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-mono text-slate-900">
                        {r.requestCode || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-mono text-sm font-extrabold text-slate-800">
                        {r.voucherNo || "-"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">{r.requestType || "-"}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-extrabold text-slate-900">
                        {fmtAmount(r.totalAmount)}{" "}
                        <span className="text-xs font-bold text-slate-500">{r.currency || ""}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[320px] truncate text-slate-700" title={r.description}>
                          {r.description || "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">{r.createdBy || "-"}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-700">
                        {r.voucherProcessedByUsername ||
                          (r.wasDelegated && r.voucherDelegateToUsername
                            ? `مخوّل: ${r.voucherDelegateToUsername}`
                            : "-")}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-700">
                        {fmtDate(r.isDisbursed ? r.voucherProcessedAt : r.createdAt)}
                      </td>
                    </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="relative flex items-center justify-between gap-3 border-t border-white/30 bg-white/65 px-5 py-4 backdrop-blur">
              <div className="text-sm font-extrabold text-slate-700">
                Total: <span className="text-slate-900">{rows.length}</span>
              </div>
            </div>
          </motion.div>
        ) : hasSearched ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-3xl border border-white/30 bg-white/55 py-16 text-center text-lg font-extrabold text-slate-700 shadow-[0_18px_55px_-28px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          >
            لا توجد نتائج لهذه الفلاتر.
          </motion.div>
        ) : (
          <motion.div
            key="prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-3xl border border-white/30 bg-white/55 py-16 text-center text-lg font-extrabold text-slate-600 shadow-[0_18px_55px_-28px_rgba(0,0,0,0.2)] backdrop-blur-xl"
          >
            اضغط زر «بحث» لعرض النتائج.
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
