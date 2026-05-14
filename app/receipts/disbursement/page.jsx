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

  useEffect(() => {
    if (!user?.id) return;
    if (!Array.isArray(permissions) || !permissions.includes(PERMISSIONS.RECEIPTS)) {
      router.replace("/home");
    }
  }, [user?.id, permissions, router]);

  const [tab, setTab] = useState("pending");
  const [companyFilter, setCompanyFilter] = useState({
    value: "all",
    label: "كل الشركات",
  });
  const [q, setQ] = useState("");
  const [date, setDate] = useState({ from: "", to: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metaCompanies, setMetaCompanies] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const filtersRef = useRef({ q: "", from: "", to: "" });

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

  const tabOptions = useMemo(
    () => [
      { value: "pending", label: "قيد انتظار الصرف" },
      { value: "done", label: "صرفتها أنا" },
    ],
    []
  );

  const tabSelectValue = useMemo(
    () => tabOptions.find((o) => o.value === tab) || tabOptions[0],
    [tab, tabOptions]
  );

  const stats = useMemo(
    () => ({
      total: rows.length,
      pendingView: tab === "pending" ? rows.length : "—",
      doneView: tab === "done" ? rows.length : "—",
    }),
    [rows, tab]
  );

  const fetchData = useCallback(async () => {
    if (!canView) return;
    const { q: qv, from: fv, to: tv } = filtersRef.current;
    const company = companyFilter?.value || "all";
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("tab", tab);
      if (company && company !== "all") params.set("company", company);
      if (qv.trim()) params.set("q", qv.trim());
      if (fv) params.set("from", fv);
      if (tv) params.set("to", tv);

      const res = await fetch(`/api/receipts/disbursement-report?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!json?.success) {
        setRows([]);
        throw new Error(json?.error || "تعذر التحميل");
      }
      setRows(Array.isArray(json.data) ? json.data : []);
      if (Array.isArray(json.meta?.companies)) setMetaCompanies(json.meta.companies);
    } catch (e) {
      console.error(e);
      alert(e?.message || "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }, [canView, tab, companyFilter]);

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
    if (!query || !canView) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    try {
      setSuggestLoading(true);
      const company = companyFilter?.value || "all";
      const params = new URLSearchParams();
      params.set("suggest", "1");
      params.set("q", query);
      params.set("tab", tab);
      if (date.from) params.set("from", date.from);
      if (date.to) params.set("to", date.to);
      if (company && company !== "all") params.set("company", company);

      const res = await fetch(`/api/receipts/disbursement-report?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
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
    } catch (err) {
      console.error("disbursement suggest:", err);
    } finally {
      setSuggestLoading(false);
    }
  }, [q, canView, companyFilter, tab, date.from, date.to, recalcSuggestPos]);

  useEffect(() => {
    if (!canView) return;
    setRows([]);
    setHasSearched(false);
    setShowSuggest(false);
    setSmartOptions([]);
    setActiveIdx(-1);
  }, [canView, tab, companyFilter?.value]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }
    const t = setTimeout(() => {
      fetchSuggestions();
    }, 250);
    return () => clearTimeout(t);
  }, [q, fetchSuggestions]);

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
    filtersRef.current = {
      q: q.trim(),
      from: date.from,
      to: date.to,
    };
    setHasSearched(true);
    setShowSuggest(false);
    setActiveIdx(-1);
    fetchData();
  };

  const handleReset = () => {
    setTab("pending");
    setCompanyFilter({ value: "all", label: "كل الشركات" });
    setQ("");
    setDate({ from: "", to: "" });
    filtersRef.current = { q: "", from: "", to: "" };
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
            قيد انتظار الصرف، وما تم صرفه بواسطتك — صلاحية الوصولات.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Card icon={FiLayers} title="المجموع" value={stats.total} />
        <Card icon={FiClock} title="قيد الصرف (العرض)" value={stats.pendingView} />
        <Card icon={FiCheckCircle} title="صرفتها أنا (العرض)" value={stats.doneView} />
      </div>

      <motion.div
        className="relative z-20 mb-6 rounded-2xl border border-gray-200/80 bg-white/85 p-5 shadow-sm backdrop-blur md:p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-4 flex items-center justify-end gap-2 text-base font-extrabold text-gray-900">
          <FiShield className="text-gray-700" />
          الفلاتر
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="text-right">
            <label className="mb-1 flex items-center justify-end gap-2 text-[13px] font-extrabold text-gray-700">
              <FiClock /> نوع القائمة
            </label>
            <Select
              {...selectMenuProps}
              options={tabOptions}
              value={tabSelectValue}
              onChange={(v) => {
                const next = v?.value || "pending";
                setTab(next === "done" ? "done" : "pending");
              }}
              styles={selectStyles}
              isSearchable={false}
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="mb-1 flex items-center justify-end gap-2 text-[13px] font-extrabold text-gray-700">
              <FiHome /> الشركة
            </label>
            <Select
              {...selectMenuProps}
              options={companyOptions}
              placeholder="كل الشركات"
              value={companyFilter}
              onChange={(v) => setCompanyFilter(v || { value: "all", label: "كل الشركات" })}
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="mb-1 flex items-center justify-end gap-2 text-[13px] font-extrabold text-gray-700">
              <FiCalendar /> From
            </label>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] font-extrabold text-gray-900 outline-none"
            />
          </div>

          <div className="text-right">
            <label className="mb-1 flex items-center justify-end gap-2 text-[13px] font-extrabold text-gray-700">
              <FiCalendar /> To
            </label>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] font-extrabold text-gray-900 outline-none"
            />
          </div>

          <div className="relative text-right lg:col-span-2">
            <label className="mb-1 flex items-center justify-end gap-2 text-[13px] font-extrabold text-gray-700">
              <FiSearch /> بحث موحّد
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
                onKeyDown={onSmartKeyDown}
                placeholder="رمز، وصف، نوع، رقم وصل…"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[16px] font-extrabold text-gray-900 shadow-sm outline-none focus:border-gray-300"
              />
              {suggestLoading && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
              )}
            </div>
          </div>
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
                      "الشركة",
                      "كود الطلب",
                      "رقم الوصل",
                      "نوع الطلب",
                      "المبلغ",
                      "الوصف",
                      "مقدم الطلب",
                      tab === "done" ? "تاريخ الصرف" : "التاريخ",
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
                  {rows.map((r, idx) => (
                    <motion.tr
                      key={`${r.companyKey}-${r._id}`}
                      whileHover={{ backgroundColor: "rgba(2,132,199,0.08)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() =>
                        window.open(
                          `/requests/${encodeURIComponent(r.companyKey)}/${encodeURIComponent(r._id)}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className={`cursor-pointer ${
                        idx % 2 === 0 ? "bg-white/30" : "bg-white/20"
                      } hover:bg-white/45`}
                    >
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
                        {tab === "done"
                          ? fmtDate(r.voucherProcessedAt)
                          : fmtDate(r.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
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
