"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FiTrash2 } from "react-icons/fi";

export default function DeleteAllRequestsPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleDeleteAll = async () => {
    const confirmDelete = confirm(
      "⚠️ هل أنت متأكد من أنك تريد حذف جميع الريكويستات من جميع الشركات؟ هذه العملية لا يمكن التراجع عنها."
    );
    if (!confirmDelete) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/requests/deleteAll", { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ تم حذف جميع الريكويستات من جميع الشركات بنجاح");
      } else {
        setMessage(`❌ فشل الحذف: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ حدث خطأ أثناء الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-6">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-gray-200 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          حذف جميع الريكويستات 🧨
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          بالضغط على الزر أدناه، سيتم حذف كل الريكويستات من جميع الشركات. تأكد أنك
          تملك الصلاحية للقيام بهذه العملية.
        </p>

        <motion.button
          onClick={handleDeleteAll}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white font-medium transition 
            ${loading ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}
        >
          <FiTrash2 className="text-lg" />
          {loading ? "جاري الحذف..." : "حذف جميع الريكويستات"}
        </motion.button>

        {message && (
          <div
            className={`mt-4 text-sm font-medium ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}