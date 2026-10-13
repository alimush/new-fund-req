"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiAlignRight } from "react-icons/fi";

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.03 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

export default function DescSuggestDropdown({
  show,
  options = [],
  activeIdx = -1,
  pos = { left: 0, top: 0, width: 320 },
  boxRef,
  onPick,
  setActiveIdx,
  maxItems = 12,
}) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!portalReady) return null;

  const visible = show && options.length > 0;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          ref={boxRef}
          key="desc-suggest"
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            width: Math.max(pos.width, 320),
            zIndex: 100000,
          }}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_18px_45px_-18px_rgba(15,23,42,0.35)] backdrop-blur-md ring-1 ring-slate-100"
        >
          <div className="border-b border-slate-100 bg-gradient-to-l from-amber-50/80 to-white px-4 py-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700/90">
              اقتراحات الوصف
            </p>
            <p className="text-[12px] font-semibold text-slate-500">
              {options.length} نتيجة — من وصولات سابقة
            </p>
          </div>

          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="max-h-[300px] overflow-y-auto overscroll-contain py-1"
          >
            {options.slice(0, maxItems).map((opt, idx) => {
              const active = idx === activeIdx;
              const text = opt.text || opt.label || "";
              return (
                <motion.button
                  key={`desc-${idx}-${text.slice(0, 40)}`}
                  type="button"
                  variants={itemVariants}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick?.(opt)}
                  onMouseEnter={() => setActiveIdx?.(idx)}
                  className={`group relative w-full border-b border-slate-100/80 px-4 py-3 text-right transition-colors last:border-b-0 ${
                    active
                      ? "bg-amber-50/90"
                      : "bg-white hover:bg-slate-50/90"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="desc-suggest-active"
                      className="absolute inset-y-1 right-0 w-1 rounded-l-full bg-amber-500"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  ) : null}

                  <div className="flex items-start justify-end gap-3">
                    <div className="min-w-0 flex-1 text-right">
                      <div
                        className={`line-clamp-3 text-[13px] font-extrabold leading-relaxed ${
                          active ? "text-amber-950" : "text-slate-900"
                        }`}
                      >
                        {text}
                      </div>
                      {opt.receivedBy ? (
                        <p className="mt-1.5 truncate text-[11px] font-bold text-slate-500">
                          {opt.mode === "payment"
                            ? "صرف"
                            : opt.mode === "receipt"
                              ? "قبض"
                              : ""}
                          {opt.mode ? " · " : ""}
                          {opt.receivedBy}
                        </p>
                      ) : null}
                    </div>

                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        active
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80"
                      }`}
                    >
                      <FiAlignRight size={16} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
