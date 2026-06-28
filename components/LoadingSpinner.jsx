"use client";

import { motion } from "framer-motion";

export default function LoadingSpinner({
  message = "جاري التحميل...",
  className = "",
}) {
  return (
    <div
      className={`flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-slate-700" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{message}</p>
    </div>
  );
}
