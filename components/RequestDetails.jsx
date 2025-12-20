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

// 🔐 المستخدم الحالي (لاحقاً يكون Dynamic)
const currentUserName = "Ali Mushtaq";

export default function RequestDetails({ id, companyKey }) {
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wfLoading, setWfLoading] = useState(true);
  const [workflowLoading, setWorkflowLoading] = useState(true);

  useEffect(() => {
    if (!request?.company) return;

    const loadWorkflow = async () => {
      setWorkflowLoading(true);

      try {
        const wfRes = await fetch(`/api/workflow?company=${request.company}`);
        const wfData = await wfRes.json();

        setRequest((prev) => ({
          ...prev,
          workflowSteps: wfData?.workflow?.steps || [],
        }));
      } catch (err) {
        console.log("Workflow load error:", err);
      } finally {
        setWorkflowLoading(false);
      }
    };

    loadWorkflow();
  }, [request?.company]);

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
      const confirm = window.confirm(
        `Are you sure you want to ${action} this request?`
      );
      if (!confirm) return;

      const res = await fetch(`/api/requests/${id}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyKey,
          user: currentUserName,
          action,
          note: `Action by ${currentUserName}`,
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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <FiInfo className="text-blue-600" /> Fund Request Details
          </h1>

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
              {request.status === "Approved" && (
                <FiCheckCircle className="text-green-600" />
              )}
              {request.status === "Rejected" && (
                <FiXCircle className="text-red-600" />
              )}
              {request.status === "Cancelled" && (
                <FiMinusCircle className="text-yellow-600" />
              )}
              {request.status === "Pending" && (
                <FiClock className="text-gray-600" />
              )}
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

      {/* SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
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
            <Info
              label="Currency"
              value={request.currency}
              icon={<FiDollarSign />}
            />
            <Info
              label="Department"
              value={request.department}
              icon={<FiUsers />}
            />
            <Info
              label="Created At"
              value={new Date(request.createdAt).toLocaleString()}
              icon={<FiCalendar />}
            />
          </div>
        </motion.div>

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

      {/* DESCRIPTION */}
      <Section title="Description" icon={<FiInfo />}>
        <p className="text-gray-700 text-sm leading-relaxed">
          {request.description || "-"}
        </p>
      </Section>

      {/* ITEMS */}
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
                      <td className="px-4 py-3 text-right">
                        {fmt.format(qty)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fmt.format(price)}
                      </td>
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
                          sum +
                          (Number(it.qty) || 0) * (Number(it.price) || 0),
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

      {/* ATTACHMENTS */}
      {Array.isArray(request.attachments) &&
        request.attachments.length > 0 && (
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

      {/* WORKFLOW ACTION BUTTONS */}
      <motion.div
        className="flex flex-wrap justify-center gap-4 mt-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* -------- APPROVE -------- */}
        {request.workflowSteps?.length > 0 &&
          request.workflowSteps[request.currentStep]?.user
            ?.username === currentUserName && (
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 4px 10px rgba(34,197,94,0.4)",
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleWorkflow("approve")}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-md transition-all"
            >
              <FiCheckCircle className="text-lg" /> Approve
            </motion.button>
          )}

        {/* -------- REJECT -------- */}
        {request.workflowSteps?.length > 0 &&
          request.workflowSteps[request.currentStep]?.user
            ?.username === currentUserName && (
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 4px 10px rgba(239,68,68,0.4)",
              }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleWorkflow("reject")}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl shadow-md transition-all"
            >
              <FiXCircle className="text-lg" /> Reject
            </motion.button>
          )}

        {/* -------- CANCEL -------- */}
        {request.createdBy === currentUserName && (
          <motion.button
            whileHover={{
              scale: 1.05,
              boxShadow: "0 4px 10px rgba(247,197,34,0.4)",
            }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleWorkflow("cancel")}
            className="flex items-center gap-2 px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-xl shadow-md transition-all"
          >
            <FiMinusCircle className="text-lg" /> Cancel
          </motion.button>
        )}
      </motion.div>

      {/* WORKFLOW STEPS VISUAL */}
      {request.company && (
        <motion.div
          className="mt-14 bg-white rounded-2xl border border-gray-200 shadow-lg p-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-bold mb-10 flex items-center gap-3 text-gray-900">
            <FiUsers className="text-blue-600" /> Workflow Steps
          </h2>

          {workflowLoading && (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          )}

          {!workflowLoading &&
            (!request.workflowSteps ||
              request.workflowSteps.length === 0) && (
              <p className="text-gray-500 italic text-center py-10 text-lg">
                No workflow found for this company.
              </p>
            )}

          {!workflowLoading && request.workflowSteps?.length > 0 && (
            <div className="flex items-start gap-12 overflow-x-auto pb-8 pt-4">
              {request.workflowSteps.map((step, idx) => {
                let statusColor = "text-gray-600";
                let badgeColor = "bg-gray-100 border-gray-300";

                if (step.status === "Approved") {
                  statusColor = "text-green-600";
                  badgeColor = "bg-green-100 border-green-300";
                } else if (step.status === "Rejected") {
                  statusColor = "text-red-600";
                  badgeColor = "bg-red-100 border-red-300";
                } else {
                  statusColor = "text-yellow-600";
                  badgeColor = "bg-yellow-100 border-yellow-300";
                }

                return (
                  <div key={idx} className="flex items-center gap-12">
                    <motion.div
                      whileHover={{ scale: 1.04 }}
                      transition={{ type: "spring", stiffness: 180 }}
                      className="min-w-[290px] max-w-[290px] bg-white border border-gray-300 rounded-3xl shadow-xl p-7 hover:shadow-2xl transition-all"
                    >
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                          {idx + 1}
                        </div>

                        <div>
                          <p className="font-bold text-gray-900 text-xl">
                            {step.user?.username || "Unknown User"}
                          </p>
                          <p className="text-xs text-gray-500 tracking-wide">
                            Workflow Step
                          </p>
                        </div>
                      </div>

                      <div
                        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold shadow-sm ${badgeColor}`}
                      >
                        <FiClock className={statusColor} />
                        <span className={statusColor}>
                          {step.status || "Pending"}
                        </span>
                      </div>
                    </motion.div>

                    {idx !== request.workflowSteps.length - 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "easeInOut",
                        }}
                        className="text-5xl text-blue-600 select-none"
                      >
                        ➜
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

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