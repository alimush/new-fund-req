"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCreditCard, FiExternalLink, FiUploadCloud } from "react-icons/fi";
import { attachmentOpenHref } from "@/lib/s3/browserOpenAttachment";
import { normalizePersonName } from "@/lib/voucher/normalizePersonName";
import { uploadPersonIdentityFiles } from "@/lib/voucher/uploadPersonIdentityClient";

export default function VoucherPersonIdentityPanel({
  personName = "",
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const normalizedName = normalizePersonName(personName);

  const fetchIdentity = useCallback(async (name) => {
    const trimmed = normalizePersonName(name);
    if (trimmed.length < 2) {
      setAttachments([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ name: trimmed });
      const res = await fetch(`/api/vouchers/person-identity?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();

      if (json?.success && Array.isArray(json.data?.attachments)) {
        setAttachments(json.data.attachments);
      } else if (json?.success && json.data?.attachment) {
        setAttachments([json.data.attachment]);
      } else {
        setAttachments([]);
      }
    } catch (err) {
      console.error("identity fetch error:", err);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIdentity(normalizedName);
    }, 300);

    return () => clearTimeout(timer);
  }, [normalizedName, fetchIdentity]);

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    setUploading(true);
    try {
      const saved = await uploadPersonIdentityFiles({
        personName: normalizedName,
        files,
      });
      setAttachments(Array.isArray(saved?.attachments) ? saved.attachments : []);
    } catch (err) {
      console.error("identity upload error:", err);
      alert(err.message || "فشل رفع الهوية");
    } finally {
      setUploading(false);
    }
  };

  const hasName = normalizedName.length >= 2;
  const hasAttachments = attachments.length > 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-50/80 to-white/90 ring-1 ring-violet-100 p-3.5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-gray-900 font-extrabold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <FiCreditCard size={15} />
          </span>
          الهوية
        </div>
        {loading ? (
          <span className="text-[11px] font-bold text-slate-400">...</span>
        ) : hasAttachments ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
            {attachments.length} مرفق
          </span>
        ) : hasName ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
            غير مرفوعة
          </span>
        ) : null}
      </div>

      <p className="text-[11px] text-slate-600 mb-3 leading-5">
        مرتبطة بحقل «استلمت من» — يمكن اختيار أكثر من ملف
      </p>

      {hasName ? (
        <p className="text-xs font-bold text-slate-700 mb-3 truncate" title={normalizedName}>
          {normalizedName}
        </p>
      ) : (
        <p className="text-xs font-bold text-amber-700 mb-3">
          أدخل «استلمت من» أولاً
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept="image/*,.pdf"
        disabled={disabled || uploading}
        onChange={(e) => {
          if (e.target.files?.length) handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col gap-2">
        {!disabled ? (
          <button
            type="button"
            disabled={uploading || !hasName}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <FiUploadCloud />
            {uploading
              ? "جاري الرفع..."
              : hasAttachments
              ? "إضافة مرفقات"
              : "رفع الهوية"}
          </button>
        ) : null}

        {hasAttachments ? (
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {attachments.map((att, idx) => (
              <a
                key={`${att.key || att.url || att.name}-${idx}`}
                href={attachmentOpenHref(att)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
              >
                <FiExternalLink className="shrink-0" />
                <span className="truncate">{att.name || `مرفق ${idx + 1}`}</span>
              </a>
            ))}
          </div>
        ) : hasName && !loading ? (
          <span className="text-xs text-slate-400">لا توجد مرفقات محفوظة</span>
        ) : null}
      </div>
    </div>
  );
}
