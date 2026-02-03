"use client";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FiCheckCircle,
  FiXCircle,
  FiMessageSquare,
  FiPlus,
  FiPaperclip,
  FiExternalLink,
  FiTrash2,
  FiFileText,
  FiImage,
  FiClock,
  FiSlash,
} from "react-icons/fi";

export default function CommentModal({
  open,
  action,
  value,
  onChange,
  onClose,
  onSubmit,
  loading,
  stepStatus,
  attachment,
  onAttachmentChange,
  tagUrl,

  // ✅ جديد
  companyKey,
  requestId,
  stepIndex,
}) {
  const [localMode, setLocalMode] = useState(action);
  const [localStatus, setLocalStatus] = useState(stepStatus || "Pending");
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (open) {
      setLocalMode(action);
      setLocalStatus(stepStatus || "Pending");
      setSubmitting(false);
    }
  }, [open, action, stepStatus]);

  useEffect(() => {
    if (!open) {
      setPreviewUrl(null);
      return;
    }

    const isFile = attachment instanceof File;
    const isImg = isFile && attachment?.type?.startsWith("image/");
    if (!isFile || !isImg || localMode === "view") {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(attachment);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [open, attachment, localMode]);

  const isView = localMode === "view";
  const isApprove = localMode === "approve";
  const isReject = localMode === "reject";

  const disableAll = submitting || loading;

  const statusUI = useMemo(() => {
    if (isView) return { label: "VIEW", cls: "bg-gray-100 text-gray-700" };
    if (isApprove) return { label: "APPROVE", cls: "bg-green-100 text-green-800" };
    return { label: "REJECT", cls: "bg-red-100 text-red-800" };
  }, [isView, isApprove, isReject]);

  const topInfo = useMemo(() => {
    if (isView) {
      if (localStatus === "Approved") {
        return {
          title: "Approved",
          subtitle: "This step has been approved",
          icon: <FiCheckCircle className="text-green-600" />,
          bubble: "bg-green-50 border-green-100",
        };
      }
      if (localStatus === "Rejected") {
        return {
          title: "Rejected",
          subtitle: "This step has been rejected",
          icon: <FiXCircle className="text-red-600" />,
          bubble: "bg-red-50 border-red-100",
        };
      }
      if (localStatus === "Cancelled") {
        return {
          title: "Cancelled",
          subtitle: "This step has been cancelled",
          icon: <FiSlash className="text-gray-600" />,
          bubble: "bg-gray-50 border-gray-200",
        };
      }
      return {
        title: "Pending",
        subtitle: "Not acted yet",
        icon: <FiClock className="text-amber-600" />,
        bubble: "bg-amber-50 border-amber-100",
      };
    }

    if (isApprove) {
      return {
        title: "Ready to approve",
        subtitle: "Add your comment & attachment then submit",
        icon: <FiCheckCircle className="text-green-600" />,
        bubble: "bg-green-50 border-green-100",
      };
    }

    return {
      title: "Ready to reject",
      subtitle: "Add your comment & attachment then submit",
      icon: <FiXCircle className="text-red-600" />,
      bubble: "bg-red-50 border-red-100",
    };
  }, [isView, localStatus, isApprove]);

  // ✅ يطلب Presigned من route ويرفع على S3 ويرجع meta
  const uploadToS3IfNeeded = async () => {
    if (!(attachment instanceof File)) return null;
  
    if (!companyKey || !requestId || stepIndex === null || stepIndex === undefined) {
      throw new Error("Missing companyKey/requestId/stepIndex");
    }
  
    const fd = new FormData();
    fd.append("file", attachment);
  
    const res = await fetch(
      `/api/workflow/workflow_attach?company=${encodeURIComponent(companyKey)}&requestId=${encodeURIComponent(
        requestId
      )}&stepIndex=${encodeURIComponent(String(stepIndex))}`,
      {
        method: "POST",
        body: fd,
        credentials: "include",
      }
    );
  
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "Upload failed");
    }
  
    // الراوت الجديد يرجع: { success: true, tagUrl: signedUrl }
    // فـ نخلي الـ attachmentMeta هو الرابط حتى تبعثه للـ PUT إذا تحتاج
    return { url: data.tagUrl };
  };
  const handleSubmit = async () => {
    if (!onSubmit) return;

    setSubmitting(true);
    try {
      const attachmentMeta = await uploadToS3IfNeeded();
      const result = await onSubmit({ attachmentMeta });

      const nextStatus =
        typeof result === "string"
          ? result
          : result?.stepStatus || (isApprove ? "Approved" : "Rejected");

      setLocalStatus(nextStatus);
      setLocalMode("view");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // ✅ View mode: نخليها تشتغل سواء string أو object
  const attachmentUrl =
  (typeof attachment === "string"
    ? attachment
    : attachment?.url) ||
  tagUrl ||
  "";

  const attachmentName =
    typeof attachment === "string"
      ? ""
      : attachment?.name || "";

  const isImageView = (() => {
    if (!attachmentUrl) return false;
    if (typeof attachment !== "string" && attachment?.type?.startsWith("image/")) return true;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentUrl);
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!disableAll) onClose?.();
        }}
      />

      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-b from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <FiMessageSquare className="text-blue-600 text-lg" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">Step Review</p>
                <p className="text-xs text-gray-500">
                  {isView ? "View details" : "Write comment & attach a file"}
                </p>
              </div>
            </div>

            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 ${statusUI.cls}`}>
              {statusUI.label}
              {isApprove && !isView && <FiCheckCircle />}
              {isReject && !isView && <FiXCircle />}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className={`mb-4 flex items-center gap-3 rounded-2xl border p-3 ${topInfo.bubble}`}>
            <div className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center">
              {topInfo.icon}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-gray-900">{topInfo.title}</p>
              <p className="text-xs text-gray-600">{topInfo.subtitle}</p>
            </div>
          </div>

          <div className="border rounded-3xl bg-gray-50 p-4">
            {/* Comment */}
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">Comment</p>

              {isView ? (
                <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white border rounded-2xl p-3">
                  {value || "لا يوجد تعليق"}
                </p>
              ) : (
                <textarea
                  rows={4}
                  value={value}
                  disabled={disableAll}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="اكتب الكومنت هنا..."
                  className="w-full bg-white border rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
              )}
            </div>

        {/* Attachment */}
<div>
  <p className="text-xs text-gray-500 mb-2 flex items-center gap-2">
    <FiPaperclip /> Attachment
  </p>

  {/* ✅ VIEW */}
  {isView ? (
    (() => {
      const url = attachmentUrl || ""; // ✅ هذا أصلاً ياخذ tagUrl كـ fallback
const isImg = /(\.jpg|\.jpeg|\.png|\.gif|\.webp)(\?|$)/i.test(url);
      if (!url) {
        return (
          <div className="bg-white border border-dashed rounded-2xl p-4 text-sm text-gray-400">
            لا يوجد ملف مرفق
          </div>
        );
      }

      return isImg ? (
        <img
          src={url}
          alt={attachmentName || `attachment-step-${stepIndex}`}
          className="max-h-56 w-full object-contain rounded-2xl border bg-white"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open attached file <FiExternalLink />
        </a>
      );
    })()
  ) : (
    /* ✅ EDIT: نفس كودك الحالي */
    <>
      {!attachment ? (
        <label
          className={`block cursor-pointer group ${
            disableAll ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            hidden
            onChange={(e) => onAttachmentChange?.(e.target.files?.[0] || null)}
          />

          <div className="bg-white border border-dashed rounded-2xl p-4 flex items-center justify-between gap-3 transition-all group-hover:border-blue-400 group-hover:bg-blue-50/50 group-hover:shadow-sm">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Add attachment</p>
              <p className="text-xs text-gray-500">
                اضغط هنا أو اختار ملف (صورة / PDF / Word)
              </p>
            </div>

            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md transition group-hover:bg-blue-700 group-hover:scale-[1.03]">
              <FiPlus className="text-2xl" />
            </div>
          </div>
        </label>
      ) : (
        <div className="bg-white border rounded-2xl p-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border flex items-center justify-center">
              {attachment?.type?.startsWith("image/") ? (
                <FiImage className="text-gray-700" />
              ) : (
                <FiFileText className="text-gray-700" />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {attachment.name}
              </p>
              <p className="text-xs text-gray-500">
                {Math.ceil(attachment.size / 1024)} KB
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={disableAll}
            onClick={(e) => {
              e.stopPropagation();
              onAttachmentChange?.(null);
            }}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border hover:bg-gray-100 text-gray-700 disabled:opacity-60"
          >
            <FiTrash2 /> Remove
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Preview</p>
          <img
            src={previewUrl}
            alt="preview"
            className="max-h-56 w-full object-contain rounded-2xl border bg-white"
          />
        </div>
      )}
    </>
  )}
</div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              disabled={disableAll}
              onClick={() => onClose?.()}
              className="px-4 py-2 rounded-2xl border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Close
            </button>

            {!isView && (
              <button
                disabled={disableAll}
                onClick={handleSubmit}
                className={`px-4 py-2 rounded-2xl text-white font-semibold shadow-sm disabled:opacity-60 ${
                  isApprove ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitting || loading ? "Sending..." : "Submit"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}