"use client";

import { motion } from "framer-motion";

export default function Pagination({
  page = 1,
  totalPages = 1,
  onPage,
  className = "",
}) {
  if (!totalPages || totalPages <= 1) return null;

  const maxVisible = 5;

  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;

  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxVisible + 1);
  }

  const pages = [];

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("...");
  }

  for (let p = start; p <= end; p++) pages.push(p);

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className={`mt-4 flex items-center justify-center gap-2 ${className}`}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => onPage?.(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-2 rounded-xl bg-white/40 ring-1 ring-white/25 disabled:opacity-50"
      >
        Prev
      </motion.button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`dots-${idx}`} className="px-2 text-gray-700/70">
            ...
          </span>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            key={p}
            type="button"
            onClick={() => onPage?.(p)}
            className={[
              "w-10 h-10 rounded-xl ring-1 transition font-bold",
              p === page
                ? "bg-gray-900 text-white ring-gray-900"
                : "bg-white/40 text-gray-900 ring-white/25 hover:bg-white/60",
            ].join(" ")}
          >
            {p}
          </motion.button>
        )
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => onPage?.(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-3 py-2 rounded-xl bg-white/40 ring-1 ring-white/25 disabled:opacity-50"
      >
        Next
      </motion.button>
    </div>
  );
}