"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Select from "react-select";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiEye,
  FiFileText,
  FiFilter,
  FiLayers,
  FiLoader,
  FiMinus,
  FiPaperclip,
  FiPlus,
  FiPrinter,
  FiRotateCcw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiType,
  FiUpload,
  FiUser,
  FiX,
} from "react-icons/fi";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { COMPANIES } from "@/lib/voucher/companies";
import { isAlGhadeerMain } from "@/lib/voucher/utils";
import {
  attachPrintLogos,
  buildDailyCashPrintPackages,
  buildDailyCashPrintPreviewHtml,
  buildDailyCashScreenPreviewHtml,
  clampPrintFontSize,
  listDailyCashPrintCompanies,
  openBlankDailyCashPrintWindow,
  openDailyCashPrintWindow,
} from "@/lib/voucher/dailyCashPrint";
import { openSignedAttachment } from "@/lib/s3/browserOpenAttachment";
import TablePagination from "@/components/TablePagination";

const PAGE_SIZE = 25;

function savedDocCompanyFilter(doc) {
  const keys = [
    ...new Set(
      (Array.isArray(doc?.companyKeys) ? doc.companyKeys : [])
        .map((k) => String(k || "").trim())
        .filter(Boolean)
    ),
  ];
  if (keys.length) return keys.join(",");
  const filter = String(doc?.companyFilter || "").trim();
  return filter || "all";
}

function emptyBalancesForCompanies(companies) {
  const balances = {};
  for (const c of companies || []) {
    balances[c.key] = isAlGhadeerMain(c.key)
      ? { iqd: "", usd: "", eur: "" }
      : { iqd: "", usd: "" };
  }
  return balances;
}

function mergePrevBalances(companies, savedBalances = {}) {
  const base = emptyBalancesForCompanies(companies);
  const src =
    savedBalances && typeof savedBalances === "object" ? savedBalances : {};
  for (const c of companies || []) {
    const prev = src[c.key] || src[String(c.key)] || {};
    base[c.key] = {
      ...(base[c.key] || {}),
      iqd: prev.iqd ?? prev.prevIqd ?? "",
      usd: prev.usd ?? prev.prevUsd ?? "",
      ...(isAlGhadeerMain(c.key)
        ? { eur: prev.eur ?? prev.prevEur ?? "" }
        : {}),
    };
  }
  return base;
}

async function loadSavedDoc(id) {
  const res = await fetch(`/api/vouchers/reports/saved/${id}`, {
    credentials: "include",
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.error || "تعذر فتح التقرير");
  }
  return json.data;
}

function buildPackagesFromDoc(doc, overrides = {}) {
  return buildDailyCashPrintPackages(doc.vouchers || [], {
    dateFrom: doc.dateFrom || "",
    dateTo: doc.dateTo || "",
    companyFilter: overrides.companyFilter || savedDocCompanyFilter(doc),
    cashier: doc.cashier || "",
    prevBalances: overrides.prevBalances ?? doc.prevBalances ?? {},
    includeEmpty: true,
  });
}

