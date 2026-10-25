"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
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
  FiTrash2,
  FiCheckCircle,
  FiUploadCloud,
  FiExternalLink,
  FiPrinter,
  FiType,
  FiMinus,
  FiPlus,
  FiLink,
  FiX,
  FiLoader,
} from "react-icons/fi";

import { FaMoneyBillWave } from "react-icons/fa6";
import { usePermissions } from "@/context/PermissionContext";
import { useUser } from "@/context/UserContext";
import { PERMISSIONS } from "@/lib/permission";
import TablePagination from "@/components/TablePagination";
import VoucherModeBadge from "@/components/VoucherModeBadge";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

import { COMPANIES } from "@/lib/voucher/companies";
import { formatAmount, isAlGhadeerMain } from "@/lib/voucher/utils";
import { formatVoucherDateDisplay } from "@/lib/voucher/voucherDate";
import { formatCategoryChecksLabels } from "@/lib/voucher/voucherLayout";
import { prefetchVoucherLayouts } from "@/lib/voucher/voucherLayoutCache";
import {
  buildDailyCashPrintPackages,
  buildDailyCashPrintPreviewHtml,
  clampPrintFontSize,
  listDailyCashPrintCompanies,
  openBlankDailyCashPrintWindow,
  openDailyCashPrintWindow,
} from "@/lib/voucher/dailyCashPrint";
import { attachmentOpenHref } from "@/lib/s3/browserOpenAttachment";
import { normalizePersonName, personNameKey } from "@/lib/voucher/normalizePersonName";
import { uploadPersonIdentityFiles } from "@/lib/voucher/uploadPersonIdentityClient";

const getCompanyName = (key) => {
  if (!key) return "-";
  const found = COMPANIES.find((c) => String(c.key).toLowerCase() === String(key).toLowerCase());
  return found ? found.name : key;
};

const getCompanyByKey = (key) =>
  COMPANIES.find((c) => String(c.key).toLowerCase() === String(key || "").toLowerCase()) ||
  null;

const isBadurSignatureKey = (key) =>
  String(key || "").trim().toLowerCase() === "badur-signature";

const getVoucherCustomerName = (row) => {
  if (!row) return "";
  return String(row.receivedBy || "").trim();
};

