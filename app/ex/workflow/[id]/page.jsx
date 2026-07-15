"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiUsers, FiPlus, FiX, FiArrowLeft } from "react-icons/fi";
import Select from "react-select";
import { PERMISSIONS } from "@/lib/permission";

export default function ExWorkflowDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);

  const [workflow, setWorkflow] = useState(null);
  const [users, setUsers] = useState([]);
  const [steps, setSteps] = useState([]);
  const [finalApproveEmailsText, setFinalApproveEmailsText] = useState("");
  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  const authHeaders = (extra = {}) => ({
    ...extra,
  });

  // ✅ Auth Guard
  useEffect(() => {
    const guard = async () => {
      try {
        const res = await fetch("/api/user-permissions", {
          cache: "no-store",
        });

        if (res.status === 401) return router.replace("/login");

        const data = await res.json();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];

        if (!perms.includes(PERMISSIONS.EX_WORKFLOW)) return router.replace("/home");
        setAuthorized(true);
      } catch {
        router.replace("/home");
      }
    };

    guard();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    loadWorkflow();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, id]);

  const loadWorkflow = async () => {
    setLoadingWorkflow(true);
    try {
      const res = await fetch(`/api/ex/workflow?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
        headers: authHeaders(),
      });

      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/home");

      const data = await res.json();

      if (data?.success && data?.workflow) {
        setWorkflow(data.workflow);

        setFinalApproveEmailsText(
          Array.isArray(data.workflow.finalApproveEmails)
            ? data.workflow.finalApproveEmails.join("\n")
            : ""
        );

        const normalizedSteps = (data.workflow.steps || []).map((s) => ({
          users: Array.isArray(s.users)
            ? s.users.map((u) => (typeof u === "string" ? u : u._id))
            : [],
        }));

        setSteps(normalizedSteps);
      } else {
        setWorkflow(null);
        setSteps([]);
      }
    } catch {
      setWorkflow(null);
      setSteps([]);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", {
        cache: "no-store",
        headers: authHeaders(),
      });

      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/home");

      const data = await res.json();

      if (data?.success && Array.isArray(data?.users)) setUsers(data.users);
      else setUsers([]);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const addStep = () => setSteps((prev) => [...prev, { users: [] }]);

  const saveSteps = async () => {
    if (!workflow) return;
  
    if (steps.some((s) => !s.users || s.users.length === 0)) {
      return alert("❌ كل Step لازم بيه مستخدم واحد على الأقل");
    }
  
    setSaving(true);
  
    const payload = {
      id,
      name: workflow.name,
      code: workflow.code,
      steps: steps.map((s) => ({ users: s.users })),
      finalApproveEmails: parseEmails(finalApproveEmailsText),
    };
  
    try {
      const res = await fetch("/api/ex/workflow", {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
  
      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/home");
  
      const data = await res.json();
  
      if (data?.success) {
        alert("✔️ تم حفظ الـ EX Workflow بنجاح\n(سيُطبق على الجديد فقط)");
        await loadWorkflow();
      } else {
        alert(data?.error || "❌ فشل حفظ Workflow");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error saving workflow");
    } finally {
      setSaving(false);
    }
  };
  const parseEmails = (text = "") =>
    [...new Set(
      String(text || "")
        .split(/[\n,;]/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    )];

  if (!authorized) return null;

  if (loadingWorkflow) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-700 text-lg">
        جاري تحميل المعلومات...
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center mt-20 text-gray-700 text-lg">
        لم يتم العثور على الـ Workflow
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiUsers className="text-blue-600" /> EX Workflow: {workflow.name}
          </h1>

          <p className="text-gray-600 text-sm mt-1">
            PageKey: <span className="font-semibold">{workflow.pageKey}</span>
          </p>

          <p className="text-gray-600 text-sm mt-1">
            Code: <span className="font-semibold">{workflow.code || "-"}</span>
          </p>

          <p className="text-xs text-gray-500 mt-1">
            التعديلات تؤثر على الريكويستات الجديدة فقط
          </p>
        </div>

        <button
          onClick={() => router.push("/ex/workflow")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black/80 shadow"
        >
          <FiArrowLeft /> Back
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 border rounded-xl p-5 shadow-lg max-w-2xl mx-auto"
      >
        <h2 className="text-lg font-semibold mb-1">Workflow Steps</h2>
        <p className="text-sm text-gray-500 mb-4">ترتيب الموافقات حسب المستخدمين</p>

        <div className="space-y-4">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="p-4 border rounded-xl bg-gray-50 shadow-sm flex items-center justify-between gap-4"
            >
              <span className="text-gray-700 font-medium">Step {idx + 1}</span>

              {loadingUsers ? (
                <div className="w-64 flex justify-center">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <Select
                  isMulti
                  options={users.map((u) => ({ value: u._id, label: u.username }))}
                  value={users
                    .filter((u) => s.users.includes(u._id))
                    .map((u) => ({ value: u._id, label: u.username }))}
                  onChange={(vals) => {
                    const updated = [...steps];
                    updated[idx].users = vals ? vals.map((v) => v.value) : [];
                    setSteps(updated);
                  }}
                  placeholder="اختر المستخدمين"
                  className="w-72"
                />
              )}

              <button
                onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                className="p-2 text-red-500 hover:bg-red-100 rounded-full"
              >
                <FiX size={16} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addStep}
          className="w-full mt-5 bg-gray-900 text-white rounded-xl p-3 hover:bg-black/80 flex items-center justify-center gap-2"
        >
          <FiPlus /> Add Step
        </button>
        <div className="mt-6">
  <h3 className="text-md font-semibold mb-2">
    {workflow?.pageKey === "attachment-only"
      ? "Create Notification Emails"
      : "Final Approve Emails"}
  </h3>
  <p className="text-sm text-gray-500 mb-2">
    {workflow?.pageKey === "attachment-only"
      ? "هاي الإيميلات يندزلها إشعار مباشرة عند إنشاء الطلب (معاملة الزبون)"
      : "هاي الإيميلات يندزلها إشعار فقط عند الموافقة النهائية"}
  </p>

  <textarea
    value={finalApproveEmailsText}
    onChange={(e) => setFinalApproveEmailsText(e.target.value)}
    placeholder={`example1@company.com
example2@company.com`}
    className="w-full min-h-[140px] border rounded-xl p-3"
  />
</div>
        <button
          onClick={saveSteps}
          disabled={saving}
          className="w-full mt-3 bg-blue-600 text-white rounded-xl p-3 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "Save Workflow"}
        </button>
      </motion.div>
    </div>
  );
}