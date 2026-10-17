"use client";

import { FiArrowUpRight, FiArrowDownLeft } from "react-icons/fi";

const VARIANTS = {
  payment: {
    label: "وصل صرف",
    Icon: FiArrowUpRight,
    ring: "ring-red-200/70",
    icon: "text-red-600",
    iconBg: "bg-red-50/80",
  },
  receipt: {
    label: "وصل قبض",
    Icon: FiArrowDownLeft,
    ring: "ring-emerald-200/70",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-50/80",
  },
};

export default function VoucherModeBadge({ mode, className = "", compact = false }) {
  const m = String(mode || "receipt").toLowerCase();
  const v = VARIANTS[m] || VARIANTS.receipt;
  const { Icon, label, ring, icon, iconBg } = v;

  if (compact) {
    return (
      <span
        title={label}
        className={`inline-flex max-w-full items-center gap-1 rounded-lg bg-white/90 px-1 py-0.5 ring-1 ring-slate-200/90 shadow-sm ${ring} ${className}`}
      >
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-slate-200/70 ${iconBg}`}
        >
          <Icon className={`text-[11px] ${icon}`} aria-hidden strokeWidth={2.5} />
        </span>
        <span className="truncate text-[10px] font-extrabold leading-none text-slate-800">
          {m === "payment" ? "صرف" : "قبض"}
        </span>
      </span>
    );
  }

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
