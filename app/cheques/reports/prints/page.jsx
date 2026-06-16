"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiArrowRight, FiPrinter } from "react-icons/fi";
import { CHEQUE_TEMPLATES } from "@/lib/cheques/templates";
import { formatChequeAmount, formatSavedAt } from "@/lib/cheques/formatCheque";
import TablePagination from "@/components/TablePagination";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";

const PAGE_SIZE = 25;

export default function ChequePrintJobsPage() {
  const { canUseCheques, ready } = useChequeAccess();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, page: 1, pageSize: PAGE_SIZE });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cheques/prints?page=${p}&pageSize=${PAGE_SIZE}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.success) {
        setRows(json.data || []);
        setMeta(json.meta || { total: 0, totalPages: 1, page: p, pageSize: PAGE_SIZE });
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && canUseCheques) load(page);
  }, [ready, canUseCheques, page, load]);

  const templateName = (key) =>
    CHEQUE_TEMPLATES.find((t) => t.key === key)?.name || key || "—";

  if (!ready || !canUseCheques) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <Link
        href="/cheques/reports"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-4"
      >
        <FiArrowRight />
        تقارير الصكوك
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <FiPrinter size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">سجل الطباعة</h1>
          <p className="text-sm font-semibold text-slate-500">
            عمليات طباعة PDF للصكوك
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-right">
                <th className="px-4 py-3 font-extrabold text-slate-700">التاريخ</th>
                <th className="px-4 py-3 font-extrabold text-slate-700">المستخدم</th>
                <th className="px-4 py-3 font-extrabold text-slate-700">القالب</th>
                <th className="px-4 py-3 font-extrabold text-slate-700">الطابعة</th>
                <th className="px-4 py-3 font-extrabold text-slate-700">الوضع</th>
                <th className="px-4 py-3 font-extrabold text-slate-700">المستفيد</th>
                <th className="px-4 py-3 font-extrabold text-slate-700">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center font-bold text-slate-500">
                    جاري التحميل…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center font-bold text-slate-500">
                    لا توجد عمليات طباعة مسجّلة
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                      {formatSavedAt(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">{row.username || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {row.templateName || templateName(row.templateKey)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      {row.printerName || "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{row.printMode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.payee || "—"}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">
                      {row.amountNumeric ? formatChequeAmount(row.amountNumeric) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
