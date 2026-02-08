"use client";

import {
  FiCheckCircle,
  FiXCircle,
  FiMinusCircle,
  FiClock,
} from "react-icons/fi";

export default function StatusBadge({ status, className = "" }) {
  const s = (status || "").toLowerCase();

  const base =
    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold " +
    "backdrop-blur bg-white/40 border border-white/30 " +
    "shadow-[0_6px_16px_-8px_rgba(0,0,0,0.25)] " +
    className;

  if (s === "approved")
    return (
      <span className={`${base} text-green-800 ring-1 ring-green-200/60`}>
        <FiCheckCircle className="text-green-600 text-sm" />
        موافق
      </span>
    );

  if (s === "rejected")
    return (
      <span className={`${base} text-red-800 ring-1 ring-red-200/60`}>
        <FiXCircle className="text-red-600 text-sm" />
        مرفوض
      </span>
    );

  if (s === "cancelled")
    return (
      <span className={`${base} text-gray-700 ring-1 ring-gray-200/60`}>
        <FiMinusCircle className="text-gray-500 text-sm" />
        ملغي
      </span>
    );

  // قيد الانتظار (افتراضي)
  return (
    <span className={`${base} text-amber-800 ring-1 ring-amber-200/60`}>
      <FiClock className="text-amber-600 text-sm" />
      قيد الانتظار
    </span>
  );
}