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
  FiClock,FiMessageSquare
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import CommentModal from "@/components/CommentModal";

export default function RequestDetails({ id, companyKey }) {
  const router = useRouter();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const workflow = request?.workflow;
  const workflowSteps = workflow?.steps || [];
  const [currentUser, setCurrentUser] = useState(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
const [commentAction, setCommentAction] = useState(null); // approve | reject | view
const [commentText, setCommentText] = useState("");
const [activeStep, setActiveStep] = useState(null);
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const [stepAttachment, setStepAttachment] = useState(null); // File | string(url) | null
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
      <div className="flex items-start gap-10 overflow-x-auto py-6">
        {workflowSteps.map((step, idx) => {
          const isCurrent = idx === request.currentStep;

          const canAct =
            request.status === "Pending" &&
            isCurrent &&
            step.status === "Pending" &&
            currentUser &&
            step.users?.some(
              (user) => String(user._id) === String(currentUser.id)
            );

            const hasComment = !!(step.comment && step.comment.trim());

            const hasAttach =
              (Array.isArray(step.tagAttachments) && step.tagAttachments.length > 0) ||
              !!step.tag; // اذا عندك tagUrl قديم
          /* ===== Step Style ===== */
          let stepBg = "bg-white";
          let stepBorder = "border-gray-200";
          let statusText = "text-gray-500";

          if (request.status === "Cancelled") {
            stepBg = "bg-gray-100";
            stepBorder = "border-gray-300";
            statusText = "text-gray-400";
          } else {
            if (step.status === "Approved") {
              stepBg = "bg-green-50";
              stepBorder = "border-green-300";
              statusText = "text-green-600";
            }

            if (step.status === "Rejected") {
              stepBg = "bg-red-50";
              stepBorder = "border-red-300";
              statusText = "text-red-600";
            }

            if (step.status === "Pending") {
              stepBg = isCurrent ? "bg-blue-50" : "bg-white";
              stepBorder = isCurrent
                ? "border-blue-300"
                : "border-gray-200";
              statusText = isCurrent
                ? "text-blue-600"
                : "text-gray-500";
            }
          }

          return (
            <div key={idx} className="flex items-center gap-8">
              {/* STEP CARD */}
              <motion.div
                whileHover={request.status === "Cancelled" ? {} : { y: -3 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  if (request.status === "Cancelled") return;
                
                  if (step.actedAt && (hasComment || hasAttach)) {
                    setCommentAction("view");
                    setCommentText(step.comment || "");
                    setActiveStep(idx);
                
                    const last =
                      Array.isArray(step.tagAttachments) && step.tagAttachments.length
                        ? step.tagAttachments[step.tagAttachments.length - 1]
                        : null;
                
                    // ✅ إذا موجود tagAttachments نعرضه، إذا لا نخلي null (والـ CommentModal يعرض tagUrl عبر tagUrl prop)
                    setStepAttachment(
                      last?.url
                        ? { url: last.url, name: last.name, type: last.type, size: last.size }
                        : null
                    );
                
                    setShowCommentModal(true);
                  }
                }}
                className={`relative min-w-[320px] rounded-2xl border ${stepBorder} ${stepBg} p-6 shadow-sm ${
                  request.status === "Cancelled"
                    ? "cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
             {(hasComment || hasAttach) && request.status !== "Cancelled" && (
  <div className="absolute top-3 right-3 flex items-center gap-1 text-blue-600">
    <FiMessageSquare className="text-lg" />
    <span className="text-xs font-medium">View</span>
  </div>
)}
                {/* HEADER */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
                      ${isCurrent ? "bg-blue-600" : "bg-gray-700"}`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">
                        Step {idx + 1}
                      </p>
                      <p className={`text-xs ${statusText}`}>
                        {request.status === "Cancelled"
                          ? "Cancelled"
                          : step.status}
                      </p>
                    </div>
                  </div>

                  {request.status === "Cancelled" ? (
                    <FiXCircle className="text-gray-400" />
                  ) : step.status === "Approved" ? (
                    <FiCheckCircle className="text-green-500" />
                  ) : step.status === "Rejected" ? (
                    <FiXCircle className="text-red-500" />
                  ) : (
                    <FiClock className="text-gray-400" />
                  )}
                </div>

                {/* USERS */}
                <div className="space-y-3">
                  {(step.users || []).map((user) => {
                    const acted =
                      step.status !== "Pending" &&
                      step.actedBy &&
                      String(step.actedBy._id) === String(user._id);

                    const userBg =
                      request.status === "Cancelled"
                        ? "bg-gray-100 border-gray-300"
                        : acted
                        ? step.status === "Approved"
                          ? "bg-green-100 border-green-400"
                          : "bg-red-100 border-red-400"
                        : "bg-gray-50 border-gray-200";

                    return (
                      <div
                        key={user._id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${userBg}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold
                          ${
                            acted
                              ? step.status === "Approved"
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                              : "bg-gray-800 text-white"
                          }`}
                        >
                          {user.username?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">
                            {user.username}
                          </p>
                          {acted && (
                            <p className="text-xs text-gray-600">
                              Took Action
                            </p>
                          )}
                        </div>

                        {acted && (
                          <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full ${
                              step.status === "Approved"
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                            }`}
                          >
                            {step.status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ACTIONS */}
                {canAct && request.status !== "Cancelled" && (
                  <div className="mt-5 flex gap-3">
              <button
  onClick={(e) => {
    e.stopPropagation();
    setActiveStep(idx);          // ✅ مهم
    setCommentAction("approve");
    setCommentText("");
    setStepAttachment(null);     // ✅ تصفير المرفق القديم
    setShowCommentModal(true);
  }}
  className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
>
  Approve
</button>

<button
  onClick={(e) => {
    e.stopPropagation();
    setActiveStep(idx);          // ✅ مهم
    setCommentAction("reject");
    setCommentText("");
    setStepAttachment(null);     // ✅ تصفير المرفق القديم
    setShowCommentModal(true);
  }}
  className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
>
  Reject
</button>
                  </div>
                )}
              </motion.div>

              {/* ARROW */}
              {idx !== workflowSteps.length - 1 && (
                <div className="text-4xl text-gray-300 select-none">→</div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </Section>
)}
<CommentModal
  open={showCommentModal}
  action={commentAction}
  value={commentText}
  onChange={setCommentText}
  loading={loading}
  stepStatus={activeStep !== null ? workflowSteps?.[activeStep]?.status : "Pending"}
  attachment={stepAttachment}
  onAttachmentChange={setStepAttachment}
  companyKey={companyKey}
  requestId={id}
  tagUrl={activeStep !== null ? workflowSteps?.[activeStep]?.tag : ""}

  stepIndex={activeStep}
  onClose={() => {
    setShowCommentModal(false);
    setActiveStep(null);
    setCommentAction(null);
    setCommentText("");
    setStepAttachment(null);
  }}
  onSubmit={commentAction === "view" ? null : async () => {
    setLoading(true);
    try {
      await fetch(`/api/requests/${id}?company=${companyKey}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: commentAction,
          note: commentText,
        }),
      });

      await fetchData();

      setShowCommentModal(false);
      setActiveStep(null);
      setCommentAction(null);
      setCommentText("");
      setStepAttachment(null);

      router.refresh();
    } finally {
      setLoading(false);
    }
  }}
/>
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