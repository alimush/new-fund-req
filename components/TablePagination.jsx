"use client";

import { motion } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function TablePagination({
  page,
  totalPages,
  onPage,
  className = "",
}) {
  if (!totalPages || totalPages <= 1) return null;

  const clamp = (n) => Math.max(1, Math.min(totalPages, n));

  const buildPages = () => {
    // 1 ... (p-1) p (p+1) ... last
    const p = page;
    const pages = new Set([1, totalPages, p - 1, p, p + 1, p - 2, p + 2]);
    const list = [...pages]
      .filter((x) => x >= 1 && x <= totalPages)
      .sort((a, b) => a - b);

    // add "gap" markers
    const out = [];
    for (let i = 0; i < list.length; i++) {
      out.push(list[i]);
      if (i < list.length - 1 && list[i + 1] - list[i] > 1) out.push("...");
    }
    return out;
  };

  const items = buildPages();

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 ${className}`}>
      <div className="text-xs text-gray-600">
        Page <span className="font-bold text-gray-900">{page}</span> of{" "}
        <span className="font-bold text-gray-900">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPage(clamp(page - 1))}
          disabled={page <= 1}
          className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-2 ${
            page <= 1
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
          }`}
        >
          <FiChevronLeft />
          Prev
        </motion.button>

        <div className="flex items-center gap-1">
          {items.map((x, idx) =>
            x === "..." ? (
              <span key={`gap-${idx}`} className="px-2 text-gray-500">
                ...
              </span>
            ) : (
              <motion.button
                key={x}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onPage(x)}
                className={`w-10 h-10 rounded-xl border text-sm font-bold ${
                  x === page
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {x}
              </motion.button>
            )
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPage(clamp(page + 1))}
          disabled={page >= totalPages}
          className={`px-3 py-2 rounded-xl border text-sm flex items-center gap-2 ${
            page >= totalPages
              ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
          }`}
        >
          Next
          <FiChevronRight />
        </motion.button>
      </div>
    </div>
  );
}