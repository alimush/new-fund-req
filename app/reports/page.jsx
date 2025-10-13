"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import {
  FiFilter,
  FiCalendar,
  FiUser,
  FiHome,
  FiRotateCcw,
  FiSearch,
} from "react-icons/fi";
 

const Select = dynamic(() => import("react-select"), { ssr: false });

export default function ReportsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);

  const [companyFilter, setCompanyFilter] = useState([]);
  const [userFilter, setUserFilter] = useState([]);
  const [date, setDate] = useState({ from: "", to: "" });

  // 🎯 تحميل الشركات واليوزرات من MongoDB
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch("/api/filters");
        const data = await res.json();
        if (data.success) {
          setCompanies([
            { value: "all", label: "All Companies" },
            ...data.companies.map((c) => ({ value: c, label: c })),
          ]);
          setUsers([
            { value: "all", label: "All Users" },
            ...data.users.map((u) => ({ value: u, label: u })),
          ]);
        }
      } catch (err) {
        console.error("❌ Error loading filters:", err);
      }
    };
    loadFilters();
  }, []);

  // ✅ منع الجمع بين "All" وباقي القيم
  const handleCompanyChange = (selected) => {
    if (!selected) return setCompanyFilter([]);
    if (selected.some((s) => s.value === "all")) {
      setCompanyFilter([{ value: "all", label: "All Companies" }]);
    } else {
      setCompanyFilter(selected.filter((s) => s.value !== "all"));
    }
  };

  const handleUserChange = (selected) => {
    if (!selected) return setUserFilter([]);
    if (selected.some((s) => s.value === "all")) {
      setUserFilter([{ value: "all", label: "All Users" }]);
    } else {
      setUserFilter(selected.filter((s) => s.value !== "all"));
    }
  };

  // 🧮 تطبيق الفلاتر وجلب البيانات من API
  const handleSearch = async () => {
    setLoading(true);
    try {
      let companyQuery = "";
      if (
        companyFilter.length === 0 ||
        companyFilter.some((c) => c.value === "all")
      ) {
        companyQuery = "all";
      } else {
        companyQuery = companyFilter.map((c) => c.value).join(",");
      }

      const res = await fetch(`/api/requests?company=${companyQuery}`);
      const data = await res.json();

      if (data.success) {
        let result = data.data;

        if (userFilter.length > 0 && !userFilter.some((u) => u.value === "all")) {
          const selectedUsers = userFilter.map((u) => u.value);
          result = result.filter((r) => selectedUsers.includes(r.createdBy));
        }

        if (date.from || date.to) {
          result = result.filter((r) => {
            const d = new Date(r.createdAt);
            const fromOk = date.from ? d >= new Date(date.from) : true;
            const toOk = date.to ? d <= new Date(date.to) : true;
            return fromOk && toOk;
          });
        }

        setRequests(result);
      }
    } catch (err) {
      console.error("❌ Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCompanyFilter([]);
    setUserFilter([]);
    setDate({ from: "", to: "" });
    setRequests([]);
  };

  const selectStyles = {
    option: (base, state) => ({
      ...base,
      backgroundColor:
        state.data.value === "all"
          ? "#e0f2fe"
          : state.isSelected
          ? "#1e3a8a"
          : state.isFocused
          ? "#f1f5f9"
          : "white",
      color:
        state.data.value === "all"
          ? "#0c4a6e"
          : state.isSelected
          ? "white"
          : "#334155",
      fontWeight: state.data.value === "all" ? "600" : "normal",
      cursor: "pointer",
    }),
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* 🧭 Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FiFilter className="text-blue-600" /> Requests Reports
        </h1>
      </motion.div>

      {/* 🧩 Filters */}
      <motion.div
        className="mb-8 grid grid-cols-1 lg:grid-cols-4 gap-4 bg-white rounded-2xl p-6 shadow-md border border-gray-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Company */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FiHome /> Company
          </label>
          <Select
            options={companies}
            isMulti
            placeholder="Select company"
            value={companyFilter}
            onChange={handleCompanyChange}
            styles={selectStyles}
          />
        </div>

        {/* User */}
        <div>
          <label className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FiUser /> User
          </label>
          <Select
            options={users}
            isMulti
            placeholder="Select user"
            value={userFilter}
            onChange={handleUserChange}
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
            className="w-full border border-gray-300 rounded-lg p-2 text-gray-800"
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
            className="w-full border border-gray-300 rounded-lg p-2 text-gray-800"
          />
        </div>

        {/* Buttons */}
        <div className="col-span-full flex justify-end gap-3 mt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={handleSearch}
            disabled={loading}
            className={`px-5 py-2.5 rounded-lg flex items-center gap-2 shadow ${
              loading
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-gray-800 text-white hover:bg-gray-900"
            }`}
          >
            {loading ? (
              <motion.div
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></motion.div>
            ) : (
              <>
                <FiSearch /> Search
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={handleReset}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-gray-200 text-gray-800 flex items-center gap-2 border hover:bg-gray-300"
          >
            <FiRotateCcw /> Reset
          </motion.button>
        </div>
      </motion.div>

      {/* 🧾 Table / Spinner / No Data */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-28"
          >
            <motion.div
              className="w-12 h-12 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"
            ></motion.div>
            <motion.p
              className="mt-4 text-gray-600 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Loading data...
            </motion.p>
          </motion.div>
        ) : requests.length > 0 ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden"
          >
            <table className="min-w-full text-sm text-gray-700">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 uppercase text-xs tracking-wide">
                <tr>
                <th className="px-6 py-3 text-left">Company</th>
    <th className="px-6 py-3 text-left">Type</th>
    <th className="px-6 py-3 text-left">User</th>
    <th className="px-6 py-3 text-left">Department</th>
    <th className="px-6 py-3 text-left">Currency</th>
    <th className="px-6 py-3 text-left">Description</th>
    <th className="px-6 py-3 text-right">Date</th>
    <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
            
<tbody>
  {requests.map((r) => {
    // 🎨 نحدد لون الحالة حسب القيمة
    const statusColors = {
      Approved: "bg-green-100 text-green-700 border border-green-300",
      Rejected: "bg-red-100 text-red-700 border border-red-300",
      Pending: "bg-yellow-100 text-yellow-700 border border-yellow-300",
      Cancelled: "bg-gray-100 text-gray-600 border border-gray-300",
    };

    const statusClass =
      statusColors[r.status] || "bg-gray-100 text-gray-600 border border-gray-300";

    return (
      <motion.tr
        key={r._id}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="border-t hover:bg-blue-50 transition cursor-pointer"
        onClick={() => window.open(`/requests/${r.company}/${r._id}`, "_blank")}
      >
        <td className="px-6 py-4 font-medium text-[15px]">{r.company}</td>
        <td className="px-6 py-4 text-[15px]">{r.requestType}</td>
        <td className="px-6 py-4 text-[15px]">{r.createdBy || "-"}</td>
        <td className="px-6 py-4 text-[15px]">{r.department || "-"}</td>
        <td className="px-6 py-4 text-[15px]">{r.currency || "-"}</td>
        <td className="px-6 py-4 text-[15px] truncate max-w-[200px]">
          {r.description || "-"}
        </td>

        {/* 🟣 حالة الريكويست */}
        <td className="px-6 py-4">
          <span
            className={`px-3 py-1.5 text-[13px] rounded-full font-semibold ${statusClass}`}
          >
            {r.status || "Pending"}
          </span>
        </td>

        <td className="px-6 py-4 text-right text-[15px]">
          {new Date(r.createdAt).toLocaleDateString()}
        </td>
      </motion.tr>
    );
  })}
</tbody>
            </table>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-gray-500 italic py-20 bg-white rounded-2xl border border-gray-200 shadow"
          >
            No requests found
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}