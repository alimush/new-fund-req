"use client";

import { motion } from "framer-motion";
import { FiLayers } from "react-icons/fi";

function LoaderIcon({ children, color = "text-indigo-600" }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-sm ring-1 ring-slate-200/90 shadow-sm ${color}`}
    >
      {children}
    </span>
  );
}

function DefaultSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-44 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/70" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-white/70 ring-1 ring-slate-200/60"
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
        <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
      </div>
      <div className="h-56 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="h-40 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/70" />
      <div className="h-16 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60"
          />
        ))}
      </div>
    </div>
  );
}

export default function PageLoader({
  title = "جاري التحميل",
  subtitle = "يرجى الانتظار...",
  variant = "default",
  icon,
  className = "",
}) {
  const Skeleton = variant === "home" ? HomeSkeleton : DefaultSkeleton;

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="relative mx-auto w-full max-w-7xl min-h-[70vh]">
        <div className="pointer-events-none select-none opacity-[0.45]">
          <Skeleton />
        </div>

        <div className="fixed inset-0 z-20 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white/90 px-8 py-10 text-center shadow-[0_24px_60px_-24px_rgba(79,70,229,0.18)] ring-1 ring-slate-200/60 backdrop-blur-md"
          >
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-200/90 border-t-indigo-600" />
              <span
                className="absolute inset-2.5 animate-spin rounded-full border-[3px] border-slate-100 border-b-blue-500"
                style={{ animationDirection: "reverse", animationDuration: "0.85s" }}
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <LoaderIcon>{icon ?? <FiLayers />}</LoaderIcon>
              </span>
            </div>

            <p className="mt-6 text-base font-extrabold text-slate-900">{title}</p>
            {subtitle ? (
              <p className="mt-1.5 text-sm font-semibold text-slate-500">{subtitle}</p>
            ) : null}

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-indigo-500/80"
                  animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1, 0.85] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
