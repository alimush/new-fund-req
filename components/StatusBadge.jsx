"use client";

import {
  FiCheckCircle,
  FiXCircle,
  FiMinusCircle,
  FiClock,
} from "react-icons/fi";

const VARIANTS = {
  approved: {
    label: "موافق",
    Icon: FiCheckCircle,
    ring: "ring-emerald-200/70",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-50/80",
  },
  rejected: {
    label: "مرفوض",
    Icon: FiXCircle,
    ring: "ring-red-200/70",
    icon: "text-red-600",
    iconBg: "bg-red-50/80",
  },
  cancelled: {
    label: "ملغي",
    Icon: FiMinusCircle,
    ring: "ring-slate-200/80",
    icon: "text-slate-500",
    iconBg: "bg-slate-100/80",
  },
  pending: {
    label: "قيد الانتظار",
    Icon: FiClock,
    ring: "ring-amber-200/70",
    icon: "text-amber-600",
    iconBg: "bg-amber-50/80",
  },
};

export default function StatusBadge({ status, className = "" }) {
  const s = String(status || "pending").toLowerCase();
  const v = VARIANTS[s] || VARIANTS.pending;
  const { Icon, label, ring, icon, iconBg } = v;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-2 py-1 ring-1 ring-slate-200/90 shadow-sm ${ring} ${className}`}
    >
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200/70 ${iconBg}`}
      >
        <Icon className={`text-[12px] ${icon}`} aria-hidden strokeWidth={2.5} />
      </span>
      <span className="whitespace-nowrap text-[11px] font-extrabold leading-none text-slate-800">
        {label}
      </span>
    </span>
  );
}
