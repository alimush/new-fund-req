"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiArrowRight, FiRefreshCw, FiSearch, FiShield, FiUser } from "react-icons/fi";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permission";
import { usePermissions } from "@/context/PermissionContext";
import { useToast } from "@/components/ui/ToastProvider";

export default function AdminTransferRequestsPage() {
  const router = useRouter();
  const { companies } = usePermissions();
  const { showToast } = useToast();

  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [transferCreatedBy, setTransferCreatedBy] = useState(true);
  const [transferWorkflow, setTransferWorkflow] = useState(true);
  const [includeOldData, setIncludeOldData] = useState(false);

  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState(null);

  const [permChecking, setPermChecking] = useState(false);
  const [permApplying, setPermApplying] = useState(false);
  const [permPreview, setPermPreview] = useState(null);

  const companyOptions = useMemo(() => {
    return [...new Set((companies || []).map((c) => String(c || "").trim()).filter(Boolean))].sort();
  }, [companies]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) =>
      String(a?.username || "").localeCompare(String(b?.username || ""), "ar", {
        sensitivity: "base",
      })
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

  const buildBody = (dryRun) => ({
    dryRun,
    fromUserId,
    toUserId,
    company: companyFilter,
    transferCreatedBy,
    transferWorkflow,
    includeOldData,
  });

  const runPreview = async () => {
    if (!fromUserId || !toUserId) {
      showToast("اختر المستخدم «من» و«إلى»", "error");
      return;
    }
    if (fromUserId === toUserId) {
      showToast("لا يمكن النقل لنفس المستخدم", "error");
      return;
    }

    setChecking(true);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(true)),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "تعذر التحقق", "error");
        return;
      }
      setPreview(json);
      if (json.totalMatched === 0) {
        showToast("لا توجد طلبات مطابقة", "error");
      } else {
        showToast(`تم العثور على ${json.totalMatched} طلب`, "success");
      }
    } catch {
      showToast("خطأ في التحقق", "error");
    } finally {
      setChecking(false);
    }
  };

  const runApply = async () => {
    if (!preview || preview.totalMatched === 0) {
      showToast("نفّذ التحقق أولاً", "error");
      return;
    }
    const fromName = preview.from?.username || fromUserId;
    const toName = preview.to?.username || toUserId;
    const ok = window.confirm(
      `تأكيد نقل ${preview.totalMatched} طلب(ات)\nمن: ${fromName}\nإلى: ${toName}\n\nلا يمكن التراجع بسهولة.`
    );
    if (!ok) return;

    setApplying(true);
    try {
      const res = await fetch("/api/admin/transfer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(false)),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "فشل النقل", "error");
        return;
      }
      showToast(
        `تم النقل — createdBy: ${json.totalCreatedByUpdated || 0}، وورك فلو: ${json.totalWorkflowDocsUpdated || 0}`,
        "success"
      );
      setPreview(json);
    } catch {
      showToast("خطأ في التنفيذ", "error");
    } finally {
      setApplying(false);
    }
  };

  const runPermPreview = async () => {
    if (!fromUserId || !toUserId) {
      showToast("اختر المستخدم «من» و«إلى»", "error");
      return;
    }
    if (fromUserId === toUserId) {
      showToast("لا يمكن النقل لنفس المستخدم", "error");
      return;
    }

    setPermChecking(true);
    setPermPreview(null);
    try {
      const res = await fetch("/api/admin/transfer-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true, fromUserId, toUserId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "تعذر التحقق", "error");
        return;
      }
      setPermPreview(json);
      if ((json.groupCount || 0) === 0) {
        showToast("المستخدم المصدر ليس في أي كروب صلاحيات", "error");
      } else {
        showToast(`وُجد ${json.groupCount} كروب`, "success");
      }
    } catch {
      showToast("خطأ في التحقق", "error");
    } finally {
      setPermChecking(false);
    }
  };

  const runPermApply = async () => {
    if (!permPreview || (permPreview.groupCount || 0) === 0) {
      showToast("نفّذ التحقق أولاً", "error");
      return;
    }
    const fromName = permPreview.from?.username || fromUserId;
    const toName = permPreview.to?.username || toUserId;
    const ok = window.confirm(
      `نقل الصلاحيات من ${fromName} إلى ${toName}؟\n\nسيتم إزالة ${fromName} من ${permPreview.groupCount} كروب وإضافة ${toName} إليه.`
    );
    if (!ok) return;

    setPermApplying(true);
    try {
      const res = await fetch("/api/admin/transfer-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false, fromUserId, toUserId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "فشل النقل", "error");
        return;
      }
      setPermPreview(json);
      const updated = json.updatedGroups || 0;
      const errors = Array.isArray(json.errors) ? json.errors : [];
      if (updated === 0 && errors.length) {
        showToast(errors[0]?.error || "فشل تحديث الكروبات", "error");
      } else if (updated === 0 && (json.groupCount || 0) > 0) {
        showToast("لم يُحدَّث أي كروب — ربما تم النقل مسبقاً", "error");
      } else {
        showToast(`تم تحديث ${updated} كروب`, "success");
      }
    } catch {
      showToast("خطأ في التنفيذ", "error");
    } finally {
      setPermApplying(false);
    }
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen pb-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur">
          <h1 className="text-2xl font-bold text-gray-900">نقل بين المستخدمين</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            انقل <span className="font-semibold">الطلبات</span> أو{" "}
            <span className="font-semibold">كروبات الصلاحيات</span> من مستخدم إلى آخر — نفس حقول «من»
            و«إلى» أدناه.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-lg"
        >
          <h2 className="mb-4 text-lg font-bold text-gray-900">١ — نقل الطلبات</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-800">من</label>
              <select
                value={fromUserId}
                onChange={(e) => {
                  setFromUserId(e.target.value);
                  setPreview(null);
                  setPermPreview(null);
                }}
                disabled={loadingUsers}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 disabled:opacity-60"
              >
                <option value="">— اختر المستخدم المصدر —</option>
                {sortedUsers.map((u) => (
                  <option key={String(u._id)} value={String(u._id)}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden justify-center sm:flex sm:pb-2">
              <FiArrowRight className="text-2xl text-indigo-500" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-800">إلى</label>
              <select
                value={toUserId}
                onChange={(e) => {
                  setToUserId(e.target.value);
                  setPreview(null);
                  setPermPreview(null);
                }}
                disabled={loadingUsers}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 disabled:opacity-60"
              >
                <option value="">— اختر المستخدم الهدف —</option>
                {sortedUsers.map((u) => (
                  <option key={String(u._id)} value={String(u._id)}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1">
            <label className="text-sm font-semibold text-gray-800">الشركة (اختياري)</label>
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPreview(null);
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900"
            >
              <option value="">كل الشركات ضمن صلاحيتك</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <p className="text-sm font-bold text-slate-800">ماذا يُنقَل؟</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={transferCreatedBy}
                onChange={(e) => {
                  setTransferCreatedBy(e.target.checked);
                  setPreview(null);
                }}
                className="rounded border-gray-300"
              />
              منشئ الطلب (createdBy) — للتقارير و«طلباتي»
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={transferWorkflow}
                onChange={(e) => {
                  setTransferWorkflow(e.target.checked);
                  setPreview(null);
                }}
                className="rounded border-gray-300"
              />
              مستخدم في خطوات الوورك فلو والتخويل
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={includeOldData}
                onChange={(e) => {
                  setIncludeOldData(e.target.checked);
                  setPreview(null);
                }}
                className="rounded border-gray-300"
              />
              تضمين Old Data
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runPreview}
              disabled={checking || applying || !fromUserId || !toUserId}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              <FiSearch />
              {checking ? "جاري التحقق..." : "تحقق (معاينة)"}
            </button>
            <button
              type="button"
              onClick={runApply}
              disabled={applying || checking || !preview || preview.totalMatched === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiUser />
              {applying ? "جاري النقل..." : "تنفيذ النقل"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setPermPreview(null);
                setFromUserId("");
                setToUserId("");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
            >
              <FiRefreshCw />
              إعادة ضبط
            </button>
          </div>
        </motion.div>

        {preview ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm"
          >
            <h2 className="text-lg font-bold text-indigo-900">نتيجة {preview.dryRun ? "المعاينة" : "التنفيذ"}</h2>
            <p className="mt-1 text-sm text-indigo-800">
              من <span className="font-bold">{preview.from?.username}</span> إلى{" "}
              <span className="font-bold">{preview.to?.username}</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-800">
              إجمالي الطلبات المتأثرة: {preview.totalMatched}
            </p>
            {!preview.dryRun ? (
              <p className="mt-1 text-sm text-gray-700">
                تم تحديث createdBy: {preview.totalCreatedByUpdated || 0} — وورك فلو:{" "}
                {preview.totalWorkflowDocsUpdated || 0}
              </p>
            ) : null}

            {(preview.byCompany || []).length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-right text-xs font-bold text-slate-700">
                    <tr>
                      <th className="px-3 py-2">الشركة</th>
                      <th className="px-3 py-2">عدد الطلبات</th>
                      <th className="px-3 py-2">أمثلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.byCompany.map((row) => (
                      <tr key={row.companyKey} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold">{row.companyKey}</td>
                        <td className="px-3 py-2">{row.matched}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">
                          {(row.samples || [])
                            .map((s) => s.requestCode || s.id)
                            .filter(Boolean)
                            .join("، ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {preview.oldData?.matched > 0 ? (
              <p className="mt-3 text-sm text-gray-700">
                Old Data: {preview.oldData.matched} طلب
                {(preview.oldData.samples || []).length
                  ? ` — ${preview.oldData.samples.map((s) => s.requestCode).filter(Boolean).join("، ")}`
                  : ""}
              </p>
            ) : null}
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-2xl border border-violet-200 bg-violet-50/40 p-6 shadow-lg"
        >
          <h2 className="text-lg font-bold text-violet-950">٢ — نقل كروبات الصلاحيات</h2>
          <p className="mt-2 text-sm leading-relaxed text-violet-900/90">
            يزيل المستخدم «من» من كل كروبات الصلاحيات التي ينتمي إليها، ويضيف المستخدم «إلى» إلى نفس
            الكروبات (بدون تكرار إن كان موجوداً مسبقاً).
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runPermPreview}
              disabled={permChecking || permApplying || !fromUserId || !toUserId}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
            >
              <FiSearch />
              {permChecking ? "جاري التحقق..." : "تحقق من الكروبات"}
            </button>
            <button
              type="button"
              onClick={runPermApply}
              disabled={
                permApplying ||
                permChecking ||
                !permPreview ||
                (permPreview.groupCount || 0) === 0
              }
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiShield />
              {permApplying ? "جاري النقل..." : "نقل الصلاحيات"}
            </button>
          </div>

          {permPreview ? (
            <div className="mt-5 rounded-xl border border-violet-100 bg-white/95 p-4">
              <p className="text-sm font-bold text-violet-900">
                {permPreview.dryRun ? "معاينة" : "بعد التنفيذ"} — من{" "}
                <span className="font-extrabold">{permPreview.from?.username}</span> إلى{" "}
                <span className="font-extrabold">{permPreview.to?.username}</span>
              </p>
              <p className="mt-1 text-sm text-gray-700">
                كروبات: {permPreview.groupCount || 0}
                {permPreview.dryRun ? (
                  <>
                    {" "}
                    — سيُضاف إلى {permPreview.willAddCount || 0}، موجود مسبقاً في{" "}
                    {permPreview.alreadyMemberCount || 0}
                  </>
                ) : (
                  <> — تم تحديث {permPreview.updatedGroups || 0}</>
                )}
              </p>

              {(permPreview.groups || []).length > 0 ? (
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-right text-xs font-bold text-slate-600">
                      <tr>
                        <th className="px-3 py-2">الكروب</th>
                        <th className="px-3 py-2">الشركات</th>
                        <th className="px-3 py-2">الصلاحيات</th>
                        <th className="px-3 py-2">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permPreview.groups.map((g) => (
                        <tr key={g.id} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2 font-semibold text-gray-900">{g.name}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {(g.companies || []).join("، ") || "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {(g.permissions || [])
                              .map((p) => PERMISSION_LABELS[p] || p)
                              .slice(0, 4)
                              .join("، ")}
                            {(g.permissions || []).length > 4
                              ? ` +${g.permissions.length - 4}`
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold">
                            {g.toAlreadyMember ? (
                              <span className="text-amber-700">إزالة المصدر فقط</span>
                            ) : (
                              <span className="text-emerald-700">إزالة + إضافة الهدف</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
