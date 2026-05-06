// /app/(...)/ex/[pageKey]/[id]/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import {
  FiArrowLeft,
  FiInfo,
  FiUser,
  FiCalendar,
  FiImage,
  FiPrinter,
  FiX,
  FiUsers,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiSend,
  FiMessageSquare,
  FiPaperclip,
  FiFileText,
  FiDownload,
} from "react-icons/fi";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getExForm } from "@/lib/exForms/registry";
import StatusBadge from "@/components/StatusBadge";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { DEFAULT_EX_BOOKING_COMPANY } from "@/lib/exForms/exCompanies";
const pct = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

function printAllPngs(pngs) {
  if (!pngs?.length) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const imgsHtml = pngs.map((src) => `<div class="page"><img src="${src}" /></div>`).join("");
  const cfg = getExForm(pageKey);
  const hideWorkflow = !!cfg?.hideWorkflow;
  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print</title>
        <style>
          @page { size: A4; margin: 0; }
          html, body { margin:0; padding:0; }
          .page { width: 210mm; height: 297mm; page-break-after: always; }
          img { width: 210mm; height: 297mm; display:block; }
        </style>
      </head>
      <body>
        ${imgsHtml}
        <script>
          const imgs = Array.from(document.images);
          let loaded = 0;
          function done(){
            window.focus();
            window.print();
            setTimeout(()=>window.close(), 50);
          }
          if(!imgs.length){ done(); }
          imgs.forEach(im=>{
            if(im.complete){ loaded++; if(loaded===imgs.length) done(); return; }
            im.onload = ()=>{ loaded++; if(loaded===imgs.length) done(); };
            im.onerror = ()=>{ loaded++; if(loaded===imgs.length) done(); };
          });
        </script>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {}
  }, 2500);
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
      className="p-6 mb-8 rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] overflow-hidden"
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

