"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUploadCloud,
  FiPaperclip,
  FiExternalLink,
  FiTrash2,
  FiX,
  FiCheckCircle,
  FiFileText,
  FiImage,
} from "react-icons/fi";

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

  const isImg = t.startsWith("image/") || isImageUrl(url);
  const isPdf = t === "application/pdf" || n.endsWith(".pdf");
  const isWord = t.includes("word") || n.endsWith(".doc") || n.endsWith(".docx");
  const isExcel =
    t.includes("sheet") ||
    t.includes("excel") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsx") ||
    n.endsWith(".csv");

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

export default function VoucherAttachModal({
  open,
  onClose,
  companyKey,
  requestId,
  stepIndex,
  title = "وصل صرف",
  onSaved,
}) {
  const inputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setSaving(false);
    }
  }, [open]);

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

  const openSelectedFile = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const uploadOneToS3 = async (pickedFile) => {
    const presignRes = await fetch("/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: pickedFile.name,
        fileType: pickedFile.type,
        prefix: "workflow/vouchers",
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

  const handleSave = async () => {
    if (!files.length) {
      alert("اختر ملف واحد على الأقل");
      return;
    }

    setSaving(true);
    try {
      const uploadedAttachments = await Promise.all(files.map((f) => uploadOneToS3(f)));

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
        throw new Error(attachData?.error || "Failed to save voucher attachments");
      }

      await onSaved?.(attachData);
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر رفع وحفظ الوصل");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/35 backdrop-blur-md"
          onClick={() => {
            if (!saving) onClose?.();
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
          <div className="relative p-5 border-b border-white/20 bg-white/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-white/55 border border-white/25 flex items-center justify-center">
                  <FiPaperclip className="text-slate-900 text-lg" />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900 truncate">
                    رفق الوصل
                  </p>
                  <p className="text-xs text-slate-600/80">
                    {title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => !saving && onClose?.()}
                className="w-10 h-10 rounded-2xl bg-white/50 border border-white/25 flex items-center justify-center text-slate-900 hover:bg-white/70"
              >
                <FiX />
              </button>
            </div>
          </div>

          <div className="relative p-5">
            <div className="rounded-3xl border border-white/20 bg-white/25 backdrop-blur-xl p-4">
              <p className="text-xs text-slate-600/80 mb-2 font-bold flex items-center gap-2">
                <FiPaperclip /> Attachment
              </p>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (saving) return;
                  onPickFiles(e.dataTransfer?.files);
                }}
                className={`
                  rounded-3xl border border-dashed border-white/35
                  bg-white/30 backdrop-blur-xl p-4 transition
                  ${saving ? "opacity-60 pointer-events-none" : "hover:bg-white/40"}
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
                      {files.length > 0 ? "إضافة مرفقات أخرى" : "ارفع الوصل"}
                    </p>
                    <p className="text-xs text-slate-600/80 mt-1">
                      اسحب الملفات هنا أو اضغط Choose
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
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
                <div className="mt-3 flex flex-col gap-2">
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
                              <p className="text-xs text-slate-600/80 mt-1">
                                {fmtSize(file.size)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openSelectedFile(file)}
                              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800"
                            >
                              <FiExternalLink /> Open
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setFiles((prev) => prev.filter((_, i) => i !== index))
                              }
                              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-2xl border border-white/25 bg-white/35 hover:bg-white/45 text-slate-900 font-bold"
                            >
                              <FiTrash2 /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                disabled={saving}
                onClick={() => onClose?.()}
                className="px-4 py-2 rounded-2xl border border-white/25 bg-white/30 text-slate-900 font-extrabold hover:bg-white/40 disabled:opacity-60"
              >
                Close
              </button>

              <button
                disabled={saving || files.length === 0}
                onClick={handleSave}
                className="px-4 py-2 rounded-2xl text-white font-extrabold bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-60"
              >
                {saving ? "Uploading..." : "رفع وحفظ"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}