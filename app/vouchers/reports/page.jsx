"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { createPortal } from "react-dom";

import {
  FiFilter,
  FiCalendar,
  FiHome,
  FiRotateCcw,
  FiSearch,
  FiLayers,
  FiShield,
  FiDownload,
  FiFileText,
  FiHash,
  FiUser,
  FiCreditCard,
} from "react-icons/fi";

import { FaMoneyBillWave } from "react-icons/fa6";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import TablePagination from "@/components/TablePagination";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

import { COMPANIES } from "@/lib/voucher/companies";

const getCompanyName = (key) => {
  if (!key) return "-";
  const found = COMPANIES.find((c) => String(c.key).toLowerCase() === String(key).toLowerCase());
  return found ? found.name : key;
};

export default function VoucherReportsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const PAGE_SIZE = 25;
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [page, setPage] = useState(1);

  const [companiesOptions, setCompaniesOptions] = useState([]);
  const [modes, setModes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [attachmentsModal, setAttachmentsModal] = useState({
    open: false,
    rowId: null,
    rowName: "",
    attachments: [],
  });

  const [companyFilter, setCompanyFilter] = useState({
    value: "all",
    label: "كل الشركات",
  });

  const [modeFilter, setModeFilter] = useState({
    value: "all",
    label: "كل الوصولات",
  });

  const [currencyFilter, setCurrencyFilter] = useState({
    value: "all",
    label: "كل العملات",
  });

  const [date, setDate] = useState({ from: "", to: "" });

  const [seqInput, setSeqInput] = useState("");
  const [beneficiaryInput, setBeneficiaryInput] = useState("");
  const [receivedByInput, setReceivedByInput] = useState("");
  const [bankInput, setBankInput] = useState("");

  // smart search
  const [smartInput, setSmartInput] = useState("");
  const [smartPicked, setSmartPicked] = useState(null);
  const [smartOptions, setSmartOptions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [portalReady, setPortalReady] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRefs = useRef({});
  const inputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });

  const hasSearchedRef = useRef(false);

  const { permissions } = usePermissions();

  const canViewReports =
    Array.isArray(permissions) &&
    (permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
     permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
     permissions.includes(PERMISSIONS.RECEIPTS));

  useEffect(() => setPortalReady(true), []);

  const [menuTarget, setMenuTarget] = useState(null);
  useEffect(() => {
    setMenuTarget(document.body);
  }, []);

  const selectMenuProps = useMemo(
    () => ({
      menuPortalTarget: menuTarget,
      menuPosition: "fixed",
    }),
    [menuTarget]
  );

  const selectStyles = useMemo(
    () => ({
      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      menu: (base) => ({
        ...base,
        zIndex: 9999,
        borderRadius: 12,
        overflow: "hidden",
        fontSize: 13,
        fontWeight: 900,
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
          ? "#111827"
          : state.isFocused
          ? "#f3f4f6"
          : "white",
        color: state.isSelected ? "white" : "#0f172a",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 900,
        paddingTop: 9,
        paddingBottom: 9,
      }),
      control: (base, state) => ({
        ...base,
        borderRadius: 12,
        borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
        boxShadow: "none",
        minHeight: 42,
        backgroundColor: "rgba(255,255,255,0.94)",
        transition: "border-color 120ms ease",
        fontSize: 13,
        fontWeight: 900,
        ":hover": { borderColor: "#cbd5e1" },
      }),
      placeholder: (base) => ({ ...base, color: "#94a3b8", fontWeight: 900 }),
      indicatorSeparator: () => ({ display: "none" }),
      singleValue: (base) => ({ ...base, fontWeight: 900 }),
      input: (base) => ({ ...base, fontWeight: 900 }),
    }),
    []
  );

  const noClearComponents = useMemo(
    () => ({
      IndicatorSeparator: () => null,
      ClearIndicator: () => null,
    }),
    []
  );

  const stats = useMemo(() => {
    const payment = rows.filter((x) => x.mode === "payment").length;
    const receipt = rows.filter((x) => x.mode === "receipt").length;
    const zero = rows.filter((x) => Number(x.amount || 0) === 0).length;

    return {
      total: meta.total || 0,
      payment,
      receipt,
      zero,
      nonZero: rows.filter((x) => Number(x.amount || 0) !== 0).length,
    };
  }, [rows, meta.total]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await fetch("/api/vouchers/reports?filters=1", {
          credentials: "include",
        });
        const json = await res.json();
        if (!json?.success) return;

        const apiCompanies = json.filters?.companies || [];

        setCompaniesOptions([
          { value: "all", label: "كل الشركات" },
          ...apiCompanies.map((key) => ({
            value: key,
            label: getCompanyName(key),
          })),
        ]);

        setModes([
          { value: "all", label: "كل الوصولات" },
          { value: "payment", label: "وصل صرف" },
          { value: "receipt", label: "وصل قبض" },
        ]);

        setCurrencies([
          { value: "all", label: "كل العملات" },
          ...((json.filters?.currencies || []).map((c) => ({
            value: c,
            label: c,
          })) || []),
        ]);
      } catch (err) {
        console.error("❌ Error loading voucher filters:", err);
      }
    };

    loadFilters();
  }, []);

  const recalcSuggestPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSuggestPos({
      left: r.left,
      top: r.bottom + 8,
      width: r.width,
    });
  }, []);

  const fetchSuggestions = useCallback(async () => {
    const q = smartInput.trim();

    if (!q) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    try {
      const res = await fetch(
        `/api/vouchers/reports?suggest=1&q=${encodeURIComponent(q)}`,
        { credentials: "include" }
      );
      const json = await res.json();

      if (json?.success) {
        const arr = Array.isArray(json.data) ? json.data : [];
        setSmartOptions(arr);

        if (arr.length > 0) {
          recalcSuggestPos();
          setShowSuggest(true);
          setActiveIdx(-1);
        } else {
          setShowSuggest(false);
          setActiveIdx(-1);
        }
      }
    } catch (err) {
      console.error("❌ Suggest error:", err);
    }
  }, [smartInput, recalcSuggestPos]);

  useEffect(() => {
    const q = smartInput.trim();

    if (!q) {
      setSmartOptions([]);
      setShowSuggest(false);
      setActiveIdx(-1);
      return;
    }

    const t = setTimeout(() => {
      fetchSuggestions();
    }, 250);

    return () => clearTimeout(t);
  }, [smartInput, fetchSuggestions]);

  useEffect(() => {
    if (!showSuggest) return;
    recalcSuggestPos();

    const onScrollOrResize = () => recalcSuggestPos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [showSuggest, recalcSuggestPos]);

  useEffect(() => {
    const onDown = (e) => {
      const inp = inputRef.current;
      const box = suggestBoxRef.current;

      const insideInput = inp && inp.contains(e.target);
      const insideBox = box && box.contains(e.target);

      if (!insideInput && !insideBox) {
        setShowSuggest(false);
        setActiveIdx(-1);
      }
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pickSuggestion = (opt) => {
    if (!opt) return;
    setSmartPicked(opt);
    setSmartInput(String(opt.value || opt.label || ""));
    setShowSuggest(false);
    setActiveIdx(-1);
  };

  const openAttachmentsModal = useCallback((row) => {
    setAttachmentsModal({
      open: true,
      rowId: row._id,
      rowName: row.voucherNo || String(row.seq ?? "").padStart(5, "0"),
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    });
  }, []);

  const closeAttachmentsModal = useCallback(() => {
    setAttachmentsModal({
      open: false,
      rowId: null,
      rowName: "",
      attachments: [],
    });
  }, []);

  const handleDeleteAttachment = useCallback(async (rowId, attachmentKey) => {
    try {
      const ok = window.confirm("تأكيد حذف الاتاج؟");
      if (!ok) return;

      const res = await fetch("/api/vouchers/view", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: rowId,
          deleteAttachmentKey: attachmentKey,
        }),
      });

      const json = await res.json();

      if (!json?.success) {
        throw new Error(json?.error || "فشل حذف الاتاج");
      }

      setRows((prev) =>
        prev.map((x) =>
          x._id === rowId
            ? {
                ...x,
                attachments: (Array.isArray(x.attachments) ? x.attachments : []).filter(
                  (a) => a.key !== attachmentKey
                ),
              }
            : x
        )
      );

      setAttachmentsModal((prev) => ({
        ...prev,
        attachments: (Array.isArray(prev.attachments) ? prev.attachments : []).filter(
          (a) => a.key !== attachmentKey
        ),
      }));
    } catch (err) {
      console.error("❌ Delete attachment error:", err);
      alert(err.message || "فشل حذف الاتاج");
    }
  }, []);

  const onSmartKeyDown = (e) => {
    if (!showSuggest || smartOptions.length === 0) {
      if (e.key === "Enter") return;
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, smartOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && smartOptions[activeIdx]) {
        e.preventDefault();
        pickSuggestion(smartOptions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setShowSuggest(false);
      setActiveIdx(-1);
    }
  };

  const buildParams = useCallback(
    (pageValue, exportMode = false) => {
      const params = new URLSearchParams();

      const q = smartPicked?.value ? String(smartPicked.value) : smartInput.trim();
      if (q) params.set("q", q);

      params.set("company", companyFilter?.value || "all");
      params.set("mode", modeFilter?.value || "all");
      params.set("currency", currencyFilter?.value || "all");

      if (seqInput.trim()) params.set("seq", seqInput.trim());
      if (beneficiaryInput.trim()) params.set("beneficiary", beneficiaryInput.trim());
      if (receivedByInput.trim()) params.set("receivedBy", receivedByInput.trim());
      if (bankInput.trim()) params.set("bank", bankInput.trim());

      if (date.from) params.set("from", date.from);
      if (date.to) params.set("to", date.to);

      params.set("page", String(pageValue));
      params.set("pageSize", String(exportMode ? 200 : PAGE_SIZE));

      return params;
    },
    [
      smartPicked,
      smartInput,
      companyFilter,
      modeFilter,
      currencyFilter,
      seqInput,
      beneficiaryInput,
      receivedByInput,
      bankInput,
      date,
    ]
  );

  const fetchPage = useCallback(
    async (pageValue) => {
      setLoading(true);
      try {
        const params = buildParams(pageValue);
        const res = await fetch(`/api/vouchers/reports?${params.toString()}`, {
          credentials: "include",
        });
        const json = await res.json();

        if (json?.success) {
          setRows(json.data || []);
          setMeta(
            json.meta || {
              total: 0,
              totalPages: 0,
              page: pageValue,
              pageSize: PAGE_SIZE,
            }
          );
        } else {
          setRows([]);
          setMeta({
            total: 0,
            totalPages: 0,
            page: pageValue,
            pageSize: PAGE_SIZE,
          });
        }
      } catch (err) {
        console.error("❌ Error fetching voucher reports:", err);
        setRows([]);
        setMeta({
          total: 0,
          totalPages: 0,
          page: pageValue,
          pageSize: PAGE_SIZE,
        });
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  useEffect(() => {
    const onMessage = (event) => {
      if (event?.data?.type === "VOUCHER_UPDATED") {
        console.log("🔄 Received update notification from view page, refreshing rows...");
        fetchPage(page);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [fetchPage, page]);

  const triggerAttachmentPick = useCallback((rowId) => {
    const ref = fileInputRefs.current[rowId];
    if (ref) ref.click();
  }, []);

  const handleUploadAttachments = useCallback(async (row, files) => {
    if (!row?._id || !files?.length) return;

    try {
      setUploadingId(row._id);

      const uploadedAttachments = [];

      for (const file of files) {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            prefix: `vouchers/${row.companyKey}/${row.mode}/${row._id}`,
          }),
        });

        const presignJson = await presignRes.json();

        if (!presignJson?.success) {
          throw new Error(presignJson?.error || "Failed to create presigned URL");
        }

        const uploadUrl = presignJson.url;
        const fileKey = presignJson.key;
        const fileUrl = presignJson.getUrl || "";

        if (!uploadUrl || !fileKey) {
          throw new Error("Presign response missing url or key");
        }

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const attachment = {
          key: fileKey,
          name: file.name,
          url: fileUrl,
          contentType: file.type || "application/octet-stream",
          size: file.size || 0,
          uploadedAt: new Date().toISOString(),
        };

        const saveRes = await fetch("/api/vouchers/view", {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: row._id,
            company: row.companyKey,
            mode: row.mode,
            attachment,
          }),
        });

        const saveJson = await saveRes.json();

        if (!saveJson?.success) {
          throw new Error(saveJson?.error || `Failed to save ${file.name}`);
        }

        uploadedAttachments.push(attachment);
      }

      setRows((prev) =>
        prev.map((x) =>
          x._id === row._id
            ? {
                ...x,
                attachments: [
                  ...(Array.isArray(x.attachments) ? x.attachments : []),
                  ...uploadedAttachments,
                ],
              }
            : x
        )
      );

      alert("✅ تم رفع الاتاجات بنجاح");
    } catch (err) {
      console.error("❌ Upload attachments error:", err);
      alert(err.message || "فشل رفع الاتاجات");
    } finally {
      setUploadingId(null);
    }
  }, []);

  const handleSearch = async () => {
    hasSearchedRef.current = true;
    setPage(1);
    await fetchPage(1);
  };

  useEffect(() => {
    if (!hasSearchedRef.current) return;
    fetchPage(page);
  }, [page, fetchPage]);

  const handleReset = () => {
    setCompanyFilter({ value: "all", label: "كل الشركات" });
    setModeFilter({ value: "all", label: "كل الوصولات" });
    setCurrencyFilter({ value: "all", label: "كل العملات" });
    setDate({ from: "", to: "" });
    setSeqInput("");
    setBeneficiaryInput("");
    setReceivedByInput("");
    setBankInput("");
    setSmartInput("");
    setSmartPicked(null);
    setSmartOptions([]);
    setShowSuggest(false);
    setActiveIdx(-1);
    setRows([]);
    setMeta({ total: 0, totalPages: 0, page: 1, pageSize: PAGE_SIZE });
    setPage(1);
    hasSearchedRef.current = false;
  };

  const fmtAmount = (v) => {
    if (v === null || v === undefined || v === "") return "-";
  
    const cleaned = String(v).replace(/,/g, "").trim();
    const n = Number(cleaned);
  
    if (!Number.isFinite(n)) return "-";
  
    return new Intl.NumberFormat("en-US").format(n);
  };

  const modeBadge = (mode) => {
    const base =
      "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] font-extrabold border";

    if (mode === "payment") {
      return (
        <span className={`${base} bg-red-50 text-red-700 border-red-200`}>
          <FiFileText /> وصل صرف
        </span>
      );
    }

    return (
      <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
        <FiFileText /> وصل قبض
      </span>
    );
  };

  const fetchAllForExport = useCallback(async () => {
    const firstParams = buildParams(1, true);
    const firstRes = await fetch(`/api/vouchers/reports?${firstParams.toString()}`, {
      credentials: "include",
    });
    const firstJson = await firstRes.json();

    if (!firstJson?.success) return { all: [], totalPages: 0 };

    const totalPages = Number(firstJson?.meta?.totalPages || 1);
    const all = [...(firstJson.data || [])];

    for (let p = 2; p <= totalPages; p++) {
      const params = buildParams(p, true);
      const res = await fetch(`/api/vouchers/reports?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        all.push(...json.data);
      }
    }

    return { all, totalPages };
  }, [buildParams]);

  const handleExportExcel = useCallback(async () => {
    try {
      setLoading(true);

      const { all } = await fetchAllForExport();
      if (!all || all.length === 0) return;

      const rowsExcel = all.map((r) => ({
        Company: getCompanyName(r.companyKey),
        Mode: r.mode === "payment" ? "وصل صرف" : "وصل قبض",
        Seq: r.voucherNo || String(r.seq ?? "").padStart(5, "0"),
        Currency: r.currency || "-",
        Amount: (() => {
          const cleaned = String(r.amount ?? "").replace(/,/g, "").trim();
          const n = Number(cleaned);
          return Number.isFinite(n) ? n : "";
        })(),
        Beneficiary: r.beneficiary || "-",
        ReceivedBy: r.receivedBy || "-",
        Bank: r.bank || "-",
        Description: r.description || "-",
        Notes: r.notes || "-",
        Date:
          r.vDateDD && r.vDateMM && r.vDateYY
            ? `${r.vDateDD}/${r.vDateMM}/${r.vDateYY}`
            : r.voucherDate
            ? new Date(r.voucherDate).toLocaleDateString("en-GB")
            : r.createdAt
            ? new Date(r.createdAt).toLocaleDateString("en-GB")
            : "-",
      }));

      const ws = XLSX.utils.json_to_sheet(rowsExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Voucher Reports");
      XLSX.writeFile(
        wb,
        `Voucher_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e) {
      console.error("❌ Export vouchers error:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchAllForExport]);

  const Card = ({ icon: Icon, title, value }) => (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 backdrop-blur shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
      </div>

      <div className="relative px-5 py-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center shadow-sm">
          <Icon className="text-xl" />
        </div>

        <div>
          <div className="text-[14px] font-extrabold text-gray-500">{title}</div>
          <div className="text-2xl font-extrabold text-gray-900">{value}</div>
        </div>
      </div>
    </motion.div>
  );

  if (!Array.isArray(permissions)) return null;
  if (!canViewReports) return null;

  return (
    <motion.div
      className="min-h-screen p-5 md:p-7 text-[14px] md:text-[15px] font-bold"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5"
      >
        <div className="text-right">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center justify-end gap-3">
            <FiFilter className="text-blue-600" /> تقارير الوصولات
          </h1>
          <p className="text-sm text-gray-600 mt-1 font-bold">
            متابعة وصولات الصرف والقبض مع فتح الوصل بصفحة مستقلة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleSearch}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border font-extrabold text-[14px] ${
              loading
                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                : "bg-gray-900 text-white border-gray-900 hover:bg-black"
            }`}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <FiSearch /> بحث
              </>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-white/80 backdrop-blur border border-gray-200 text-gray-900 flex items-center gap-2 shadow-sm hover:bg-white font-extrabold text-[14px]"
          >
            <FiRotateCcw /> مسح
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleExportExcel}
            disabled={loading || rows.length === 0}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm border font-extrabold text-[14px] ${
              loading || rows.length === 0
                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                : "bg-white/80 backdrop-blur border-gray-200 text-gray-900 hover:bg-white"
            }`}
          >
            <FiDownload /> Excel
          </motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Card icon={FiLayers} title="المجموع" value={stats.total} />
        <Card icon={FiFileText} title="وصولات الصرف" value={stats.payment} />
        <Card icon={FiFileText} title="وصولات القبض" value={stats.receipt} />
      </div>

      <motion.div
        className="relative z-20 rounded-2xl border border-gray-200/80 bg-white/85 backdrop-blur shadow-sm p-5 md:p-6 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center justify-end gap-2 text-gray-900 font-extrabold mb-4 text-base">
          <FiShield className="text-gray-700" />
          الفلاتر
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiHome /> الشركة
            </label>
            <Select
              {...selectMenuProps}
              options={companiesOptions}
              placeholder="كل الشركات"
              value={companyFilter}
              onChange={(v) =>
                setCompanyFilter(v || { value: "all", label: "كل الشركات" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiFileText /> نوع الوصل
            </label>
            <Select
              {...selectMenuProps}
              options={modes}
              placeholder="كل الوصولات"
              value={modeFilter}
              onChange={(v) =>
                setModeFilter(v || { value: "all", label: "كل الوصولات" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FaMoneyBillWave /> العملة
            </label>
            <Select
              {...selectMenuProps}
              options={currencies}
              placeholder="كل العملات"
              value={currencyFilter}
              onChange={(v) =>
                setCurrencyFilter(v || { value: "all", label: "كل العملات" })
              }
              styles={selectStyles}
              isSearchable
              components={noClearComponents}
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiHash /> رقم الوصل
            </label>
            <input
              type="text"
              value={seqInput}
              onChange={(e) => setSeqInput(e.target.value)}
              placeholder="رقم الوصل"
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          {/* <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiUser /> المستفيد
            </label>
            <input
              type="text"
              value={beneficiaryInput}
              onChange={(e) => setBeneficiaryInput(e.target.value)}
              placeholder="اسم المستفيد"
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div> */}

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiUser /> استلمت من
            </label>
            <input
              type="text"
              value={receivedByInput}
              onChange={(e) => setReceivedByInput(e.target.value)}
              placeholder="استلمت من"
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiCreditCard /> البنك
            </label>
            <input
              type="text"
              value={bankInput}
              onChange={(e) => setBankInput(e.target.value)}
              placeholder="اسم البنك"
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiCalendar /> From
            </label>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          <div className="text-right">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiCalendar /> To
            </label>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 border border-gray-200 bg-white text-gray-900 outline-none font-extrabold text-[14px]"
            />
          </div>

          <div className="text-right lg:col-span-2">
            <label className="text-[13px] text-gray-700 mb-1 flex items-center justify-end gap-2 font-extrabold">
              <FiSearch /> بحث موحّد
            </label>

            <div className="relative flex gap-2">
              <input
                ref={inputRef}
                value={smartInput}
                onChange={(e) => {
                  setSmartInput(e.target.value);
                  setSmartPicked(null);
                  setActiveIdx(-1);
                }}
                onFocus={() => {
                  if (smartOptions.length > 0) {
                    recalcSuggestPos();
                    setShowSuggest(true);
                  }
                }}
                onKeyDown={onSmartKeyDown}
                placeholder="رقم / وصف / مستفيد / استلمت من / بنك"
                className="w-full rounded-xl px-4 py-2.5 border border-gray-200 bg-white text-gray-900 font-extrabold text-[16px] shadow-sm outline-none focus:border-gray-300"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {portalReady && showSuggest && smartOptions.length > 0 &&
        createPortal(
          <div
            ref={suggestBoxRef}
            style={{
              position: "fixed",
              left: suggestPos.left,
              top: suggestPos.top,
              width: suggestPos.width,
              zIndex: 99999,
            }}
            className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
          >
            {smartOptions.slice(0, 12).map((opt, idx) => (
              <button
                key={`${opt.type || "x"}-${opt.value}-${idx}`}
                type="button"
                onClick={() => pickSuggestion(opt)}
                className={`w-full text-right px-4 py-3 text-[15px] font-extrabold ${
                  idx === activeIdx ? "bg-gray-100" : "bg-white"
                } hover:bg-gray-100`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div className="flex flex-col items-center py-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-700 font-extrabold text-lg">جاري التحميل</p>
          </motion.div>
        ) : rows.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 overflow-hidden rounded-3xl border border-white/30 bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.35)]"
          >
            <div className="relative overflow-x-auto">
              <table className="min-w-[1600px] w-full text-[15px] md:text-[16px] text-slate-800 font-bold">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-white/80 backdrop-blur border-b border-white/40">
                    {[
                      "الشركة",
                      "نوع الوصل",
                      "رقم الوصل",
                      "العملة",
                      "المبلغ",
                      // "المستفيد",
                      "استلمت من",
                      "البنك",
                      "الوصف",
                      "الاتاج",
                      "التاريخ",
                    ].map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="px-6 py-4 text-right text-[13px] md:text-[14px] font-extrabold tracking-wide text-slate-900 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/30">
                  {rows.map((r, idx) => (
                    <motion.tr
                      key={r._id}
                      whileHover={{ backgroundColor: "rgba(2,132,199,0.08)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() =>
                        window.open(
                          `/vouchers/view?company=${encodeURIComponent(
                            r.companyKey
                          )}&mode=${encodeURIComponent(
                            r.mode
                          )}&id=${encodeURIComponent(r._id)}`,
                          "_blank"
                        )
                      }
                      className={`cursor-pointer ${
                        idx % 2 === 0 ? "bg-white/30" : "bg-white/20"
                      } hover:bg-white/45`}
                    >
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {getCompanyName(r.companyKey)}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {modeBadge(r.mode)}
                      </td>

                      <td className="px-6 py-4 text-right font-mono text-slate-900 whitespace-nowrap">
                        {r.voucherNo || String(r.seq ?? "").padStart(5, "0")}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap font-extrabold">
                        {r.currency || "-"}
                      </td>

                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {fmtAmount(r.amount)}
                      </td>

                      {/* <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.beneficiary || "-"}
                      </td> */}

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.receivedBy || "-"}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {r.bank || "-"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="max-w-[320px] truncate text-slate-700">
                          {r.description || "-"}
                        </div>
                      </td>

                      <td
                        className="px-6 py-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="file"
                          hidden
                          multiple
                          ref={(el) => {
                            fileInputRefs.current[r._id] = el;
                          }}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length) handleUploadAttachments(r, files);
                            e.target.value = "";
                          }}
                        />

                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => triggerAttachmentPick(r._id)}
                            disabled={uploadingId === r._id}
                            className={`px-3 py-2 rounded-xl border text-[13px] font-extrabold transition ${
                              uploadingId === r._id
                                ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                                : "bg-white hover:bg-gray-50 text-slate-900 border-gray-200"
                            }`}
                          >
                            {uploadingId === r._id ? "جاري الرفع..." : "رفع مرفق"}
                          </button>

                          {Array.isArray(r.attachments) && r.attachments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => openAttachmentsModal(r)}
                              className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[13px] font-extrabold hover:bg-blue-100"
                            >
                              عرض الاتاجات ({r.attachments.length})
                            </button>
                          ) : (
                            <span className="text-[12px] text-slate-400">لا يوجد</span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap text-slate-700">
                        {r.vDateDD && r.vDateMM && r.vDateYY
                          ? `${r.vDateDD}/${r.vDateMM}/${r.vDateYY}`
                          : r.voucherDate
                          ? new Date(r.voucherDate).toLocaleDateString("en-GB")
                          : r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="relative px-5 py-4 bg-white/65 backdrop-blur border-t border-white/30 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-700 font-extrabold">
                Total: <span className="text-slate-900">{meta.total}</span>
                {"  "} | Page: <span className="text-slate-900">{meta.page}</span>
                {" / "}
                <span className="text-slate-900">{meta.totalPages || 1}</span>
              </div>

              <TablePagination
                page={page}
                totalPages={meta.totalPages || 1}
                onPage={setPage}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-slate-700 font-extrabold py-16 rounded-3xl border border-white/30 bg-white/55 backdrop-blur-xl shadow-[0_18px_55px_-28px_rgba(0,0,0,0.25)] text-lg"
          >
            No data (press Search).
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attachmentsModal.open && (
          <motion.div
            className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAttachmentsModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={closeAttachmentsModal}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-extrabold hover:bg-gray-50"
                >
                  إغلاق
                </button>

                <div className="text-right">
                  <div className="text-lg font-extrabold text-gray-900">الاتاجات</div>
                  <div className="text-sm text-gray-500 font-bold">
                    الوصل: {attachmentsModal.rowName}
                  </div>
                </div>
              </div>

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
                {attachmentsModal.attachments.length > 0 ? (
                  attachmentsModal.attachments.map((att, idx) => (
                    <div
                      key={`${att.key || att.name}-${idx}`}
                      className="rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteAttachment(attachmentsModal.rowId, att.key)
                          }
                          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[13px] font-extrabold hover:bg-red-100"
                        >
                          حذف
                        </button>

                        <a
                          href={att?.url ? encodeURI(att.url) : "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-[13px] font-extrabold hover:bg-blue-100"
                        >
                          فتح
                        </a>
                      </div>

                      <div className="text-right min-w-0">
                        <div className="font-extrabold text-gray-900 truncate">
                          {att.name || `ملف ${idx + 1}`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {att.contentType || "-"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 font-extrabold py-8">
                    لا توجد اتاجات
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}