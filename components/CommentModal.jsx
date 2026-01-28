"use client";
import { motion } from "framer-motion";
import { FiCheckCircle, FiXCircle, FiUser, FiMessageSquare } from "react-icons/fi";

export default function CommentModal({
  open,
  action,       // approve | reject | view
  value,
  onChange,
  onClose,
  onSubmit,
  loading,
  username,     // 👈 اسم اليوزر مال الستيب
}) {
  if (!open) return null;

  const isView = action === "view";
  const isApprove = action === "approve";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FiMessageSquare className="text-blue-600" />
            Review Comments
          </h3>
      
        </div>

        {/* STATUS BAR */}
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl mb-4
          ${
            isApprove
              ? "bg-green-50 text-green-700"
              : action === "reject"
              ? "bg-red-50 text-red-700"
              : "bg-gray-50 text-gray-700"
          }`}
        >
          <span className="font-semibold">
            {isView
              ? "Review Comment"
              : isApprove
              ? "Approve"
              : "Reject"}
          </span>

          {isApprove && <FiCheckCircle className="text-green-600 text-xl" />}
          {action === "reject" && <FiXCircle className="text-red-600 text-xl" />}
        </div>

        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <FiUser className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {username || "Unknown User"}
            </p>
            <p className="text-xs text-gray-500">
              Step Action User
            </p>
          </div>
        </div>

        {/* COMMENT BOX */}
        <div className="border rounded-xl p-4 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Comment</p>

          {isView ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {value || "لا يوجد تعليق"}
            </p>
          ) : (
            <textarea
              rows={4}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="اكتب الكومنت هنا..."
              className="w-full bg-white border rounded-xl p-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* ACTIONS */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>

          {!isView && (
            <button
              disabled={loading}
              onClick={onSubmit}
              className={`px-4 py-2 rounded-xl text-white font-semibold
                ${
                  isApprove
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
            >
              {loading ? "Sending..." : "Submit"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}