function fmtWhen(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodLabel(r) {
  if (r.dateFrom && r.dateTo) {
    return r.dateFrom === r.dateTo
      ? r.dateFrom
      : `${r.dateFrom} → ${r.dateTo}`;
  }
  return r.dateFrom || r.dateTo || "—";
}

function companiesLabel(r) {
  return (
    (r.companyNames || []).filter(Boolean).join(" · ") ||
    (r.companyKeys || []).join(" · ") ||
    "—"
  );
}

export default function SavedVoucherReportsPage() {
  const { permissions, user: permUser } = usePermissions();
  const canView =
    Array.isArray(permissions) &&
    (permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
      permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
      permissions.some((p) => String(p || "").startsWith("VOUCHERS_")));
  const isDelegate =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);
  const currentUserId = String(permUser?.id || "").trim();
  const currentUsername = String(permUser?.username || "").trim();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [companyFilter, setCompanyFilter] = useState([]);
  const [preview, setPreview] = useState({
    open: false,
    title: "",
    html: "",
    doc: null,
  });
  const [attachModal, setAttachModal] = useState({
    open: false,
    row: null,
  });
  const [printModal, setPrintModal] = useState({
    open: false,
    doc: null,
    companies: [],
    balances: {},
    fontSize: 9,
    fontBold: true,
  });
  const [fontSettingsOpen, setFontSettingsOpen] = useState(false);
  const [fontPrefsLoaded, setFontPrefsLoaded] = useState(false);
  const [savingFontPrefs, setSavingFontPrefs] = useState(false);
  const [printing, setPrinting] = useState(false);
  const fileInputRefs = useRef({});
  const companyKeysRef = useRef([]);

  const companyOptions = useMemo(
    () =>
      COMPANIES.filter((c) => c?.key && c?.permission).map((c) => ({
        value: c.key,
        label: c.name || c.key,
      })),
    []
  );

  const selectedCompanyKeys = useMemo(
    () =>
      (Array.isArray(companyFilter) ? companyFilter : [])
        .map((o) => String(o?.value || "").trim())
        .filter(Boolean),
    [companyFilter]
  );

  useEffect(() => {
    companyKeysRef.current = selectedCompanyKeys;
  }, [selectedCompanyKeys]);

  const load = useCallback(async (pageValue = 1, companyKeys) => {
    const keys = Array.isArray(companyKeys)
      ? companyKeys
      : companyKeysRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageValue),
        pageSize: String(PAGE_SIZE),
      });
      if (keys.length) {
        params.set("company", keys.join(","));
      }
      const res = await fetch(
        `/api/vouchers/reports/saved?${params.toString()}`,
        { credentials: "include", cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "تعذر التحميل");
      }
      setRows(Array.isArray(json.data) ? json.data : []);
      setMeta(
        json.meta || {
          total: 0,
          totalPages: 0,
          page: pageValue,
          pageSize: PAGE_SIZE,
        }
      );
      setPage(pageValue);
    } catch (e) {
      console.error(e);
      alert(e?.message || "تعذر تحميل التقارير المحفوظة");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) load(1);
  }, [canView, load]);

  const canDeleteRow = useCallback(
    (r) => {
      if (!r) return false;
      if (
        currentUserId &&
        String(r.savedByUserId || "") === currentUserId
      ) {
        return true;
      }
      if (
        currentUsername &&
        String(r.savedByUsername || "").toLowerCase() ===
          currentUsername.toLowerCase()
      ) {
        return true;
      }
      return false;
    },
    [currentUserId, currentUsername]
  );

  const filteredRows = useMemo(() => {
    const needle = String(q || "").trim().toLowerCase();
    const selected = new Set(
      selectedCompanyKeys.map((k) => k.toLowerCase())
    );
    return (rows || []).filter((r) => {
      if (dateFrom && String(r.dateFrom || "") < dateFrom) return false;
      if (dateTo && String(r.dateTo || r.dateFrom || "") > dateTo) return false;
      if (selected.size) {
        const keys = [
          ...(Array.isArray(r.companyKeys) ? r.companyKeys : []),
          r.companyFilter,
        ]
          .map((k) => String(k || "").trim().toLowerCase())
          .filter((k) => k && k !== "all");
        if (!keys.some((k) => selected.has(k))) return false;
      }
      if (!needle) return true;
      const blob = [
        r.title,
        r.savedByUsername,
        companiesLabel(r),
        periodLabel(r),
        r.cashier,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q, dateFrom, dateTo, selectedCompanyKeys]);

  const stats = useMemo(() => {
    let withSigned = 0;
    for (const r of filteredRows) {
      if (Array.isArray(r.signedAttachments) && r.signedAttachments.length) {
        withSigned += 1;
      }
    }
    return {
      total: filteredRows.length,
      withSigned,
      withoutSigned: Math.max(0, filteredRows.length - withSigned),
    };
  }, [filteredRows]);

  const closePreview = useCallback(() => {
    setPreview({ open: false, title: "", html: "", doc: null });
  }, []);

  const viewSaved = useCallback(async (id) => {
    setBusyId(id);
    try {
      const doc = await loadSavedDoc(id);
      const packages = buildPackagesFromDoc(doc);
      if (!packages.length) {
        alert("لا توجد بيانات للعرض");
        return;
      }
      const withLogos = await attachPrintLogos(packages);
      const html = buildDailyCashScreenPreviewHtml(withLogos, {
        fontSize: doc.fontSize || 9,
        fontBold: doc.fontBold !== false,
      });
      setPreview({
        open: true,
        title: doc.title || "تقرير محفوظ",
        html,
        doc,
      });
    } catch (e) {
      alert(e?.message || "تعذر فتح التقرير");
    } finally {
      setBusyId(null);
    }
  }, []);

  const closePrintModal = useCallback(() => {
    setFontSettingsOpen(false);
    setPrintModal((prev) => ({
      ...prev,
      open: false,
      doc: null,
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
      printModal.companies?.[0]?.name ||
      printModal.doc?.companyNames?.[0] ||
      "صندوق تجريبي";
    return buildDailyCashPrintPreviewHtml({
      fontSize: printModal.fontSize || 9,
      fontBold: printModal.fontBold !== false,
      companyName,
    });
  }, [
    printModal.fontSize,
    printModal.fontBold,
    printModal.companies,
    printModal.doc,
  ]);

  const openPrintFromSaved = useCallback(
    async (idOrDoc) => {
      const id =
        typeof idOrDoc === "string" ? idOrDoc : String(idOrDoc?._id || "");
      setBusyId(id || "print");
      try {
        const doc =
          typeof idOrDoc === "object" && idOrDoc?.vouchers
            ? idOrDoc
            : await loadSavedDoc(id);
        const companyFilter = savedDocCompanyFilter(doc);
        const companies = listDailyCashPrintCompanies(doc.vouchers || [], {
          companyFilter,
          includeEmpty: true,
        });
        if (!companies.length) {
          alert("لا توجد صناديق للطباعة في هذا التقرير");
          return;
        }
        setPrintModal((prev) => ({
          open: true,
          doc,
          companies,
          balances: mergePrevBalances(companies, doc.prevBalances),
          fontSize: clampPrintFontSize(prev.fontSize || 9),
          fontBold: prev.fontBold !== false,
        }));
        setFontSettingsOpen(false);
      } catch (e) {
        alert(e?.message || "تعذر تجهيز الطباعة");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const confirmPrintSaved = useCallback(async () => {
    const printWin = openBlankDailyCashPrintWindow();
    try {
      setPrinting(true);
      const doc = printModal.doc;
      if (!doc) {
        try {
          printWin?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      const selectedKeys = (printModal.companies || [])
        .map((c) => String(c.key || "").trim())
        .filter(Boolean);
      const packages = buildPackagesFromDoc(doc, {
        companyFilter: selectedKeys.length
          ? selectedKeys.join(",")
          : savedDocCompanyFilter(doc),
        prevBalances: printModal.balances || {},
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
        autoPrint: true,
      });
    } catch (e) {
      try {
        printWin?.close();
      } catch {
        /* ignore */
      }
      alert(e?.message || "تعذر طباعة التقرير");
    } finally {
      setPrinting(false);
    }
  }, [
    printModal.doc,
    printModal.companies,
    printModal.balances,
    printModal.fontSize,
    printModal.fontBold,
    closePrintModal,
  ]);

  const removeSaved = useCallback(
    async (id) => {
      if (!confirm("حذف هذا التقرير المحفوظ؟")) return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/vouchers/reports/saved/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || "تعذر الحذف");
        }
        if (preview.open && String(preview.doc?._id) === String(id)) {
          closePreview();
        }
        await load(page);
      } catch (e) {
        alert(e?.message || "تعذر الحذف");
      } finally {
        setBusyId(null);
      }
    },
    [load, page, preview.open, preview.doc, closePreview]
  );

  const triggerUpload = useCallback((rowId) => {
    fileInputRefs.current[rowId]?.click();
  }, []);

  const handleUploadSigned = useCallback(async (row, files) => {
    if (!row?._id || !files?.length) return;
    setUploadingId(String(row._id));
    try {
      let lastAttachments = Array.isArray(row.signedAttachments)
        ? row.signedAttachments
        : [];

      for (const file of files) {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            prefix: `voucher-saved-reports/${row._id}`,
          }),
        });
        const presignJson = await presignRes.json().catch(() => ({}));
        if (!presignJson?.success) {
          throw new Error(presignJson?.error || "تعذر تجهيز الرفع");
        }

        const uploadRes = await fetch(presignJson.url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error(`فشل رفع ${file.name}`);
        }

        const attachment = {
          key: presignJson.key,
          name: file.name,
          url: presignJson.getUrl || "",
          contentType: file.type || "application/octet-stream",
          size: file.size || 0,
          uploadedAt: new Date().toISOString(),
        };

        const saveRes = await fetch(`/api/vouchers/reports/saved/${row._id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", attachment }),
        });
        const saveJson = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok || !saveJson?.success) {
          throw new Error(saveJson?.error || "تعذر حفظ المرفق");
        }
        lastAttachments = Array.isArray(saveJson.data?.signedAttachments)
          ? saveJson.data.signedAttachments
          : lastAttachments;
      }

      setRows((prev) =>
        prev.map((r) =>
          String(r._id) === String(row._id)
            ? { ...r, signedAttachments: lastAttachments }
            : r
        )
      );
      setAttachModal((prev) =>
        prev.open && String(prev.row?._id) === String(row._id)
          ? { ...prev, row: { ...prev.row, signedAttachments: lastAttachments } }
          : prev
      );
    } catch (e) {
      alert(e?.message || "تعذر رفع التقرير الموقّع");
    } finally {
      setUploadingId(null);
    }
  }, []);

  const removeSignedAttachment = useCallback(async (row, att) => {
    if (!row?._id || !att) return;
    if (!confirm("حذف هذا المرفق؟")) return;
    setUploadingId(String(row._id));
    try {
      const res = await fetch(`/api/vouchers/reports/saved/${row._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          key: att.key || "",
          url: att.url || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "تعذر الحذف");
      }
      const next = Array.isArray(json.data?.signedAttachments)
        ? json.data.signedAttachments
        : [];
      setRows((prev) =>
        prev.map((r) =>
          String(r._id) === String(row._id)
            ? { ...r, signedAttachments: next }
            : r
        )
      );
      setAttachModal((prev) =>
        prev.open && String(prev.row?._id) === String(row._id)
          ? { ...prev, row: { ...prev.row, signedAttachments: next } }
          : prev
      );
    } catch (e) {
      alert(e?.message || "تعذر حذف المرفق");
    } finally {
      setUploadingId(null);
    }
  }, []);

  const handleReset = useCallback(() => {
    setQ("");
    setDateFrom("");
    setDateTo("");
    setCompanyFilter([]);
    load(1, []);
  }, [load]);

  if (!Array.isArray(permissions)) return null;
  if (!canView) return null;

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
                تقارير محفوظة
                <ColoredIcon color="text-blue-600">
                  <FiFilter />
                </ColoredIcon>
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                لقطات التقارير اليومية مع فتح وعرض ورفع التقرير الموقّع
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => load(1)}
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

              <Link
                href="/vouchers/reports"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-extrabold text-amber-900 ring-1 ring-amber-200/80 transition hover:bg-amber-100"
              >
                <FiArrowRight className="text-base" />
                تقارير الوصولات
              </Link>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          <KpiCard
            label="المجموع"
            value={stats.total}
            icon={<FiLayers />}
            iconColor="text-indigo-600"
          />
          <KpiCard
            label="مع تقرير موقّع"
            value={stats.withSigned}
            icon={<FiCheckCircle />}
            iconColor="text-emerald-600"
          />
          <KpiCard
            label="بدون موقّع"
            value={stats.withoutSigned}
            icon={<FiFileText />}
            iconColor="text-red-600"
          />
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

          <div
            className={`grid grid-cols-1 gap-4 ${
              isDelegate ? "lg:grid-cols-6" : "lg:grid-cols-4"
            }`}
          >
            <div className={`text-right ${isDelegate ? "lg:col-span-2" : "lg:col-span-2"}`}>
              <FilterLabel icon={<FiSearch className="text-sm" />} iconColor="text-blue-600">
                بحث
              </FilterLabel>
              <input
                className={filterInputClass}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="عنوان / صندوق / مستخدم..."
              />
            </div>
            {isDelegate ? (
              <div className="text-right lg:col-span-2">
                <FilterLabel
                  icon={<FiLayers className="text-sm" />}
                  iconColor="text-violet-600"
                >
                  الصناديق
                </FilterLabel>
                <Select
                  isMulti
                  isClearable
                  closeMenuOnSelect={false}
                  options={companyOptions}
                  value={companyFilter}
                  onChange={(vals) => setCompanyFilter(vals || [])}
                  placeholder="اختر صندوق أو أكثر..."
                  classNamePrefix="saved-company-filter"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: 44,
                      borderRadius: 12,
                      borderColor: "rgb(226 232 240 / 0.9)",
                      boxShadow: "none",
                      fontWeight: 800,
                      fontSize: 14,
                      direction: "rtl",
                    }),
                    valueContainer: (base) => ({
                      ...base,
                      justifyContent: "flex-end",
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "#eff6ff",
                      borderRadius: 8,
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: "#1e3a8a",
                      fontWeight: 800,
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: "#94a3b8",
                      fontWeight: 700,
                    }),
                    menu: (base) => ({ ...base, zIndex: 40, direction: "rtl" }),
                    option: (base) => ({
                      ...base,
                      textAlign: "right",
                      fontWeight: 700,
                    }),
                  }}
                />
              </div>
            ) : null}
            <div className="text-right">
              <FilterLabel icon={<FiCalendar className="text-sm" />} iconColor="text-indigo-600">
                من تاريخ
              </FilterLabel>
              <input
                type="date"
                className={filterInputClass}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="text-right">
              <FilterLabel icon={<FiCalendar className="text-sm" />} iconColor="text-emerald-600">
                إلى تاريخ
              </FilterLabel>
              <input
                type="date"
                className={filterInputClass}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200/70 bg-white/75 py-20 text-slate-500 shadow-sm ring-1 ring-slate-200/50"
            >
              <FiLoader className="animate-spin" />
              جاري التحميل...
            </motion.div>
          ) : filteredRows.length > 0 ? (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative z-0 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 shadow-sm ring-1 ring-slate-200/50"
            >
              <div id="voucher-saved-reports-table" className="relative w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse text-[11px] leading-snug text-slate-800 font-bold md:text-[12px]">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[7%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
                      {[
                        "العنوان",
                        "الفترة",
                        "الصناديق",
                        "الوصولات",
                        "حفظ بواسطة",
                        "تاريخ الحفظ",
                        "الاتاج",
                        "إجراءات",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-1.5 py-2.5 text-right text-[10px] font-extrabold tracking-wide text-slate-900 md:px-2 md:text-[11px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60">
                    {filteredRows.map((r, idx) => {
                      const id = String(r._id);
                      const busy = busyId === id;
                      const uploading = uploadingId === id;
                      const signed = Array.isArray(r.signedAttachments)
                        ? r.signedAttachments
                        : [];
                      return (
                        <motion.tr
                          key={id}
                          whileHover={{
                            backgroundColor: "rgba(248,250,252,0.95)",
                          }}
                          transition={{ duration: 0.12 }}
                          className={`transition-colors hover:bg-slate-50 ${
                            idx % 2 === 0 ? "bg-white/50" : "bg-white/30"
                          }`}
                        >
                          <td
                            className="px-1.5 py-2 text-right font-extrabold text-slate-900 md:px-2"
                            title={r.title || "تقرير يومي"}
                          >
                            <span className="line-clamp-2 break-words">
                              {r.title || "تقرير يومي"}
                            </span>
                          </td>
                          <td className="px-1.5 py-2 text-right md:px-2">
                            <span className="line-clamp-2 break-words font-mono text-[10px] md:text-[11px]">
                              {periodLabel(r)}
                            </span>
                          </td>
                          <td
                            className="px-1.5 py-2 text-right md:px-2"
                            title={companiesLabel(r)}
                          >
                            <span className="line-clamp-2 break-words">
                              {companiesLabel(r)}
                            </span>
                          </td>
                          <td className="px-1.5 py-2 text-center font-extrabold text-slate-900 md:px-2">
                            {r.voucherCount ?? 0}
                          </td>
                          <td className="px-1.5 py-2 text-right md:px-2">
                            <span className="inline-flex max-w-full items-center justify-end gap-1">
                              <span className="line-clamp-1 break-all">
                                {r.savedByUsername || "—"}
                              </span>
                              <FiUser className="shrink-0 opacity-50" />
                            </span>
                          </td>
                          <td className="px-1.5 py-2 text-right text-slate-700 md:px-2">
                            <span className="line-clamp-2 break-words text-[10px] md:text-[11px]">
                              {fmtWhen(r.createdAt)}
                            </span>
                          </td>
                          <td
                            className="px-1.5 py-2 text-right md:px-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="file"
                              hidden
                              multiple
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.xls,.xlsx,.csv,image/*,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                              ref={(el) => {
                                fileInputRefs.current[id] = el;
                              }}
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length) handleUploadSigned(r, files);
                                e.target.value = "";
                              }}
                            />
                            <div className="flex flex-col items-stretch gap-1">
                              <button
                                type="button"
                                onClick={() => triggerUpload(id)}
                                disabled={uploading || busy}
                                className={`rounded-lg border px-1.5 py-1 text-[10px] font-extrabold transition md:text-[11px] ${
                                  uploading
                                    ? "cursor-not-allowed border-gray-200 bg-gray-200 text-gray-500"
                                    : "border-gray-200 bg-white text-slate-900 hover:bg-gray-50"
                                }`}
                              >
                                {uploading ? "رفع..." : "رفع"}
                              </button>
                              {signed.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAttachModal({ open: true, row: r })
                                  }
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-1.5 py-1 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100 md:text-[11px]"
                                >
                                  عرض ({signed.length})
                                </button>
                              ) : (
                                <span className="text-center text-[10px] text-slate-400">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-1.5 py-2 text-right md:px-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col items-stretch gap-1">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => viewSaved(id)}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-[10px] font-extrabold text-slate-900 hover:bg-gray-50 disabled:opacity-60 md:text-[11px]"
                              >
                                <FiEye />
                                عرض
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => openPrintFromSaved(id)}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-1.5 py-1 text-[10px] font-extrabold text-sky-800 hover:bg-sky-100 disabled:opacity-60 md:text-[11px]"
                              >
                                <FiPrinter />
                                طباعة
                              </button>
                              {canDeleteRow(r) ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => removeSaved(id)}
                                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 md:text-[11px]"
                                >
                                  <FiTrash2 />
                                  حذف
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-white/80 px-5 py-4 backdrop-blur">
                <div className="text-sm font-extrabold text-slate-700">
                  Total: <span className="text-slate-900">{meta.total}</span>
                  {"  "} | Page:{" "}
                  <span className="text-slate-900">{meta.page}</span>
                  {" / "}
                  <span className="text-slate-900">{meta.totalPages || 1}</span>
                </div>
                <TablePagination
                  page={page}
                  totalPages={meta.totalPages || 1}
                  onPage={(p) => load(p)}
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
      </div>

      <AnimatePresence>
        {preview.open ? (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-stretch justify-center bg-black/40 p-2 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreview}
          >
            <motion.div
              className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {preview.title}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    عرض بالطول — نفس فورمة التقرير
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openPrintFromSaved(preview.doc)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-800 ring-1 ring-sky-200/80 hover:bg-sky-100"
                  >
                    <FiPrinter />
                    طباعة
                  </button>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200/90 hover:bg-white"
                  >
                    <FiX />
                    إغلاق
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden bg-[#e8eef5]">
                <iframe
                  title={preview.title || "تقرير محفوظ"}
                  srcDoc={preview.html}
                  className="h-full w-full border-0 bg-transparent"
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {attachModal.open && attachModal.row ? (
          <motion.div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAttachModal({ open: false, row: null })}
          >
            <motion.div
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    الاتاج / التقرير الموقّع
                  </p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">
                    {attachModal.row.title || "تقرير محفوظ"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachModal({ open: false, row: null })}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                >
                  <FiX />
                </button>
              </div>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
                {(attachModal.row.signedAttachments || []).length === 0 ? (
                  <p className="py-8 text-center text-sm font-extrabold text-slate-500">
                    لا توجد مرفقات بعد
                  </p>
                ) : (
                  (attachModal.row.signedAttachments || []).map((att, i) => (
                    <div
                      key={`${att.key || att.url || i}`}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-right text-sm font-extrabold text-sky-800 hover:underline"
                        onClick={() => {
                          try {
                            openSignedAttachment(att);
                          } catch (e) {
                            alert(e?.message || "تعذر فتح الملف");
                          }
                        }}
                        title={att.name || "مرفق"}
                      >
                        <span className="inline-flex items-center gap-1">
                          <FiPaperclip className="shrink-0 opacity-70" />
                          {att.name || "مرفق"}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={uploadingId === String(attachModal.row._id)}
                        onClick={() =>
                          removeSignedAttachment(attachModal.row, att)
                        }
                        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-extrabold text-red-700 hover:bg-red-100"
                      >
                        حذف
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-slate-200/80 px-4 py-3">
                <button
                  type="button"
                  disabled={uploadingId === String(attachModal.row._id)}
                  onClick={() => triggerUpload(String(attachModal.row._id))}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-extrabold text-slate-900 ring-1 ring-slate-200/90 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <FiUpload />
                  رفع (PDF / صورة / Excel)
                </button>
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
                    طباعة التقرير المحفوظ
                  </div>
                  <div className="text-sm text-gray-500 font-bold">
                    الرصيد محفوظ مسبقاً — تطبع كل الصفحات معاً
                  </div>
                </div>
              </div>

              <div className="p-5 max-h-[65vh] overflow-y-auto space-y-3">
                <p className="text-right text-xs font-bold text-slate-500">
                  الصناديق التي ستُطبع
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  {(printModal.companies || []).map((c) => (
                    <span
                      key={c.key}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-extrabold text-slate-800"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={closePrintModal}
                  disabled={printing}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-extrabold hover:bg-gray-50 disabled:opacity-60"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmPrintSaved}
                  disabled={printing}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold shadow-sm ${
                    printing
                      ? "cursor-not-allowed bg-slate-300 text-slate-500"
                      : "bg-sky-600 text-white hover:bg-sky-700"
                  }`}
                >
                  {printing ? (
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
                        style={{
                          width: "210mm",
                          height: "297mm",
                          maxWidth: "100%",
                        }}
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
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-white ring-1 ring-slate-200/90 ${iconColor}`}
      >
        {icon}
      </span>
    </label>
  );
}