function CommentModal({
  open,
  title,
  subtitle,
  submitLabel,
  onClose,
  onSubmit,
  loading,
  isOperation = false,
  attachmentFile = null,
  onAttachmentChange,
  uploading = false,
}) {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) setComment("");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 15, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
          >
            {/* HEADER */}
            <div className="p-5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-gray-900">
                <FiMessageSquare className="text-lg" />
                {title}
              </div>

              <button
                onClick={loading ? undefined : onClose}
                className="p-2 rounded-lg hover:bg-gray-100"
                disabled={loading}
              >
                <FiX />
              </button>
            </div>

            {/* BODY */}
            <div className="p-6">
              <div className="text-gray-700 text-sm mb-4 text-center">
                {subtitle || "Are you sure you want to perform this action?"}
              </div>

              <div className="space-y-4">
                {isOperation && (
                  <div className="space-y-3">
                    <div className="text-sm font-bold text-gray-800 text-right">ارفع مرفق الأوبريشن</div>

                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 transition hover:bg-gray-100">
                      <FiPaperclip />
                      <span className="text-sm font-semibold text-gray-700">
                        {attachmentFile ? attachmentFile.name : "اختيار ملف"}
                      </span>

                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => onAttachmentChange?.(e.target.files?.[0] || null)}
                      />
                    </label>

                    {attachmentFile && (
                      <div className="break-all text-center text-xs text-gray-500">{attachmentFile.name}</div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-700 text-right">أضف تعليق (اختياري)</div>
                  <textarea
                    className="w-full rounded-2xl border border-gray-200 p-3 text-sm outline-none transition focus:ring-2 focus:ring-black text-right"
                    rows={3}
                    dir="rtl"
                    placeholder="اكتب تعليقك هنا..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={loading || uploading}
                  />
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={loading ? undefined : onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                onClick={() => onSubmit(comment)}
                disabled={loading || uploading || (isOperation && !attachmentFile)}
                className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 font-bold text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {loading || uploading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent"></span>
                    Processing
                  </>
                ) : (
                  <>
                    <FiSend /> {submitLabel}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const isImageFile = (file) => {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name);
};
const isPdfFile = (file) => {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
};
const fileExt = (name = "") => {
  const s = String(name).toLowerCase();
  const i = s.lastIndexOf(".");
  return i >= 0 ? s.slice(i + 1) : "";
};
const downloadFile = async (file) => {
  if (!file?.url) return;
  const res = await fetch(file.url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name || `file.${fileExt(file.name) || "bin"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
};

export default function ExDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id;
  const { permissions } = usePermissions();

const isOperationUser =
  Array.isArray(permissions) && permissions.includes(PERMISSIONS.OPERATION);

  const pageKey = String(params?.pageKey || "").trim();
  const company =
    String(searchParams.get("company") || "").trim() || DEFAULT_EX_BOOKING_COMPANY;
  const cfg = useMemo(() => getExForm(pageKey), [pageKey]);

  const TEMPLATE_IMG = cfg?.template?.url || cfg?.template?.img || "/fallback-a4.jpg";
  const POS = cfg?.pos || {};
  const FIELDS = Array.isArray(cfg?.fields) ? cfg.fields : [];
  const isAttachmentOnly = pageKey === "attachment-only" || cfg?.key === "attachment-only";

  const [status, setStatus] = useState("loading");
  const [doc, setDoc] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [acting, setActing] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewPngs, setPreviewPngs] = useState([]);
  const [building, setBuilding] = useState(false);

  const [actionModal, setActionModal] = useState({ open: false, action: null, stepIndex: null });
  const [opAttachment, setOpAttachment] = useState(null);
  const [uploadingOpAttachment, setUploadingOpAttachment] = useState(false);

  const pageRef = useRef(null);


  useEffect(() => {
    if (!id || !pageKey) return;
    let alive = true;

    (async () => {
      try {
        setStatus("loading");
        setErrMsg("");

        const res = await fetch(
          `/api/ex/${encodeURIComponent(pageKey)}/${id}?key=${encodeURIComponent(
            pageKey
          )}&company=${encodeURIComponent(company)}`,
          {
          cache: "no-store",
          credentials: "include",
          }
        );

        const j = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok || !j?.success) {
          setDoc(null);
          setWorkflow(null);
          setCurrentUser(null);
          setStatus(res.status === 404 ? "notfound" : "error");
          setErrMsg(j?.error || "Not found");
          return;
        }

        setDoc(j.data);
        setWorkflow(j.workflow ?? j.data?.workflow ?? null);
        setCurrentUser(j.currentUser || null);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setErrMsg(e?.message || "Server error");
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, pageKey, company]);

  const workflowSteps = useMemo(() => (Array.isArray(workflow?.steps) ? workflow.steps : []), [workflow]);

  const buildPngs = async () => {
    const node = pageRef.current;
    if (!node) return [];
    await waitForImages(node);

    const png = await toPng(node, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#ffffff",
    });
    return [png];
  };

  const openPreview = async () => {
    setShowPreview(true);
    setBuilding(true);
    try {
      const pngs = await buildPngs();
      setPreviewPngs(pngs);
    } finally {
      setBuilding(false);
    }
  };

  const doPrint = async () => {
    setBuilding(true);
    try {
      const pngs = await buildPngs();
      printAllPngs(pngs);
    } finally {
      setBuilding(false);
    }
  };

  const getStepFiles = (step) => {
    const files = [];
  
    // مرفقات الستيب
    if (Array.isArray(step?.tagAttachments) && step.tagAttachments.length) {
      files.push(...step.tagAttachments.filter(Boolean));
    }
  
    if (step?.tag && !files.some((f) => f?.url === step.tag)) {
      files.push({
        url: step.tag,
        name: "Step Attachment",
        type: "",
        size: 0,
      });
    }
  
    // مرفقات الطلب الأصلي
    if (Array.isArray(doc?.attachments) && doc.attachments.length) {
      for (const f of doc.attachments) {
        if (!f) continue;
  
        const exists = files.some(
          (x) =>
            (x?.key && f?.key && String(x.key) === String(f.key)) ||
            (x?.url && f?.url && String(x.url) === String(f.url))
        );
  
        if (!exists) {
          files.push({
            key: f?.key || "",
            url: f?.url || "",
            name: f?.name || "Attachment",
            type: f?.type || "",
            size: Number(f?.size || 0),
          });
        }
      }
    }
  
    return files;
  };
 

  const submitAction = async (noteTextRaw) => {
    if (!actionModal?.action || actionModal?.stepIndex == null) return;

    const noteText = typeof noteTextRaw === "string" ? noteTextRaw : "";

    setActing(true);
    try {
      let attachmentMeta = null;

      if (actionModal.action === "operation_submit" && opAttachment) {
        setUploadingOpAttachment(true);
        try {
          const presignRes = await fetch("/api/upload/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: opAttachment.name,
              fileType: opAttachment.type,
              prefix: `ex-operation-${pageKey}`,
            }),
          });

          const presignJson = await presignRes.json();

          if (!presignRes.ok || !presignJson?.url || !presignJson?.key) {
            throw new Error(presignJson?.error || "Failed to get upload URL");
          }

          const uploadRes = await fetch(presignJson.url, {
            method: "PUT",
            body: opAttachment,
            headers: {
              "Content-Type": opAttachment.type || "application/octet-stream",
            },
          });

          if (!uploadRes.ok) {
            throw new Error("Failed to upload operation attachment");
          }

          attachmentMeta = {
            key: presignJson.key,
            url: presignJson.getUrl || "",
            name: opAttachment.name || "",
            type: opAttachment.type || "",
            size: opAttachment.size || 0,
          };
        } finally {
          setUploadingOpAttachment(false);
        }
      }

      const res = await fetch(
        `/api/ex/${encodeURIComponent(pageKey)}/${id}?key=${encodeURIComponent(
          pageKey
        )}&company=${encodeURIComponent(company)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: actionModal.action,
            note: noteText || "",
            stepIndex: actionModal.stepIndex,
            key: pageKey,
            company,
            attachmentMeta,
            clearTag: false,
          }),
        }
      );

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.success) {
        if (res.status === 409) {
          alert("صار تحديث بالمستند، رح نسوي Refresh");
          window.location.reload();
          return;
        }
        alert(j?.error || "Action failed");
        return;
      }

      setDoc(j.data);
      setWorkflow(j.workflow ?? j.data?.workflow ?? null);
      setActionModal({ open: false, action: null, stepIndex: null });
      setOpAttachment(null);
    } catch (e) {
      alert(e?.message || "Submit failed");
    } finally {
      setActing(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-700 bg-transparent">
        <div className="font-black">Document not found</div>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-xl">
          Back
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-700 bg-transparent">
        <div className="font-black">Error</div>
        <div className="text-sm mt-2 text-gray-600">{errMsg || "Server error"}</div>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-xl">
          Back
        </button>
      </div>
    );
  }

  const planStatus = String(doc?.status || "").toLowerCase();

  return (
    <motion.div
      className="min-h-screen bg-transparent p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Offscreen Render Area */}
        <div className="sr-only" aria-hidden="true">
          <div ref={pageRef} className="relative bg-white overflow-hidden" style={{ width: 900, aspectRatio: "210/297" }}>
            <img src={TEMPLATE_IMG} alt="template" className="absolute inset-0 w-full h-full object-contain" draggable={false} />

            <div className="absolute inset-0 text-gray-900">
              {Object.entries(POS || {}).map(([posKey, p]) => {
                if (!p) return null;

                const fieldName = posKey.split("_")[0];
                const f = FIELDS.find((x) => x.name === fieldName);

                const v = doc?.[fieldName];
                if (!v) return null;

                const positions = Array.isArray(p) ? p : [p];
                const text = String(v);

                return positions.map((pos, idx) => (
                  <div
                    key={`${posKey}-${idx}`}
                    className="absolute font-extrabold"
                    style={{
                      ...pct(pos),
                      width: `${pos.width ?? 20}%`,
                      height: pos.height ? `${pos.height}%` : undefined,
                      fontSize: pos.fontSize ?? 16,
                      direction: pos.dir || "rtl",
                      textAlign: pos.align || (pos.dir === "ltr" ? "left" : "right"),
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      paddingLeft: pos.pinLeft ? 6 : 0,
                      paddingRight: pos.pinLeft ? 0 : 6,
                      lineHeight: 1.4,
                    }}
                  >
                    {text}
                  </div>
                ));
              })}
            </div>
          </div>
        </div>

        {/* HEADER */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
          {!isAttachmentOnly && (
  <StatusBadge status={doc?.status || "Pending"} />
)}
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <FiInfo className="text-blue-600" /> {cfg?.title || pageKey} Details
            </h1>

            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-white hover:bg-gray-900 shadow"
            >
              <FiArrowLeft /> Back
            </button>
          </div>

          {planStatus === "pending" && !isAttachmentOnly && !cfg?.hidePrint && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={openPreview}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-60"
                disabled={building}
              >
                <FiImage /> <span className="text-sm font-semibold">Preview</span>
              </button>

              {/* <button
                onClick={doPrint}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black shadow disabled:opacity-60"
                disabled={building}
              >
                <FiPrinter /> <span className="text-sm font-semibold">Print</span>
              </button> */}

              {(building || acting) && <div className="text-sm text-gray-600">جارِ التنفيذ…</div>}
            </div>
          )}
        </div>

        {/* SUMMARY (dynamic) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          <motion.div
            className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
              <FiInfo /> معلومات المستند
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
            <Info label="ID" value={doc?._id} icon={<FiInfo />} />
<Info label="Status" value={doc?.status} icon={<FiInfo />} />
<Info label="Created By" value={doc?.createdBy} icon={<FiUser />} />
<Info
  label="Created At"
  value={doc?.createdAt ? new Date(doc.createdAt).toLocaleString() : "-"}
  icon={<FiCalendar />}
/>
            </div>
          </motion.div>

          <motion.div
  className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"
  initial={{ opacity: 0, y: 30 }}
  animate={{ opacity: 1, y: 0 }}
>
  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-700">
    <FiPaperclip /> {isAttachmentOnly ? "الاتاج" : "الحقول"}
  </h2>

  {isAttachmentOnly ? (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Info label="اسم الزبون" value={doc?.customerName} icon={<FiUser />} />
      <Info label="رقم الوحدة" value={doc?.unitNo} icon={<FiInfo />} />
    </div>
      {Array.isArray(doc?.attachments) && doc.attachments.length > 0 ? (
        doc.attachments.map((file, idx) => {
          const img = isImageFile(file);
          const pdf = isPdfFile(file);

          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/60 ring-1 ring-black/5"
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center text-gray-700 ring-1 ring-black/10">
                  {img ? <FiImage /> : <FiFileText />}
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-gray-800 truncate">
                    {file?.name || `Attachment ${idx + 1}`}
                  </div>
                  <div className="text-xs text-gray-500">
                    {pdf ? "PDF" : img ? "Image" : fileExt(file?.name) || "FILE"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={file?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!file?.url) e.preventDefault();
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black"
                >
                  Open
                </a>

                <button
                  type="button"
                  onClick={() => downloadFile(file)}
                  disabled={!file?.url}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  <FiDownload /> Download
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-sm text-gray-500 text-center py-6">
          لا توجد مرفقات
        </div>
      )}
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 text-sm text-gray-700">
      {FIELDS.map((f) => (
        <Info
          key={f.name}
          label={f.label || f.name}
          value={doc?.[f.name]}
          icon={<FiInfo />}
        />
      ))}
    </div>
  )}
</motion.div>
        </div>


        {/* {Array.isArray(doc?.attachments) && doc.attachments.length > 0 && (
          <Section title="Attachments" icon={<FiPaperclip />}>
            <div className="flex flex-wrap gap-6">
              {doc.attachments.map((file, idx) => {
                const img = isImageFile(file);
                const pdf = isPdfFile(file);

                return (
                  <div key={idx} className="group w-40">
                    <a
                      href={file.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      onClick={(e) => {
                        if (!file?.url) e.preventDefault();
                      }}
                    >
                      <div className="w-40 h-40 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm transition-transform group-hover:scale-[1.03] group-hover:shadow-lg flex items-center justify-center">
                        {img && file?.url ? (
                          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-gray-600">
                            <FiFileText className="text-3xl" />
                            <div className="mt-2 text-[11px] font-bold uppercase opacity-70">
                              {pdf ? "PDF" : fileExt(file?.name) || "FILE"}
                            </div>
                          </div>
                        )}
                      </div>
                    </a>

                    <p className="mt-2 text-[13px] text-center text-gray-800 font-semibold truncate group-hover:text-blue-600">
                      {file?.name || "Attachment"}
                    </p>

                    <div className="mt-2 flex items-center justify-center gap-2">
                      <a
                        href={file.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black"
                        onClick={(e) => {
                          if (!file?.url) e.preventDefault();
                        }}
                      >
                        Open
                      </a>

                      <button
                        type="button"
                        onClick={() => downloadFile(file)}
                        disabled={!file?.url}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5"
                      >
                        <FiDownload /> Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )} */}

        {/* WORKFLOW (same logic) */}
        {workflow && (
  <Section title={`Workflow: ${workflow?.name || ""}`} icon={<FiUsers />}>
    {workflowSteps.length === 0 && (
      <p className="text-gray-500 italic text-center py-6">No workflow steps found.</p>
    )}

    {workflowSteps.length > 0 && (
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white/60 to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white/60 to-transparent z-10" />

        <div className="flex items-start gap-6 overflow-x-auto py-6 px-1">
          {workflowSteps.map((step, idx) => {
            const stepFiles = getStepFiles(step);
            const planStatus = String(doc?.status || "").toLowerCase();
            const stepStatus = String(step?.status || "Pending");
            const stepStatusLower = stepStatus.toLowerCase();

            const isCurrent = idx === Number(doc?.currentStep);
            const isCancelled = planStatus === "cancelled" || planStatus === "canceled";

            const canAct =
  planStatus === "pending" &&
  isCurrent &&
  stepStatusLower === "pending" &&
  currentUser &&
  step?.users?.some((u) => String(u?._id) === String(currentUser?._id));

  const canViewAttachments =
  isCurrent &&
  stepStatusLower === "pending" &&
  currentUser &&
  step?.users?.some((u) => String(u?._id) === String(currentUser?._id));

            const hasComment = !!(step?.comment && String(step.comment).trim());
            const hasAttach =
              (Array.isArray(step?.tagAttachments) && step.tagAttachments.length > 0) || !!step?.tag;

            const actedName =
              step?.actedBy?.username || step?.actedBy?.name || step?.actedBy?.email || "";

            const cardBase = `
              relative min-w-[320px] rounded-3xl p-6
              bg-white/40 backdrop-blur-2xl
              ring-1 ring-white/25
              shadow-[0_18px_45px_-28px_rgba(0,0,0,0.25)]
              transition
            `;

            const cardHover = isCancelled
              ? "cursor-not-allowed opacity-80"
              : "cursor-default hover:bg-white/55 hover:ring-white/40";

              const currentRing = isAttachmentOnly
              ? "ring-2 ring-green-200/80 bg-green-50/40"
              : isCurrent && !isCancelled
              ? "ring-2 ring-blue-200/70"
              : "";

            return (
              <div key={idx} className="flex items-center gap-5">
                <motion.div
                  whileHover={isCancelled ? {} : { y: -3 }}
                  transition={{ duration: 0.2 }}
                  className={`${cardBase} ${cardHover} ${currentRing}`}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/45 via-transparent to-transparent opacity-80" />

               

                  {/* HEADER */}
                  <div className="relative flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-bold
                          ${
                            isAttachmentOnly
                              ? "bg-green-600"
                              : isCancelled
                              ? "bg-gray-500"
                              : isCurrent
                              ? "bg-blue-600"
                              : "bg-gray-800"
                          }
                        `}
                      >
                        {idx + 1}
                      </div>

                      <div>
                      <p className="font-semibold text-gray-800 text-base">
  {isAttachmentOnly ? `تم ارسال الاتاج للستيب رقم ${idx + 1}` : `Step ${idx + 1}`}
</p>

                        <div className="mt-2">
                        {!isAttachmentOnly && (
  <StatusBadge status={isCancelled ? "cancelled" : stepStatus} />
)}
                        </div>

                        {(step?.actedAt || actedName) && (
                          <div className="mt-3 space-y-2 text-xs">
                            {step?.actedAt && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <div className="h-7 w-7 rounded-xl bg-gray-100 flex items-center justify-center">
                                  <FiCalendar className="text-gray-500 text-sm" />
                                </div>
                                <span className="font-semibold text-gray-700">Acted At:</span>
                                <span className="px-2.5 py-1 rounded-lg bg-white/70 ring-1 ring-gray-200 font-medium">
                                  {new Date(step.actedAt).toLocaleString("en-US", {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            )}

                            {!!actedName && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <div className="h-7 w-7 rounded-xl bg-gray-100 flex items-center justify-center">
                                  <FiUser className="text-gray-500 text-sm" />
                                </div>
                                <span className="font-semibold text-gray-700">By:</span>
                                <span className="px-2.5 py-1 rounded-lg bg-white/70 ring-1 ring-gray-200 font-medium truncate max-w-[150px]">
                                  {actedName}
                                </span>
                              </div>
                            )}

                            {hasComment && (
                              <div className="flex items-start gap-2 text-gray-600 mt-2">
                                <div className="h-7 w-7 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                  <FiMessageSquare className="text-gray-500 text-sm" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-semibold text-gray-700 block mb-1">Comment:</span>
                                  <div className="px-3 py-2 rounded-xl bg-white/70 ring-1 ring-black/5 text-gray-800 whitespace-pre-wrap text-sm leading-relaxed max-h-32 overflow-y-auto font-medium">
                                    {step.comment}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {isCancelled ? (
                      <FiXCircle className="text-gray-400 text-lg" />
                    ) : stepStatus === "Approved" ? (
                      <FiCheckCircle className="text-green-600 text-lg" />
                    ) : stepStatus === "Rejected" ? (
                      <FiXCircle className="text-red-600 text-lg" />
                    ) : (
                      <FiClock className="text-amber-600 text-lg" />
                    )}
                  </div>

                  {/* USERS */}
                  <div className="relative space-y-3">
                    {(step.users || []).map((user, uidx) => {
                      const username = user?.username || user?.name || user?.email || "User";

                      const acted =
                        stepStatusLower !== "pending" &&
                        step?.actedBy &&
                        (String(step.actedBy?._id) === String(user?._id) ||
                          String(step.actedBy?.username) === String(user?.username) ||
                          String(step.actedBy?.email) === String(user?.email));

                      const rowBase =
                        "flex items-center gap-3 p-3 rounded-2xl " +
                        "bg-white/45 backdrop-blur ring-1 ring-black/5";

                      const avatarBg = isCancelled
                        ? "bg-gray-500"
                        : acted
                        ? stepStatus === "Approved"
                          ? "bg-green-600"
                          : "bg-red-600"
                        : "bg-gray-800";

                      return (
                        <div key={user?._id || `${idx}_${uidx}`} className={rowBase}>
                          <div
                            className={`h-9 w-9 rounded-2xl flex items-center justify-center font-bold text-white ${avatarBg}`}
                          >
                            {String(username).charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{username}</p>
                            {acted && <p className="text-xs text-gray-600">Took Action</p>}
                          </div>

                          {acted && !isCancelled && <StatusBadge status={stepStatus} />}
                        </div>
                      );
                    })}
                  </div>

                  {!isAttachmentOnly &&
  stepFiles.length > 0 &&
  currentUser &&
  step?.users?.some((u) => String(u?._id) === String(currentUser?._id)) && ( <div className="mt-4 space-y-2">
    <div className="text-sm font-semibold text-gray-700">مرفقات الستيب</div>

    <div className="space-y-2">
      {stepFiles.map((file, fileIdx) => {
        const img = isImageFile(file);
        const pdf = isPdfFile(file);

        return (
          <div
            key={`${idx}_${fileIdx}`}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-white/55 ring-1 ring-black/5"
          >
            <div className="min-w-0 flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl border border-black/10 bg-white/70 flex items-center justify-center text-gray-600">
                {img ? <FiImage /> : <FiFileText />}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {file?.name || (pdf ? "PDF Attachment" : "Attachment")}
                </div>
                <div className="text-xs text-gray-500">
                  {pdf ? "PDF" : img ? "Image" : fileExt(file?.name) || "FILE"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={file?.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!file?.url) e.preventDefault();
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black"
              >
                Open
              </a>

              <button
                type="button"
                onClick={() => downloadFile(file)}
                disabled={!file?.url}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <FiDownload /> Download
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

                  {/* ACTIONS */}
                  {canAct && !isCancelled && !isOperationUser && !isAttachmentOnly && (
  <div className="mt-5 flex gap-3">
    <button
      disabled={acting}
      onClick={() => {
        setActionModal({ open: true, action: "approve", stepIndex: idx });
      }}
      className="flex-1 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm disabled:opacity-60"
    >
      Approve
    </button>

    <button
      disabled={acting}
      onClick={() => {

        setActionModal({ open: true, action: "reject", stepIndex: idx });
      }}
      className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm disabled:opacity-60"
    >
      Reject
    </button>
  </div>
)}

{canAct && !isCancelled && isOperationUser && !isAttachmentOnly && (
  <div className="mt-5 flex gap-3">
    <button
      disabled={acting}
      onClick={() =>
        setActionModal({ open: true, action: "operation_submit", stepIndex: idx })
      }
      className="flex-1 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm disabled:opacity-60"
    >
تم معاينة المرفق
    </button>
    <button
      disabled={acting}
      onClick={() =>
        setActionModal({ open: true, action: "reject", stepIndex: idx })
      }
      className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm disabled:opacity-60"
    >
      Reject
    </button>
  </div>
)}
                </motion.div>

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

        {/* PREVIEW MODAL */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md sm:max-w-2xl lg:max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                initial={{ y: 24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 18, opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 140, damping: 18 }}
              >
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-black text-gray-900 flex items-center gap-2">
                    <FiImage /> Preview (A4)
                  </div>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setPreviewPngs([]);
                    }}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center gap-2"
                  >
                    <FiX /> Close
                  </button>
                </div>

                <div className="flex-1 bg-gray-50 overflow-y-auto">
                  {building && !previewPngs.length ? (
                    <div className="h-full flex items-center justify-center text-gray-600">جارِ تجهيز المعاينة…</div>
                  ) : previewPngs.length ? (
                    <div className="p-2 space-y-3">
                      {previewPngs.map((src, i) => (
                        <div key={i} className="w-full bg-white rounded-xl shadow overflow-hidden aspect-[210/297]">
                          <img src={src} alt={`page_${i + 1}`} className="w-full h-full object-contain block" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600">لا يوجد معاينة</div>
                  )}
                </div>

                <div className="p-3 border-t flex justify-end gap-2 bg-white">
                  <button
                    onClick={doPrint}
                    className="px-4 py-2 rounded-xl font-black flex items-center gap-2 bg-black text-white hover:bg-gray-900"
                    disabled={building}
                  >
                    <FiPrinter /> Print
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <CommentModal
          open={!!actionModal?.open}
          title={
            actionModal?.action === "approve"
              ? "Approve Step"
              : actionModal?.action === "reject"
              ? "Reject Step"
              : "Submit Step"
          }
          subtitle={
            actionModal?.action === "operation_submit"
              ? "ارفع مرفق الأوبريشن ثم أرسل للخطوة التالية"
              : "Submit"
          }
          submitLabel="Submit"
          onClose={() => {
            if (acting) return;
            setActionModal({ open: false, action: null, stepIndex: null });
            setOpAttachment(null);
          }}
          onSubmit={submitAction}
          loading={acting}
          uploading={uploadingOpAttachment}
          isOperation={actionModal?.action === "operation_submit"}
          attachmentFile={opAttachment}
          onAttachmentChange={setOpAttachment}
        />
      </div>
    </motion.div>
  );
}