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
  const workflow = request?.workflow;
  const workflowSteps = workflow?.steps || [];
  const [currentUser, setCurrentUser] = useState(null);
  

  // 🟢 ---------------- FETCH DATA FUNCTION (خارج useEffect) ----------------
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/requests/${id}?company=${companyKey}`, {
        cache: "no-store",
        credentials: "include"
      });
      const data = await res.json();
      if (data.success) setRequest(data.data);
    } catch (err) {
      console.error("❌ Error loading request:", err);
    } finally {
      setLoading(false);
    }
  };
  // 🟢 ----------------------------------------------------------------------

  // جلب المستخدم
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/userid", {
          credentials: "include",
        });
        const data = await res.json();
        setCurrentUser(data.user); 
      } catch (err) {
        console.error("❌ Error loading user", err);
      }
    };
    fetchUser();
  }, []);

  // جلب الطلب
  useEffect(() => {
    if (!id || !companyKey) return;
    fetchData();   // 👈 الآن متاحة
  }, [id, companyKey]);

 
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
  const isOwner =
  currentUser &&
  String(request.createdBy) === String(currentUser.username);

const canCancel =
  request.status === "Pending" && isOwner; return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
    <div className="mb-10">
  <div className="flex items-center justify-between">
    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
      <FiInfo className="text-blue-600" /> Fund Request Details
    </h1>

    <button
      onClick={() => router.back()}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 shadow"
    >
      <FiArrowLeft /> Back
    </button>
  </div>

  {/* 🔽 Cancel Button تحت العنوان */}
  {canCancel && (
    <button
      onClick={async () => {
        try {
          setLoading(true);
          await fetch(`/api/requests/cancel`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id, company: companyKey }),
          });
          await fetchData();
        } finally {
          setLoading(false);
        }
      }}
      className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl
                 bg-gray-800 text-white border border-gray-800
                 hover:bg-gray-900 hover:border-gray-900 transition"
    >
      <FiMinusCircle />
      <span className="text-sm font-semibold">Cancel Request</span>
    </button>
  )}
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
        
{/* ================= WORKFLOW ================= */}
{workflow && (
  <Section title={`Workflow: ${workflow.name || ""}`} icon={<FiUsers />}>
    {workflowSteps.length === 0 && (
      <p className="text-gray-500 italic text-center py-6">
        No workflow steps found.
      </p>
    )}

    {workflowSteps.length > 0 && (
      <div className="flex items-start gap-12 overflow-x-auto pb-8 pt-4">
        {workflowSteps.map((step, idx) => {
          const isCurrent = idx === request.currentStep;
// إذا الطلب Cancelled → خلي كل الخطوات رمادية من البداية
if (request.status === "Cancelled") {
  return (
    <div key={idx} className="flex items-center gap-10">
      <motion.div
        className="min-w-[280px] max-w-[280px] bg-gray-100 border rounded-3xl shadow-lg p-6 opacity-60"
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow bg-gray-400 text-white">
            {idx + 1}
          </div>

          <div>
            <p className="font-bold text-gray-600 text-lg">
              {step.user?.username || "Unknown User"}
            </p>
            <p className="text-xs text-gray-400 tracking-wide">
              Workflow Step
            </p>
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-400 italic">Cancelled</p>
      </motion.div>
    </div>
  );
}
          // ✅ الشرط الصحيح 100%
          const stepUserId =
          typeof step.user === "string"
            ? step.user
            : step.user?._id;
        if (request.status === "Cancelled") {
  statusColor = "text-gray-500";
  badgeColor = "bg-gray-200 border-gray-300";
  stepBg = "bg-gray-100";
}
            const canAct =
            request.status !== "Cancelled" &&            // 🛑 يمنع أي عمل بعد الإلغاء
            isCurrent &&
            step.status === "Pending" &&
            currentUser &&
            String(stepUserId) === String(currentUser?.id);
            if (request.status === "Cancelled") {
              return (
                <div key={idx} className="flex items-center gap-10">
                  <motion.div
                    className="min-w-[280px] max-w-[280px] bg-gray-100 border rounded-3xl shadow-lg p-6 opacity-60"
                  >
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow bg-gray-400 text-white">
                        {idx + 1}
                      </div>
            
                      <div>
                        <p className="font-bold text-gray-600 text-lg">
                          {step.user?.username || "Unknown User"}
                        </p>
                        <p className="text-xs text-gray-400 tracking-wide">
                          Workflow Step
                        </p>
                      </div>
                    </div>
            
                    {/* لا تعرض أي status */}
                    <p className="mt-2 text-xs text-gray-400 italic">
                      Cancelled
                    </p>
                  </motion.div>
                </div>
              );
            }
          let statusColor = "text-gray-600";
          let badgeColor = "bg-gray-100 border-gray-300";
          let stepBg = "bg-white";

          if (step.status === "Approved") {
            statusColor = "text-green-600";
            badgeColor = "bg-green-100 border-green-300";
            stepBg = "bg-green-50";
          } else if (step.status === "Rejected") {
            statusColor = "text-red-600";
            badgeColor = "bg-red-100 border-red-300";
            stepBg = "bg-red-50";
          } else if (isCurrent) {
            statusColor = "text-blue-600";
            badgeColor = "bg-blue-100 border-blue-300";
            stepBg = "bg-blue-50";
          }

          return (
            <div key={idx} className="flex items-center gap-10">
              {/* STEP CARD */}
              <motion.div
                whileHover={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 180 }}
                className={`min-w-[280px] max-w-[280px] ${stepBg} border rounded-3xl shadow-lg p-6 transition-all`}
              >
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow ${
                      isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div>
                    <p className="font-bold text-gray-900 text-lg">
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

                {step.actedAt && (
                  <p className="mt-3 text-xs text-gray-400">
                    {new Date(step.actedAt).toLocaleString()}
                  </p>
                )}

            

                {/* ✅ APPROVE / REJECT (يطلع بس للي إله الدور) */}
                {canAct && (
  <div className="mt-6 flex gap-3">

    {/* APPROVE */}
    <button
      onClick={async () => {
        try {
          setLoading(true);

          await fetch(`/api/requests/${id}?company=${companyKey}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "approve",
            }),
          });

          await fetchData(); // تحديث بدون رفرش
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
    >
      <FiCheckCircle /> {loading ? "Processing..." : "Approve"}
    </button>

    {/* REJECT */}
    <button
      onClick={async () => {
        const note = prompt("سبب الرفض");
        if (!note) return;

        try {
          setLoading(true);

          await fetch(`/api/requests/${id}?company=${companyKey}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reject",
              note,
            }),
          });

          await fetchData(); // تحديث مباشر
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
    >
      <FiXCircle /> {loading ? "Processing..." : "Reject"}
    </button>

  </div>
)}
              </motion.div>

              {/* ARROW */}
              {idx !== workflowSteps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 10 }}
                  transition={{
                    repeat: Infinity,
                    repeatType: "reverse",
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
  </Section>
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