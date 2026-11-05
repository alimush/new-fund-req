"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  FiArrowRight,
  FiCalendar,
  FiEye,
  FiHome,
  FiLoader,
  FiPrinter,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { usePermissions } from "@/context/PermissionContext";
import { useUser } from "@/context/UserContext";
import { PERMISSIONS } from "@/lib/permission";
import {
  attachPrintLogos,
  buildDailyCashPrintPackages,
  buildDailyCashScreenPreviewHtml,
  openBlankDailyCashPrintWindow,
  openDailyCashPrintWindow,
} from "@/lib/voucher/dailyCashPrint";
import TablePagination from "@/components/TablePagination";

const PAGE_SIZE = 25;

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

function buildPackagesFromDoc(doc) {
  return buildDailyCashPrintPackages(doc.vouchers || [], {
    dateFrom: doc.dateFrom || "",
    dateTo: doc.dateTo || "",
    companyFilter: doc.companyFilter || "all",
    cashier: doc.cashier || "",
    prevBalances: doc.prevBalances || {},
    includeEmpty: true,
  });
}

export default function SavedVoucherReportsPage() {
  const { permissions } = usePermissions();
  const { user: ctxUser } = useUser();
  const canView =
    Array.isArray(permissions) &&
    (permissions.includes(PERMISSIONS.VOUCHERS_REPORTS_VIEW) ||
      permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS) ||
      permissions.some((p) => String(p || "").startsWith("VOUCHERS_")));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [preview, setPreview] = useState({
    open: false,
    title: "",
    html: "",
    doc: null,
  });

  const load = useCallback(async (pageValue = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/vouchers/reports/saved?page=${pageValue}&pageSize=${PAGE_SIZE}`,
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

  const printSaved = useCallback(async (idOrDoc) => {
    const printWin = openBlankDailyCashPrintWindow();
    const id =
      typeof idOrDoc === "string" ? idOrDoc : String(idOrDoc?._id || "");
    setBusyId(id || "print");
    try {
      const doc =
        typeof idOrDoc === "object" && idOrDoc?.vouchers
          ? idOrDoc
          : await loadSavedDoc(id);
      const packages = buildPackagesFromDoc(doc);
      if (!packages.length) {
        try {
          printWin?.close();
        } catch {
          /* ignore */
        }
        alert("لا توجد بيانات للطباعة");
        return;
      }
      await openDailyCashPrintWindow(packages, printWin, {
        fontSize: doc.fontSize || 9,
        fontBold: doc.fontBold !== false,
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
      setBusyId(null);
    }
  }, []);

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

  const fmtWhen = (v) => {
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

  if (!Array.isArray(permissions)) return null;
  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-slate-600">
        لا تملك صلاحية عرض التقارير المحفوظة
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-500">تقارير الوصولات</p>
            <h1 className="text-2xl font-black text-slate-900">تقارير محفوظة</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              لقطات التقارير اليومية — العرض بالطول بنفس فورمة الطباعة
            </p>
          </div>
          <Link
            href="/vouchers/reports"
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-black"
          >
            <FiArrowRight />
            رجوع للتقارير
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
              <FiLoader className="animate-spin" />
              جاري التحميل...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              لا توجد تقارير محفوظة بعد. اطبع تقريراً يومياً ليُحفظ هنا تلقائياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-600">
                  <tr>
                    <th className="px-4 py-3">العنوان</th>
                    <th className="px-4 py-3">الفترة</th>
                    <th className="px-4 py-3">الصناديق</th>
                    <th className="px-4 py-3">الوصولات</th>
                    <th className="px-4 py-3">حفظ بواسطة</th>
                    <th className="px-4 py-3">تاريخ الحفظ</th>
                    <th className="px-4 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const busy = busyId === String(r._id);
                    const companies =
                      (r.companyNames || []).filter(Boolean).join(" · ") ||
                      (r.companyKeys || []).join(" · ") ||
                      "-";
                    const range =
                      r.dateFrom && r.dateTo
                        ? r.dateFrom === r.dateTo
                          ? r.dateFrom
                          : `${r.dateFrom} → ${r.dateTo}`
                        : r.dateFrom || r.dateTo || "-";
                    return (
                      <tr
                        key={r._id}
                        className="border-t border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {r.title || "تقرير يومي"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <FiCalendar className="opacity-60" />
                            {range}
                          </span>
                        </td>
                        <td className="max-w-[220px] px-4 py-3 font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <FiHome className="shrink-0 opacity-60" />
                            <span className="truncate">{companies}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-slate-800">
                          {r.voucherCount ?? 0}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <FiUser className="opacity-60" />
                            {r.savedByUsername || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {fmtWhen(r.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => viewSaved(String(r._id))}
                              className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <FiEye />
                              عرض
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => printSaved(String(r._id))}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-black disabled:opacity-50"
                            >
                              <FiPrinter />
                              طباعة
                            </button>
                            {(String(r.savedByUsername || "") ===
                              String(ctxUser?.username || "") ||
                              permissions.includes(
                                PERMISSIONS.VIEW_ALL_REPORTS
                              )) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => removeSaved(String(r._id))}
                                className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-700 ring-1 ring-red-100 hover:bg-red-100 disabled:opacity-50"
                              >
                                <FiTrash2 />
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {meta.totalPages > 1 ? (
          <div className="mt-4">
            <TablePagination
              page={page}
              totalPages={meta.totalPages}
              onPage={(p) => load(p)}
            />
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {preview.open ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-stretch justify-center bg-slate-950/55 p-2 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreview}
          >
            <motion.div
              className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-black text-slate-900">
                    {preview.title}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    عرض بالطول — نفس فورمة التقرير
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printSaved(preview.doc)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-black"
                  >
                    <FiPrinter />
                    طباعة
                  </button>
                  <button
                    type="button"
                    onClick={closePreview}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
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
    </div>
  );
}
