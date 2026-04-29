"use client";
import { useState, useEffect, useRef } from "react";
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
  FiMessageSquare,
  FiDownload,
  FiLayers,
FiEdit,
FiUploadCloud,
} from "react-icons/fi";
import { GrCurrency } from "react-icons/gr";


import CommentModal from "@/components/CommentModal";
import StatusBadge from "@/components/StatusBadge";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import VoucherModal from "@/components/VoucherModal";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import PrintableRequestPDF from "@/components/PrintableRequestPDF";
import CreateRequestModal from "@/components/CreateRequestModal";
import VoucherAttachModal from "@/components/VoucherAttachModal";
import { useRouter, useSearchParams } from "next/navigation";
export default function RequestDetails({ id, companyKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") || "new";
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  const workflow = request?.workflow;
  const workflowSteps = workflow?.steps || [];

  const [currentUser, setCurrentUser] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentAction, setCommentAction] = useState(null); // approve | reject | view
  const [commentText, setCommentText] = useState("");
  const [activeStep, setActiveStep] = useState(null);
  const [showVoucherAttachModal, setShowVoucherAttachModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  const [stepAttachment, setStepAttachment] = useState(null); // {url,name,type,size} | null

  const { permissions } = usePermissions();
  const canPrint =
  Array.isArray(permissions) && permissions.includes(PERMISSIONS.PRINT_REQUEST);

  const printRef = useRef(null);

  const canViewAll =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.VIEW_REPORTS);

  const [accessChecked, setAccessChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // 🟢 ---------------- FETCH DATA FUNCTION (خارج useEffect) ----------------
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/requests/${id}?company=${companyKey}&source=${encodeURIComponent(source)}`, {
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

  useEffect(() => {
    if (!id || !companyKey) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, companyKey]);

  // جلب المستخدم
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/userid", { credentials: "include" });
        const data = await res.json();
        setCurrentUser(data.user);
      } catch (err) {
        console.error("❌ Error loading user", err);
      }
    };
    fetchUser();
  }, []);

  // Access check
  useEffect(() => {
    if (!request || !currentUser) return;
    setAccessDenied(false);
    setAccessChecked(true);
  }, [request, currentUser]);

  const handleDownloadPDF = async () => {
    if (!printRef.current || !request) return;
  
    const root = printRef.current;
  
    const hiddenEls = root.querySelectorAll("[data-no-pdf='1']");
    hiddenEls.forEach((el) => (el.style.display = "none"));
  
    const style = document.createElement("style");
    style.innerHTML = `
      .no-pdf-effects, .no-pdf-effects * {
        backdrop-filter: none !important;
        filter: none !important;
        box-shadow: none !important;
        text-shadow: none !important;
        background-image: none !important;
      }
      .no-pdf-effects { background-color: #ffffff !important; }
  
      .no-pdf-effects .bg-white { background-color: #ffffff !important; }
      .no-pdf-effects .bg-gray-50 { background-color: #f9fafb !important; }
      .no-pdf-effects .bg-gray-100 { background-color: #f3f4f6 !important; }
      .no-pdf-effects .bg-slate-50 { background-color: #f8fafc !important; }
      .no-pdf-effects .bg-slate-200 { background-color: #e2e8f0 !important; }
  
      .no-pdf-effects .bg-green-50 { background-color: #f0fdf4 !important; }
      .no-pdf-effects .bg-yellow-50 { background-color: #fefce8 !important; }
      .no-pdf-effects .bg-red-50 { background-color: #fef2f2 !important; }
  
      .no-pdf-effects .text-black { color: #000000 !important; }
      .no-pdf-effects .text-gray-600 { color: #4b5563 !important; }
      .no-pdf-effects .text-gray-700 { color: #374151 !important; }
  
      .no-pdf-effects .text-green-600 { color: #16a34a !important; }
      .no-pdf-effects .text-yellow-600 { color: #ca8a04 !important; }
      .no-pdf-effects .text-red-600 { color: #dc2626 !important; }
  
      .no-pdf-effects .border-gray-600 { border-color: #4b5563 !important; }
      .no-pdf-effects .border-gray-300 { border-color: #d1d5db !important; }
      .no-pdf-effects .border-green-300 { border-color: #86efac !important; }
      .no-pdf-effects .border-yellow-300 { border-color: #fde047 !important; }
      .no-pdf-effects .border-red-300 { border-color: #fca5a5 !important; }
  
      .no-pdf-effects, .no-pdf-effects * {
        outline-color: #d1d5db !important;
        caret-color: #111827 !important;
      }
    `;
    document.head.appendChild(style);
  
    try {
      root.classList.add("no-pdf-effects");
      await new Promise((r) => setTimeout(r, 250));
  
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: root.scrollWidth,
        windowHeight: root.scrollHeight,
      });
  
      const pdf = await PDFDocument.create();
  
      // A4 landscape للصفحة الأولى
      const pageW = 841.89;
      const pageH = 595.28;
  
      // ===============================
      // 1) الصفحة الأولى: request PDF
      // ===============================
      const pngBlob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 1)
      );
  
      if (!pngBlob) throw new Error("Failed to create canvas blob");
  
      const pngBytes = await pngBlob.arrayBuffer();
      const pngImage = await pdf.embedPng(pngBytes);
  
      const scale = pageW / pngImage.width;
      const scaledHeight = pngImage.height * scale;
      const pagesCount = Math.ceil(scaledHeight / pageH);
  
      for (let i = 0; i < pagesCount; i++) {
        const page = pdf.addPage([pageW, pageH]);
        page.drawImage(pngImage, {
          x: 0,
          y: pageH - scaledHeight + i * pageH,
          width: pageW,
          height: scaledHeight,
        });
      }
  
      // ==========================================
      // 2) بعده: كل attachment بصفحة / صفحات
      // ==========================================
      const attachments = Array.isArray(request.attachments)
        ? request.attachments
        : [];
  
      for (const file of attachments) {
        if (!file?.url) continue;
  
        try {
          const res = await fetch(
            `/api/download?url=${encodeURIComponent(file.url)}`,
            {
              cache: "no-store",
            }
          );
  
          if (!res.ok) {
            console.error("❌ Failed to fetch attachment:", file.name, res.status);
            continue;
          }
  
          const contentType =
            (file?.type || res.headers.get("content-type") || "").toLowerCase();
  
          const bytes = await res.arrayBuffer();
          const lowerName = String(file?.name || "").toLowerCase();
  
          // ========= PDF =========
          if (contentType.includes("pdf") || lowerName.endsWith(".pdf")) {
            const attachmentPdf = await PDFDocument.load(bytes, {
              ignoreEncryption: true,
            });
  
            const copiedPages = await pdf.copyPages(
              attachmentPdf,
              attachmentPdf.getPageIndices()
            );
  
            copiedPages.forEach((p) => pdf.addPage(p));
            continue;
          }
  
          // ========= JPG / JPEG =========
          if (
            contentType.includes("jpeg") ||
            contentType.includes("jpg") ||
            /\.(jpg|jpeg)$/i.test(lowerName)
          ) {
            const img = await pdf.embedJpg(bytes);
            const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  
            const imgScale = Math.min(595.28 / img.width, 841.89 / img.height);
            const w = img.width * imgScale;
            const h = img.height * imgScale;
  
            page.drawImage(img, {
              x: (595.28 - w) / 2,
              y: (841.89 - h) / 2,
              width: w,
              height: h,
            });
            continue;
          }
  
          // ========= PNG =========
          if (
            contentType.includes("png") ||
            /\.(png)$/i.test(lowerName)
          ) {
            const img = await pdf.embedPng(bytes);
            const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  
            const imgScale = Math.min(595.28 / img.width, 841.89 / img.height);
            const w = img.width * imgScale;
            const h = img.height * imgScale;
  
            page.drawImage(img, {
              x: (595.28 - w) / 2,
              y: (841.89 - h) / 2,
              width: w,
              height: h,
            });
            continue;
          }
  
          console.warn("Unsupported attachment type:", file.name, contentType);
        } catch (err) {
          console.error("❌ Failed to append attachment:", file?.name, err);
        }
      }
  
      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
  
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `Request-${request?.requestCode || request?._id}.pdf`;
      link.click();
  
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("❌ PDF generation failed:", err);
    } finally {
      root.classList.remove("no-pdf-effects");
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
      hiddenEls.forEach((el) => (el.style.display = ""));
    }
  };

  // Guards
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (accessDenied) return null;
  if (!accessChecked) return null;

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-600">
        <p className="text-lg font-bold">Request not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
        >
          Back
        </button>
      </div>
    );
  }

  const companyLabel =
    request?.company || request?._oldProjectName || companyKey || "-";

    const isOwner =
    currentUser && String(request.createdBy) === String(currentUser.username);
  
  const hasAnyApproval =
    Array.isArray(request?.approvalHistory) &&
    request.approvalHistory.some(
      (h) => String(h?.action || "").toLowerCase() === "approve"
    );
  
  const canCancel = request.status === "Pending" && isOwner;
  
  const canEdit =
    request.status === "Pending" &&
    isOwner &&
    !hasAnyApproval;

  const projectName =
    request?.projectName || request?._oldProjectName || request?.project || "-";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* =================== HEADER =================== */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <StatusBadge status={request.status} />

          {/* ✅ أوضح: عنوان أكبر + وزن أعلى */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight">
            <FiInfo className="text-blue-600" /> Fund Request Details
          </h1>

          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-black shadow"
          >
            <FiArrowLeft /> Back
          </button>
        </div>

        {/* 🔽 Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
      className="flex items-center gap-2 px-4 py-2 rounded-xl
                 bg-gray-900 text-white
                 hover:bg-black transition shadow"
    >
      <FiMinusCircle />
      <span className="text-sm font-bold">Cancel</span>
    </button>
  )}

{canEdit && (
  <button
    onClick={() => setShowEditModal(true)}
    className="flex items-center gap-2 px-4 py-2 rounded-xl
               bg-amber-500 text-white
               hover:bg-amber-600 transition shadow"
  >
    <FiEdit />
    <span className="text-sm font-bold">Edit</span>
  </button>
)}
{canPrint && (
  <button
    data-no-pdf="1"
    onClick={async () => {
      if (pdfLoading) return;
      setPdfLoading(true);
      try {
        await handleDownloadPDF();
      } finally {
        setPdfLoading(false);
      }
    }}
    disabled={pdfLoading}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white transition shadow ${
      pdfLoading
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-blue-600 hover:bg-blue-700"
    }`}
  >
    {pdfLoading ? (
      <>
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-bold">جاري التحميل...</span>
      </>
    ) : (
      <>
        <FiDownload />
        <span className="text-sm font-bold">PDF</span>
      </>
    )}
  </button>
)}
</div>
      </div>

      {/* =================== SUMMARY =================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <motion.div
          className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* ✅ عنوان أوضح: أكبر + Bold */}
          <h2 className="text-xl md:text-2xl font-extrabold mb-5 flex items-center gap-2 text-gray-900">
            <FiInfo /> معلومات الطلب
          </h2>

          {/* ✅ النص العام أوضح */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[15px] text-gray-800">

{/* 1) Company (Full width) */}
<div className="sm:col-span-2 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
  <Info label="الشركة" value={companyLabel} icon={<FiUsers />} />
</div>
{companyKey === "Al-Rida" && (
  <div className="sm:col-span-2 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
    <Info
      label="المصروفية"
      value={request.expenseType || "-"}
      icon={<FiDollarSign />}
    />
  </div>
)}

{/* 2) Project Name (Full width) */}
<div className="sm:col-span-2 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
<Info
  label="Project Name"
  value={request._oldProjectName || request.projectName || "-"}
  icon={<FiLayers />}
/></div>

{/* 3) Request Code */}
<div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
  <Info
    label="رمز الطلب"
    value={request.requestCode || request.code || request._id}
    icon={<FiInfo />}
  />
</div>

{/* 4) Type */}
<div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
  <Info label="النوع" value={request.requestType} icon={<FiInfo />} />
</div>

{/* 5) Department */}
<div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
  <Info label="القسم" value={request.department} icon={<FiUsers />} />
</div>

{/* 6) Currency */}
<div className="rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
  <Info label="العملة" value={request.currency} icon={<GrCurrency />} />
</div>

{/* 7) Created At (Full width) */}
<div className="sm:col-span-2 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/45 hover:shadow-[0_12px_30px_-15px_rgba(0,0,0,0.35)]">
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
          <h2 className="text-xl md:text-2xl font-extrabold mb-5 flex items-center gap-2 text-gray-900">
            <FiUsers /> معلومات مقدم الطلب
          </h2>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center shadow-inner">
              <span className="text-2xl font-extrabold text-gray-800">
                {request.createdBy?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>

            <div>
              <p className="font-extrabold text-gray-900 text-lg">
                {request.createdBy || "Unknown User"}
              </p>
              <p className="text-sm text-gray-600 font-semibold">Primary Contact</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* =================== DESCRIPTION =================== */}
      <Section title="الوصف" icon={<FiInfo />}>
        <p className="text-gray-800 text-[15px] leading-relaxed font-medium">
          {request.description || "-"}
        </p>
      </Section>

      {/* =================== ITEMS =================== */}
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
            <table className="min-w-full text-[15px] text-slate-900">
              {/* Header */}
              <thead className="sticky top-0 z-10">
                <tr
                  className="
                    bg-white/75 backdrop-blur
                    border-b border-black/5
                    text-[12px] uppercase tracking-wider text-slate-800
                  "
                >
                  <th className="px-5 py-4 text-left font-extrabold w-[52%]">
                    الوصف
                  </th>
                  <th className="px-5 py-4 text-right font-extrabold w-[16%]">
                    العدد
                  </th>
                  <th className="px-5 py-4 text-right font-extrabold w-[16%]">
                    المبلغ
                  </th>
                  <th className="px-5 py-4 text-right font-extrabold w-[16%]">
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
                          <div className="text-[12px] text-slate-600 mt-0.5 font-semibold">
                            Item #{i + 1}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right tabular-nums font-bold text-slate-900">
                          {fmt.format(qty)}
                        </td>

                        <td className="px-5 py-4 text-right tabular-nums font-semibold text-slate-800">
                          {fmt.format(price)}
                        </td>

                        <td className="px-5 py-4 text-right tabular-nums">
                          <span
                            className="
                              inline-flex items-center justify-end
                              px-3 py-1 rounded-2xl
                              bg-white/80 ring-1 ring-black/5
                              font-extrabold text-slate-900
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
                      className="px-5 py-12 text-center text-slate-600 italic font-semibold"
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
                  <tr className="bg-white/80 backdrop-blur border-t border-black/5">
                    <td
                      className="px-5 py-4 text-right font-extrabold text-slate-800"
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
                          font-extrabold text-lg text-slate-900
                          shadow-sm
                        "
                      >
                        {fmt.format(
                          request.items.reduce(
                            (sum, it) =>
                              sum +
                              (Number(it.qty) || 0) * (Number(it.price) || 0),
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

      {/* =================== ATTACHMENTS =================== */}
      {Array.isArray(request.attachments) && request.attachments.length > 0 && (
        <Section title="Attachments" icon={<FiPaperclip />}>
          <div className="flex flex-wrap gap-6">
            {request.attachments.map((file, idx) => (
              <a
                key={idx}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block w-36"
              >
                <div className="w-36 h-36 rounded-2xl overflow-hidden border border-gray-200 shadow-sm transition-transform transform group-hover:scale-105 group-hover:shadow-lg">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="mt-2 text-[13px] text-center text-gray-800 font-semibold truncate group-hover:text-blue-600">
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
            <p className="text-gray-600 italic text-center py-6 font-semibold">
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
                    step.users?.some(
                      (u) =>
                        String(u.username) === String(currentUser?.username)
                    );

                  const isCurrent = idx === request.currentStep;

                  const canAct =
                    (request.status === "Pending" ||
                      request.status === "Rejected") &&
                    isCurrent &&
                    step.status === "Pending" &&
                    currentUser &&
                    step.users?.some(
                      (user) =>
                        String(user.username) === String(currentUser.username)
                    );

                  const hasComment = !!(step.comment && step.comment.trim());
                  const hasAttach =
                    (Array.isArray(step.tagAttachments) &&
                      step.tagAttachments.length > 0) ||
                    !!step.tag;

                  const isCancelled = request.status === "Cancelled";

                  const cardBase = `
                    relative min-w-[340px] rounded-3xl p-6
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
                              Array.isArray(step.tagAttachments) &&
                              step.tagAttachments.length
                                ? step.tagAttachments[
                                    step.tagAttachments.length - 1
                                  ]
                                : null;

                            setStepAttachment(
                              last?.url
                                ? {
                                    url: last.url,
                                    name: last.name,
                                    type: last.type,
                                    size: last.size,
                                  }
                                : null
                            );

                            setShowCommentModal(true);
                          }
                        }}
                        className={`${cardBase} ${cardHover} ${currentRing}`}
                      >
                        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/45 via-transparent to-transparent opacity-80" />

                        {(hasComment || hasAttach) && !isCancelled && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 text-blue-800/90">
                            <FiMessageSquare className="text-lg" />
                            <span className="text-xs font-bold">View</span>
                          </div>
                        )}

                        {/* HEADER */}
                        <div className="relative flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-extrabold
                                ${
                                  isCancelled
                                    ? "bg-gray-500"
                                    : isCurrent
                                    ? "bg-blue-600"
                                    : "bg-gray-900"
                                }
                              `}
                            >
                              {idx + 1}
                            </div>

                            <div>
                              <p className="font-extrabold text-gray-900 text-[16px]">
                                الخطوة {idx + 1}
                              </p>

                              <div className="mt-1">
                                <StatusBadge
                                  status={isCancelled ? "cancelled" : step.status}
                                />
                              </div>

                              {step?.actedAt && (
                                <div className="mt-2 text-[12px] text-gray-700 flex items-center gap-2 font-semibold">
                                  <FiCalendar className="text-gray-500" />
                                  <span className="font-extrabold">
                                    Acted At:
                                  </span>
                                  <span className="font-semibold">
                                    {new Date(step.actedAt).toLocaleString()}
                                  </span>
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
                              : "bg-gray-900";

                            return (
                              <div key={user._id} className={rowBase}>
                                <div
                                  className={`h-9 w-9 rounded-2xl flex items-center justify-center font-extrabold text-white ${avatarBg}`}
                                >
                                  {user.username?.charAt(0)?.toUpperCase() || "U"}
                                </div>

                                <div className="flex-1">
                                  <p className="text-[14px] font-extrabold text-gray-900">
                                    {user.username}
                                  </p>
                                  {acted && (
                                    <p className="text-[12px] text-gray-700 font-semibold">
                                      Took Action
                                    </p>
                                  )}
                                </div>

                                {acted && <StatusBadge status={step.status} />}
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
                              className="flex-1 py-2.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-extrabold shadow-sm"
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
                              className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold shadow-sm"
                            >
                              Reject
                            </button>
                          </div>
                        )}

{isFinalApproved &&
  isLastStepUser &&
  ["Badur-Baghdad", "Al-Ghadeer", "010" , "Tiba-Al-najaf" , "Ghadeer-Karbala"].includes(companyKey) && (
    <div className="mt-4 flex gap-3">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowVoucherModal(true);
        }}
        className="flex-1 py-2.5 rounded-2xl bg-gray-900 text-white font-extrabold hover:bg-black shadow"
      >
        وصل صرف
      </button>

      <button
  onClick={(e) => {
    e.stopPropagation();
    setShowVoucherAttachModal(true);
  }}
  className="flex-1 py-2.5 rounded-2xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 shadow flex items-center justify-center gap-2"
>
  <FiUploadCloud />
  رفق الوصل
</button>
    </div>
  )}
                      </motion.div>

                      {/* ARROW */}
                      {idx !== workflowSteps.length - 1 && (
                        <div className="text-3xl text-gray-400/60 select-none">
                          →
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ================= MODALS ================= */}
      <CommentModal
  open={showCommentModal}
  action={commentAction}
  value={commentText}
  onChange={setCommentText}
  loading={loading}
  stepStatus={
    activeStep !== null ? workflowSteps?.[activeStep]?.status : "Pending"
  }
  attachment={stepAttachment}
  attachments={
    activeStep !== null ? workflowSteps?.[activeStep]?.tagAttachments || [] : []
  }
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
      : async () => {
          setLoading(true);
          try {
            await fetch(`/api/requests/${id}?company=${companyKey}`, {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: commentAction,
                note: commentText,
                stepIndex: Number.isInteger(activeStep) ? activeStep : null,
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

<VoucherAttachModal
  open={showVoucherAttachModal}
  onClose={() => setShowVoucherAttachModal(false)}
  companyKey={companyKey}
  requestId={id}
  stepIndex={workflowSteps.length - 1}
  title="وصل صرف"
  onSaved={async () => {
    setShowVoucherAttachModal(false);
    await fetchData();
    router.refresh();
  }}
/>


<CreateRequestModal
  open={showEditModal}
  onClose={() => setShowEditModal(false)}
  companyKey={companyKey}
  canCreate={true}
  mode="edit"
  initialData={request}
  requestId={id}
  onCreated={async () => {
    setShowEditModal(false);
    await fetchData();
    router.refresh();
  }}
/>
      {/* ================= PRINTABLE (Hidden) ================= */}
      <div
        ref={printRef}
        style={{
          position: "absolute",
          top: "-10000px",
          left: "-10000px",
          width: "297mm",
          background: "#fff",
        }}
      >
        <PrintableRequestPDF companyKey={companyKey} request={request} />
      </div>
    </motion.div>
  );
}

function Info({ label, value, icon }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/35 backdrop-blur ring-1 ring-white/25 p-3 shadow-sm">
      <div className="text-gray-700 text-xl">{icon}</div>

      <div className="min-w-0">
        {/* ✅ عنوان أوضح وأعلى */}
        <div className="text-[12px] font-extrabold text-gray-700 tracking-wide">
          {label}
        </div>

        {/* ✅ قيمة أوضح: حجم أكبر شوي */}
        <div className="font-semibold text-gray-900 text-[15px] truncate">
          {value || "-"}
        </div>
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
      {/* ✅ فرق واضح بالخط: العنوان أكبر + Bold */}
      <h2 className="text-xl md:text-2xl font-extrabold mb-4 flex items-center gap-2 text-gray-900">
        {icon} {title}
      </h2>

      {/* ✅ محتوى أوضح */}
      <div className="text-[15px] text-gray-800">{children}</div>
    </motion.div>
  );
}