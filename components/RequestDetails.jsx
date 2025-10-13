"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiArrowLeft,
  FiInfo,
  FiDollarSign,
  FiList,
  FiPaperclip,
  FiCalendar,
  FiUsers,
  FiCheckCircle,
  FiXCircle,
  FiMinusCircle,
  FiClock,
} from "react-icons/fi";
import { useRouter } from "next/navigation";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function RequestDetails({ id, companyKey }) {
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🟦 Fetch request details
  useEffect(() => {
    if (!id || !companyKey) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/requests/${id}?company=${companyKey}`);
        const data = await res.json();
        if (data.success) setRequest(data.data);
      } catch (err) {
        console.error("❌ Error loading request:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, companyKey]);
  const handleWorkflow = async (action) => {
    if (!id || !companyKey) return;
  
    try {
      const confirm = window.confirm(`Are you sure you want to ${action} this request?`);
      if (!confirm) return;
  
      const res = await fetch(`/api/requests/${id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyKey,
          user: "Ali Mushtaq",
          action,
          note: `Action by Ali Mushtaq`,
        }),
      });
  
      const data = await res.json();
  
      if (data.success) {
        alert(`Request ${action} successfully!`);
        setRequest(data.data);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (err) {
      console.error("❌ Workflow error:", err);
      alert("An error occurred while processing the action.");
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-600">
        <p className="text-lg">Request not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* 🔹 Header */}
     {/* 🔹 Header */}
<div className="flex justify-between items-center mb-10">
  <div>
    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
      <FiInfo className="text-blue-600" /> Fund Request Details
    </h1>

    {/* 🔸 Status Badge */}
    <div className="mt-3">
      <span
        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm ${
          request.status === "Approved"
            ? "bg-green-100 text-green-700 border border-green-300"
            : request.status === "Rejected"
            ? "bg-red-100 text-red-700 border border-red-300"
            : request.status === "Cancelled"
            ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
            : "bg-gray-100 text-gray-700 border border-gray-300"
        }`}
      >
        {request.status === "Approved" && <FiCheckCircle className="text-green-600" />}
        {request.status === "Rejected" && <FiXCircle className="text-red-600" />}
        {request.status === "Cancelled" && <FiMinusCircle className="text-yellow-600" />}
        {request.status === "Pending" && <FiClock className="text-gray-600" />}
        <span>{request.status}</span>
      </span>
    </div>
  </div>

  <button
    onClick={() => router.back()}
    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 shadow"
  >
    <FiArrowLeft /> Back
  </button>
</div>

      {/* 🧾 Request Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Left Section: Request Info */}
        <motion.div
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
            <FiInfo /> Request Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
            <Info label="Company" value={request.company} icon={<FiUsers />} />
            <Info label="Type" value={request.requestType} icon={<FiInfo />} />
            <Info label="Currency" value={request.currency} icon={<FiDollarSign />} />
            <Info label="Department" value={request.department} icon={<FiUsers />} />
            <Info
              label="Created At"
              value={new Date(request.createdAt).toLocaleString()}
              icon={<FiCalendar />}
            />
          </div>
        </motion.div>

        {/* Right Section: Requester */}
        <motion.div
          className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
            <FiUsers /> Requester Information
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center shadow-inner">
              <span className="text-xl font-bold text-gray-700">
                {request.createdBy?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-800">
                {request.createdBy || "Unknown User"}
              </p>
              <p className="text-sm text-gray-500">Primary Contact</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 📝 Description */}
      <Section title="Description" icon={<FiInfo />}>
        <p className="text-gray-700 text-sm leading-relaxed">
           {request.description || "-"}
        </p>
      </Section>

    
     {/* 📋 Items Table */}
<Section title="Items" icon={<FiList />}>
  <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-md bg-white">
    <table className="min-w-full text-sm text-gray-700">
      <thead>
        <tr className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 uppercase text-xs tracking-wide">
          <th className="px-4 py-3 text-left">Description</th>
          <th className="px-4 py-3 text-right">Qty</th>
          <th className="px-4 py-3 text-right">Price</th>
          <th className="px-4 py-3 text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {request.items?.length > 0 ? (
          request.items.map((it, i) => {
            const qty = Number(it.qty) || 0;
            const price = Number(it.price) || 0;
            return (
              <tr
                key={i}
                className="border-t hover:bg-gray-50 transition-colors duration-200"
              >
                <td className="px-4 py-3 font-medium">{it.desc}</td>
                <td className="px-4 py-3 text-right">{fmt.format(qty)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{fmt.format(price)}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-700">
                  {fmt.format(qty * price)}
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td
              className="px-4 py-4 text-center text-gray-500 italic"
              colSpan={4}
            >
              No items found
            </td>
          </tr>
        )}
      </tbody>

      {request.items?.length > 0 && (
        <tfoot>
          <tr className="bg-gray-50 border-t">
            <td
              className="px-4 py-3 font-semibold text-right text-gray-700"
              colSpan={3}
            >
              Total
            </td>
            <td className="px-4 py-3 text-right font-bold text-lg text-blue-700">
              {fmt.format(
                request.items.reduce(
                  (sum, it) =>
                    sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
                  0
                )
              )}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  </div>
</Section>

    {/* 📎 Attachments */}
{Array.isArray(request.attachments) && request.attachments.length > 0 && (
  <Section title="Attachments" icon={<FiPaperclip />}>
    <div className="flex flex-wrap gap-6">
      {request.attachments.map((file, idx) => (
        <a
          key={idx}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block w-32"
        >
          <div className="w-32 h-32 rounded-xl overflow-hidden border border-gray-200 shadow-sm transition-transform transform group-hover:scale-105 group-hover:shadow-lg">
            <img
              src={file.url}
              alt={file.name}
              className="w-full h-full object-cover"
            />
          </div>
          <p className="mt-2 text-sm text-center text-gray-700 truncate group-hover:text-blue-600">
            {file.name}
          </p>
        </a>
      ))}
    </div>
  </Section>
)}
{/* 🧭 Workflow Actions */}
{request && (
  <motion.div
    className="flex flex-wrap justify-center gap-4 mt-10"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    {/* ✅ Approve */}
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: "0 4px 10px rgba(34,197,94,0.4)" }}
      whileTap={{ scale: 0.97 }}
      onClick={() => handleWorkflow("approve")}
      className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-md transition-all"
    >
      <FiCheckCircle className="text-lg" /> Approve
    </motion.button>

    {/* ❌ Reject */}
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: "0 4px 10px rgba(239,68,68,0.4)" }}
      whileTap={{ scale: 0.97 }}
      onClick={() => handleWorkflow("reject")}
      className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-md transition-all"
    >
      <FiXCircle className="text-lg" /> Reject
    </motion.button>

    {/* 🚫 Cancel */}
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: "0 4px 10px rgba(234,179,8,0.4)" }}
      whileTap={{ scale: 0.97 }}
      onClick={() => handleWorkflow("cancel")}
      className="flex items-center gap-2 px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-xl shadow-md transition-all"
    >
      <FiMinusCircle className="text-lg" /> Cancel
    </motion.button>

    {/* ⏳ Pending */}
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: "0 4px 10px rgba(107,114,128,0.4)" }}
      whileTap={{ scale: 0.97 }}
      onClick={() => handleWorkflow("pending")}
      className="flex items-center gap-2 px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl shadow-md transition-all"
    >
      <FiClock className="text-lg" /> Pending
    </motion.button>
    
  </motion.div>
  
)}
{/* 🧾 Workflow History */}
{Array.isArray(request.approvalHistory) && request.approvalHistory.length > 0 && (
  <motion.div
    className="mt-14 bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
      <FiClock className="text-blue-600" /> Workflow History
    </h2>

    <div className="space-y-4">
      {request.approvalHistory
        .slice()
        .reverse()
        .map((step, idx) => {
          // 🎨 نحدد اللون والأيقونة حسب الحالة
          let color = "text-gray-600";
          let icon = <FiClock className="text-gray-500" />;
          if (step.action === "Approved") {
            color = "text-green-600";
            icon = <FiCheckCircle className="text-green-500" />;
          } else if (step.action === "Rejected") {
            color = "text-red-600";
            icon = <FiXCircle className="text-red-500" />;
          } else if (step.action === "Pending") {
            color = "text-gray-600";
            icon = <FiClock className="text-gray-400" />;
          } else if (step.action === "Cancelled") {
            color = "text-yellow-600";
            icon = <FiMinusCircle className="text-yellow-500" />;
          }

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-start gap-4 border border-gray-100 rounded-xl p-4 bg-gray-50/70 hover:bg-gray-100/90 transition`}
            >
              <div className="flex-shrink-0">{icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className={`font-semibold ${color}`}>{step.action}</p>
                  <span className="text-sm text-gray-500">
                    {new Date(step.date).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">
                  By: <span className="font-medium">{step.user}</span>
                </p>
                {step.note && (
                  <p className="text-sm text-gray-500 italic mt-1">
                    “{step.note}”
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
    </div>
  </motion.div>
)}
    </motion.div>
  );
}

// 🔹 Card-like info
function Info({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3 bg-white/60">
      <div className="text-gray-500 text-lg">{icon}</div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-medium text-gray-800">{value || "-"}</div>
      </div>
    </div>
  );
}

// 🔹 Section component
function Section({ title, icon, children }) {
  return (
    <motion.div
      className="p-6 mb-8 bg-white border border-gray-200 rounded-2xl shadow-sm"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
        {icon} {title}
      </h2>
      {children}
    </motion.div>
  );
}