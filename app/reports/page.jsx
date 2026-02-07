"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
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
} from "react-icons/fi";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

export default function ReportsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters options from API
  const [companies, setCompanies] = useState([]); // ✅ no "all"
  const [users, setUsers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [codeOptions, setCodeOptions] = useState([]);

  // Selected filters
  const [companyFilter, setCompanyFilter] = useState([]);
  const [userFilter, setUserFilter] = useState([]);
  const [currencyFilter, setCurrencyFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [pendingFilter, setPendingFilter] = useState(null);
  const [codeCompany, setCodeCompany] = useState(null); // Prefix company
  const [codeOption, setCodeOption] = useState(null); // Full requestCode selected
  const [date, setDate] = useState({ from: "", to: "" });
  const [menuTarget, setMenuTarget] = useState(null);
  useEffect(() => {
  setMenuTarget(document.body);
}, []);
const selectMenuProps = {
  menuPortalTarget: menuTarget,
  menuPosition: "fixed",
};

  // ✅ Softer select styles (no aggressive colors; fits layout)
  const selectStyles = useMemo(
    () => ({
      menu: (base) => ({ ...base, borderRadius: 14, overflow: "hidden" }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
          ? "#111827"
          : state.isFocused
          ? "#f3f4f6"
          : "white",
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
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
menu: (base) => ({ ...base, zIndex: 9999 }),
      }),
      multiValue: (base) => ({ ...base, borderRadius: 999 }),
      placeholder: (base) => ({ ...base, color: "#94a3b8" }),
    }),
    []
  );

  // ✅ Cards stats
  const stats = useMemo(() => {
    const total = requests.length;
    const approved = requests.filter((x) => x.status === "Approved").length;
    const pending = requests.filter((x) => x.status === "Pending").length;
    const rejected = requests.filter((x) => x.status === "Rejected").length;
    const cancelled = requests.filter((x) => x.status === "Cancelled").length;
    return { total, approved, pending, rejected, cancelled };
  }, [requests]);

  // ✅ Load filters once
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch("/api/reports?company=all");
        const json = await res.json();
        if (!json?.success) return;

        const f = json.filters || {};

        setCompanies((f.companies || []).map((c) => ({ value: c, label: c })));

        setUsers([
          { value: "all", label: "All Users" },
          ...(f.users || []).map((u) => ({ value: u, label: u })),
        ]);

        setCurrencies([
          { value: "all", label: "All Currencies" },
          ...(f.currencies || []).map((c) => ({ value: c, label: c })),
        ]);

        setStatuses([
          { value: "all", label: "All Status" },
          ...(f.statuses || []).map((s) => ({ value: s, label: s })),
        ]);

        setPendingUsers([
          { value: "all", label: "All Pending Users" },
          ...(f.pendingUsers || []),
        ]);
      } catch (err) {
        console.error("❌ Error loading reports filters:", err);
      }
    };
    loadFilters();
  }, []);

  // ✅ Auto prefix if exactly 1 company selected
  useEffect(() => {
    if (companyFilter?.length === 1) {
      setCodeCompany({
        value: companyFilter[0].value,
        label: `REQ-${String(companyFilter[0].value).toUpperCase()}-`,
      });
    } else {
      setCodeCompany(null);
    }
    setCodeOption(null);
  }, [companyFilter]);

  // ✅ load codes when codeCompany changes
  useEffect(() => {
    const loadCodes = async () => {
      setCodeOptions([]);
      setCodeOption(null);

      if (!codeCompany?.value) return;

      const params = new URLSearchParams();
      params.set("codes", "1");
      params.set("company", codeCompany.value);

      const res = await fetch(`/api/reports?${params.toString()}`);
      const json = await res.json();

      if (json?.success) setCodeOptions(json.data || []);
    };

    loadCodes();
  }, [codeCompany]);

  // ✅ Prevent mixing "All" in multi (for users only)
  const handleMultiAll = (selected, setter, allLabel) => {
    if (!selected) return setter([]);
    if (selected.some((s) => s.value === "all")) {
      setter([{ value: "all", label: allLabel }]);
    } else {
      setter(selected.filter((s) => s.value !== "all"));
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      params.set(
        "company",
        companyFilter.length === 0
          ? "all"
          : companyFilter.map((c) => c.value).join(",")
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

      if (codeOption?.value) {
        params.set("code", codeOption.value);
      } else if (codeCompany?.value) {
        params.set("code", `REQ-${codeCompany.value.toUpperCase()}-`);
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      const json = await res.json();

      if (json?.success) {
        setRequests(json.data || []);
      } else {
        console.warn("Reports fetch denied:", json?.error);
        setRequests([]);
      }
    } catch (err) {
      console.error("❌ Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCompanyFilter([]);
    setUserFilter([]);
    setCurrencyFilter(null);
    setStatusFilter(null);
    setPendingFilter(null);
    setDate({ from: "", to: "" });
    setCodeCompany(null);
    setCodeOption(null);
    setRequests([]);
  };

  const badge = (status) => {
    const base =
      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border";
    if (status === "Approved")
      return (
        <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
          <FiCheckCircle /> Approved
        </span>
      );
    if (status === "Rejected")
      return (
        <span className={`${base} bg-red-50 text-red-700 border-red-200`}>
          <FiXCircle /> Rejected
        </span>
      );
    if (status === "Cancelled")
      return (
        <span className={`${base} bg-gray-100 text-gray-700 border-gray-200`}>
          <FiXCircle /> Cancelled
        </span>
      );
    return (
      <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>
        <FiClock /> Pending
      </span>
    );
  };

  // ✅ Softer card: smoother shadow + border + hover glow
  const Card = ({ icon: Icon, title, value }) => (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur shadow-sm"
    >
      {/* subtle hover glow */}
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

  return (
    <motion.div
      className="min-h-screen p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <FiFilter className="text-blue-600" /> Requests Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Filter and track requests across your allowed companies.
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
                <FiSearch /> Search
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
            <FiRotateCcw /> Reset
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card icon={FiLayers} title="Total" value={stats.total} />
        <Card icon={FiCheckCircle} title="Approved" value={stats.approved} />
        <Card icon={FiClock} title="Pending" value={stats.pending} />
        <Card icon={FiXCircle} title="Rejected" value={stats.rejected} />
        <Card icon={FiXCircle} title="Cancelled" value={stats.cancelled} />
      </div>

      {/* Filters Card */}
      <motion.div
        className="rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur shadow-sm p-5 md:p-6 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        whileHover={{ y: -1 }}
      >
        <div className="flex items-center gap-2 text-gray-900 font-semibold mb-4">
          <FiShield className="text-gray-700" />
          Filters
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Company (multi) */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiHome /> Company
            </label>
            <Select
              {...selectMenuProps}

              options={companies}
              isMulti
              placeholder="Select company"
              value={companyFilter}
              onChange={(v) => setCompanyFilter(v || [])}
              styles={selectStyles}
            />
          </div>

          {/* Requester (multi) */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiUser /> Requester
            </label>
            <Select
              {...selectMenuProps}
              options={users}
             

              isMulti
              placeholder="Select requester"
              value={userFilter}
              onChange={(v) => handleMultiAll(v, setUserFilter, "All Users")}
              styles={selectStyles}
            />
          </div>

          {/* Status (single) */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiCheckCircle /> Status
            </label>
            <Select
              {...selectMenuProps}
              options={statuses}
           

              placeholder="Select status"
              value={statusFilter}
              onChange={setStatusFilter}
              styles={selectStyles}
            />
          </div>

          {/* Currency (single) */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiDollarSign /> Currency
            </label>
            <Select
              {...selectMenuProps}
              options={currencies}
              placeholder="Select currency"
            

              value={currencyFilter}
              onChange={setCurrencyFilter}
              styles={selectStyles}
            />
          </div>

          {/* Pending With (single) */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiClock /> Pending With
            </label>
            <Select
              {...selectMenuProps}
              options={pendingUsers}
              

              placeholder="Select pending user"
              value={pendingFilter}
              onChange={setPendingFilter}
              styles={selectStyles}
            />
          </div>

          {/* From */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiCalendar /> From
            </label>
            <input
  type="date"
  value={date.from}
  onChange={(e) => setDate({ ...date, from: e.target.value })}
  className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white/90 text-gray-900 outline-none"
/>
          </div>

          {/* To */}
          <div>
            <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <FiCalendar /> To
            </label>
            <input

              type="date"
              value={date.to}
             

              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white/90 text-gray-900 outline-none focus:border-gray-300 transition"
            />
          </div>

          {/* Code Prefix */}
          <div>
            <label className="text-sm text-gray-600 mb-1">Code Prefix</label>
            <Select
               {...selectMenuProps}

              options={companies.map((x) => ({
                value: x.value,
                label: `REQ-${String(x.value).toUpperCase()}-`,
              }))}
              placeholder="Select company prefix"
              value={codeCompany}
              
              onChange={(v) => {
                if (!v) {
                  setCodeCompany(null);
                  setCodeOption(null);
                  return;
                }
                setCodeCompany(v);
                setCodeOption(null);
              }}
              styles={selectStyles}
              isClearable
              isSearchable
              closeMenuOnSelect
            />
          </div>

          {/* Request Code */}
          <div>
            <label className="text-sm text-gray-600 mb-1">Request Code</label>
            <Select
              {...selectMenuProps}
              options={codeOptions}
              value={codeOption}
              onChange={setCodeOption}
            

              isClearable
              isSearchable
              isDisabled={!codeCompany?.value}
              placeholder={codeCompany?.value ? "Select request code..." : "Select prefix first"}
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
            <p className="mt-4 text-gray-600">Loading data...</p>
          </motion.div>
        ) : requests.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="rounded-2xl border border-gray-200/80 bg-white/85 backdrop-blur shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-700">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left">Company</th>
                    <th className="px-6 py-3 text-left">Code</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Requester</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Pending With</th>
                    <th className="px-6 py-3 text-left">Department</th>
                    <th className="px-6 py-3 text-left">Currency</th>
                    <th className="px-6 py-3 text-left">Description</th>
                    <th className="px-6 py-3 text-right">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((r) => (
                    <motion.tr
                      key={r._id}
                      whileHover={{ backgroundColor: "rgba(2, 132, 199, 0.06)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() =>
                        window.open(`/requests/${r.companyKey}/${r._id}`, "_blank")
                      }
                      className="border-t cursor-pointer"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {r.companyKey}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-900">
                        {r.requestCode || "-"}
                      </td>
                      <td className="px-6 py-4">{r.requestType || "-"}</td>
                      <td className="px-6 py-4">{r.createdBy || "-"}</td>
                      <td className="px-6 py-4">{badge(r.status)}</td>
                      <td className="px-6 py-4">
                        {Array.isArray(r.pendingWithNames) &&
                        r.pendingWithNames.length > 0
                          ? r.pendingWithNames.join(", ")
                          : "-"}
                      </td>
                      <td className="px-6 py-4">{r.department || "-"}</td>
                      <td className="px-6 py-4">{r.currency || "-"}</td>
                      <td className="px-6 py-4 truncate max-w-[280px]">
                        {r.description || "-"}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gray-600 italic py-16 rounded-2xl border border-gray-200/80 bg-white/75 backdrop-blur shadow-sm"
          >
            No requests found
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}