const getIdentityAttachmentsFromEntry = (entry) => {
  if (!entry) return [];
  if (Array.isArray(entry.attachments)) return entry.attachments.filter((item) => item?.url);
  if (entry.attachment?.url) return [entry.attachment];
  return [];
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
  const [deleteAttConfirm, setDeleteAttConfirm] = useState({
    open: false,
    rowId: null,
    att: null,
  });
  const [deletingAttKey, setDeletingAttKey] = useState(null);

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
  const [uploadingIdentityKey, setUploadingIdentityKey] = useState(null);
  const [deletingIdentityKey, setDeletingIdentityKey] = useState(null);
  const [identityByKey, setIdentityByKey] = useState({});
  const [identityModal, setIdentityModal] = useState({
    open: false,
    rowId: null,
    personName: "",
    personKey: "",
    attachments: [],
    loading: false,
  });
  const [printModal, setPrintModal] = useState({
    open: false,
    vouchers: [],
    companies: [],
    balances: {},
    fontSize: 9,
    fontBold: true,
  });
  const [fontSettingsOpen, setFontSettingsOpen] = useState(false);
  const [savingFontPrefs, setSavingFontPrefs] = useState(false);
  const [fontPrefsLoaded, setFontPrefsLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const identityModalFileRef = useRef(null);
  const fileInputRefs = useRef({});
  const inputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });

  const hasSearchedRef = useRef(false);

  const { permissions, user: permUser } = usePermissions();
  const { user: ctxUser } = useUser();
  const printerUsername = String(
    permUser?.username || ctxUser?.username || ""
  ).trim();

  const canViewReports =
    Array.isArray(permissions) &&
    (permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
     permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
     permissions.includes(PERMISSIONS.RECEIPTS));

  const canExportEmptyForm =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.MANAGE_PERMISSIONS);

  const canLinkRequest =
    Array.isArray(permissions) &&
    (permissions.includes(PERMISSIONS.VOUCHER_DELEGATE) ||
      permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
      permissions.includes(PERMISSIONS.MANAGE_PERMISSIONS));

  const [linkModal, setLinkModal] = useState({
    open: false,
    voucher: null,
  });
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState([]);
  const [linkSearching, setLinkSearching] = useState(false);
  const [linkBusyId, setLinkBusyId] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkOkMsg, setLinkOkMsg] = useState("");
  const linkSearchTimer = useRef(null);

  const openLinkRequestModal = useCallback((voucherRow) => {
    if (!voucherRow?._id) return;
    setLinkModal({ open: true, voucher: voucherRow });
    setLinkQuery("");
    setLinkResults([]);
    setLinkError("");
    setLinkOkMsg("");
    setLinkBusyId("");
  }, []);

  const closeLinkRequestModal = useCallback(() => {
    setLinkModal({ open: false, voucher: null });
    setLinkQuery("");
    setLinkResults([]);
    setLinkError("");
    setLinkOkMsg("");
    setLinkBusyId("");
  }, []);

  const searchRequestsForLink = useCallback(async (q) => {
    const query = String(q || "").trim();
    if (!query) {
      setLinkResults([]);
      setLinkSearching(false);
      return;
    }
    setLinkSearching(true);
    setLinkError("");
    try {
      const res = await fetch(
        `/api/vouchers/link-request?q=${encodeURIComponent(query)}`,
        { credentials: "include", cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setLinkResults([]);
        setLinkError(json?.error || "فشل البحث");
        return;
      }
      setLinkResults(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      setLinkResults([]);
      setLinkError(err?.message || "فشل البحث");
    } finally {
      setLinkSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!linkModal.open) return undefined;
    if (linkSearchTimer.current) clearTimeout(linkSearchTimer.current);
    linkSearchTimer.current = setTimeout(() => {
      void searchRequestsForLink(linkQuery);
    }, 280);
    return () => {
      if (linkSearchTimer.current) clearTimeout(linkSearchTimer.current);
    };
  }, [linkQuery, linkModal.open, searchRequestsForLink]);

  const confirmLinkRequest = useCallback(
    async (requestRow) => {
      const voucher = linkModal.voucher;
      if (!voucher?._id || !requestRow?._id) return;
      setLinkBusyId(String(requestRow._id));
      setLinkError("");
      setLinkOkMsg("");
      try {
        const res = await fetch("/api/vouchers/link-request", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voucherId: voucher._id,
            requestId: requestRow._id,
            requestCompanyKey: requestRow.companyKey,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success) {
          setLinkError(json?.error || "فشل ربط الوصل بالطلب");
          return;
        }
        const href =
          json?.requestLink?.href ||
          `/requests/${encodeURIComponent(requestRow.companyKey)}/${encodeURIComponent(requestRow._id)}`;
        const requestCode = String(requestRow.requestCode || "").trim();
        setRows((prev) =>
          prev.map((row) =>
            String(row._id) === String(voucher._id)
              ? {
                  ...row,
                  requestId: requestRow._id,
                  requestCode,
                  requestCompanyKey: requestRow.companyKey,
                  requestLink: { href, requestCode },
                }
              : row
          )
        );
        setLinkOkMsg(json.message || "تم الربط");
        setTimeout(() => closeLinkRequestModal(), 700);
      } catch (err) {
        setLinkError(err?.message || "فشل ربط الوصل بالطلب");
      } finally {
        setLinkBusyId("");
      }
    },
    [linkModal.voucher, closeLinkRequestModal]
  );

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

  /** عمود الفئة: فلتر بدور سكنجر، أو «كل الشركات» إذا كانت بدور سكنجر ضمن الخيارات */
  const showSignatureCategoryCol = useMemo(() => {
    if (isBadurSignatureKey(companyFilter?.value)) return true;
    if (String(companyFilter?.value || "").trim().toLowerCase() !== "all") {
      return false;
    }
    return companiesOptions.some((o) => isBadurSignatureKey(o?.value));
  }, [companyFilter?.value, companiesOptions]);
  const signatureCompany = useMemo(
    () => getCompanyByKey("Badur-Signature"),
    []
  );

  /** جهّز تخطيط الحقول + صور القوالب قبل فتح الوصل */
  useEffect(() => {
    const keys = new Set(
      (rows || []).map((r) => String(r?.companyKey || "").trim()).filter(Boolean)
    );
    if (isBadurSignatureKey(companyFilter?.value)) {
      keys.add("Badur-Signature");
    }
    companiesOptions.forEach((o) => {
      if (o?.value && o.value !== "all") keys.add(String(o.value).trim());
    });
    void prefetchVoucherLayouts([...keys]);

    keys.forEach((key) => {
      const company = getCompanyByKey(key);
      if (!company) return;
      [
        company.paymentImgJpg,
        company.receiptImgJpg,
        company.paymentImgPng || company.paymentImg,
        company.receiptImgPng || company.receiptImg,
      ]
        .filter(Boolean)
        .forEach((src) => {
          const img = new window.Image();
          img.decoding = "async";
          img.src = src;
        });
    });
  }, [rows, companyFilter?.value, companiesOptions]);

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

        // حمّل تخطيط كل الشركات المتاحة فوراً لتقليل التعليق عند فتح الوصل
        void prefetchVoucherLayouts(apiCompanies);

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
    const raw = String(opt.value || opt.label || "");
    const next =
      opt.type === "amount" || (/^[\d,\s.]+$/.test(raw) && /\d/.test(raw))
        ? formatAmount(raw) || raw
        : raw;
    setSmartInput(next);
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

  const handleDeleteVoucher = useCallback(
    async (row, e) => {
      e?.stopPropagation?.();
      if (!row?._id) return;
      const ok = window.confirm(
        `تأكيد حذف الوصل رقم ${row.voucherNo || String(row.seq ?? "").padStart(5, "0")}؟ سيعاد العداد -1 إذا كان هذا آخر رقم صادر.`
      );
      if (!ok) return;

      try {
        setDeletingId(row._id);
        const res = await fetch(
          `/api/vouchers/view?id=${encodeURIComponent(row._id)}`,
          { method: "DELETE", credentials: "include" }
        );
        const json = await res.json();
        if (!json?.success) {
          throw new Error(json?.error || "فشل حذف الوصل");
        }

        const nextRows = rows.filter((x) => x._id !== row._id);
        setRows(nextRows);
        setMeta((prev) => {
          const newTotal = Math.max(0, (prev.total || 0) - 1);
          const ps = prev.pageSize || PAGE_SIZE;
          const newTotalPages = Math.max(1, Math.ceil(newTotal / ps));
          return {
            ...prev,
            total: newTotal,
            totalPages: newTotalPages,
          };
        });
        if (nextRows.length === 0 && page > 1) {
          setPage(page - 1);
        }
      } catch (err) {
        console.error("❌ Delete voucher error:", err);
        alert(err.message || "فشل حذف الوصل");
      } finally {
        setDeletingId(null);
      }
    },
    [page, rows]
  );

  const attachmentMatches = useCallback((a, att) => {
    if (!a || !att) return false;
    const k = String(att.key || "").trim();
    const u = String(att.url || "").trim();
    if (k && String(a.key || "").trim() === k) return true;
    if (u && String(a.url || "").trim() === u) return true;
    return false;
  }, []);

  const requestDeleteAttachment = useCallback((rowId, att) => {
    if (!rowId || !att) return;
    const key = String(att.key || "").trim();
    const url = String(att.url || "").trim();
    if (!key && !url) {
      alert("لا يمكن تحديد هذا الاتاج للحذف.");
      return;
    }
    setDeleteAttConfirm({ open: true, rowId, att });
  }, []);

  const handleDeleteAttachmentConfirmed = useCallback(async () => {
    const { rowId, att } = deleteAttConfirm;
    if (!rowId || !att) return;

    const deleteKey = String(att.key || "").trim();
    const deleteUrl = String(att.url || "").trim();
    const matchId = deleteKey || deleteUrl;
    if (!matchId) return;

    try {
      setDeletingAttKey(matchId);
      const res = await fetch("/api/vouchers/view", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: String(rowId),
          ...(deleteKey ? { deleteAttachmentKey: deleteKey } : {}),
          ...(deleteUrl ? { deleteAttachmentUrl: deleteUrl } : {}),
        }),
      });

      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.error || "فشل حذف الاتاج");
      }

      setRows((prev) =>
        prev.map((x) =>
          String(x._id) === String(rowId)
            ? {
                ...x,
                attachments: (Array.isArray(x.attachments) ? x.attachments : []).filter(
                  (a) => !attachmentMatches(a, att)
                ),
              }
            : x
        )
      );

      setAttachmentsModal((prev) => ({
        ...prev,
        attachments: (Array.isArray(prev.attachments) ? prev.attachments : []).filter(
          (a) => !attachmentMatches(a, att)
        ),
      }));

      setDeleteAttConfirm({ open: false, rowId: null, att: null });
    } catch (err) {
      console.error("Delete attachment error:", err);
      alert(err.message || "فشل حذف الاتاج");
    } finally {
      setDeletingAttKey(null);
    }
  }, [deleteAttConfirm, attachmentMatches]);

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

  const loadIdentitiesForRows = useCallback(async (pageRows) => {
    const names = [
      ...new Set(
        (pageRows || [])
          .map((row) => normalizePersonName(getVoucherCustomerName(row)))
          .filter((name) => name.length >= 2)
      ),
    ];

    if (!names.length) return;

    try {
      const params = new URLSearchParams({ names: names.join(",") });
      const res = await fetch(`/api/vouchers/person-identity?${params.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();

      if (json?.success && json.data && typeof json.data === "object") {
        setIdentityByKey((prev) => ({ ...prev, ...json.data }));
      }
    } catch (err) {
      console.error("load identities error:", err);
    }
  }, []);

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
          const nextRows = json.data || [];
          setRows(nextRows);
          setMeta(
            json.meta || {
              total: 0,
              totalPages: 0,
              page: pageValue,
              pageSize: PAGE_SIZE,
            }
          );
          loadIdentitiesForRows(nextRows);
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
    [buildParams, loadIdentitiesForRows]
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

  const applyIdentityRecord = useCallback((personKey, record) => {
    if (!personKey) return;
    if (record) {
      setIdentityByKey((prev) => ({ ...prev, [personKey]: record }));
    } else {
      setIdentityByKey((prev) => {
        const next = { ...prev };
        delete next[personKey];
        return next;
      });
    }
  }, []);

  const fetchIdentityRecord = useCallback(async (personName) => {
    const trimmed = normalizePersonName(personName);
    if (trimmed.length < 2) return null;

    const params = new URLSearchParams({ name: trimmed });
    const res = await fetch(`/api/vouchers/person-identity?${params.toString()}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (!json?.success) {
      throw new Error(json?.error || "تعذر تحميل الهوية");
    }
    return json.data || null;
  }, []);

  const openIdentityModal = useCallback(
    async (row) => {
      const personName = getVoucherCustomerName(row);
      if (!personName || personName.length < 2) {
        alert("حقل «استلمت من» فارغ على هذا الوصل");
        return;
      }

      const key = personNameKey(personName);
      setIdentityModal({
        open: true,
        rowId: row._id,
        personName,
        personKey: key,
        attachments: getIdentityAttachmentsFromEntry(identityByKey[key]),
        loading: true,
      });

      try {
        const record = await fetchIdentityRecord(personName);
        const attachments = getIdentityAttachmentsFromEntry(record);
        applyIdentityRecord(key, record);
        setIdentityModal((prev) => ({
          ...prev,
          attachments,
          loading: false,
        }));
      } catch (err) {
        console.error("identity modal load error:", err);
        setIdentityModal((prev) => ({ ...prev, loading: false }));
        alert(err.message || "تعذر تحميل الهوية");
      }
    },
    [applyIdentityRecord, fetchIdentityRecord, identityByKey]
  );

  const closeIdentityModal = useCallback(() => {
    setIdentityModal({
      open: false,
      rowId: null,
      personName: "",
      personKey: "",
      attachments: [],
      loading: false,
    });
  }, []);

  const handleIdentityAction = useCallback(
    async (row, e) => {
      e?.stopPropagation?.();
      await openIdentityModal(row);
    },
    [openIdentityModal]
  );

  const handleUploadIdentity = useCallback(
    async (personName, personKey, files) => {
      const fileList = Array.from(files || []).filter(Boolean);
      if (!fileList.length) return;

      if (!personName || personName.length < 2) {
        alert("حقل «استلمت من» فارغ");
        return;
      }

      try {
        setUploadingIdentityKey(personKey);
        const saved = await uploadPersonIdentityFiles({ personName, files: fileList });
        applyIdentityRecord(personKey, saved);
        setIdentityModal((prev) => ({
          ...prev,
          attachments: getIdentityAttachmentsFromEntry(saved),
        }));
      } catch (err) {
        console.error("Upload identity error:", err);
        alert(err.message || "فشل رفع الهوية");
      } finally {
        setUploadingIdentityKey(null);
      }
    },
    [applyIdentityRecord]
  );

  const handleDeleteIdentityAttachment = useCallback(
    async (att) => {
      const personName = identityModal.personName;
      const personKey = identityModal.personKey;
      if (!personName || !att) return;

      const deleteKey = String(att.key || "").trim();
      const deleteUrl = String(att.url || "").trim();
      const matchId = deleteKey || deleteUrl;
      if (!matchId) {
        alert("لا يمكن تحديد هذا المرفق للحذف");
        return;
      }

      const ok = window.confirm(`حذف المرفق "${att.name || "ملف"}"؟`);
      if (!ok) return;

      try {
        setDeletingIdentityKey(matchId);
        const res = await fetch("/api/vouchers/person-identity", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personName,
            deleteAttachmentKey: deleteKey,
            deleteAttachmentUrl: deleteUrl,
          }),
        });
        const json = await res.json();
        if (!json?.success) {
          throw new Error(json?.error || "فشل حذف المرفق");
        }

        const record = json.data || null;
        applyIdentityRecord(personKey, record);
        setIdentityModal((prev) => ({
          ...prev,
          attachments: getIdentityAttachmentsFromEntry(record),
        }));
      } catch (err) {
        console.error("Delete identity attachment error:", err);
        alert(err.message || "فشل حذف المرفق");
      } finally {
        setDeletingIdentityKey(null);
      }
    },
    [applyIdentityRecord, identityModal.personKey, identityModal.personName]
  );

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
      const vouchers = Array.isArray(all) ? all : [];

      const companyVal = companyFilter?.value || "all";
      const modeVal = modeFilter?.value || "all";
      const currencyVal = currencyFilter?.value || "all";

      const res = await fetch("/api/vouchers/reports/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vouchers,
          dateFrom: date.from,
          dateTo: date.to,
          companyFilter: companyVal,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const parts = ["تقرير_صندوق"];
      if (companyVal && companyVal !== "all") parts.push(companyVal);
      if (modeVal && modeVal !== "all") {
        parts.push(modeVal === "payment" ? "صرف" : "قبض");
      }
      if (currencyVal && currencyVal !== "all") parts.push(currencyVal);
      if (date.from || date.to) {
        parts.push([date.from || "", date.to || ""].filter(Boolean).join("_"));
      }
      parts.push(new Date().toISOString().slice(0, 10));
      a.download = `${parts.join("_")}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("❌ Export vouchers error:", e);
    } finally {
      setLoading(false);
    }
  }, [
    fetchAllForExport,
    date.from,
    date.to,
    companyFilter,
    modeFilter,
    currencyFilter,
  ]);

  const handleExportEmptyForm = useCallback(async () => {
    try {
      setLoading(true);
      const companyVal = companyFilter?.value || "all";

      const res = await fetch("/api/vouchers/reports/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emptyForm: true,
          dateFrom: date.from,
          dateTo: date.to,
          companyFilter: companyVal,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const parts = ["فورمة_صندوق_فارغة"];
      if (companyVal && companyVal !== "all") parts.push(companyVal);
      parts.push(new Date().toISOString().slice(0, 10));
      a.download = `${parts.join("_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("❌ Export empty form error:", e);
    } finally {
      setLoading(false);
    }
  }, [companyFilter, date.from, date.to]);

  const handlePrintDailyCash = useCallback(async () => {
    try {
      setLoading(true);
      const { all } = await fetchAllForExport();
      const vouchers = Array.isArray(all) ? all : [];

      const companyVal = companyFilter?.value || "all";
      const companies = listDailyCashPrintCompanies(vouchers, {
        companyFilter: companyVal,
        includeEmpty: true,
      });
      if (!companies.length) {
        alert("اختر صندوقاً للطباعة أو تأكد من صلاحياتك");
        return;
      }

      const balances = {};
      for (const c of companies) {
        balances[c.key] = isAlGhadeerMain(c.key)
          ? { iqd: "", usd: "", eur: "" }
          : { iqd: "", usd: "" };
      }

      setPrintModal((prev) => ({
        open: true,
        vouchers,
        companies,
        balances,
        fontSize: prev.fontSize || 9,
        fontBold: prev.fontBold !== false,
      }));
      setFontSettingsOpen(false);
    } catch (e) {
      console.error("❌ Print daily cash prepare error:", e);
      alert(e?.message || "تعذر تجهيز الطباعة");
    } finally {
      setLoading(false);
    }
  }, [fetchAllForExport, companyFilter]);

  const closePrintModal = useCallback(() => {
    setFontSettingsOpen(false);
    setPrintModal((prev) => ({
      ...prev,
      open: false,
      vouchers: [],
      companies: [],
      balances: {},
    }));
  }, []);

  const updatePrintFont = useCallback((patch) => {
    setPrintModal((prev) => ({
      ...prev,
      fontBold:
        patch.fontBold !== undefined
          ? patch.fontBold !== false
          : prev.fontBold !== false,
      fontSize: clampPrintFontSize(
        patch.fontSize != null ? patch.fontSize : prev.fontSize
      ),
    }));
  }, []);

  const loadPrintFontPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/vouchers/reports/print-prefs", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success && json.data) {
        setPrintModal((prev) => ({
          ...prev,
          fontSize: clampPrintFontSize(json.data.fontSize || 9),
          fontBold: json.data.fontBold !== false,
        }));
      }
    } catch {
      /* keep defaults */
    } finally {
      setFontPrefsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!fontPrefsLoaded) loadPrintFontPrefs();
  }, [fontPrefsLoaded, loadPrintFontPrefs]);

  const savePrintFontPrefs = useCallback(async () => {
    try {
      setSavingFontPrefs(true);
      const res = await fetch("/api/vouchers/reports/print-prefs", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fontSize: printModal.fontSize || 9,
          fontBold: printModal.fontBold !== false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "تعذر الحفظ");
      }
      setPrintModal((prev) => ({
        ...prev,
        fontSize: clampPrintFontSize(json.data?.fontSize || 9),
        fontBold: json.data?.fontBold !== false,
      }));
      setFontSettingsOpen(false);
    } catch (e) {
      alert(e?.message || "تعذر حفظ إعدادات الخط");
    } finally {
      setSavingFontPrefs(false);
    }
  }, [printModal.fontSize, printModal.fontBold]);

  const printFontPreviewHtml = useMemo(() => {
    const companyName =
      printModal.companies?.[0]?.name || companyFilter?.label || "صندوق تجريبي";
    return buildDailyCashPrintPreviewHtml({
      fontSize: printModal.fontSize || 9,
      fontBold: printModal.fontBold !== false,
      companyName,
    });
  }, [
    printModal.fontSize,
    printModal.fontBold,
    printModal.companies,
    companyFilter?.label,
  ]);

  const updatePrintBalance = useCallback((companyKey, field, value) => {
    setPrintModal((prev) => ({
      ...prev,
      balances: {
        ...prev.balances,
        [companyKey]: {
          ...(prev.balances?.[companyKey] || { iqd: "", usd: "" }),
          [field]: value,
        },
      },
    }));
  }, []);

  const confirmPrintDailyCash = useCallback(async () => {
    // Open immediately on confirm click so popup blockers do not block it.
    const printWin = openBlankDailyCashPrintWindow();
    try {
      setLoading(true);
      const all = Array.isArray(printModal.vouchers) ? printModal.vouchers : [];

      let cashier = printerUsername;
      if (!cashier) {
        try {
          const meRes = await fetch("/api/user-permissions", {
            cache: "no-store",
            credentials: "include",
          });
          const meJson = await meRes.json().catch(() => ({}));
          cashier = String(meJson?.user?.username || "").trim();
        } catch {
          /* ignore */
        }
      }

      const packages = buildDailyCashPrintPackages(all, {
        dateFrom: date.from,
        dateTo: date.to,
        companyFilter: companyFilter?.value || "all",
        cashier,
        prevBalances: printModal.balances || {},
        includeEmpty: true,
      });

      if (!packages.length) {
        try {
          printWin?.close();
        } catch {
          /* ignore */
        }
        alert("ماكو صندوق للطباعة");
        return;
      }

      closePrintModal();
      await openDailyCashPrintWindow(packages, printWin, {
        fontSize: printModal.fontSize || 9,
        fontBold: printModal.fontBold !== false,
      });
    } catch (e) {
      console.error("❌ Print daily cash error:", e);
      try {
        printWin?.close();
      } catch {
        /* ignore */
      }
      alert(e?.message || "تعذر فتح نافذة الطباعة");
    } finally {
      setLoading(false);
    }
  }, [
    printModal.vouchers,
    printModal.balances,
    printModal.fontSize,
    printModal.fontBold,
    date.from,
    date.to,
    companyFilter,
    printerUsername,
    closePrintModal,
  ]);

  const Card = ({ icon, title, value, iconColor = "text-blue-600" }) => (
    <KpiCard label={title} value={value} icon={icon} iconColor={iconColor} />
  );

  if (!Array.isArray(permissions)) return null;
  if (!canViewReports) return null;

  const filterInputClass =
    "w-full rounded-xl bg-white/94 px-3 py-2.5 text-[14px] font-extrabold text-slate-900 outline-none ring-1 ring-slate-200/90 transition focus:ring-slate-300/90";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/30 px-2 py-4 sm:px-4 sm:py-6 lg:px-5 lg:py-8 text-[14px] md:text-[15px] font-bold"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      dir="ltr"
    >
      <div className="mx-auto w-full max-w-none">
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600/90">
                التقارير
              </p>
              <h1 className="mt-1 flex items-center justify-end gap-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                تقارير الوصولات
                <ColoredIcon color="text-blue-600">
                  <FiFilter />
                </ColoredIcon>
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                متابعة وصولات الصرف والقبض مع فتح الوصل بصفحة مستقلة
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleSearch}
                disabled={loading}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                  loading
                    ? "cursor-not-allowed bg-slate-300 text-slate-500"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <FiSearch className="text-base" />
                )}
                بحث
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleReset}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200/90 transition hover:bg-white hover:shadow-sm disabled:opacity-60"
              >
                <FiRotateCcw className="text-base" />
                مسح الفلاتر
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleExportExcel}
                disabled={loading}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                  loading
                    ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
                    : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 hover:bg-emerald-100"
                }`}
              >
                <FiDownload className="text-base" />
                Excel
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={handlePrintDailyCash}
                disabled={loading}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                  loading
                    ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
                    : "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80 hover:bg-sky-100"
                }`}
              >
                <FiPrinter className="text-base" />
                طباعة التقرير
              </motion.button>

              {canExportEmptyForm ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleExportEmptyForm}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                    loading
                      ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
                      : "bg-violet-50 text-violet-800 ring-1 ring-violet-200/80 hover:bg-violet-100"
                  }`}
                >
                  <FiDownload className="text-base" />
                  فورمة فارغة
                </motion.button>
              ) : null}
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <Card icon={<FiLayers />} title="المجموع" value={stats.total} iconColor="text-indigo-600" />
          <Card icon={<FiFileText />} title="وصولات الصرف" value={stats.payment} iconColor="text-red-600" />
          <Card icon={<FiCheckCircle />} title="وصولات القبض" value={stats.receipt} iconColor="text-emerald-600" />
        </motion.div>

        <motion.div
          className="relative z-20 mb-6 rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-4 flex items-center justify-end gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">الفلاتر</h2>
            <ColoredIcon color="text-blue-600">
              <FiShield />
            </ColoredIcon>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="text-right">
            <FilterLabel icon={<FiHome className="text-sm" />} iconColor="text-blue-600">
              الشركة
            </FilterLabel>
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
            <FilterLabel icon={<FiFileText className="text-sm" />} iconColor="text-red-600">
              نوع الوصل
            </FilterLabel>
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
            <FilterLabel icon={<FaMoneyBillWave className="text-sm" />} iconColor="text-emerald-600">
              العملة
            </FilterLabel>
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
            <FilterLabel icon={<FiHash className="text-sm" />} iconColor="text-indigo-600">
              رقم الوصل
            </FilterLabel>
            <input
              type="text"
              value={seqInput}
              onChange={(e) => setSeqInput(e.target.value)}
              placeholder="رقم الوصل"
              className={filterInputClass}
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
            <FilterLabel icon={<FiUser className="text-sm" />} iconColor="text-slate-600">
              استلمت من
            </FilterLabel>
            <input
              type="text"
              value={receivedByInput}
              onChange={(e) => setReceivedByInput(e.target.value)}
              placeholder="استلمت من"
              className={filterInputClass}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiCreditCard className="text-sm" />} iconColor="text-blue-600">
              البنك
            </FilterLabel>
            <input
              type="text"
              value={bankInput}
              onChange={(e) => setBankInput(e.target.value)}
              placeholder="اسم البنك"
              className={filterInputClass}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiCalendar className="text-sm" />} iconColor="text-amber-600">
              From
            </FilterLabel>
            <input
              type="date"
              value={date.from}
              onChange={(e) => setDate({ ...date, from: e.target.value })}
              className={filterInputClass}
            />
          </div>

          <div className="text-right">
            <FilterLabel icon={<FiCalendar className="text-sm" />} iconColor="text-amber-600">
              To
            </FilterLabel>
            <input
              type="date"
              value={date.to}
              onChange={(e) => setDate({ ...date, to: e.target.value })}
              className={filterInputClass}
            />
          </div>

          <div className="text-right lg:col-span-2">
            <FilterLabel icon={<FiSearch className="text-sm" />} iconColor="text-blue-600">
              بحث موحّد
            </FilterLabel>

            <div className="relative flex gap-2">
              <input
                ref={inputRef}
                value={smartInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  // إذا الإدخال يشبه مبلغ (أرقام/فواصل فقط) → فوارز آلاف تلقائياً
                  const looksLikeAmount =
                    raw.length > 0 && /^[\d,\s.]*$/.test(raw) && /\d/.test(raw);
                  const next = looksLikeAmount ? formatAmount(raw) : raw;
                  setSmartInput(next);
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
                placeholder="رقم / وصف / مستفيد / استلمت من / بنك / مبلغ"
                className={`${filterInputClass} px-4 text-[16px] shadow-sm`}
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
            className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden"
          >
            {smartOptions.slice(0, 12).map((opt, idx) => (
              <button
                key={`${opt.type || "x"}-${opt.value}-${idx}`}
                type="button"
                onClick={() => pickSuggestion(opt)}
                className={`w-full text-right px-4 py-3 text-[15px] font-extrabold transition ${
                  idx === activeIdx ? "bg-slate-100" : "bg-white"
                } hover:bg-slate-50`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}

      <AnimatePresence mode="wait">
        {loading ? (
          <VoucherReportsSearchLoading />
        ) : rows.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative z-0 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 shadow-sm ring-1 ring-slate-200/50"
          >
            <div id="voucher-reports-table" className="relative w-full overflow-hidden">
              <table className="w-full table-fixed border-collapse text-[11px] leading-snug text-slate-800 font-bold md:text-[12px]">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[5%]" />
                  <col className="w-[7%]" />
                  <col className="w-[4%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[6%]" />
                  <col className={showSignatureCategoryCol ? "w-[10%]" : "w-[12%]"} />
                  {showSignatureCategoryCol ? <col className="w-[9%]" /> : null}
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[7%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
                    {[
                      "الشركة",
                      "النوع",
                      "الرقم",
                      "الطلب",
                      "العملة",
                      "المبلغ",
                      "استلمت من",
                      "البنك",
                      "الصك",
                      "الوصف",
                      ...(showSignatureCategoryCol ? ["الفئة"] : []),
                      "الاتاج",
                      "الهوية",
                      "التاريخ",
                      "حذف",
                    ].map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="px-1.5 py-2.5 text-right text-[10px] font-extrabold tracking-wide text-slate-900 md:px-2 md:text-[11px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/60">
                  {rows.map((r, idx) => (
                    <motion.tr
                      key={r._id}
                      whileHover={{ backgroundColor: "rgba(248,250,252,0.95)" }}
                      transition={{ duration: 0.12 }}
                      onClick={() => {
                        if (canLinkRequest && !r.requestLink?.href) {
                          openLinkRequestModal(r);
                          return;
                        }
                        window.open(
                          `/vouchers/view?company=${encodeURIComponent(
                            r.companyKey
                          )}&mode=${encodeURIComponent(
                            r.mode
                          )}&id=${encodeURIComponent(r._id)}`,
                          "_blank"
                        );
                      }}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        idx % 2 === 0 ? "bg-white/50" : "bg-white/30"
                      }`}
                      title={
                        canLinkRequest && !r.requestLink?.href
                          ? "اضغط لربط الوصل بطلب صرف"
                          : "فتح الوصل"
                      }
                    >
                      <td
                        className="px-1.5 py-2 text-right font-extrabold text-slate-900 md:px-2"
                        title={getCompanyName(r.companyKey)}
                      >
                        <span className="line-clamp-2 break-words">
                          {getCompanyName(r.companyKey)}
                        </span>
                      </td>

                      <td className="px-1.5 py-2 text-right md:px-2">
                        <VoucherModeBadge mode={r.mode} compact />
                      </td>

                      <td
                        className="px-1.5 py-2 text-right font-mono text-slate-900 md:px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `/vouchers/view?company=${encodeURIComponent(
                              r.companyKey
                            )}&mode=${encodeURIComponent(
                              r.mode
                            )}&id=${encodeURIComponent(r._id)}`,
                            "_blank"
                          );
                        }}
                      >
                        <span className="break-all underline-offset-2 hover:underline">
                          {r.voucherNo || String(r.seq ?? "").padStart(5, "0")}
                        </span>
                      </td>

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col items-end gap-1">
                          {r.requestLink?.href ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  r.requestLink.href,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }}
                              title={
                                r.requestLink.requestCode
                                  ? `طلب ${r.requestLink.requestCode}`
                                  : "فتح طلب الصرف"
                              }
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-1.5 py-1 text-[10px] font-extrabold text-sky-800 transition hover:bg-sky-100 md:text-[11px]"
                            >
                              <FiExternalLink className="shrink-0 text-xs" />
                              <span className="truncate">
                                {r.requestLink.requestCode || "طلب"}
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {canLinkRequest && !r.requestLink?.href ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openLinkRequestModal(r);
                              }}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-extrabold text-emerald-800 transition hover:bg-emerald-100 md:text-[11px]"
                              title="بحث وربط طلب بالوصل"
                            >
                              <FiLink className="shrink-0 text-xs" />
                              <span className="truncate">ربط طلب</span>
                            </button>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-1.5 py-2 text-right font-extrabold md:px-2">
                        {r.currency || "-"}
                      </td>

                      <td
                        className="px-1.5 py-2 text-right font-extrabold text-slate-900 md:px-2"
                        title={fmtAmount(r.amount)}
                      >
                        <span className="break-all">{fmtAmount(r.amount)}</span>
                      </td>

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
                        title={r.receivedBy || ""}
                      >
                        <span className="line-clamp-2 break-words">
                          {r.receivedBy || "-"}
                        </span>
                      </td>

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
                        title={r.bank || ""}
                      >
                        <span className="line-clamp-2 break-words">
                          {r.bank || "-"}
                        </span>
                      </td>

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.chequeNo ? (
                          r.chequeId ? (
                            <button
                              type="button"
                              onClick={() =>
                                window.open(
                                  `/cheques/view?id=${encodeURIComponent(
                                    String(r.chequeId)
                                  )}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              title="فتح الصك المرتبط"
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 font-mono text-[10px] font-extrabold text-emerald-800 transition hover:bg-emerald-100 md:text-[11px]"
                            >
                              <FiCreditCard className="shrink-0 text-xs" />
                              <span className="truncate">{r.chequeNo}</span>
                            </button>
                          ) : (
                            <span className="break-all font-mono text-slate-800">
                              {r.chequeNo}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td
                        className="px-1.5 py-2 text-right text-slate-700 md:px-2"
                        title={r.description || ""}
                      >
                        <span className="line-clamp-3 break-words">
                          {r.description || "-"}
                        </span>
                      </td>

                      {showSignatureCategoryCol ? (
                        <td className="px-1.5 py-2 text-right md:px-2">
                          {(() => {
                            const labels = formatCategoryChecksLabels(
                              r.categoryChecks,
                              signatureCompany || getCompanyByKey(r.companyKey)
                            );
                            if (!labels.length) {
                              return <span className="text-slate-400">—</span>;
                            }
                            return (
                              <div className="flex flex-wrap justify-end gap-1">
                                {labels.map((label) => (
                                  <span
                                    key={`${r._id}-${label}`}
                                    className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-800"
                                    title={label}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                      ) : null}

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
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

                        <div className="flex flex-col items-stretch gap-1">
                          <button
                            type="button"
                            onClick={() => triggerAttachmentPick(r._id)}
                            disabled={uploadingId === r._id}
                            className={`rounded-lg border px-1.5 py-1 text-[10px] font-extrabold transition md:text-[11px] ${
                              uploadingId === r._id
                                ? "cursor-not-allowed border-gray-200 bg-gray-200 text-gray-500"
                                : "border-gray-200 bg-white text-slate-900 hover:bg-gray-50"
                            }`}
                          >
                            {uploadingId === r._id ? "رفع..." : "رفع"}
                          </button>

                          {Array.isArray(r.attachments) && r.attachments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => openAttachmentsModal(r)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-1 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100 md:text-[11px]"
                            >
                              عرض ({r.attachments.length})
                            </button>
                          ) : (
                            <span className="text-center text-[10px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const personName = getVoucherCustomerName(r);
                          const personKey = personNameKey(personName);
                          const identityAttachments = getIdentityAttachmentsFromEntry(
                            identityByKey[personKey]
                          );
                          const hasIdentity = identityAttachments.length > 0;
                          const isUploadingIdentity = uploadingIdentityKey === personKey;
                          const missingName = !personName || personName.length < 2;

                          return missingName ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleIdentityAction(r, e)}
                              disabled={isUploadingIdentity}
                              title={`إدارة هوية: ${personName}`}
                              className={`inline-flex w-full items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 md:text-[11px] ${
                                isUploadingIdentity
                                  ? "border-slate-200 bg-slate-100 text-slate-500"
                                  : hasIdentity
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  : "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                              }`}
                            >
                              {isUploadingIdentity ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                              ) : (
                                <FiCreditCard className="shrink-0 text-xs" />
                              )}
                              <span className="truncate">
                                {isUploadingIdentity
                                  ? "..."
                                  : hasIdentity
                                  ? `(${identityAttachments.length})`
                                  : "هوية"}
                              </span>
                            </button>
                          );
                        })()}
                      </td>

                      <td className="px-1.5 py-2 text-right text-slate-700 md:px-2">
                        <span className="break-words">
                          {formatVoucherDateDisplay(r)}
                        </span>
                      </td>

                      <td
                        className="px-1.5 py-2 text-right md:px-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleDeleteVoucher(r, e)}
                          disabled={deletingId === r._id}
                          title="حذف الوصل"
                          className={`inline-flex w-full items-center justify-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-extrabold transition md:text-[11px] ${
                            deletingId === r._id
                              ? "cursor-not-allowed border-gray-200 bg-gray-200 text-gray-500"
                              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          {deletingId === r._id ? (
                            <span className="h-3 w-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                          ) : (
                            <FiTrash2 className="shrink-0 text-sm" />
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-white/80 px-5 py-4 backdrop-blur">
              <div className="text-sm font-extrabold text-slate-700">
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
            className="rounded-3xl border border-slate-200/70 bg-white/75 py-16 text-center text-lg font-extrabold text-slate-600 shadow-sm ring-1 ring-slate-200/50"
          >
            لا توجد نتائج — اضغط «بحث»
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {linkModal.open && linkModal.voucher ? (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLinkRequestModal}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-extrabold text-slate-400">
                    ربط وصل بطلب صرف
                  </p>
                  <h3 className="mt-0.5 truncate text-base font-black text-slate-900">
                    وصل{" "}
                    {linkModal.voucher.voucherNo ||
                      String(linkModal.voucher.seq ?? "").padStart(5, "0")}
                  </h3>
                  <p className="mt-0.5 text-[12px] font-semibold text-slate-500">
                    {getCompanyName(linkModal.voucher.companyKey)}
                    {linkModal.voucher.amount != null
                      ? ` · ${formatAmount(linkModal.voucher.amount)} ${
                          linkModal.voucher.currency || ""
                        }`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLinkRequestModal}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              <div className="space-y-3 p-5">
                <label className="block text-right text-[12px] font-extrabold text-slate-600">
                  ابحث برمز الطلب
                </label>
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder="مثال: REQ-123 أو جزء من الرمز…"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-3 text-sm font-bold text-slate-900 outline-none ring-sky-200 focus:bg-white focus:ring-2"
                  />
                </div>

                {linkError ? (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700 ring-1 ring-red-100">
                    {linkError}
                  </p>
                ) : null}
                {linkOkMsg ? (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                    {linkOkMsg}
                  </p>
                ) : null}

                <div className="max-h-[340px] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/60">
                  {linkSearching ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500">
                      <FiLoader className="animate-spin" />
                      جاري البحث…
                    </div>
                  ) : !String(linkQuery || "").trim() ? (
                    <p className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                      اكتب رمز الطلب للبحث
                    </p>
                  ) : linkResults.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">
                      لا توجد نتائج
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {linkResults.map((req) => {
                        const busy = String(linkBusyId) === String(req._id);
                        return (
                          <li key={req._id}>
                            <button
                              type="button"
                              disabled={Boolean(linkBusyId)}
                              onClick={() => confirmLinkRequest(req)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-right transition hover:bg-white disabled:opacity-60"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span className="font-mono text-sm font-black text-slate-900">
                                    {req.requestCode || "—"}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 ring-1 ring-slate-200">
                                    {req.status || "—"}
                                  </span>
                                  {req.linkedVoucherCount > 0 ? (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-100">
                                      {req.linkedVoucherCount} وصل مربوط
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-[12px] font-semibold text-slate-500">
                                  {getCompanyName(req.companyKey) || req.companyKey}
                                  {req.description
                                    ? ` · ${String(req.description).slice(0, 60)}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                                {busy ? (
                                  <FiLoader className="animate-spin" />
                                ) : (
                                  <FiLink />
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <p className="text-center text-[11px] font-semibold text-slate-400">
                  يمكن ربط نفس الطلب بعدة وصولات — يظهر للكاشير داخل الطلب
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {printModal.open && (
          <motion.div
            className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePrintModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
              dir="rtl"
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closePrintModal}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-extrabold hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSettingsOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm font-extrabold hover:bg-indigo-100"
                  >
                    <FiType className="text-base" />
                    تغيير حجم الخط
                  </button>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-gray-900">
                    طباعة التقرير اليومي
                  </div>
                  <div className="text-sm text-gray-500 font-bold">
                    أدخل الرصيد السابق لكل شركة (مثل Excel)
                  </div>
                </div>
              </div>

              <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
                {(printModal.companies || []).map((c) => (
                  <div
                    key={c.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                  >
                    <div className="text-right text-sm font-extrabold text-slate-900">
                      {c.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block text-right">
                        <span className="mb-1 block text-xs font-bold text-slate-600">
                          الرصيد السابق - دينار
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={printModal.balances?.[c.key]?.iqd ?? ""}
                          onChange={(e) =>
                            updatePrintBalance(c.key, "iqd", e.target.value)
                          }
                          placeholder="0"
                          className="w-full rounded-xl bg-white px-3 py-2.5 text-[14px] font-extrabold text-slate-900 outline-none ring-1 ring-slate-200/90 focus:ring-sky-300 text-left"
                          dir="ltr"
                        />
                      </label>
                      <label className="block text-right">
                        <span className="mb-1 block text-xs font-bold text-slate-600">
                          الرصيد السابق - دولار
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={printModal.balances?.[c.key]?.usd ?? ""}
                          onChange={(e) =>
                            updatePrintBalance(c.key, "usd", e.target.value)
                          }
                          placeholder="0"
                          className="w-full rounded-xl bg-white px-3 py-2.5 text-[14px] font-extrabold text-slate-900 outline-none ring-1 ring-slate-200/90 focus:ring-sky-300 text-left"
                          dir="ltr"
                        />
                      </label>
                      {isAlGhadeerMain(c.key) ? (
                        <label className="block text-right sm:col-span-2">
                          <span className="mb-1 block text-xs font-bold text-slate-600">
                            الرصيد السابق - يورو
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={printModal.balances?.[c.key]?.eur ?? ""}
                            onChange={(e) =>
                              updatePrintBalance(c.key, "eur", e.target.value)
                            }
                            placeholder="0"
                            className="w-full rounded-xl bg-white px-3 py-2.5 text-[14px] font-extrabold text-slate-900 outline-none ring-1 ring-slate-200/90 focus:ring-sky-300 text-left"
                            dir="ltr"
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closePrintModal}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-extrabold hover:bg-gray-50 disabled:opacity-60"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmPrintDailyCash}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold shadow-sm ${
                    loading
                      ? "cursor-not-allowed bg-slate-300 text-slate-500"
                      : "bg-sky-600 text-white hover:bg-sky-700"
                  }`}
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <FiPrinter className="text-base" />
                  )}
                  طباعة
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fontSettingsOpen && (
          <motion.div
            className="fixed inset-0 z-[100050] bg-black/50 flex items-center justify-center p-3 sm:p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !savingFontPrefs && setFontSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <button
                  type="button"
                  disabled={savingFontPrefs}
                  onClick={() => setFontSettingsOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  إغلاق
                </button>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-slate-900">
                    إعدادات خط الطباعة
                  </div>
                  <div className="text-sm font-bold text-slate-500">
                    تحكم واحد لخط الجدول — الفورمة ثابتة والرصيد يبقى ظاهراً
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4 overflow-y-auto border-b border-slate-200 p-5 lg:border-b-0 lg:border-l">
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold text-slate-800">
                        حجم الخط (لكل الجدول)
                      </span>
                      <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-black text-indigo-700 ring-1 ring-indigo-100">
                        {printModal.fontSize || 9}px
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updatePrintFont({
                            fontSize: (printModal.fontSize || 9) - 1,
                          })
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        aria-label="تصغير الخط"
                      >
                        <FiMinus />
                      </button>
                      <input
                        type="range"
                        min={7}
                        max={14}
                        step={1}
                        value={printModal.fontSize || 9}
                        onChange={(e) =>
                          updatePrintFont({
                            fontSize: Number(e.target.value),
                          })
                        }
                        className="w-full accent-indigo-600"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updatePrintFont({
                            fontSize: (printModal.fontSize || 9) + 1,
                          })
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        aria-label="تكبير الخط"
                      >
                        <FiPlus />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "صغير", size: 7 },
                        { label: "عادي", size: 9 },
                        { label: "كبير", size: 11 },
                        { label: "أكبر", size: 13 },
                      ].map((opt) => {
                        const active =
                          Number(printModal.fontSize || 9) === opt.size;
                        return (
                          <button
                            key={opt.size}
                            type="button"
                            onClick={() =>
                              updatePrintFont({ fontSize: opt.size })
                            }
                            className={`rounded-xl px-2 py-2.5 text-xs font-extrabold ring-1 transition ${
                              active
                                ? "bg-indigo-600 text-white ring-indigo-600"
                                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-right text-sm font-extrabold text-slate-800">
                      غمق الخط
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updatePrintFont({ fontBold: false })}
                        className={`rounded-xl px-3 py-3.5 text-sm font-medium ring-1 transition ${
                          printModal.fontBold === false
                            ? "bg-indigo-600 text-white ring-indigo-600"
                            : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        عادي
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePrintFont({ fontBold: true })}
                        className={`rounded-xl px-3 py-3.5 text-sm font-extrabold ring-1 transition ${
                          printModal.fontBold !== false
                            ? "bg-indigo-600 text-white ring-indigo-600"
                            : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        غامق
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-right text-xs font-bold leading-6 text-indigo-900">
                    غيّر الحجم أو الغمق مرة واحدة — ينطبق على كل الأعمدة بنفس
                    النتيجة. الحفظ يخزّن الإعداد فقط ولا يفتح الطباعة.
                  </div>
                </div>

                <div className="flex min-h-0 flex-col bg-slate-100/80 p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <span className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-600 ring-1 ring-slate-200">
                      حجم ثابت · يتغير الخط فقط
                    </span>
                    <span className="text-sm font-extrabold text-slate-700">
                      معاينة فورمة الطباعة
                    </span>
                  </div>
                  <div className="relative min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-200/70 p-3">
                    {/* إطار A4 ثابت الأبعاد — لا نكبّر/نصغّر الصفحة مع الخط */}
                    <div
                      className="mx-auto"
                      style={{
                        width: "210mm",
                        height: "297mm",
                        maxWidth: "100%",
                      }}
                    >
                      <iframe
                        title="معاينة فورمة الطباعة"
                        srcDoc={printFontPreviewHtml}
                        className="block h-full w-full rounded-md border border-slate-300 bg-white shadow-lg"
                        style={{ width: "210mm", height: "297mm", maxWidth: "100%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  disabled={savingFontPrefs}
                  onClick={() => setFontSettingsOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={savingFontPrefs}
                  onClick={savePrintFontPrefs}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold shadow-sm ${
                    savingFontPrefs
                      ? "cursor-not-allowed bg-slate-300 text-slate-500"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {savingFontPrefs ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <FiCheckCircle className="text-base" />
                  )}
                  حفظ الإعدادات
                </button>
              </div>
            </motion.div>
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
                          disabled={Boolean(deletingAttKey)}
                          onClick={() =>
                            requestDeleteAttachment(attachmentsModal.rowId, att)
                          }
                          className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[13px] font-extrabold hover:bg-red-100 disabled:opacity-50"
                        >
                          حذف الاتاج
                        </button>
                        <a
                          href={attachmentOpenHref(att)}
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

      <AnimatePresence>
        {identityModal.open && (
          <motion.div
            className="fixed inset-0 z-[99999] bg-black/40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeIdentityModal}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closeIdentityModal}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 font-extrabold hover:bg-gray-50"
                >
                  إغلاق
                </button>

                <div className="text-right min-w-0 flex-1">
                  <div className="text-lg font-extrabold text-gray-900">الهوية</div>
                  <div className="text-sm text-gray-500 font-bold truncate">
                    {identityModal.personName}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    identityModal.loading ||
                    uploadingIdentityKey === identityModal.personKey
                  }
                  onClick={() => identityModalFileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-800 text-[13px] font-extrabold hover:bg-violet-100 disabled:opacity-50"
                >
                  <FiUploadCloud />
                  {uploadingIdentityKey === identityModal.personKey
                    ? "جاري الرفع..."
                    : "إضافة مرفقات"}
                </button>
              </div>

              <input
                ref={identityModalFileRef}
                type="file"
                hidden
                multiple
                accept="image/*,.pdf"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) {
                    handleUploadIdentity(
                      identityModal.personName,
                      identityModal.personKey,
                      files
                    );
                  }
                  e.target.value = "";
                }}
              />

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
                {identityModal.loading ? (
                  <div className="text-center text-gray-500 font-extrabold py-8">
                    جاري التحميل...
                  </div>
                ) : identityModal.attachments.length > 0 ? (
                  identityModal.attachments.map((att, idx) => {
                    const matchId = String(att.key || att.url || "").trim();
                    const isDeleting = deletingIdentityKey === matchId;

                    return (
                      <div
                        key={`${att.key || att.name}-${idx}`}
                        className="rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={Boolean(deletingIdentityKey)}
                            onClick={() => handleDeleteIdentityAttachment(att)}
                            className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[13px] font-extrabold hover:bg-red-100 disabled:opacity-50"
                          >
                            {isDeleting ? "..." : "حذف"}
                          </button>
                          <a
                            href={attachmentOpenHref(att)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl border border-violet-200 bg-violet-50 text-violet-800 text-[13px] font-extrabold hover:bg-violet-100"
                          >
                            فتح
                          </a>
                        </div>

                        <div className="text-right min-w-0">
                          <div className="font-extrabold text-gray-900 truncate">
                            {att.name || `مرفق ${idx + 1}`}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {att.contentType || "-"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-gray-500 font-extrabold py-8">
                    لا توجد مرفقات — اضغط «إضافة مرفقات»
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteAttConfirm.open && deleteAttConfirm.att && (
          <motion.div
            className="fixed inset-0 z-[100000] bg-black/45 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() =>
              !deletingAttKey &&
              setDeleteAttConfirm({ open: false, rowId: null, att: null })
            }
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 text-right"
            >
              <h3 className="text-lg font-extrabold text-gray-900">تأكيد حذف الاتاج</h3>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                هل تريد حذف الملف التالي من هذا الوصل؟ لا يمكن التراجع عن هذه العملية.
              </p>
              <p className="mt-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm font-extrabold text-gray-900 truncate">
                {deleteAttConfirm.att.name || "ملف مرفق"}
              </p>
              <motion.div className="mt-6 flex flex-row-reverse gap-3">
                <button
                  type="button"
                  disabled={Boolean(deletingAttKey)}
                  onClick={handleDeleteAttachmentConfirmed}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingAttKey ? "جاري الحذف…" : "تأكيد الحذف"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingAttKey)}
                  onClick={() =>
                    setDeleteAttConfirm({ open: false, rowId: null, att: null })
                  }
                  className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-extrabold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

function VoucherReportsSearchLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[360px] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 ring-1 ring-slate-200/50"
    >
      <div className="pointer-events-none space-y-3 p-5 opacity-40">
        <div className="h-12 animate-pulse rounded-xl bg-slate-100/90" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100/80" />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mx-4 w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white/95 px-8 py-9 text-center shadow-[0_24px_60px_-24px_rgba(59,130,246,0.2)] ring-1 ring-slate-200/60"
        >
          <div className="relative mx-auto h-14 w-14">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-slate-200/90 border-t-blue-600" />
            <span
              className="absolute inset-2.5 animate-spin rounded-full border-[3px] border-slate-100 border-b-indigo-500"
              style={{ animationDirection: "reverse", animationDuration: "0.85s" }}
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <ColoredIcon color="text-blue-600" size="sm">
                <FiSearch />
              </ColoredIcon>
            </span>
          </div>

          <p className="mt-5 text-base font-extrabold text-slate-900">جاري البحث</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-500">يرجى الانتظار...</p>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-blue-500/80"
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
    </motion.div>
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

function KpiCard({ label, value, icon, iconColor = "text-blue-600" }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/75 p-4 ring-1 ring-slate-200/70 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.15)] hover:ring-slate-300/80">
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/90 shadow-sm transition duration-300 group-hover:scale-105">
          <span className={`text-lg ${iconColor}`}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[11px] font-bold text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-base font-extrabold text-slate-900 sm:text-lg">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterLabel({ icon, iconColor = "text-slate-600", children }) {
  return (
    <label className="mb-1.5 flex items-center justify-end gap-1.5 text-[13px] font-extrabold text-slate-700">
      {children}
      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-white ring-1 ring-slate-200/90 ${iconColor}`}>
        {icon}
      </span>
    </label>
  );
}