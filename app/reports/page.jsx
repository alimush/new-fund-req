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

  // 🎯 Load companies & users
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

  // ✅ Prevent mixing "All"
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

  // 🔍 Fetch data
  const handleSearch = async () => {
    setLoading(true);
    try {
      const companyQuery =
        companyFilter.length === 0 ||
        companyFilter.some((c) => c.value === "all")
          ? "all"
          : companyFilter.map((c) => c.value).join(",");

      const res = await fetch(`/api/requests?company=${companyQuery}`);
      const data = await res.json();

      if (data.success) {
        let result = data.data;

        if (userFilter.length > 0 && !userFilter.some((u) => u.value === "all")) {
          const selectedUsers = userFilter.map((u) => u.value);
          result = result.filter((r) =>
            selectedUsers.includes(r.createdBy)
          );
        }

        if (date.from || date.to) {
          result = result.filter((r) => {
            const d = new Date(r.createdAt);
            return (
              (!date.from || d >= new Date(date.from)) &&
              (!date.to || d <= new Date(date.to))
            );
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
      {/* Header */}
      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-3xl font-bold text-gray-800 flex items-center gap-3 mb-8"
      >
        <FiFilter className="text-blue-600" /> Requests Reports
      </motion.h1>

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
      
   {/* Table */}
<AnimatePresence mode="wait">
  {loading ? (
    <motion.div className="flex flex-col items-center py-28">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="mt-4 text-gray-600">Loading data...</p>
    </motion.div>
  ) : requests.length > 0 ? (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
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
          </tr>
        </thead>

        <tbody>
          {requests.map((r) => (
            <motion.tr
              key={r._id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              onClick={() =>
                window.open(`/requests/${r.company}/${r._id}`, "_blank")
              }
              className="
                border-t
                cursor-pointer
                transition-all
                duration-200
                ease-out
                hover:bg-blue-50
                hover:shadow-sm
              "
            >
              <td className="px-6 py-4 font-medium">{r.company}</td>
              <td className="px-6 py-4">{r.requestType}</td>
              <td className="px-6 py-4">{r.createdBy}</td>
              <td className="px-6 py-4">{r.department}</td>
              <td className="px-6 py-4">{r.currency}</td>
              <td className="px-6 py-4 truncate max-w-[220px]">
                {r.description}
              </td>
              <td className="px-6 py-4 text-right">
                {new Date(r.createdAt).toLocaleDateString()}
              </td>
            </motion.tr>
          ))}
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