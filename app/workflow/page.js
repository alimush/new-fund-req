"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FiPlus,
  FiLayers,
  FiFileText,
  FiUsers,
  FiTrash2,
  FiX,
  FiHash,
  FiShield,
} from "react-icons/fi";
import Select from "react-select";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

// ✅ هذني حسب الكود اللي انت كاتبه
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permission";

export default function WorkflowPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);

  const [workflows, setWorkflows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [code, setCode] = useState("");

  // ✅ NEW: required permissions
  const [requiredPerms, setRequiredPerms] = useState([]);

  const authHeaders = (extra = {}) => ({ ...extra });

  // ✅ options for permissions select
  const PERM_OPTIONS = useMemo(() => {
    return Object.values(PERMISSIONS).map((p) => ({
      value: p,
      label: PERMISSION_LABELS[p] || p,
    }));
  }, []);

  // =========================
  // ✅ Auth Guard
  // =========================
  useEffect(() => {
    const guard = async () => {
      try {
        const res = await fetch("/api/user-permissions", {
          cache: "no-store",
        });

        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await res.json();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];

        const ok = perms.includes("MANAGE_PERMISSIONS");
        if (!ok) {
          router.replace("/home");
          return;
        }

        setAuthorized(true);
      } catch (e) {
        router.replace("/home");
      }
    };

    guard();
  }, [router]);

  // =========================
  // ✅ Load Data
  // =========================
  useEffect(() => {
    if (!authorized) return;
    loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const loadWorkflows = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/workflow", {
        cache: "no-store",
        headers: authHeaders(),
      });

      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/home");

      const data = await res.json();

      if (data?.success) {
        setWorkflows(data.workflows || []);
        await loadCompanies(data.workflows || []);
      } else {
        setWorkflows([]);
      }
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load companies
  const loadCompanies = async (wfList) => {
    try {
      if (!Array.isArray(wfList)) wfList = [];

      const res = await fetch("/api/permissions", {
        cache: "no-store",
        headers: authHeaders(),
      });

      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/home");

      const data = await res.json();
      if (!data?.success) return;

      const compSet = new Set();
      (data.data || []).forEach((grp) => {
        (grp.companies || []).forEach((c) => compSet.add(c));
      });

      const allCompanies = [...compSet];
      setCompanies(allCompanies);
      setAvailableCompanies(allCompanies);
    } catch {
      setCompanies([]);
      setAvailableCompanies([]);
    }
  };

  // ✅ helper: normalize code
  const normalizeCode = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, "-")
      .toUpperCase();

  // CREATE WORKFLOW
  const createWorkflow = async () => {
    if (!name.trim()) {
      showToast("اكتب اسم الـ Workflow", "error");
      return;
    }
    if (!company) {
      showToast("اختر الشركة", "error");
      return;
    }

    const normCode = normalizeCode(code);
    if (!normCode) {
      showToast("اكتب كود للـ Workflow (مثلاً: ALGHDEER-1)", "error");
      return;
    }

    const res = await fetch("/api/workflow", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name,
        company,
        code: normCode,
        steps: [],
        rules: {
          requiredPermissions: requiredPerms, // ✅ هنا المهم
          priority: 1,
        },
      }),
    });

    if (res.status === 401) return router.replace("/login");
    if (res.status === 403) return router.replace("/home");

    const data = await res.json();

    if (data.success) {
      setOpenModal(false);
      setName("");
      setCompany("");
      setCode("");
      setRequiredPerms([]);
      showToast("تم إنشاء الـ Workflow بنجاح", "success");
      router.push(`/workflow/${data.workflow._id}`);
    } else {
      showToast(data.error || "فشل إنشاء Workflow", "error");
    }
  };

  // DELETE WORKFLOW
  const deleteWorkflow = async (id) => {
    if (!window.confirm("هل تريد حذف هذا الـ Workflow؟")) return;

    const res = await fetch(`/api/workflow?id=${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (res.status === 401) return router.replace("/login");
    if (res.status === 403) return router.replace("/home");

    const data = await res.json();

    if (data.success) {
      showToast("تم حذف الـ Workflow", "success");
      loadWorkflows();
    } else {
      showToast(data.error || "فشل حذف Workflow", "error");
    }
  };

  const renderRulesText = (wf) => {
    const req = wf?.rules?.requiredPermissions || [];
    if (!Array.isArray(req) || req.length === 0) return "عام (بدون شروط)";
    return req.join(", ");
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mx-auto w-full max-w-7xl">
      {/* HEADER */}
      <div className="mb-8 rounded-3xl border border-white/70 bg-white/70 p-6 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-800">
              <FiLayers className="text-blue-600" /> Workflow Management
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              صمّم الـ workflows للشركات وخلي التحكم بالصلاحيات أوضح.
            </p>
          </div>

          <button
            onClick={() => setOpenModal(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2 text-white shadow transition hover:-translate-y-0.5 hover:bg-black/80"
          >
            <FiPlus /> Create Workflow
          </button>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <p className="text-gray-700 text-lg">Loading...</p>
      ) : workflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-10 text-center shadow-sm">
          <p className="text-lg italic text-gray-600">No workflows found yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {workflows.map((wf) => (
            <motion.div
              key={wf._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.03 }}
              className="relative rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <button
                onClick={() => deleteWorkflow(wf._id)}
                className="absolute top-3 right-3 text-red-600 hover:text-red-800"
              >
                <FiTrash2 size={20} />
              </button>

              <div onClick={() => router.push(`/workflow/${wf._id}`)} className="cursor-pointer">
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                  <FiFileText className="text-blue-600" /> {wf.name}
                </h2>

                <p className="text-gray-600 mt-1">
                  Company: <span className="font-semibold">{wf.company}</span>
                </p>

                <p className="text-gray-600 mt-1 flex items-center gap-2">
                  <FiHash className="text-gray-500" />
                  Code: <span className="font-semibold">{wf.code || "-"}</span>
                </p>

                {/* ✅ NEW: show rules */}
                <p className="text-gray-600 mt-2 flex items-center gap-2">
                  <FiShield className="text-gray-500" />
                  Rules: <span className="font-semibold">{renderRulesText(wf)}</span>
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow">
                    <FiUsers className="text-xl" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Steps</p>
                    <p className="text-xl font-bold text-gray-800">{wf.steps?.length || 0}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl"
          >
            <button
              onClick={() => setOpenModal(false)}
              className="absolute top-3 right-3 text-gray-600 hover:text-black"
            >
              <FiX size={22} />
            </button>

            <h2 className="text-xl font-bold mb-4">Create Workflow</h2>

            <input
              type="text"
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border rounded-xl mb-4"
            />

            <input
              type="text"
              placeholder="Workflow code (مثلاً: ALGHDEER-1)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full p-3 border rounded-xl mb-4"
            />

            <Select
              options={availableCompanies.map((c) => ({ value: c, label: c }))}
              onChange={(val) => setCompany(val?.value || "")}
              placeholder="Select Company"
              className="mb-4"
            />

            {/* ✅ NEW: Permissions Select */}
            <Select
              isMulti
              options={PERM_OPTIONS}
              value={PERM_OPTIONS.filter((o) => requiredPerms.includes(o.value))}
              onChange={(vals) => setRequiredPerms((vals || []).map((v) => v.value))}
              placeholder="اختر الصلاحيات المطلوبة لهذا الـ Workflow (اختياري)"
              className="mb-2"
              styles={{
                menu: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />

            <div className="text-xs text-gray-500 mb-4">
              إذا خليتها فارغة → Workflow عام.  
              إذا اخترت مثلاً MARKETING → بس مستخدمين الماركتنك ينطبق عليهم هذا الـ Workflow.
            </div>

            <button
              onClick={() => {
                // نخزن normalized code قبل الإرسال حتى ما يصير لخبطة
                setCode((prev) => normalizeCode(prev));
                createWorkflow();
              }}
              className="w-full p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow"
            >
              Create Workflow
            </button>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
}