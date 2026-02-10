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
import StatusBadge from "@/components/StatusBadge";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import VoucherModal from "@/components/VoucherModal";

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
const [showVoucherModal, setShowVoucherModal] = useState(false);
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const [stepAttachment, setStepAttachment] = useState(null); // File | string(url) | null
const { permissions } = usePermissions();

const canViewAll =
  Array.isArray(permissions) &&
  permissions.includes(PERMISSIONS.VIEW_REPORTS);

const [accessChecked, setAccessChecked] = useState(false);
const [accessDenied, setAccessDenied] = useState(false);
useEffect(() => {
  if (!id || !companyKey) return;
  fetchData();
}, [id, companyKey]);

useEffect(() => {
  // ننتظر لحد ما تجي كل البيانات
  if (!request || !currentUser || !Array.isArray(permissions)) return;

  const isOwner = String(request.createdBy) === String(currentUser.username);
  const allowed = isOwner || canViewAll;

  if (!allowed) {
    setAccessDenied(true);
    router.replace("/home"); // او "/403"
    return;
  }

  setAccessChecked(true);
}, [request, currentUser, permissions, canViewAll, router]);


const base =
  "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border";
  // 🟢 ---------------- FETCH DATA FUNCTION (خارج useEffect) ----------------
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/requests/${id}?company=${companyKey}`, {
        cache: "no-store",
        credentials: "include",
      });
  
      if (res.status === 401 || res.status === 403) {
        router.replace("/home");
        return;
      }
  
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
  if (accessDenied) return null;
  if (!accessChecked) return null;
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
      className="min-h-screen bg-gradient-to-br  p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      
    <div className="mb-10">
  <div className="flex items-center justify-between">
  <StatusBadge status={request.status} />

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
      const ok = window.confirm("هل أنت متأكد من إلغاء الطلب؟");
      if (!ok) return;

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
className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
            <FiInfo /> معلومات الطلب
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
  {/* Request Code */}
  <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info
      label="رمز الطلب"
      value={request.requestCode || request.code || request._id}
      icon={<FiInfo />}
    />
  </div>

  <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info label=" الشركة" value={request.company} icon={<FiUsers />} />
  </div>

  <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info label="النوع" value={request.requestType} icon={<FiInfo />} />
  </div>

  <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info
      label="العملة"
      value={request.currency}
      icon={<FiDollarSign />}
    />
  </div>

  <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info
      label="القسم"
      value={request.department}
      icon={<FiUsers />}
    />
  </div>

  <div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info
      label="تاريخ الإنشاء"
      value={new Date(request.createdAt).toLocaleString()}
      icon={<FiCalendar />}
    />
  </div>
</div>
        </motion.div>

        <motion.div
        className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
            <FiUsers /> معلومات مقدم الطلب
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
      <Section title="الوصف" icon={<FiInfo />}>
        <p className="text-gray-700 text-sm leading-relaxed">
          {request.description || "-"}
        </p>
      </Section>

  {/* ITEMS */}
<Section title="Items" icon={<FiList />}>
  <div
    className="
      relative overflow-hidden
      rounded-3xl
      bg-white/55 backdrop-blur-2xl
      ring-1 ring-black/5
      shadow-[0_18px_45px_-28px_rgba(0,0,0,0.22)]
    "
  >
    {/* soft glow */}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/20 to-transparent opacity-90" />
    <div className="pointer-events-none absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/70 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-white/50 blur-3xl" />

    <div className="relative overflow-x-auto">
      <table className="min-w-full text-sm text-slate-900">
        {/* Header */}
        <thead className="sticky top-0 z-10">
          <tr
            className="
              bg-white/70 backdrop-blur
              border-b border-black/5
              text-[11px] uppercase tracking-wider text-slate-700
            "
          >
            <th className="px-5 py-4 text-left font-black w-[52%]">
              الوصف
            </th>
            <th className="px-5 py-4 text-right font-black w-[16%]">
              العدد
            </th>
            <th className="px-5 py-4 text-right font-black w-[16%]">
              المبلغ
            </th>
            <th className="px-5 py-4 text-right font-black w-[16%]">
              المجموع الكلي
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-black/5">
          {request.items?.length > 0 ? (
            request.items.map((it, i) => {
              const qty = Number(it.qty) || 0;
              const price = Number(it.price) || 0;
              const sub = qty * price;

              return (
                <tr
                  key={i}
                  className={[
                    "transition-colors",
                    "hover:bg-slate-900/[0.03]",
                    i % 2 === 0 ? "bg-white/35" : "bg-transparent",
                  ].join(" ")}
                >
                  <td className="px-5 py-4">
                    <div className="font-extrabold text-slate-900 leading-tight">
                      {it.desc || "-"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Item #{i + 1}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums font-semibold text-slate-800">
                    {fmt.format(qty)}
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums text-slate-700">
                    {fmt.format(price)}
                  </td>

                  <td className="px-5 py-4 text-right tabular-nums">
                    <span
                      className="
                        inline-flex items-center justify-end
                        px-3 py-1 rounded-2xl
                        bg-white/70 ring-1 ring-black/5
                        font-black text-slate-900
                        shadow-sm
                      "
                    >
                      {fmt.format(sub)}
                    </span>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                className="px-5 py-12 text-center text-slate-500 italic"
                colSpan={4}
              >
                No items found
              </td>
            </tr>
          )}
        </tbody>

        {/* Footer Total */}
        {request.items?.length > 0 && (
          <tfoot className="sticky bottom-0 z-10">
            <tr className="bg-white/75 backdrop-blur border-t border-black/5">
              <td
                className="px-5 py-4 text-right font-black text-slate-700"
                colSpan={3}
              >
                Total
              </td>
              <td className="px-5 py-4 text-right">
                <span
                  className="
                    inline-flex items-center justify-end
                    px-4 py-2 rounded-2xl
                    bg-white ring-1 ring-black/5
                    font-black text-lg text-slate-900
                    shadow-sm
                  "
                >
                  {fmt.format(
                    request.items.reduce(
                      (sum, it) =>
                        sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
                      0
                    )
                  )}
                </span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
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
      <div className="relative">
        {/* fade edges */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white/60 to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white/60 to-transparent z-10" />

        <div className="flex items-start gap-6 overflow-x-auto py-6 px-1">
          {workflowSteps.map((step, idx) => {
            const lastIdx = workflowSteps.length - 1;
            const isLast = idx === lastIdx;
            
            const isFinalApproved =
              isLast &&
              request.status === "Approved" &&
              step.status === "Approved";
              
              const isLastStepUser =
  isLast &&
  currentUser &&
  step.users?.some((u) => String(u._id) === String(currentUser.id));

              
            const isCurrent = idx === request.currentStep;
            const canAct =
            (request.status === "Pending" || request.status === "Rejected") &&
            isCurrent &&
            step.status === "Pending" &&
            currentUser &&
            step.users?.some((user) => String(user._id) === String(currentUser.id));
            const hasComment = !!(step.comment && step.comment.trim());

            const hasAttach =
              (Array.isArray(step.tagAttachments) && step.tagAttachments.length > 0) ||
              !!step.tag;

            const isCancelled = request.status === "Cancelled";

            // ⭐ card style (soft / clean)
            const cardBase = `
              relative min-w-[320px] rounded-3xl p-6
              bg-white/40 backdrop-blur-2xl
              ring-1 ring-white/25
              shadow-[0_18px_45px_-28px_rgba(0,0,0,0.25)]
              transition
            `;

            const cardHover = isCancelled
              ? "cursor-not-allowed opacity-80"
              : "cursor-pointer hover:bg-white/55 hover:ring-white/40";

            const currentRing =
              isCurrent && !isCancelled ? "ring-2 ring-blue-200/70" : "";

            return (
              <div key={idx} className="flex items-center gap-5">
                {/* STEP CARD */}
                <motion.div
                  whileHover={isCancelled ? {} : { y: -3 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => {
                    if (isCancelled) return;

                    if (step.actedAt && (hasComment || hasAttach)) {
                      setCommentAction("view");
                      setCommentText(step.comment || "");
                      setActiveStep(idx);

                      const last =
                        Array.isArray(step.tagAttachments) && step.tagAttachments.length
                          ? step.tagAttachments[step.tagAttachments.length - 1]
                          : null;

                      setStepAttachment(
                        last?.url
                          ? { url: last.url, name: last.name, type: last.type, size: last.size }
                          : null
                      );

                      setShowCommentModal(true);
                    }
                  }}
                  className={`${cardBase} ${cardHover} ${currentRing}`}
                >
                  {/* soft glow */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/45 via-transparent to-transparent opacity-80" />

                  {(hasComment || hasAttach) && !isCancelled && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 text-blue-700/80">
                      <FiMessageSquare className="text-lg" />
                      <span className="text-xs font-medium">View</span>
                    </div>
                  )}

                  {/* HEADER */}
                  <div className="relative flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-bold
                          ${isCancelled ? "bg-gray-500" : isCurrent ? "bg-blue-600" : "bg-gray-800"}
                        `}
                      >
                        {idx + 1}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-800">
                          الخطوة {idx + 1}
                        </p>

                        {/* ✅ status from component (مرة وحده) */}
                        <div className="mt-1">
                          <StatusBadge status={isCancelled ? "cancelled" : step.status} />
                        </div>
                        {step?.actedAt && (
  <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
    <FiCalendar className="text-gray-500" />
    <span className="font-semibold">Acted At:</span>
    <span>{new Date(step.actedAt).toLocaleString()}</span>
  </div>
)}
                      </div>
                    </div>

                    {isCancelled ? (
                      <FiXCircle className="text-gray-400 text-lg" />
                    ) : step.status === "Approved" ? (
                      <FiCheckCircle className="text-green-600 text-lg" />
                    ) : step.status === "Rejected" ? (
                      <FiXCircle className="text-red-600 text-lg" />
                    ) : (
                      <FiClock className="text-amber-600 text-lg" />
                    )}
                  </div>

                  {/* USERS */}
                  <div className="relative space-y-3">
                    {(step.users || []).map((user) => {
                      const acted =
                        step.status !== "Pending" &&
                        step.actedBy &&
                        String(step.actedBy._id) === String(user._id);

                      const rowBase =
                        "flex items-center gap-3 p-3 rounded-2xl " +
                        "bg-white/45 backdrop-blur ring-1 ring-black/5";

                      const avatarBg = isCancelled
                        ? "bg-gray-500"
                        : acted
                        ? step.status === "Approved"
                          ? "bg-green-600"
                          : "bg-red-600"
                        : "bg-gray-800";

                      return (
                        <div key={user._id} className={rowBase}>
                          <div
                            className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-white ${avatarBg}`}
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

                          {/* بدل الباج الملون القديم نخليه من الكومبوننت */}
                          {acted && (
                            <StatusBadge status={step.status} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ACTIONS */}
                  {canAct && !isCancelled && (
                    <div className="mt-5 flex gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveStep(idx);
                          setCommentAction("approve");
                          setCommentText("");
                          setStepAttachment(null);
                          setShowCommentModal(true);
                        }}
                        className="flex-1 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm"
                      >
                        Approve
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveStep(idx);
                          setCommentAction("reject");
                          setCommentText("");
                          setStepAttachment(null);
                          setShowCommentModal(true);
                        }}
                        className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm"
                      >
                        Reject
                      </button>
                  
                    </div>
                  )}
                    {isFinalApproved && isLastStepUser && (
  <div className="mt-4">
    <button
      onClick={(e) => {
        e.stopPropagation();
        setShowVoucherModal(true);
      }}
      className="w-full py-2.5 rounded-2xl bg-gray-900 text-white font-extrabold hover:bg-black shadow"
    >
      وصل صرف
    </button>
  </div>
)}
                </motion.div>

                {/* ARROW */}
                {idx !== workflowSteps.length - 1 && (
                  <div className="text-3xl text-gray-400/60 select-none">→</div>
                )}
              </div>
            );
          })}
        </div>
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
  onSubmit={
    commentAction === "view"
      ? null
      : async ({ attachmentMeta = null, clearTag = false, stepIndex } = {}) => {
          setLoading(true);
          try {
            await fetch(`/api/requests/${id}?company=${companyKey}`, {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: commentAction,
                note: commentText,
              
                // ✅ stepIndex دايمًا من المودال إذا موجود، وإلا من activeStep
                stepIndex: Number.isInteger(stepIndex)
                  ? stepIndex
                  : Number.isInteger(activeStep)
                  ? activeStep
                  : null,
              
                clearTag: Boolean(clearTag),
                attachmentMeta: attachmentMeta?.key ? attachmentMeta : null,
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
        }
  }
/>
<VoucherModal
  open={showVoucherModal}
  onClose={() => setShowVoucherModal(false)}
  request={request}
  companyKey={companyKey}
  requestId={id}
  onSaved={async () => {
    await fetchData();
  }}
/>
    </motion.div>
  );
}

function Info({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/35 backdrop-blur ring-1 ring-white/25 p-3 shadow-sm">


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
    className="p-6 mb-8 rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] overflow-hidden"      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
        {icon} {title}
      </h2>
      {children}
      
    </motion.div>

    
  );
  
}