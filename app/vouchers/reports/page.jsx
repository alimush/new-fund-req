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
} from "react-icons/fi";

import { FaMoneyBillWave } from "react-icons/fa6";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import TablePagination from "@/components/TablePagination";
import VoucherModeBadge from "@/components/VoucherModeBadge";

const Select = dynamic(() => import("react-select").then((m) => m.default), {
  ssr: false,
});

import { COMPANIES } from "@/lib/voucher/companies";
import { formatAmount } from "@/lib/voucher/utils";
import { formatVoucherDateDisplay } from "@/lib/voucher/voucherDate";
import { attachmentOpenHref } from "@/lib/s3/browserOpenAttachment";

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
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRefs = useRef({});
  const inputRef = useRef(null);
  const suggestBoxRef = useRef(null);
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });

  const hasSearchedRef = useRef(false);
  const tableScrollRef = useRef(null);
  const hScrollTrackRef = useRef(null);
  const hScrollDragRef = useRef(null);
  const [tableHScroll, setTableHScroll] = useState({
    scrollLeft: 0,
    clientWidth: 0,
    scrollWidth: 0,
  });
  const [fixedHScroll, setFixedHScroll] = useState({
    visible: false,
    left: 0,
    width: 0,
  });

  const readTableScrollMetrics = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setTableHScroll({
      scrollLeft: el.scrollLeft,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    });
  }, []);

  const setTableScrollLeft = useCallback((nextLeft) => {
    const el = tableScrollRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const clamped = Math.min(max, Math.max(0, nextLeft));
    el.scrollLeft = clamped;
    setTableHScroll({
      scrollLeft: clamped,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    });
  }, []);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    readTableScrollMetrics();
    el.addEventListener("scroll", readTableScrollMetrics, { passive: true });

    const ro = new ResizeObserver(readTableScrollMetrics);
    ro.observe(el);
    window.addEventListener("resize", readTableScrollMetrics);

    return () => {
      el.removeEventListener("scroll", readTableScrollMetrics);
      ro.disconnect();
      window.removeEventListener("resize", readTableScrollMetrics);
    };
  }, [rows, loading, readTableScrollMetrics]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el || rows.length === 0) {
      setFixedHScroll({ visible: false, left: 0, width: 0 });
      return;
    }

    const updateFixedBar = () => {
      const rect = el.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      setFixedHScroll({
        visible: inView && rect.width > 0,
        left: rect.left,
        width: rect.width,
      });
    };

    updateFixedBar();
    window.addEventListener("scroll", updateFixedBar, { passive: true, capture: true });
    window.addEventListener("resize", updateFixedBar);

    const ro = new ResizeObserver(updateFixedBar);
    ro.observe(el);

    return () => {
      window.removeEventListener("scroll", updateFixedBar, { capture: true });
      window.removeEventListener("resize", updateFixedBar);
      ro.disconnect();
    };
  }, [rows, loading]);

  const hScrollUi = useMemo(() => {
    const { scrollLeft, clientWidth, scrollWidth } = tableHScroll;
    const scrollable = Math.max(0, scrollWidth - clientWidth);
    const trackWidth = clientWidth || 1;
    const thumbWidth =
      scrollable > 0
        ? Math.max(56, (clientWidth / scrollWidth) * trackWidth)
        : trackWidth;
    const thumbTravel = Math.max(0, trackWidth - thumbWidth);
    const thumbLeft =
      scrollable > 0 ? (scrollLeft / scrollable) * thumbTravel : 0;

    return {
      scrollable,
      thumbWidth,
      thumbTravel,
      thumbLeft,
      canScroll: scrollable > 0,
    };
  }, [tableHScroll]);

  const onHScrollThumbMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = tableScrollRef.current;
      if (!el || hScrollUi.scrollable <= 0) return;

      hScrollDragRef.current = {
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        scrollable: hScrollUi.scrollable,
        thumbTravel: hScrollUi.thumbTravel,
      };

      const onMove = (ev) => {
        const drag = hScrollDragRef.current;
        if (!drag) return;
        const deltaX = ev.clientX - drag.startX;
        const scrollDelta =
          drag.thumbTravel > 0
            ? (deltaX / drag.thumbTravel) * drag.scrollable
            : 0;
        setTableScrollLeft(drag.startScrollLeft + scrollDelta);
      };

      const onUp = () => {
        hScrollDragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [hScrollUi, setTableScrollLeft]
  );

  const onHScrollTrackMouseDown = useCallback(
    (e) => {
      if (e.button !== 0 || !hScrollUi.canScroll) return;
      const track = hScrollTrackRef.current;
      if (!track || e.target !== track) return;

      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const targetThumbLeft = Math.min(
        hScrollUi.thumbTravel,
        Math.max(0, clickX - hScrollUi.thumbWidth / 2)
      );
      const newScrollLeft =
        hScrollUi.thumbTravel > 0
          ? (targetThumbLeft / hScrollUi.thumbTravel) * hScrollUi.scrollable
          : 0;
      setTableScrollLeft(newScrollLeft);
    },
    [hScrollUi, setTableScrollLeft]
  );

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

      const companyVal = companyFilter?.value || "all";
      const modeVal = modeFilter?.value || "all";
      const currencyVal = currencyFilter?.value || "all";

      const res = await fetch("/api/vouchers/reports/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vouchers: all,
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
                disabled={loading || rows.length === 0}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold shadow-sm transition ${
                  loading || rows.length === 0
                    ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80"
                    : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 hover:bg-emerald-100"
                }`}
              >
                <FiDownload className="text-base" />
                Excel
              </motion.button>
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

      {portalReady &&
        fixedHScroll.visible &&
        rows.length > 0 &&
        createPortal(
          <div
            ref={hScrollTrackRef}
            role="scrollbar"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, hScrollUi.scrollable)}
            aria-valuenow={tableHScroll.scrollLeft}
            aria-controls="voucher-reports-table"
            onMouseDown={onHScrollTrackMouseDown}
            style={{
              position: "fixed",
              left: fixedHScroll.left,
              width: fixedHScroll.width,
              bottom: 12,
              zIndex: 99990,
            }}
            className="relative h-5 shrink-0 rounded-xl border border-slate-300/80 bg-slate-200/95 px-1 shadow-lg backdrop-blur cursor-pointer select-none"
            aria-label="تمرير أفقي للجدول"
          >
            <div
              onMouseDown={onHScrollThumbMouseDown}
              className={`absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full border border-slate-400/40 shadow-sm ${
                hScrollUi.canScroll
                  ? "cursor-grab bg-slate-500 hover:bg-slate-600 active:cursor-grabbing"
                  : "cursor-default bg-slate-400/70"
              }`}
              style={{
                width: `${hScrollUi.thumbWidth}px`,
                left: `${hScrollUi.thumbLeft}px`,
              }}
            />
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
            <div
              id="voucher-reports-table"
              ref={tableScrollRef}
              onWheel={(e) => {
                if (!e.shiftKey || !tableScrollRef.current) return;
                e.preventDefault();
                setTableScrollLeft(
                  tableScrollRef.current.scrollLeft + e.deltaY
                );
              }}
              className="relative overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <table className="min-w-[1600px] w-full text-[14px] md:text-[15px] text-slate-800 font-bold">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
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
                      "حذف الوصل",
                    ].map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="px-6 py-4 text-right text-[12px] md:text-[13px] font-extrabold tracking-wide text-slate-900 whitespace-nowrap"
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
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        idx % 2 === 0 ? "bg-white/50" : "bg-white/30"
                      }`}
                    >
                      <td className="px-6 py-4 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        {getCompanyName(r.companyKey)}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <VoucherModeBadge mode={r.mode} />
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
                        {formatVoucherDateDisplay(r)}
                      </td>

                      <td
                        className="px-6 py-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleDeleteVoucher(r, e)}
                          disabled={deletingId === r._id}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-extrabold transition ${
                            deletingId === r._id
                              ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          {deletingId === r._id ? (
                            <span className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <FiTrash2 className="text-base" />
                          )}
                          حذف
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