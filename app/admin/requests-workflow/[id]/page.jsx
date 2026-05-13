"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FiArrowLeft, FiPlus, FiX, FiUsers } from "react-icons/fi";
import Select from "react-select";
import { PERMISSIONS } from "@/lib/permission";
import { useToast } from "@/components/ui/ToastProvider";

export default function AdminRequestWorkflowEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const company = String(searchParams.get("company") || "").trim();
  const { showToast } = useToast();

  const [authorized, setAuthorized] = useState(false);
  const [loadingReq, setLoadingReq] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState(null);
  const [users, setUsers] = useState([]);
  const [workflowName, setWorkflowName] = useState("");
  const [steps, setSteps] = useState([]);

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

  const loadRequest = useCallback(async () => {
    if (!company || !id) return;
    setLoadingReq(true);
    try {
      const res = await fetch(
        `/api/admin/requests-workflow/${encodeURIComponent(id)}?company=${encodeURIComponent(company)}`,
        { cache: "no-store" }
      );
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        router.replace("/home");
        return;
      }
      const json = await res.json();
      if (json?.success && json.data) {
        const d = json.data;
        setRequest(d);
        setWorkflowName(String(d?.workflow?.name || ""));
        const normalized = (d?.workflow?.steps || []).map((s) => ({
          users: Array.isArray(s.users)
            ? s.users.map((u) => (typeof u === "string" ? u : String(u?._id || "")))
            : [],
        }));
        setSteps(normalized);
      } else {
        setRequest(null);
        setSteps([]);
        showToast(json?.error || "لم يتم العثور على الطلب", "error");
      }
    } catch {
      setRequest(null);
      showToast("خطأ في تحميل الطلب", "error");
    } finally {
      setLoadingReq(false);
    }
  }, [company, id, router, showToast]);

  useEffect(() => {
    if (!authorized) return;
    if (!company) return;
    loadUsers();
    loadRequest();
  }, [authorized, company, loadRequest, loadUsers]);

  const save = async () => {
    if (!company || !id || !request) return;
    if (steps.some((s) => !s.users || s.users.length === 0)) {
      showToast("كل خطوة لازم يكون بها مستخدم واحد على الأقل", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/requests-workflow/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company,
          workflow: {
            name: workflowName,
            steps: steps.map((s) => ({ users: s.users })),
          },
        }),
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
        showToast("تم حفظ وورك فلو الطلب", "success");
        await loadRequest();
      } else {
        showToast(json?.error || "فشل الحفظ", "error");
      }
    } catch {
      showToast("خطأ في الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!authorized) return null;

  if (!company) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
        <p className="mb-4">معامل company مفقود في الرابط.</p>
        <button
          type="button"
          onClick={() => router.push("/admin/requests-workflow")}
          className="rounded-xl bg-gray-900 px-4 py-2 text-white"
        >
          العودة للقائمة
        </button>
      </div>
    );
  }

  if (loadingReq) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-700">
        جاري تحميل الطلب...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-lg text-center text-gray-700">
        <p className="mb-4">لم يتم العثور على الطلب.</p>
        <button
          type="button"
          onClick={() => router.push("/admin/requests-workflow")}
          className="rounded-xl bg-gray-900 px-4 py-2 text-white"
        >
          العودة للقائمة
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl pb-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">وورك فلو الطلب</h1>
          <p className="mt-1 text-sm text-gray-600">
            الشركة: <span className="font-semibold">{company}</span> — رقم الطلب:{" "}
            <span className="font-mono text-xs">{request.requestCode || "—"}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            يتم الحفظ على نسخة الطلب الحالية؛ تبقى حالات الخطوات السابقة عندما لا تغيّر عدد الخطوات أو ترتيبها.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/admin/requests-workflow")}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-800 hover:bg-gray-50"
        >
          <FiArrowLeft /> رجوع
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-lg"
      >
        <label className="mb-1 block text-sm font-medium text-gray-700">اسم الورك فلو (اختياري)</label>
        <input
          type="text"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="mb-6 w-full rounded-xl border border-gray-300 px-3 py-2"
        />

        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <FiUsers className="text-blue-600" /> خطوات الموافقة
        </h2>

        <div className="space-y-4">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="shrink-0 font-medium text-gray-800">الخطوة {idx + 1}</span>
              {loadingUsers ? (
                <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
              ) : (
                <Select
                  isMulti
                  className="min-w-0 flex-1"
                  options={users.map((u) => ({
                    value: String(u._id),
                    label: u.username,
                  }))}
                  value={users
                    .filter((u) => s.users.includes(String(u._id)))
                    .map((u) => ({ value: String(u._id), label: u.username }))}
                  onChange={(vals) => {
                    const next = [...steps];
                    next[idx] = { users: (vals || []).map((v) => v.value) };
                    setSteps(next);
                  }}
                  placeholder="اختر المستخدمين"
                  styles={{ menu: (base) => ({ ...base, zIndex: 50 }) }}
                />
              )}
              <button
                type="button"
                onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                className="shrink-0 rounded-full p-2 text-red-600 hover:bg-red-50"
                aria-label="حذف خطوة"
              >
                <FiX size={18} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSteps((prev) => [...prev, { users: [] }])}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-white hover:bg-black/85"
        >
          <FiPlus /> إضافة خطوة
        </button>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </motion.div>
    </div>
  );
}
