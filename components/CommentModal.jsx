"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCheckCircle,
  FiXCircle,
  FiMessageSquare,
  FiPaperclip,
  FiExternalLink,
  FiTrash2,
  FiFileText,
  FiImage,
  FiClock,
  FiSlash,
  FiUploadCloud,
} from "react-icons/fi";

/* ======================= helpers ======================= */
const isImageUrl = (u) => /(\.jpg|\.jpeg|\.png|\.gif|\.webp)(\?|$)/i.test(u || "");

const fmtSize = (bytes) => {
  const n = Number(bytes || 0);
  if (!n) return "";
  const kb = n / 1024;
  if (kb < 1024) return `${Math.ceil(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getFileKind = ({ url = "", type = "", name = "" } = {}) => {
  const n = (name || "").toLowerCase();
  const t = (type || "").toLowerCase();
  const u = (url || "").toLowerCase();

  const isImg = t.startsWith("image/") || isImageUrl(url);
  const isPdf = t === "application/pdf" || n.endsWith(".pdf") || u.includes(".pdf");
  const isWord =
    t.includes("word") || n.endsWith(".doc") || n.endsWith(".docx") || u.includes(".doc");
  const isExcel =
    t.includes("sheet") ||
    t.includes("excel") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsx") ||
    n.endsWith(".csv") ||
    u.includes(".xls") ||
    u.includes(".xlsx") ||
    u.includes(".csv");

  if (isImg) return "image";
  if (isPdf) return "pdf";
  if (isWord) return "word";
  if (isExcel) return "excel";
  return "file";
};

const kindLabel = (k) => {
  if (k === "image") return "Image";
  if (k === "pdf") return "PDF";
  if (k === "word") return "Word";
  if (k === "excel") return "Excel";
  return "File";
};

const kindIcon = (k) => {
  if (k === "image") return <FiImage className="text-slate-900/80" />;
  return <FiFileText className="text-slate-900/80" />;
};

/* ======================= component ======================= */
export default function CommentModal({
  open,
  action,
  value,
  onChange,
  onClose,
  onSubmit,
  loading,
  stepStatus,
  attachment,   // fallback single attachment object or string
  attachments,  // preferred array for multi attachments
  tagUrl,       // fallback url string
  companyKey,
  requestId,
  stepIndex,
}) {
  const [mode, setMode] = useState(action); // approve | reject | view
  const [localStatus, setLocalStatus] = useState(stepStatus || "Pending");
  const [submitting, setSubmitting] = useState(false);

  const [files, setFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [localComment, setLocalComment] = useState("");

  const inputRef = useRef(null);

  const isView = mode === "view";
  const isApprove = mode === "approve";
  const isReject = mode === "reject";
  const isEditComment = mode === "edit_comment";
  const disableAll = submitting || loading;

  /* ======================= INIT ON OPEN ======================= */
  useEffect(() => {
    if (!open) return;

    setMode(action);
    setLocalStatus(stepStatus || "Pending");
    setSubmitting(false);
    setFiles([]);
    setLocalComment(value || "");

    const attArray = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

    if (attArray.length > 0) {
      setUploadedFiles(attArray);
      return;
    }

    const attObj =
      attachment && typeof attachment === "object" && !(attachment instanceof File)
        ? attachment
        : null;

    const attUrl = typeof attachment === "string" ? attachment : attObj?.url || "";
    const finalUrl = (attUrl || tagUrl || "").trim();

    if (finalUrl) {
      setUploadedFiles([
        {
          url: finalUrl,
          name: attObj?.name || "",
          type: attObj?.type || "",
          size: Number(attObj?.size || 0),
        },
      ]);
    } else {
      setUploadedFiles([]);
    }
  }, [open, action, stepStatus, attachment, attachments, tagUrl]);

  /* ======================= UI BITS ======================= */
  const statusUI = useMemo(() => {
    if (isView) {
      return {
        label: "VIEW",
        cls: "bg-white/40 text-slate-900 border-white/25",
      };
    }

    if (isEditComment) {
      return {
        label: "EDIT",
        cls: "bg-indigo-500/15 text-indigo-900 border-indigo-500/20",
      };
    }

    if (isApprove) {
      return {
        label: "APPROVE",
        cls: "bg-green-500/15 text-green-900 border-green-500/20",
      };
    }

    return {
      label: "REJECT",
      cls: "bg-red-500/15 text-red-900 border-red-500/20",
    };
  }, [isView, isApprove, isEditComment]);

  const topInfo = useMemo(() => {
    if (isView) {
      if (localStatus === "Approved") {
        return {
          title: "موافق",
          subtitle: "هذه الخطوة تم الموافقة عليها",
          icon: <FiCheckCircle className="text-green-600" />,
          bubble: "bg-green-500/10 border-green-500/15",
        };
      }

      if (localStatus === "Rejected") {
        return {
          title: "مرفوض",
          subtitle: "هذه الخطوة تم رفضها",
          icon: <FiXCircle className="text-red-600" />,
          bubble: "bg-red-500/10 border-red-500/15",
        };
      }

      if (localStatus === "Cancelled") {
        return {
          title: "ملغي",
          subtitle: "هذه الخطوة تم إلغاؤها",
          icon: <FiSlash className="text-slate-700" />,
          bubble: "bg-slate-500/10 border-slate-500/15",
        };
      }

      return {
        title: "قيد الانتظار",
        subtitle: "هذه الخطوة لم يتم اتخاذ إجراء عليها بعد",
        icon: <FiClock className="text-amber-600" />,
        bubble: "bg-amber-500/10 border-amber-500/15",
      };
    }

    if (isEditComment) {
      return {
        title: "تعديل التعليق",
        subtitle: "عدّل تعليق الخطوة الأخيرة ثم احفظ",
        icon: <FiMessageSquare className="text-indigo-600" />,
        bubble: "bg-indigo-500/10 border-indigo-500/15",
      };
    }

    if (isApprove) {
      return {
        title: "Ready to approve",
        subtitle: "Add comment & attachment then submit",
        icon: <FiCheckCircle className="text-green-600" />,
        bubble: "bg-green-500/10 border-green-500/15",
      };
    }

    return {
      title: "Ready to reject",
      subtitle: "Add comment & attachment then submit",
      icon: <FiXCircle className="text-red-600" />,
      bubble: "bg-red-500/10 border-red-500/15",
    };
  }, [isView, isApprove, isEditComment, localStatus]);

  /* ======================= UPLOAD HELPERS ======================= */
  const uploadOneToS3 = async (pickedFile) => {
    const presignRes = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: pickedFile.name,
        fileType: pickedFile.type,
        prefix: "workflow/attachments",
      }),
    });

    const presignData = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok || !presignData?.success) {
      throw new Error(presignData?.error || "Failed to get upload URL");
    }

    const uploadRes = await fetch(presignData.url, {
      method: "PUT",
      body: pickedFile,
      headers: {
        "Content-Type": pickedFile.type || "application/octet-stream",
      },
    });

    if (!uploadRes.ok) {
      throw new Error("Failed to upload file to S3");
    }

    return {
      key: presignData.key,
      name: pickedFile.name || "",
      type: pickedFile.type || "",
      size: pickedFile.size || 0,
    };
  };

  const clearStepAttachment = async () => {
    const res = await fetch("/api/workflow/workflow_attach", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        companyKey,
        requestId,
        stepIndex,
        clearTag: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || "Failed to clear attachments");
    }
  };
  const openSelectedFile = (file) => {
    if (!file) return;
  
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
  
    // تنظيف لاحقاً
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  /* ======================= SUBMIT ======================= */
  const handleSubmit = async () => {
    if (!onSubmit) return;

    setSubmitting(true);
    try {
      let uploadedAttachments = [];

      if (files.length > 0) {
        uploadedAttachments = await Promise.all(files.map((f) => uploadOneToS3(f)));
      
        const attachRes = await fetch("/api/workflow/workflow_attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            companyKey,
            requestId,
            stepIndex,
            attachments: uploadedAttachments,
          }),
        });
      
        const attachData = await attachRes.json().catch(() => ({}));
      
        if (!attachRes.ok || !attachData?.success) {
          throw new Error(attachData?.error || "Failed to save attachments");
        }
      
        if (Array.isArray(attachData.tagAttachments)) {
          setUploadedFiles(attachData.tagAttachments);
        }
      }

      const result = await onSubmit({
        attachments: uploadedAttachments,
        comment: value !== undefined ? value : localComment,
      });

      const nextStatus =
        result?.stepStatus ||
        (typeof result === "string" ? result : isApprove ? "Approved" : "Rejected");

      setLocalStatus(nextStatus);
      setMode("view");
      setFiles([]);
    } finally {
      setSubmitting(false);
    }
  };

  /* ======================= PICK FILES ======================= */
  const onPickFiles = (picked) => {
    const arr = Array.from(picked || []);
    if (!arr.length) return;

    const valid = arr.filter((f) => {
      const name = (f.name || "").toLowerCase();
      return (
        f.type?.startsWith("image/") ||
        f.type === "application/pdf" ||
        name.endsWith(".pdf") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx") ||
        name.endsWith(".xls") ||
        name.endsWith(".xlsx") ||
        name.endsWith(".csv")
      );
    });

    if (!valid.length) return;

    setFiles((prev) => {
      const merged = [...prev, ...valid];
      return merged.filter(
        (file, index, self) =>
          index === self.findIndex(
            (f) =>
              f.name === file.name &&
              f.size === file.size &&
              f.lastModified === file.lastModified
          )
      );
    });
  };

  const openFileDialog = () => inputRef.current?.click();

  if (!open) return null;

  const hasUploadedFiles = uploadedFiles.length > 0;

  /* ======================= UI CARDS ======================= */
  const ShellCard = ({ children }) => (
    <div
      className="
        rounded-3xl border border-white/25 bg-white/35 backdrop-blur-2xl
        ring-1 ring-black/5 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.35)]
        overflow-hidden
      "
    >
      {children}
    </div>
  );

  const EmptyAttachmentCard = () => (
    <ShellCard>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/50 border border-white/25 flex items-center justify-center">
            <FiPaperclip className="text-slate-700/70" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900">لا يوجد مرفق</p>
            <p className="text-xs text-slate-600/80 mt-1">لا يوجد ملف مرفوع لهذه الخطوة.</p>
          </div>
        </div>
      </div>
    </ShellCard>
  );

  const SelectedFileCard = () => {
    if (!files.length) return null;
  
    return (
      <ShellCard>
        <div className="p-4 flex flex-col gap-2">
          {files.map((file, index) => {
            const kind = getFileKind({ type: file.type, name: file.name });
  
            return (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="rounded-2xl border border-white/25 bg-white/25 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-white/50 border border-white/25 flex items-center justify-center shrink-0">
                      {kindIcon(kind)}
                    </div>
  
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-slate-900 truncate">
                          {file.name}
                        </p>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white/50 border border-white/25 text-slate-700 font-bold">
                          {kindLabel(kind)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600/80 mt-1">{fmtSize(file.size)}</p>
                    </div>
                  </div>
  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={disableAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        openSelectedFile(file);
                      }}
                      className="
                        inline-flex items-center gap-2 text-xs px-3 py-2 rounded-2xl
                        bg-slate-900 text-white font-bold hover:bg-slate-800
                        disabled:opacity-60
                      "
                    >
                      <FiExternalLink /> Open
                    </button>
  
                    <button
                      type="button"
                      disabled={disableAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles((prev) => prev.filter((_, i) => i !== index));
                      }}
                      className="
                        inline-flex items-center gap-2 text-xs px-3 py-2 rounded-2xl
                        border border-white/25 bg-white/35 hover:bg-white/45
                        text-slate-900 font-bold disabled:opacity-60
                      "
                    >
                      <FiTrash2 /> Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ShellCard>
    );
  };
  const UploadedAttachmentCard = () => {
    if (!uploadedFiles.length) return <EmptyAttachmentCard />;

    return (
      <ShellCard>
        <div className="p-4 flex flex-col gap-2">
          {uploadedFiles.map((file, index) => {
            const name = file?.name?.trim() || `attachment-step-${stepIndex ?? ""}-${index + 1}`;
            const kind = getFileKind({
              url: file?.url,
              type: file?.type,
              name,
            });

            const fileUrl = file?.url || "";

            return (
              <div
                key={`${file?.key || file?.url || name}-${index}`}
                className="rounded-2xl border border-white/25 bg-white/25 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-white/50 border border-white/25 flex items-center justify-center shrink-0">
                      {kindIcon(kind)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-extrabold text-slate-900 truncate">{name}</p>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-white/50 border border-white/25 text-slate-700 font-bold">
                          {kindLabel(kind)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-600/80 flex-wrap">
                        {!!file?.size && <span>{fmtSize(file.size)}</span>}
                        {!!file?.type && <span className="opacity-70">•</span>}
                        {!!file?.type && <span className="truncate">{file.type}</span>}
                      </div>
                    </div>
                  </div>

                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-2xl
                      bg-slate-900 text-white font-bold text-xs
                      hover:bg-slate-800
                    "
                    onClick={(e) => e.stopPropagation()}
                    title="Open attachment"
                  >
                    فتح <FiExternalLink />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </ShellCard>
    );
  };

  /* ======================= RENDER ======================= */
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/35 backdrop-blur-md"
          onClick={() => {
            if (!disableAll) onClose?.();
          }}
        />

        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="
            relative w-full max-w-xl overflow-hidden rounded-[28px]
            border border-white/25 bg-white/45 backdrop-blur-2xl
            shadow-[0_30px_70px_-40px_rgba(0,0,0,0.7)]
          "
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent opacity-80" />

          <div className="relative p-5 border-b border-white/20 bg-white/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-white/55 border border-white/25 flex items-center justify-center">
                  <FiMessageSquare className="text-slate-900 text-lg" />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900 truncate">Step Review</p>
                  <p className="text-xs text-slate-600/80">
                    {isView ? "View details" : "Write comment & attach file(s)"}
                  </p>
                </div>
              </div>

              <div
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-extrabold flex items-center gap-2 border ${statusUI.cls}`}
              >
                {statusUI.label}
                {isApprove && !isView && <FiCheckCircle />}
                {isReject && !isView && <FiXCircle />}
              </div>
            </div>
          </div>

          <div className="relative p-5">
            <div
              className={`
                mb-4 flex items-center gap-3 rounded-3xl border border-white/20
                p-3 bg-white/30 backdrop-blur-xl ${topInfo.bubble}
              `}
            >
              <div className="w-10 h-10 rounded-2xl bg-white/55 border border-white/25 flex items-center justify-center">
                {topInfo.icon}
              </div>

              <div className="leading-tight">
                <p className="text-sm font-extrabold text-slate-900">{topInfo.title}</p>
                <p className="text-xs text-slate-600/80 mt-0.5">{topInfo.subtitle}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/25 backdrop-blur-xl p-4">
              <div className="mb-4">
                <p className="text-xs text-slate-600/80 mb-2 font-bold">تعليق</p>

                {isView ? (
                  <div className="text-sm text-slate-900 whitespace-pre-wrap bg-white/35 border border-white/25 rounded-3xl p-3">
                    {value || "لا يوجد تعليق"}
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    value={value !== undefined ? value : localComment}
                    disabled={disableAll}
                    onChange={(e) => {
                      if (onChange) onChange(e.target.value);
                      else setLocalComment(e.target.value);
                    }}
                    placeholder="اكتب الكومنت هنا..."
                    className="
                      w-full bg-white/35 border border-white/25 rounded-3xl p-3
                      text-sm text-slate-900 placeholder:text-slate-600/70
                      focus:outline-none focus:ring-2 focus:ring-slate-900/30
                      disabled:opacity-60
                    "
                  />
                )}
              </div>

              <div>
                <p className="text-xs text-slate-600/80 mb-2 font-bold flex items-center gap-2">
                  <FiPaperclip /> Attachment
                </p>

                {isView || isEditComment ? (
                  <UploadedAttachmentCard />
                ) : (
                  <>
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (disableAll) return;
                        onPickFiles(e.dataTransfer?.files);
                      }}
                      className={`
                        rounded-3xl border border-dashed border-white/35
                        bg-white/30 backdrop-blur-xl p-4 transition
                        ${disableAll ? "opacity-60 pointer-events-none" : "hover:bg-white/40"}
                      `}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        hidden
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                        onChange={(e) => {
                          onPickFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-slate-900">
                            {files.length > 0 ? "إضافة مرفقات أخرى" : "ارفع مرفقات"}
                          </p>
                          <p className="text-xs text-slate-600/80 mt-1">
                            اسحب الملفات هنا أو اضغط زر (صورة / PDF / Word / Excel)
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={openFileDialog}
                          className="
                            shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-2xl
                            bg-slate-900 text-white font-extrabold text-xs
                            hover:bg-slate-800
                          "
                        >
                          <FiUploadCloud /> {files.length > 0 ? "Add more" : "Choose"}
                        </button>
                      </div>
                    </div>

                    {files.length > 0 && (
                      <div className="mt-3">
                        <SelectedFileCard />
                      </div>
                    )}

                    {hasUploadedFiles && (
                      <div className="mt-3">
                        <p className="text-[11px] text-slate-600/70 font-bold mb-2">
                          المرفقات الحالية (قبل التعديل)
                        </p>
                        <UploadedAttachmentCard />
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
                className="
                  px-4 py-2 rounded-2xl border border-white/25 bg-white/30
                  text-slate-900 font-extrabold hover:bg-white/40 disabled:opacity-60
                "
              >
                Close
              </button>

              {!isView && (
                <button
                  disabled={disableAll}
                  onClick={handleSubmit}
                  className={`
                    inline-flex items-center justify-center gap-2 min-w-[120px]
                    px-4 py-2 rounded-2xl text-white font-extrabold
                    shadow-sm disabled:opacity-60 disabled:cursor-not-allowed
                    ${
                      isEditComment
                        ? "bg-indigo-600 hover:bg-indigo-700"
                        : isApprove
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }
                  `}
                >
                  {submitting || loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {isEditComment
                        ? "جاري الحفظ..."
                        : isApprove
                        ? "جاري الموافقة..."
                        : "جاري الرفض..."}
                    </>
                  ) : isEditComment ? (
                    "حفظ التعليق"
                  ) : isApprove ? (
                    "موافقة"
                  ) : (
                    "رفض"
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}