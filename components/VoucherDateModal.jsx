"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function VoucherDateModal({
  open,
  tmpDate = { yearShort: "", month: "", day: "" },
  setTmpDate,
  only2Digits,
  onClose,
  onSave,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6"
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 15, opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-extrabold text-gray-900 mb-4 text-center">
              تعديل التاريخ
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 text-center">
                  السنة
                </label>
                <input
                  value={tmpDate?.yearShort || ""}
                  onChange={(e) =>
                    setTmpDate((prev) => ({
                      ...prev,
                      yearShort: only2Digits(e.target.value),
                    }))
                  }
                  maxLength={2}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-center font-extrabold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 text-center">
                  الشهر
                </label>
                <input
                  value={tmpDate?.month || ""}
                  onChange={(e) =>
                    setTmpDate((prev) => ({
                      ...prev,
                      month: only2Digits(e.target.value),
                    }))
                  }
                  maxLength={2}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-center font-extrabold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 text-center">
                  اليوم
                </label>
                <input
                  value={tmpDate?.day || ""}
                  onChange={(e) =>
                    setTmpDate((prev) => ({
                      ...prev,
                      day: only2Digits(e.target.value),
                    }))
                  }
                  maxLength={2}
                  className="w-full rounded-2xl border border-gray-300 px-3 py-3 text-center font-extrabold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-800 font-extrabold hover:bg-gray-200 transition"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={onSave}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 transition"
              >
                حفظ التاريخ
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}