"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiSearch, FiRefreshCw, FiChevronLeft, FiChevronRight, FiEdit3 } from "react-icons/fi";
import { PERMISSIONS } from "@/lib/permission";
import { usePermissions } from "@/context/PermissionContext";

export default function AdminRequestsWorkflowListPage() {
  const router = useRouter();
  const { companies } = usePermissions();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: 25 });
  const [apiCompanies, setApiCompanies] = useState([]);

  const [companyFilter, setCompanyFilter] = useState("");
  const [requestCodeInput, setRequestCodeInput] = useState("");
  const [appliedCompany, setAppliedCompany] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const companyOptions = useMemo(() => {
    const fromApi = Array.isArray(apiCompanies) ? apiCompanies : [];
    const fromCtx = Array.isArray(companies) ? companies : [];
    const merged = [...new Set([...fromApi, ...fromCtx].map((c) => String(c || "").trim()).filter(Boolean))];
    return merged.sort();
  }, [apiCompanies, companies]);

  useEffect(() => {
    const guard = async () => {
      try {
        const res = await fetch("/api/user-permissions", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
        if (!perms.includes(PERMISSIONS.MANAGE_PERMISSIONS)) {
          router.replace("/home");
          return;
        }
        setAuthorized(true);
      } catch {
        router.replace("/home");
      }
    };
    guard();
  }, [router]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedCompany) params.set("company", appliedCompany);
      if (appliedCode.trim()) params.set("requestCode", appliedCode.trim());
      params.set("page", String(meta.page));
      params.set("pageSize", String(meta.pageSize));

      const res = await fetch(`/api/admin/requests-workflow?${params.toString()}`, {
        cache: "no-store",
      });

      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        router.replace("/home");
        return;
      }

      const json = await res.json();
      if (json?.success) {
        setRows(Array.isArray(json.data) ? json.data : []);
        setMeta((m) => ({
          ...m,
          ...(json.meta || {}),
        }));
        if (Array.isArray(json.filters?.companies)) {
          setApiCompanies(json.filters.companies);
        }
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedCompany, appliedCode, meta.page, meta.pageSize, router]);

  useEffect(() => {
    if (!authorized) return;
    fetchList();
  }, [authorized, fetchList]);

  const applyFilters = () => {
    setAppliedCompany(companyFilter);
    setAppliedCode(requestCodeInput);
    setMeta((m) => ({ ...m, page: 1 }));
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-bold text-gray-900">تعديل وورك فلو الطلبات</h1>
          <p className="mt-2 text-sm text-gray-600">
            عرض كل الطلبات ضمن شركاتك والدخول لتعديل مسار الموافقات لكل طلب. هذه الصفحة مخصصة لمن لديه صلاحية{" "}
            <span className="font-mono text-xs">MANAGE_PERMISSIONS</span>.
          </p>
        </div>

            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">الشركة</label>
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900"
                >
                  <option value="">كل الشركات</option>
                  {companyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">رقم الطلب (requestCode)</label>
                <input
                  type="text"
                  value={requestCodeInput}
                  onChange={(e) => setRequestCodeInput(e.target.value)}
                  placeholder="مثال: WAS-..."
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-white shadow hover:bg-black/85"
                >
                  <FiSearch /> بحث
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompanyFilter("");
                    setRequestCodeInput("");
                    setAppliedCompany("");
                    setAppliedCode("");
                    setMeta((m) => ({ ...m, page: 1 }));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-800 hover:bg-gray-50"
                >
                  <FiRefreshCw /> مسح
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-gray-600">جاري التحميل...</p>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-10 text-center text-gray-600">
                لا توجد طلبات مطابقة للفلتر.
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-x-auto rounded-2xl border border-gray-200 bg-white/95 shadow"
              >
                <table className="min-w-full text-right text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">رقم الطلب</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">الشركة</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">الحالة</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">الخطوة الحالية</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">الخطوات</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">منشئ</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.companyKey}-${r._id}`} className="border-b border-gray-100 hover:bg-gray-50/80">
                        <td className="px-4 py-2 font-mono text-xs text-gray-900">{r.requestCode || "—"}</td>
                        <td className="px-4 py-2 text-gray-800">{r.companyKey}</td>
                        <td className="px-4 py-2 text-gray-800">{r.status}</td>
                        <td className="px-4 py-2 text-gray-800">{r.currentStep}</td>
                        <td className="px-4 py-2 text-gray-800">{r.stepsCount}</td>
                        <td className="px-4 py-2 text-gray-800">{r.createdBy}</td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/admin/requests-workflow/${r._id}?company=${encodeURIComponent(r.companyKey)}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                          >
                            <FiEdit3 /> تعديل الوورك فلو
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}

            {meta.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setMeta((m) => ({ ...m, page: Math.max(1, m.page - 1) }))}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 disabled:opacity-40"
                >
                  <FiChevronRight /> السابق
                </button>
                <span className="text-sm text-gray-700">
                  صفحة {meta.page} من {meta.totalPages} — إجمالي {meta.total}
                </span>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setMeta((m) => ({ ...m, page: Math.min(m.totalPages, m.page + 1) }))}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 disabled:opacity-40"
                >
                  التالي <FiChevronLeft />
                </button>
              </div>
            )}
      </div>
    </div>
  );
}
