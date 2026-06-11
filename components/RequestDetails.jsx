"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  FiUserCheck,
  FiHash,
  FiFile,
  FiBriefcase,
} from "react-icons/fi";
import { GrCurrency } from "react-icons/gr";


import CommentModal from "@/components/CommentModal";
import StatusBadge from "@/components/StatusBadge";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import {
  resolveVoucherCompanyKeyForUser,
  hasVoucherPermissionForRequest,
} from "@/lib/voucher/resolveVoucherCompanyKey";
import VoucherModal from "@/components/VoucherModal";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import PrintableRequestPDF from "@/components/PrintableRequestPDF";
import CreateRequestModal from "@/components/CreateRequestModal";
import VoucherAttachModal from "@/components/VoucherAttachModal";
import { useRouter, useSearchParams } from "next/navigation";
import {
  supportsExpenseType,
  isApprovalOnlyCompany,
} from "@/lib/companies/expenseTypeCompanies";

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
  const [delegateUserId, setDelegateUserId] = useState("");
  const [delegateVoucherCompanyKey, setDelegateVoucherCompanyKey] = useState("");
  const [delegating, setDelegating] = useState(false);
  const [approvingDisburse, setApprovingDisburse] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const copyToastTimerRef = useRef(null);

  const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  const fmtDateEn = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-GB");
  };

  const fmtDateTimeEn = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fmtTimeEn = (v) => {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const [stepAttachment, setStepAttachment] = useState(null); // {url,name,type,size} | null

  const { permissions } = usePermissions();
  const canPrint =
  Array.isArray(permissions) && permissions.includes(PERMISSIONS.PRINT_REQUEST);
  const canDelegateVoucher =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);
  const canViewReceipts =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.RECEIPTS);
  const approvalOnlyCompany = isApprovalOnlyCompany(companyKey);

  const voucherCompanyConfig = COMPANIES.find(
    (c) => String(c.key).trim().toLowerCase() === String(companyKey || "").trim().toLowerCase()
  );
  const isTestVoucherCompany = String(voucherCompanyConfig?.key || "").trim() === "010";
  const canCreateVoucherForCompany = useMemo(
    () =>
      Array.isArray(permissions) &&
      (isTestVoucherCompany
        ? voucherCompanyConfig?.permission &&
          permissions.includes(voucherCompanyConfig.permission)
        : hasVoucherPermissionForRequest(companyKey, permissions)),
    [permissions, companyKey, isTestVoucherCompany, voucherCompanyConfig]
  );
  const effectiveVoucherCompanyKey = useMemo(() => {
    const lastStep = workflowSteps[workflowSteps.length - 1];
    if (lastStep && currentUser) {
      const curId = String(currentUser?._id || currentUser?.id || "").trim();
      const curName = String(currentUser?.username || "").trim();
      const delId = String(
        lastStep?.voucherDelegateTo?._id || lastStep?.voucherDelegateTo || ""
      ).trim();
      const delName = String(lastStep?.voucherDelegateToUsername || "").trim();
      const isDelegated =
        (delId && curId && delId === curId) ||
        (delName && curName && delName === curName);
      const delegatedKey = String(lastStep?.voucherDelegateCompanyKey || "").trim();
      if (isDelegated && delegatedKey) return delegatedKey;
    }
    return resolveVoucherCompanyKeyForUser(companyKey, permissions);
  }, [companyKey, permissions, workflowSteps, currentUser]);

  const lastWorkflowStep = workflowSteps.length
    ? workflowSteps[workflowSteps.length - 1]
    : null;
  const stepMarkedDisbursed = Boolean(
    lastWorkflowStep?.voucherProcessedAt ||
      lastWorkflowStep?.voucherProcessedBy ||
      lastWorkflowStep?.voucherNo ||
      lastWorkflowStep?.voucherId
  );
  const delegateDisburseApproved = Boolean(
    lastWorkflowStep?.voucherProcessedAt || lastWorkflowStep?.voucherProcessedBy
  );
  const disbursement = request?.disbursement;
  const hasLinkedVoucher = Boolean(disbursement?.hasVoucher);
  const isRequestDisbursed = Boolean(
    disbursement?.isDisbursed ?? disbursement?.stepDisbursed ?? stepMarkedDisbursed
  );
  const showPrintVoucher = hasLinkedVoucher;
  const voucherNoLabel =
    hasLinkedVoucher && disbursement?.voucherNo
      ? String(disbursement.voucherNo).trim()
      : "";

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

  useEffect(() => {
    const steps = request?.workflow?.steps || [];
    const optsMap = request?.delegationVoucherOptionsByUser || {};
    if (!steps.length) {
      setDelegateUserId("");
      setDelegateVoucherCompanyKey("");
      return;
    }
    const lastStep = steps[steps.length - 1];
    const delegated = lastStep?.voucherDelegateTo;
    const delegatedId =
      typeof delegated === "string"
        ? delegated
        : String(delegated?._id || delegated?.id || "");
    setDelegateUserId(delegatedId || "");

    const savedKey = String(lastStep?.voucherDelegateCompanyKey || "").trim();
    if (savedKey) {
      setDelegateVoucherCompanyKey(savedKey);
      return;
    }

    if (delegatedId) {
      const options = optsMap[delegatedId] || [];
      const preferred = effectiveVoucherCompanyKey;
      const norm = (k) => String(k || "").trim().toLowerCase();
      const hit = options.find((o) => norm(o.key) === norm(preferred));
      setDelegateVoucherCompanyKey(
        hit?.key || options.find((o) => o.isDefault)?.key || options[0]?.key || ""
      );
    } else {
      setDelegateVoucherCompanyKey("");
    }
  }, [request, effectiveVoucherCompanyKey]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    };
  }, []);

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
    return <RequestDetailsLoading />;
  }
  if (accessDenied) return null;
  if (!accessChecked) return null;

  if (!request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 px-6 text-slate-600">
        <div className="rounded-3xl bg-white/70 px-10 py-12 text-center shadow-xl ring-1 ring-white/50 backdrop-blur">
          <FiInfo className="mx-auto mb-4 text-4xl text-slate-400" />
          <p className="text-lg font-extrabold text-slate-800">الطلب غير موجود</p>
          <p className="mt-2 text-sm font-semibold text-slate-500">تعذّر العثور على هذا الطلب</p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-black"
          >
            <FiArrowLeft /> رجوع
          </button>
        </div>
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

  const itemsTotal =
    Array.isArray(request.items) && request.items.length > 0
      ? request.items.reduce(
          (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
          0
        )
      : Number(request.amount) || 0;

  const currentStepIdx = Number.isFinite(request.currentStep) ? request.currentStep : 0;
  const workflowProgressPct =
    workflowSteps.length > 0
      ? Math.min(
          100,
          Math.round(
            ((request.status === "Approved" || request.status === "Cancelled"
              ? workflowSteps.length
              : currentStepIdx + 0.5) /
              workflowSteps.length) *
              100
          )
        )
      : 0;

  const disburseStatusLabel = isRequestDisbursed
    ? voucherNoLabel
      ? `وصل ${voucherNoLabel}`
      : "مصروف"
    : "غير مصروف";

  const showExpenseType = supportsExpenseType(companyKey);
  const expenseTypeLabel = request?.expenseType || "-";
  const expenseTypeIsSpent = expenseTypeLabel === "مصروف";
  const kpiColumnCount =
    2 +
    (showExpenseType ? 1 : 0) +
    (canViewReceipts && !approvalOnlyCompany ? 1 : 0) +
    1;

  const requestCodeLabel =
    request.requestCode || request.code || String(request._id || "").slice(-8) || "-";

  const copyRequestCode = async () => {
    try {
      await navigator.clipboard.writeText(String(requestCodeLabel));
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
      setCodeCopied(true);
      copyToastTimerRef.current = setTimeout(() => setCodeCopied(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const getId = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    return String(v?._id || v?.id || v?.userId || "");
  };
  const getUsername = (v) => {
    if (!v) return "";
    if (typeof v === "string") return String(v).trim();
    return String(v?.username || v?.userName || "").trim();
  };
  const sameUser = (a, b) => {
    const aid = getId(a);
    const bid = getId(b);
    if (aid && bid) return aid === bid;
    const au = getUsername(a);
    const bu = getUsername(b);
    return !!au && !!bu && au === bu;
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* =================== HERO =================== */}
        <motion.div
          className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200/90 transition duration-200 hover:bg-white hover:shadow-sm"
            >
              <FiArrowLeft className="text-base" />
              رجوع
            </button>
            <StatusBadge status={request.status} />
          </div>

          <div className="mt-5 border-b border-slate-100 pb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              تفاصيل طلب الصرف
            </p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
              {projectName}
            </h1>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50/90 p-2.5 ring-1 ring-slate-200/70">
            <div className="relative">
              <AnimatePresence>
                {codeCopied ? (
                  <motion.span
                    key="code-copied-toast"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 2 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 whitespace-nowrap rounded-lg bg-slate-800/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-md"
                  >
                    تم نسخ كود الريكويست
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <button
                type="button"
                onClick={copyRequestCode}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs font-extrabold text-blue-800 ring-1 ring-blue-200/80 shadow-sm transition duration-200 hover:bg-blue-50"
                title="اضغط للنسخ"
              >
                <FiHash className="text-sm text-blue-500" />
                {requestCodeLabel}
              </button>
            </div>
            <HeroMetaChip icon={<FiBriefcase className="text-sm" />} iconColor="text-amber-600">
              {companyLabel}
            </HeroMetaChip>
            {request.requestType ? (
              <HeroMetaChip icon={<FiInfo className="text-sm" />} iconColor="text-indigo-600">
                {request.requestType}
              </HeroMetaChip>
            ) : null}
            {request.department ? (
              <HeroMetaChip icon={<FiUsers className="text-sm" />} iconColor="text-blue-600">
                {request.department}
              </HeroMetaChip>
            ) : null}
            {showExpenseType ? (
              <HeroMetaChip
                icon={<FiDollarSign className="text-sm" />}
                iconColor={expenseTypeIsSpent ? "text-emerald-600" : "text-rose-600"}
              >
                {expenseTypeLabel}
              </HeroMetaChip>
            ) : null}
          </div>

          {(canCancel || canEdit || canPrint) && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {canCancel && (
                <button
                  type="button"
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3.5 py-2 text-sm font-extrabold text-red-700 ring-1 ring-red-200/80 transition duration-200 hover:bg-red-100"
                >
                  <FiMinusCircle className="text-base" />
                  إلغاء
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2 text-sm font-extrabold text-amber-800 ring-1 ring-amber-200/80 transition duration-200 hover:bg-amber-100"
                >
                  <FiEdit className="text-base" />
                  تعديل
                </button>
              )}
              {canPrint && (
                <button
                  type="button"
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
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold text-white shadow-sm transition duration-200 ${
                    pdfLoading
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {pdfLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      جاري التحميل...
                    </>
                  ) : (
                    <>
                      <FiDownload className="text-base" />
                      PDF
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* =================== KPI STRIP =================== */}
        <motion.div
          className={`mb-8 grid grid-cols-2 gap-3 sm:gap-4 ${
            kpiColumnCount >= 5
              ? "lg:grid-cols-5"
              : kpiColumnCount === 4
              ? "lg:grid-cols-4"
              : "lg:grid-cols-3"
          }`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <KpiCard
            label="المبلغ الإجمالي"
            value={itemsTotal > 0 ? fmt.format(itemsTotal) : "-"}
            sub={request.currency || ""}
            icon={<FiDollarSign />}
            iconColor="text-emerald-600"
          />
          <KpiCard
            label="الخطوة الحالية"
            value={
              workflowSteps.length
                ? `${Math.min(currentStepIdx + 1, workflowSteps.length)} / ${workflowSteps.length}`
                : "-"
            }
            sub={workflow?.name || "سير العمل"}
            icon={<FiLayers />}
            iconColor="text-indigo-600"
          />
          {showExpenseType ? (
            <KpiCard
              label="نوع المصروف"
              value={expenseTypeLabel}
              sub={
                expenseTypeLabel === "مصروف"
                  ? "مصروف"
                  : expenseTypeLabel === "غير مصروف"
                  ? "غير مصروف"
                  : "لم يُحدَّد"
              }
              icon={<FiDollarSign />}
              iconColor={expenseTypeIsSpent ? "text-emerald-600" : "text-rose-600"}
            />
          ) : null}
          {canViewReceipts && !approvalOnlyCompany ? (
            <KpiCard
              label="حالة الصرف"
              value={disburseStatusLabel}
              sub={isRequestDisbursed ? "تم الصرف" : "بانتظار الصرف"}
              icon={<FiCheckCircle />}
              iconColor={isRequestDisbursed ? "text-emerald-600" : "text-amber-600"}
            />
          ) : null}
          <KpiCard
            label="تاريخ الإنشاء"
            value={fmtDateEn(request.createdAt)}
            sub={fmtTimeEn(request.createdAt)}
            icon={<FiCalendar />}
            iconColor="text-purple-600"
          />
        </motion.div>

        {/* =================== SUMMARY =================== */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="معلومات الطلب" icon={<ColoredIcon color="text-blue-600"><FiInfo /></ColoredIcon>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Info label="الشركة" value={companyLabel} icon={<FiUsers />} iconColor="text-blue-600" />
              {showExpenseType ? (
                <Info
                  label="المصروفية"
                  value={expenseTypeLabel}
                  icon={<FiDollarSign />}
                  iconColor={expenseTypeIsSpent ? "text-emerald-600" : "text-rose-600"}
                />
              ) : null}
              <Info label="اسم المشروع" value={projectName} icon={<FiLayers />} iconColor="text-indigo-600" className="sm:col-span-2" />
              <Info label="رمز الطلب" value={requestCodeLabel} icon={<FiHash />} iconColor="text-purple-600" />
              <Info label="النوع" value={request.requestType} icon={<FiInfo />} iconColor="text-teal-600" />
              <Info label="القسم" value={request.department} icon={<FiBriefcase />} iconColor="text-amber-600" />
              <Info label="العملة" value={request.currency} icon={<GrCurrency />} iconColor="text-emerald-600" />
            </div>
          </Section>

          <Section title="مقدم الطلب" icon={<ColoredIcon color="text-blue-600"><FiUsers /></ColoredIcon>}>
            <div className="group flex items-center gap-4 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-blue-200/60">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl font-extrabold text-white shadow-md transition duration-300 group-hover:scale-105">
                {request.createdBy?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-lg font-extrabold text-slate-900">
                  {request.createdBy || "غير معروف"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-500">مقدّم الطلب</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <FiCalendar className="text-purple-500" />
                  {fmtDateTimeEn(request.createdAt)}
                </p>
              </div>
            </div>
          </Section>
        </div>

        {/* =================== DESCRIPTION =================== */}
        <Section title="الوصف" icon={<ColoredIcon color="text-teal-600"><FiMessageSquare /></ColoredIcon>}>
          <p className="rounded-2xl bg-white/70 p-4 text-[15px] font-medium leading-relaxed text-slate-800 ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-slate-300/70">
            {request.description || "—"}
          </p>
        </Section>

        {/* =================== ITEMS =================== */}
        <Section
          title="Items"
          icon={<ColoredIcon color="text-emerald-600"><FiList /></ColoredIcon>}
        >
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
                            بند #{i + 1}
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
                      className="px-5 py-12 text-center text-slate-600 font-semibold"
                      colSpan={4}
                    >
                      لا توجد بنود
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
                      المجموع
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className="
                          inline-flex items-center justify-end
                          px-4 py-2 rounded-2xl
                          bg-gradient-to-r from-emerald-50 to-teal-50 ring-1 ring-emerald-200/70
                          font-extrabold text-lg text-emerald-900
                          shadow-sm
                        "
                      >
                        {fmt.format(itemsTotal)}
                        {request.currency ? (
                          <span className="mr-2 text-sm font-bold text-emerald-700">
                            {request.currency}
                          </span>
                        ) : null}
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
          <Section title="المرفقات" icon={<ColoredIcon color="text-amber-600"><FiPaperclip /></ColoredIcon>} badge={`${request.attachments.length} ملف`} badgeClass="bg-amber-50 text-amber-700 ring-amber-200/70">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {request.attachments.map((file, idx) => {
                const isImage =
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(String(file?.name || "")) ||
                  String(file?.type || "").startsWith("image/");
                return (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 shadow-sm ring-1 ring-slate-200/50 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:ring-slate-300/80">
                      {isImage ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 p-3">
                          <FiFile className="text-3xl text-blue-500" />
                          <span className="text-[10px] font-bold uppercase text-slate-500">ملف</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                        <p className="truncate text-[11px] font-bold text-white">{file.name}</p>
                      </div>
                    </div>
                    <p className="mt-2 truncate text-center text-[12px] font-semibold text-slate-700 group-hover:text-slate-900">
                      {file.name}
                    </p>
                  </a>
                );
              })}
            </div>
          </Section>
        )}

        {/* ================= WORKFLOW ================= */}
        {workflow && (
          <Section title="سير العمل" icon={<ColoredIcon color="text-indigo-600"><FiUsers /></ColoredIcon>} badge={workflow.name || null} badgeClass="bg-indigo-50 text-indigo-700 ring-indigo-200/70">
            {workflowSteps.length === 0 && (
              <p className="py-8 text-center font-semibold text-slate-500">
                لا توجد خطوات في سير العمل
              </p>
            )}

            {workflowSteps.length > 0 && (
              <div className="relative">
                {/* Progress bar */}
                <div className="mb-6 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70 transition duration-300 hover:bg-white hover:shadow-md hover:ring-slate-300/70">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-extrabold text-slate-700">
                    <span>التقدّم</span>
                    <span className="text-indigo-600">
                      الخطوة {Math.min(currentStepIdx + 1, workflowSteps.length)} من{" "}
                      {workflowSteps.length}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${workflowProgressPct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {workflowSteps.map((step, i) => {
                      const done = step.status === "Approved";
                      const rejected = step.status === "Rejected";
                      const current = i === currentStepIdx && request.status === "Pending";
                      return (
                        <span
                          key={i}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                            done
                              ? "bg-emerald-500 text-white"
                              : rejected
                              ? "bg-red-500 text-white"
                              : current
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {i + 1}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-5 overflow-x-auto px-1 pb-2 pt-2 [mask-image:linear-gradient(to_right,transparent_0,black_20px,black_calc(100%-20px),transparent_100%)]">
                {workflowSteps.map((step, idx) => {
                  const lastIdx = workflowSteps.length - 1;
                  const isLast = idx === lastIdx;

                  const isFinalApproved =
                    isLast &&
                    request.status === "Approved" &&
                    step.status === "Approved";

                  const delegatedToId = getId(step?.voucherDelegateTo);
                  const delegatedToUsername = String(step?.voucherDelegateToUsername || "").trim();
                  const processedByUsername = String(step?.voucherProcessedByUsername || "").trim();
                  const currentUserId = getId(currentUser);
                  const currentUsername = String(currentUser?.username || "").trim();

                  const isLastStepUser =
                    isLast &&
                    currentUser &&
                    step.users?.some(
                      (u) => sameUser(u, currentUser)
                    );

                  const canOpenVoucherActions =
                    isFinalApproved &&
                    isLastStepUser &&
                    (
                      !delegatedToId ||
                      sameUser(step?.voucherDelegateTo, currentUser) ||
                      (delegatedToUsername &&
                        delegatedToUsername === currentUsername)
                    );
                  const isDelegatedCurrentUser =
                    (!!delegatedToId && sameUser(step?.voucherDelegateTo, currentUser)) ||
                    (delegatedToUsername && delegatedToUsername === currentUsername);
                  const delegateDisburseApproved = Boolean(
                    step?.voucherProcessedAt || step?.voucherProcessedBy
                  );
                  const delegateAwaitingApprove =
                    isFinalApproved && isDelegatedCurrentUser && !delegateDisburseApproved;
                  const canUseVoucherByPermissionOrDelegation =
                    canCreateVoucherForCompany || isDelegatedCurrentUser;

                  const wasDelegatedOnStep =
                    !!delegatedToId || !!delegatedToUsername;
                  const canDelegateViewDisbursedVoucher =
                    canDelegateVoucher &&
                    isFinalApproved &&
                    hasLinkedVoucher &&
                    wasDelegatedOnStep;
                  const showFullVoucherActions =
                    canOpenVoucherActions &&
                    canUseVoucherByPermissionOrDelegation &&
                    !delegateAwaitingApprove;
                  const showDelegatePrintOnly =
                    canDelegateViewDisbursedVoucher && !showFullVoucherActions;

                  const isCurrent = idx === request.currentStep;
                  const canApproveFinalStep =
                    !isLast || approvalOnlyCompany || canDelegateVoucher;

                  const canAct =
                    (request.status === "Pending" ||
                      request.status === "Rejected") &&
                    isCurrent &&
                    step.status === "Pending" &&
                    canApproveFinalStep &&
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
                    relative min-w-[320px] max-w-[360px] shrink-0 rounded-3xl p-5
                    bg-white/55 backdrop-blur-xl
                    ring-1 ring-slate-200/60
                    shadow-[0_16px_40px_-24px_rgba(0,0,0,0.28)]
                    transition duration-300
                  `;

                  const cardHover = isCancelled
                    ? "cursor-not-allowed opacity-80"
                    : "cursor-pointer hover:-translate-y-1 hover:bg-white/80 hover:shadow-[0_20px_45px_-22px_rgba(0,0,0,0.2)] hover:ring-indigo-200/60";

                  const currentRing =
                    isCurrent && !isCancelled && request.status === "Pending"
                      ? "ring-2 ring-indigo-400/50"
                      : "";

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
                        {(hasComment || hasAttach) && !isCancelled && (
                          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-indigo-700 ring-1 ring-indigo-200/70">
                            <FiMessageSquare className="text-sm" />
                            <span className="text-[10px] font-extrabold">عرض</span>
                          </div>
                        )}

                        {/* HEADER */}
                        <div className="relative flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-extrabold text-white ${
                                isCancelled
                                  ? "bg-gray-500"
                                  : step.status === "Approved"
                                  ? "bg-emerald-600"
                                  : step.status === "Rejected"
                                  ? "bg-red-600"
                                  : isCurrent
                                  ? "bg-indigo-600"
                                  : "bg-slate-800"
                              }`}
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
                                <div className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                                  <FiCalendar className="text-slate-400" />
                                  <span>{fmtDateTimeEn(step.actedAt)}</span>
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
                            const userId = getId(user);
                            const acted =
                              step.status !== "Pending" &&
                              step.actedBy &&
                              sameUser(step.actedBy, user);
                            const isDelegated =
                              (
                                (!!delegatedToId && sameUser(step?.voucherDelegateTo, user)) ||
                                (delegatedToUsername &&
                                  delegatedToUsername === String(user?.username || "").trim())
                              );
                            const isVoucherProcessed =
                              !!step?.voucherProcessedBy &&
                              (
                                sameUser(step?.voucherProcessedBy, user) ||
                                (processedByUsername &&
                                  processedByUsername === String(user?.username || "").trim())
                              );

                            const rowBase =
                              "flex items-center gap-3 p-3 rounded-2xl " +
                              "bg-white/70 ring-1 ring-slate-200/50";

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
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    {isDelegated && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                                        <FiUserCheck className="text-[11px]" />
                                        مخوّل
                                      </span>
                                    )}
                                    {isVoucherProcessed && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                        <FiCheckCircle className="text-[11px]" />
                                        صرف
                                      </span>
                                    )}
                                  </div>
                                  {acted && (
                                    <p className="text-[12px] font-semibold text-slate-500">
                                      اتخذ إجراء
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
                          <div className="mt-5 grid grid-cols-2 gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStep(idx);
                                setCommentAction("approve");
                                setCommentText("");
                                setStepAttachment(null);
                                setShowCommentModal(true);
                              }}
                              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              <FiCheckCircle /> موافقة
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
                              className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-700"
                            >
                              <FiXCircle /> رفض
                            </button>
                          </div>
                        )}

                        {delegateAwaitingApprove && !isCancelled && !approvalOnlyCompany && (
                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setApprovingDisburse(true);
                                try {
                                  const res = await fetch(
                                    `/api/requests/${id}?company=${companyKey}`,
                                    {
                                      method: "PUT",
                                      credentials: "include",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        action: "delegate_disburse_approve",
                                        stepIndex: idx,
                                      }),
                                    }
                                  );
                                  const json = await res.json().catch(() => ({}));
                                  if (!res.ok || !json?.success) {
                                    alert(json?.error || "تعذر  الصرف");
                                    return;
                                  }
                                  await fetchData();
                                } catch {
                                  alert("خطأ في الاتصال");
                                } finally {
                                  setApprovingDisburse(false);
                                }
                              }}
                              disabled={approvingDisburse}
                              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {approvingDisburse ? (
                                <>
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  جاري الاعتماد...
                                </>
                              ) : (
                                <>
                                  <FiCheckCircle />  موافقة
                                </>
                              )}
                            </button>
                            <p className="mt-2 text-center text-[11px] font-semibold text-emerald-800">
                               الصرف أولاً — ثم إنشاء أو رفع الوصل
                            </p>
                          </div>
                        )}

{(showFullVoucherActions || showDelegatePrintOnly) &&
  isFinalApproved &&
  !approvalOnlyCompany &&
  ["Badur-Baghdad", "Al-Ghadeer", "010", "Tiba-Al-najaf", "Ghadeer-Karbala"].includes(companyKey) && (
    <div className="mt-4 flex flex-col gap-2">
      {voucherNoLabel ? (
        <p className="text-center text-sm font-extrabold text-emerald-800">
          وصل صرف رقم {voucherNoLabel}
        </p>
      ) : null}
      <motion.div className={`flex gap-3 ${showDelegatePrintOnly ? "" : ""}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowVoucherModal(true);
          }}
          className="flex-1 rounded-2xl bg-slate-900 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-black"
        >
          {showPrintVoucher || showDelegatePrintOnly
            ? "طباعة الوصل"
            : "إنشاء وصل صرف"}
        </button>

        {showFullVoucherActions && !showDelegatePrintOnly ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowVoucherAttachModal(true);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-2.5 text-sm font-extrabold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
          >
            <FiUploadCloud />
            رفق الوصل
          </button>
        ) : null}
      </motion.div>
    </div>
  )}
{isFinalApproved &&
  isLastStepUser &&
  canDelegateVoucher &&
  !approvalOnlyCompany &&
  !hasLinkedVoucher &&
  !delegateDisburseApproved &&
  ["Badur-Baghdad", "Al-Ghadeer", "010", "Tiba-Al-najaf", "Ghadeer-Karbala"].includes(companyKey) && (
    <div
      className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 ring-1 ring-indigo-200/60"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-extrabold text-indigo-800 mb-2">تخويل مستخدم للصرف/رفع الوصل</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={delegateUserId}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            const nextUserId = e.target.value;
            setDelegateUserId(nextUserId);
            const options =
              request?.delegationVoucherOptionsByUser?.[nextUserId] || [];
            const norm = (k) => String(k || "").trim().toLowerCase();
            const hit = options.find((o) => norm(o.key) === norm(effectiveVoucherCompanyKey));
            setDelegateVoucherCompanyKey(
              hit?.key || options.find((o) => o.isDefault)?.key || options[0]?.key || ""
            );
          }}
          className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">اختر مستخدم</option>
          {(step.users || []).map((u) => (
            <option key={getId(u) || getUsername(u)} value={getId(u) || getUsername(u)}>
              {u.username}
            </option>
          ))}
        </select>
        <select
          value={delegateVoucherCompanyKey}
          disabled={!delegateUserId}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            setDelegateVoucherCompanyKey(e.target.value);
          }}
          className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
        >
          <option value="">اختر وصل الصرف</option>
          {(request?.delegationVoucherOptionsByUser?.[delegateUserId] || []).map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            if (!delegateUserId) {
              alert("اختَر مستخدم للتخويل");
              return;
            }
            if (!delegateVoucherCompanyKey) {
              alert("اختَر وصل الصرف للتخويل");
              return;
            }
            setDelegating(true);
            try {
              const res = await fetch(`/api/requests/${id}?company=${companyKey}`, {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "delegate_voucher",
                  stepIndex: idx,
                  delegateToUserId: delegateUserId.length === 24 ? delegateUserId : "",
                  delegateToUsername: delegateUserId.length === 24 ? "" : delegateUserId,
                  delegateVoucherCompanyKey,
                }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok || !json?.success) {
                throw new Error(json?.error || "فشل التخويل");
              }
              await fetchData();
              setDelegateUserId("");
              setDelegateVoucherCompanyKey("");
            } catch (err) {
              alert(err?.message || "تعذر تنفيذ التخويل");
            } finally {
              setDelegating(false);
            }
          }}
          disabled={!delegateUserId || !delegateVoucherCompanyKey || delegating}
          className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {delegating ? "جاري التخويل..." : "تخويل"}
        </button>
      </div>
      {delegatedToId && (
        <p className="mt-2 text-[12px] font-semibold text-indigo-700">
          تم التخويل بواسطة {step?.voucherDelegatedBy?.username || "-"}
          {step?.voucherDelegateCompanyKey
            ? ` على وصل ${
                COMPANIES.find(
                  (c) =>
                    String(c.key).trim().toLowerCase() ===
                    String(step.voucherDelegateCompanyKey).trim().toLowerCase()
                )?.name || step.voucherDelegateCompanyKey
              }`
            : ""}
          .
        </p>
      )}
    </div>
  )}
                      </motion.div>

                      {/* ARROW */}
                      {idx !== workflowSteps.length - 1 && (
                        <motion.div
                          className="flex shrink-0 items-center self-center select-none text-2xl text-indigo-400/90"
                          animate={{ x: [0, 6, 0], opacity: [0.55, 1, 0.55] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          aria-hidden
                        >
                          →
                        </motion.div>
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
  loading={submittingAction}
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
          setSubmittingAction(true);
          try {
            const res = await fetch(`/api/requests/${id}?company=${companyKey}`, {
              method: "PUT",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: commentAction,
                note: commentText,
                stepIndex: Number.isInteger(activeStep) ? activeStep : null,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json?.success) {
              alert(json?.error || "تعذر تنفيذ الإجراء");
              return;
            }

            await fetchData();

            setShowCommentModal(false);
            setActiveStep(null);
            setCommentAction(null);
            setCommentText("");
            setStepAttachment(null);

            router.refresh();
          } finally {
            setSubmittingAction(false);
          }
        }
  }
/>

      <VoucherModal
        open={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        request={request}
        companyKey={hasLinkedVoucher ? companyKey : effectiveVoucherCompanyKey}
        requestCompanyKey={companyKey}
        requestId={id}
        treatAsExisting={hasLinkedVoucher}
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
      </div>
    </motion.div>
  );
}

function RequestDetailsLoading() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="relative mx-auto w-full max-w-7xl min-h-[70vh]">
        <div className="pointer-events-none select-none space-y-6 opacity-[0.45]">
          <div className="h-44 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/70" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-white/70 ring-1 ring-slate-200/60"
              />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
            <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
          </div>
          <div className="h-56 animate-pulse rounded-3xl bg-white/70 ring-1 ring-slate-200/60" />
        </div>

        <div className="fixed inset-0 z-20 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white/90 px-8 py-10 text-center shadow-[0_24px_60px_-24px_rgba(79,70,229,0.18)] ring-1 ring-slate-200/60 backdrop-blur-md"
          >
            <div className="relative mx-auto h-16 w-16">
              <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-200/90 border-t-indigo-600" />
              <span
                className="absolute inset-2.5 animate-spin rounded-full border-[3px] border-slate-100 border-b-blue-500"
                style={{ animationDirection: "reverse", animationDuration: "0.85s" }}
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <ColoredIcon color="text-indigo-600" size="sm">
                  <FiLayers />
                </ColoredIcon>
              </span>
            </div>

            <p className="mt-6 text-base font-extrabold text-slate-900">جاري تحميل الطلب</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-500">يرجى الانتظار...</p>

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-indigo-500/80"
                  animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1, 0.85] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function HeroMetaChip({ icon, iconColor = "text-slate-600", children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200/90 shadow-sm">
      <span className={iconColor}>{icon}</span>
      {children}
    </span>
  );
}

function ColoredIcon({ color = "text-blue-600", children, size = "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const ic = size === "sm" ? "text-sm" : "text-base";
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200/90 shadow-sm ${color} ${ic}`}
    >
      {children}
    </span>
  );
}

function KpiCard({ label, value, sub, icon, iconColor = "text-blue-600" }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/75 p-4 ring-1 ring-slate-200/70 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.15)] hover:ring-slate-300/80">
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/90 shadow-sm transition duration-300 group-hover:scale-105">
          <span className={`text-lg ${iconColor}`}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-base font-extrabold text-slate-900 sm:text-lg">{value}</p>
          {sub ? (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{sub}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, icon, iconColor = "text-gray-700", className = "" }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl bg-white/70 p-3.5 ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-slate-300/70 ${className}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/90 shadow-sm">
        <span className={`text-base ${iconColor}`}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-500">{label}</div>
        <div className="mt-0.5 break-words text-[15px] font-extrabold text-slate-900">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, badge, badgeClass, children }) {
  return (
    <motion.div
      className="mb-8 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/50 backdrop-blur-xl transition duration-300 hover:border-slate-300/80 hover:bg-white hover:shadow-[0_22px_50px_-26px_rgba(0,0,0,0.14)] sm:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 md:text-xl">
          {icon} {title}
        </h2>
        {badge ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${
              badgeClass || "bg-blue-50 text-blue-700 ring-blue-200/70"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="text-[15px] text-slate-800">{children}</div>
    </motion.div>
  );
}