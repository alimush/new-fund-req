"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Select from "react-select";
import {
  FiSearch,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiEdit3,
  FiUsers,
  FiLayers,
} from "react-icons/fi";
import { PERMISSIONS } from "@/lib/permission";
import { usePermissions } from "@/context/PermissionContext";
import { useToast } from "@/components/ui/ToastProvider";

export default function AdminRequestsWorkflowListPage() {
  const router = useRouter();
  const { companies } = usePermissions();
  const { showToast } = useToast();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: 25 });
  const [apiCompanies, setApiCompanies] = useState([]);

  const [companyFilter, setCompanyFilter] = useState("");
  const [requestCodeInput, setRequestCodeInput] = useState("");
  const [disbursedFilter, setDisbursedFilter] = useState("");
  const [lastStepUserFilter, setLastStepUserFilter] = useState("");

  const [appliedCompany, setAppliedCompany] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [appliedDisbursed, setAppliedDisbursed] = useState("");
  const [appliedLastStepUser, setAppliedLastStepUser] = useState("");

  const [bulkChecking, setBulkChecking] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkCheckResult, setBulkCheckResult] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [bulkWorkflowName, setBulkWorkflowName] = useState("");
  const [bulkSteps, setBulkSteps] = useState([]);

  const companyOptions = useMemo(() => {
    const fromApi = Array.isArray(apiCompanies) ? apiCompanies : [];
    const fromCtx = Array.isArray(companies) ? companies : [];
    const merged = [...new Set([...fromApi, ...fromCtx].map((c) => String(c || "").trim()).filter(Boolean))];
    return merged.sort();
  }, [apiCompanies, companies]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      String(a?.username || "").localeCompare(String(b?.username || ""), "ar", { sensitivity: "base" })
    );
  }, [users]);

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
      if (appliedDisbursed) params.set("disbursed", appliedDisbursed);
      if (appliedLastStepUser) params.set("lastStepUser", appliedLastStepUser);
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
  }, [appliedCompany, appliedCode, appliedDisbursed, appliedLastStepUser, meta.page, meta.pageSize, router]);

  useEffect(() => {
    if (!authorized) return;
    fetchList();
  }, [authorized, fetchList]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadUsers();
  }, [authorized, loadUsers]);

  const applyFilters = () => {
    setAppliedCompany(companyFilter);
    setAppliedCode(requestCodeInput);
    setAppliedDisbursed(disbursedFilter);
    setAppliedLastStepUser(lastStepUserFilter);
    setMeta((m) => ({ ...m, page: 1 }));
    setBulkCheckResult(null);
  };

  const runBulkCheck = async () => {
    setBulkChecking(true);
    setBulkCheckResult(null);
    try {
      const res = await fetch("/api/admin/requests-workflow/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: true,
          company: appliedCompany,
          requestCode: appliedCode.trim(),
          disbursed: appliedDisbursed,
          lastStepUser: appliedLastStepUser,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "تعذر التحقق", "error");
        return;
      }
      setBulkCheckResult(json);
      if (json.count === 0) {
        showToast(json.message || "لا توجد طلبات مطابقة", "error");
        return;
      }
      if (!json.uniform) {
        showToast(json.message || "الوورك فلو غير موحّد", "error");
        return;
      }
      await loadUsers();
      const wf = json.workflow || { name: "", steps: [] };
      setBulkWorkflowName(String(wf.name || ""));
      setBulkSteps(
        (wf.steps || []).map((s) => ({
          users: Array.isArray(s.users) ? s.users.map((u) => String(u)) : [],
        }))
      );
      setBulkModalOpen(true);
      showToast(`تم التحقق: ${json.count} طلب — آخر خطوة موحّدة`, "success");
    } catch {
      showToast("خطأ في التحقق", "error");
    } finally {
      setBulkChecking(false);
    }
  };

  const applyBulkSave = async () => {
    if (bulkSteps.length !== 1) {
      showToast("التعديل الجماعي يتوقع خطوة واحدة (آخر خطوة). أعد التحقق.", "error");
      return;
    }
    if (bulkSteps.some((s) => !s.users || s.users.length === 0)) {
      showToast("كل خطوة لازم يكون بها مستخدم واحد على الأقل", "error");
      return;
    }
    setBulkSaving(true);
    try {
      const res = await fetch("/api/admin/requests-workflow/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          company: appliedCompany,
          requestCode: appliedCode.trim(),
          disbursed: appliedDisbursed,
          lastStepUser: appliedLastStepUser,
          workflow: {
            name: bulkWorkflowName,
            steps: bulkSteps.map((s) => ({ users: s.users })),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "فشل التطبيق", "error");
        return;
      }
      showToast(`تم تحديث ${json.updated} طلباً`, "success");
      setBulkModalOpen(false);
      setBulkCheckResult(null);
      await fetchList();
    } catch {
      showToast("خطأ في الحفظ", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen pb-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-bold text-gray-900">تعديل وورك فلو الطلبات</h1>
          <p className="mt-2 text-sm text-gray-600">
            عرض الطلبات ضمن شركاتك والدخول لتعديل مسار الموافقات. يمكن فلترة الطلبات التي صُرِف وصلها من آخر خطوة،
            أو حصر القائمة بمن هو الموافق <span className="font-semibold">الوحيد</span> في آخر خطوة (مستخدم واحد فقط
            في تلك الخطوة)، وتعديل موافقي <span className="font-semibold">آخر خطوة</span> دفعة واحدة عندما تتطابق
            آخر خطوة بين كل الطلبات المفلترة (نفس المستخدمين عليها)، بغضّ النظر عن عدد الخطوات السابقة (حد أقصى
            250 طلباً لكل عملية).
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
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">حالة الصرف (آخر خطوة)</label>
            <select
              value={disbursedFilter}
              onChange={(e) => setDisbursedFilter(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900"
            >
              <option value="">الكل</option>
              <option value="yes">مصروفة (وصل مسجّل)</option>
              <option value="no">غير مصروفة</option>
            </select>
          </div>
          <div className="flex w-full min-w-[240px] flex-[1_1_100%] flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">موافق آخر خطوة (اختياري)</label>
            <select
              value={lastStepUserFilter}
              onChange={(e) => setLastStepUserFilter(e.target.value)}
              disabled={loadingUsers}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-60"
            >
              <option value="">— بدون هذا الفلتر —</option>
              {sortedUsers.map((u) => (
                <option key={String(u._id)} value={String(u._id)}>
                  {u.username || String(u._id)}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-gray-500">
              عند الاختيار: تظهر فقط الطلبات التي آخر خطوة فيها <span className="font-semibold">مستخدم واحد</span>{" "}
              وهو هذا المستخدم (لا يشمل الطلبات التي آخر خطوة فيها أكثر من موافق).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
                setDisbursedFilter("");
                setLastStepUserFilter("");
                setAppliedCompany("");
                setAppliedCode("");
                setAppliedDisbursed("");
                setAppliedLastStepUser("");
                setMeta((m) => ({ ...m, page: 1 }));
                setBulkCheckResult(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-gray-800 hover:bg-gray-50"
            >
              <FiRefreshCw /> مسح
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-2 text-sm text-indigo-950">
              <FiLayers className="mt-0.5 shrink-0 text-lg" />
              <div>
                <p className="font-semibold">تعديل جماعي على المفلتر فقط</p>
                <p className="mt-1 text-indigo-900/90">
                  يُسمح عندما تتطابق <span className="font-semibold">آخر خطوة</span> بين كل الطلبات المطابقة للفلتر
                  (نفس مجموعة الموافقين على تلك الخطوة فقط)، دون اشتراط تطابق عدد الخطوات أو الخطوات السابقة. التعديل
                  يحدّث موافقي آخر خطوة فقط مع الإبقاء على باقي الخطوات وحالاتها وسجلات الصرف كما في التعديل الفردي؛
                  ويمكنك تعديل اسم الوورك فلو لكل الطلبات المحددة.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={bulkChecking || loading}
              onClick={runBulkCheck}
              className="shrink-0 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-800 disabled:opacity-50"
            >
              {bulkChecking ? "جاري التحقق…" : "التحقق وفتح التعديل الجماعي"}
            </button>
          </div>
          {bulkCheckResult && !bulkCheckResult.uniform && bulkCheckResult.count > 0 && (
            <p className="mt-3 text-sm font-medium text-amber-900">{bulkCheckResult.message}</p>
          )}
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
                  <th className="px-4 py-3 font-semibold text-gray-700">الصرف</th>
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
                    <td className="px-4 py-2">
                      {r.hasVoucherOut ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                          مصروفة
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          —
                        </span>
                      )}
                    </td>
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

      <AnimatePresence>
        {bulkModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !bulkSaving) setBulkModalOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-gray-900">تعديل جماعي — آخر خطوة فقط</h2>
              <p className="mt-1 text-xs text-gray-600">
                يُطبَّق على {bulkCheckResult?.count ?? "—"} طلباً مطابقاً للفلتر. يُستبدل موافقو{" "}
                <span className="font-semibold">الخطوة الأخيرة</span> فقط؛ بقية الخطوات لا تتغير.
              </p>

              <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
                اسم الوورك فلو (اختياري، لكل الطلبات المحددة)
              </label>
              <input
                type="text"
                value={bulkWorkflowName}
                onChange={(e) => setBulkWorkflowName(e.target.value)}
                className="mb-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-900"
              />

              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FiUsers className="text-blue-600" /> موافقو الخطوة الأخيرة
              </h3>
              <div className="space-y-3">
                {bulkSteps.map((s, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <span className="mb-2 block text-xs font-medium text-gray-600">
                      {bulkSteps.length === 1
                        ? "الخطوة الأخيرة (موحّدة بين الطلبات المفلترة)"
                        : `الخطوة ${idx + 1}`}
                    </span>
                    {loadingUsers ? (
                      <div className="h-9 animate-pulse rounded bg-gray-200" />
                    ) : (
                      <Select
                        isMulti
                        className="min-w-0"
                        options={users.map((u) => ({
                          value: String(u._id),
                          label: u.username,
                        }))}
                        value={users
                          .filter((u) => s.users.includes(String(u._id)))
                          .map((u) => ({ value: String(u._id), label: u.username }))}
                        onChange={(vals) => {
                          const next = [...bulkSteps];
                          next[idx] = { users: (vals || []).map((v) => v.value) };
                          setBulkSteps(next);
                        }}
                        placeholder="اختر المستخدمين"
                        styles={{ menu: (base) => ({ ...base, zIndex: 200 }) }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={bulkSaving}
                  onClick={() => setBulkModalOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={bulkSaving}
                  onClick={applyBulkSave}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {bulkSaving ? "جاري التطبيق…" : "تطبيق على المفلتر"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
