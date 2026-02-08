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

  attachment, // {url,name,type,size} | string url | null
  tagUrl,     // url string

  companyKey,
  requestId,
  stepIndex,
}) {
  const [mode, setMode] = useState(action); // approve | reject | view
  const [localStatus, setLocalStatus] = useState(stepStatus || "Pending");
  const [submitting, setSubmitting] = useState(false);

  // attachments
  const [file, setFile] = useState(null); // File selected
  const [uploadedMeta, setUploadedMeta] = useState(null); // {url,name,type,size}
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  const inputRef = useRef(null);

  const isView = mode === "view";
  const isApprove = mode === "approve";
  const isReject = mode === "reject";
  const disableAll = submitting || loading;

  // ---------- INIT ON OPEN (sync props -> local state) ----------
  useEffect(() => {
    if (!open) return;

    setMode(action);
    setLocalStatus(stepStatus || "Pending");
    setSubmitting(false);

    // reset edit stuff
    setFile(null);
    setPreviewUrl(null);
    setImgFailed(false);

    // sync attachment for view
    const attObj =
      attachment && typeof attachment === "object" && !(attachment instanceof File)
        ? attachment
        : null;

    const attUrl = typeof attachment === "string" ? attachment : attObj?.url || "";
    const finalUrl = (attUrl || tagUrl || "").trim();

    if (finalUrl) {
      setUploadedMeta({
        url: finalUrl,
        name: attObj?.name || "",
        type: attObj?.type || "",
        size: Number(attObj?.size || 0),
      });
    } else {
      setUploadedMeta(null);
    }
  }, [open, action, stepStatus, tagUrl, attachment]);

  // ---------- PREVIEW FOR SELECTED FILE ----------
  useEffect(() => {
    if (!open) return;

    if (!file || isView) {
      setPreviewUrl(null);
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, file, isView]);

  // ---------- UI BITS ----------
  const statusUI = useMemo(() => {
    if (isView)
      return {
        label: "VIEW",
        cls: "bg-white/40 text-slate-900 border-white/25",
      };
    if (isApprove)
      return {
        label: "APPROVE",
        cls: "bg-green-500/15 text-green-900 border-green-500/20",
      };
    return {
      label: "REJECT",
      cls: "bg-red-500/15 text-red-900 border-red-500/20",
    };
  }, [isView, isApprove]);

  const topInfo = useMemo(() => {
    if (isView) {
      if (localStatus === "Approved")
        return {
          title: "موافق",
          subtitle: " هذه الخطوة تم الموافقة عليها",
          icon: <FiCheckCircle className="text-green-600" />,
          bubble: "bg-green-500/10 border-green-500/15",
        };
      if (localStatus === "Rejected")
        return {
          title: "مرفوض",
          subtitle: " هذه الخطوة تم رفضها",
          icon: <FiXCircle className="text-red-600" />,
          bubble: "bg-red-500/10 border-red-500/15",
        };
      if (localStatus === "Cancelled")
        return {
          title: " ملغي",
          subtitle: " هذه الخطوة تم إلغاؤها",
          icon: <FiSlash className="text-slate-700" />,
          bubble: "bg-slate-500/10 border-slate-500/15",
        };

      return {
        title: " قيد الانتظار",
        subtitle: " هذه الخطوة لم يتم اتخاذ إجراء عليها بعد",
        icon: <FiClock className="text-amber-600" />,
        bubble: "bg-amber-500/10 border-amber-500/15",
      };
    }

    if (isApprove)
      return {
        title: "Ready to approve",
        subtitle: "Add comment & attachment then submit",
        icon: <FiCheckCircle className="text-green-600" />,
        bubble: "bg-green-500/10 border-green-500/15",
      };

    return {
      title: "Ready to reject",
      subtitle: "Add comment & attachment then submit",
      icon: <FiXCircle className="text-red-600" />,
      bubble: "bg-red-500/10 border-red-500/15",
    };
  }, [isView, isApprove, localStatus]);

  // ---------- Upload ----------
  const uploadToS3 = async (pickedFile) => {
    if (!(pickedFile instanceof File)) return null;

    if (!companyKey || !requestId || stepIndex === null || stepIndex === undefined) {
      throw new Error("Missing companyKey/requestId/stepIndex");
    }

    const fd = new FormData();
    fd.append("file", pickedFile);

    const res = await fetch(
      `/api/workflow/workflow_attach?company=${encodeURIComponent(
        companyKey
      )}&requestId=${encodeURIComponent(requestId)}&stepIndex=${encodeURIComponent(
        String(stepIndex)
      )}`,
      { method: "POST", body: fd, credentials: "include" }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || "Upload failed");

    return {
      url: data.tagUrl,
      name: pickedFile.name || "",
      type: pickedFile.type || "",
      size: pickedFile.size || 0,
    };
  };

  const clearStepAttachment = async () => {
    // عندك route PUT /api/workflow/workflow_attach
    // هذا يمسح Tag/Attachment للستيب
    await fetch("/api/workflow/workflow_attach", {
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
  };

  const handleSubmit = async () => {
    if (!onSubmit) return;

    setSubmitting(true);
    try {
      let meta = null;

      if (file) {
        meta = await uploadToS3(file);
        if (meta?.url) {
          setUploadedMeta(meta);
          setImgFailed(false);
        }
      } else {
        // ماكو ملف — اذا تريد “يمسح القديم” خلّي هذا
        await clearStepAttachment();
        setUploadedMeta(null);
        setImgFailed(false);
      }

      const result = await onSubmit({ attachmentMeta: meta });

      // لا تعتمد على result دائماً
      const nextStatus =
        result?.stepStatus ||
        (typeof result === "string" ? result : isApprove ? "Approved" : "Rejected");

      setLocalStatus(nextStatus);
      setMode("view");
      setFile(null);
      setPreviewUrl(null);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Pick file ----------
  const onPickFile = (f) => {
    if (!f) return;

    const name = (f.name || "").toLowerCase();
    const ok =
      f.type?.startsWith("image/") ||
      f.type === "application/pdf" ||
      name.endsWith(".pdf") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx") ||
      name.endsWith(".xls") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".csv");

    if (!ok) return;

    setFile(f);
  };

  const openFileDialog = () => inputRef.current?.click();

  if (!open) return null;

  // ---------- Derived for view card ----------
  const viewUrl = uploadedMeta?.url || "";
  const viewName = uploadedMeta?.name || "";
  const viewType = uploadedMeta?.type || "";
  const viewSize = uploadedMeta?.size || 0;

  /* ======================= Cards ======================= */
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
            <p className="text-xs text-slate-600/80 mt-1">ماكو ملف مرفوع لهذه الخطوة.</p>
          </div>
        </div>
      </div>
    </ShellCard>
  );

  const SelectedFileCard = () => {
    if (!file) return null;
    const kind = getFileKind({ type: file.type, name: file.name });
    const isImg = kind === "image";

    return (
      <ShellCard>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/50 border border-white/25 flex items-center justify-center">
                {kindIcon(kind)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{file.name}</p>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/50 border border-white/25 text-slate-700 font-bold">
                    {kindLabel(kind)}
                  </span>
                </div>
                <p className="text-xs text-slate-600/80 mt-1">{fmtSize(file.size)}</p>
              </div>
            </div>

            <button
              type="button"
              disabled={disableAll}
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setPreviewUrl(null);
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

          {isImg && previewUrl && (
            <div className="mt-3">
              <img
                src={previewUrl}
                alt="preview"
                className="max-h-60 w-full object-contain rounded-2xl border border-white/25 bg-white/40"
              />
            </div>
          )}
        </div>
      </ShellCard>
    );
  };

  const UploadedAttachmentCard = () => {
    if (!viewUrl) return <EmptyAttachmentCard />;

    const name = viewName?.trim() || `attachment-step-${stepIndex ?? ""}`;
    const kind = getFileKind({ url: viewUrl, type: viewType, name });
    const canPreviewImage = kind === "image" && !imgFailed;

    return (
      <ShellCard>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/50 border border-white/25 flex items-center justify-center">
                {kindIcon(kind)}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{name}</p>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/50 border border-white/25 text-slate-700 font-bold">
                    {kindLabel(kind)}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600/80">
                  {!!viewSize && <span>{fmtSize(viewSize)}</span>}
                  {!!viewType && <span className="opacity-70">•</span>}
                  {!!viewType && <span className="truncate">{viewType}</span>}
                </div>
              </div>
            </div>

            <a
              href={viewUrl}
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

          {/* Preview */}
          {kind === "image" && (
            <div className="mt-3">
              {canPreviewImage ? (
                <img
                  src={viewUrl}
                  alt={name}
                  onError={() => setImgFailed(true)}
                  className="max-h-60 w-full object-contain rounded-2xl border border-white/25 bg-white/40"
                />
              ) : (
                <div className="rounded-2xl border border-white/25 bg-white/35 p-4">
                  <p className="text-sm font-extrabold text-slate-900">المعاينة غير متاحة</p>
                  <p className="text-xs text-slate-600/80 mt-1">
                    ماكدرنا نعرض الصورة داخل المودال. افتحها من زر (فتح).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Non-image friendly note */}
          {kind !== "image" && (
            <div className="mt-3 rounded-2xl border border-white/25 bg-white/35 p-4">
              <p className="text-xs text-slate-600/90">
                هذا الملف نوعه <b>{kindLabel(kind)}</b>. إذا ما ينفتح هنا، استخدم زر <b>فتح</b>.
              </p>
            </div>
          )}
        </div>
      </ShellCard>
    );
  };

  /* ======================= render ======================= */
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/35 backdrop-blur-md"
          onClick={() => {
            if (!disableAll) onClose?.();
          }}
        />

        {/* Modal */}
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
          {/* Soft glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent opacity-80" />

          {/* Header */}
          <div className="relative p-5 border-b border-white/20 bg-white/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-white/55 border border-white/25 flex items-center justify-center">
                  <FiMessageSquare className="text-slate-900 text-lg" />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900 truncate">Step Review</p>
                  <p className="text-xs text-slate-600/80">
                    {isView ? "View details" : "Write comment & attach a file"}
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

          {/* Body */}
          <div className="relative p-5">
            {/* Top Info */}
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

            {/* Main Card */}
            <div className="rounded-3xl border border-white/20 bg-white/25 backdrop-blur-xl p-4">
              {/* Comment */}
              <div className="mb-4">
                <p className="text-xs text-slate-600/80 mb-2 font-bold">تعليق</p>

                {isView ? (
                  <div className="text-sm text-slate-900 whitespace-pre-wrap bg-white/35 border border-white/25 rounded-3xl p-3">
                    {value || "لا يوجد تعليق"}
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    value={value}
                    disabled={disableAll}
                    onChange={(e) => onChange(e.target.value)}
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

              {/* Attachment */}
              <div>
                <p className="text-xs text-slate-600/80 mb-2 font-bold flex items-center gap-2">
                  <FiPaperclip /> Attachment
                </p>

                {isView ? (
                  <UploadedAttachmentCard />
                ) : (
                  <>
                    {/* Dropzone */}
                    {!file ? (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (disableAll) return;
                          const f = e.dataTransfer?.files?.[0];
                          onPickFile(f);
                        }}
                        className={`
                          rounded-3xl border border-dashed border-white/35
                          bg-white/30 backdrop-blur-xl p-4
                          transition
                          ${disableAll ? "opacity-60 pointer-events-none" : "hover:bg-white/40"}
                        `}
                      >
                        <input
                          ref={inputRef}
                          type="file"
                          hidden
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                          onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                        />

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-slate-900">ارفع مرفق</p>
                            <p className="text-xs text-slate-600/80 mt-1">
                              اسحب الملف هنا أو اضغط زر (صورة / PDF / Word / Excel)
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
                            <FiUploadCloud /> Choose
                          </button>
                        </div>
                      </div>
                    ) : (
                      <SelectedFileCard />
                    )}

                    {/* إذا اكو مرفق قديم وتريد تبينه حتى بالـ edit (اختياري) */}
                    {!!viewUrl && (
                      <div className="mt-3">
                        <p className="text-[11px] text-slate-600/70 font-bold mb-2">
                          المرفق الحالي (قبل التعديل)
                        </p>
                        <UploadedAttachmentCard />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
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
                    px-4 py-2 rounded-2xl text-white font-extrabold
                    shadow-sm disabled:opacity-60
                    ${isApprove ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                  `}
                >
                  {submitting || loading ? "Sending..." : "Submit"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}