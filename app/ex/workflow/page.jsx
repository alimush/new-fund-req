"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiPlus, FiLayers, FiFileText, FiUsers, FiTrash2, FiX, FiHash } from "react-icons/fi";
import Select from "react-select";
import { useRouter } from "next/navigation";

// ✅ يجيب الفورمات من registry (Client-side)
import { EX_FORMS } from "@/lib/exForms/registry";

/** ✅ Pages = forms from registry + exceptions manual */
const buildExPages = () => {
  const forms = Object.values(EX_FORMS || {}).map((f) => ({
    key: f.key,
    name: f.title || f.key,
    href: `/ex/${f.key}`,
    icon: FiFileText,
  }));

  // صفحة خاصة خارج EX_FORMS
  const extras = [
    {
      key: "exceptions",
      name: "الاستثنائات",
      href: "/ex/payment-plan",
      icon: FiFileText,
    },
  ];

  // منع التكرار
  const map = new Map();
  [...forms, ...extras].forEach((x) => map.set(x.key, x));
  return Array.from(map.values());
};

export default function ExWorkflowPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState("");
  const [pageKey, setPageKey] = useState("");
  const [code, setCode] = useState("");

  const EX_PAGES = useMemo(() => buildExPages(), []);

  const getUserId = () => localStorage.getItem("userId") || "";

  const authHeaders = (extra = {}) => ({
    ...extra,
    "x-user-id": getUserId(),
  });

  // =========================
  // ✅ Auth Guard
  // =========================
  useEffect(() => {
    const guard = async () => {
      const userId = getUserId();
      if (!userId) return router.replace("/login");

      try {
        const res = await fetch(`/api/user-permissions?id=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });

        const data = await res.json();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];

        const ok = perms.includes("MANAGE_PERMISSIONS");
        if (!ok) return router.replace("/home");

        setAuthorized(true);
      } catch {
        router.replace("/home");
      }
    };

    guard();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ex/workflow", {
        cache: "no-store",
        headers: authHeaders(),
      });

      if (res.status === 401) return router.replace("/login");
      if (res.status === 403) return router.replace("/home");

      const data = await res.json();
      if (data?.success) setWorkflows(data.workflows || []);
      else setWorkflows([]);
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeCode = (s) =>
    String(s || "")
      .trim()
      .replace(/\s+/g, "-")
      .toUpperCase();

  const createWorkflow = async () => {
    if (!name.trim()) return alert("اكتب اسم الـ Workflow");
    if (!pageKey) return alert("اختر الصفحة (pageKey)");

    const normCode = normalizeCode(code);
    if (!normCode) return alert("اكتب كود للـ Workflow (مثلاً: EX-01)");

    const res = await fetch("/api/ex/workflow", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, pageKey, code: normCode }),
    });

    if (res.status === 401) return router.replace("/login");
    if (res.status === 403) return router.replace("/home");

    const data = await res.json();

    if (data?.success) {
      setOpenModal(false);
      setName("");
      setPageKey("");
      setCode("");
      router.push(`/ex/workflow/${data.workflow._id}`);
    } else {
      alert(data?.error || "فشل إنشاء Workflow");
    }
  };

  const deleteWorkflow = async (id) => {
    if (!window.confirm("هل تريد حذف هذا الـ Workflow؟")) return;

    const res = await fetch(`/api/ex/workflow?id=${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    if (res.status === 401) return router.replace("/login");
    if (res.status === 403) return router.replace("/home");

    const data = await res.json();
    if (data?.success) {
      alert("✔️ تم حذف الـ Workflow");
      loadWorkflows();
    } else {
      alert(data?.error || "فشل حذف Workflow");
    }
  };

  const pageName = (k) => EX_PAGES.find((x) => x.key === k)?.name || k;

  if (!authorized) return null;

  return (
    <div className="p-10 min-h-screen bg-gradient-to-br from-gray-100 to-gray-300">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FiLayers className="text-blue-600" /> EX Workflow Management
        </h1>

        <button
          onClick={() => setOpenModal(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-xl hover:bg-black/80 shadow"
        >
          <FiPlus /> Create Workflow
        </button>
      </div>

      {loading ? (
        <p className="text-gray-700 text-lg">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {workflows.map((wf) => (
            <motion.div
              key={wf._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.03 }}
              className="relative bg-white/90 p-6 rounded-2xl shadow-lg border border-gray-200"
            >
              <button
                onClick={() => deleteWorkflow(wf._id)}
                className="absolute top-3 right-3 text-red-600 hover:text-red-800"
              >
                <FiTrash2 size={20} />
              </button>

              <div onClick={() => router.push(`/ex/workflow/${wf._id}`)} className="cursor-pointer">
                <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                  <FiFileText className="text-blue-600" /> {wf.name}
                </h2>

                <p className="text-gray-600 mt-1">
                  PageKey: <span className="font-semibold">{pageName(wf.pageKey)}</span>
                </p>

                <p className="text-gray-600 mt-1 flex items-center gap-2">
                  <FiHash className="text-gray-500" />
                  Code: <span className="font-semibold">{wf.code || "-"}</span>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white p-8 rounded-2xl w-full max-w-lg shadow-2xl"
          >
            <button
              onClick={() => setOpenModal(false)}
              className="absolute top-3 right-3 text-gray-600 hover:text-black"
            >
              <FiX size={22} />
            </button>

            <h2 className="text-xl font-bold mb-4">Create EX Workflow</h2>

            <input
              type="text"
              placeholder="Workflow name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border rounded-xl mb-4"
            />

            <input
              type="text"
              placeholder="Workflow code (مثلاً: EX-01)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full p-3 border rounded-xl mb-4"
            />

            <Select
              options={EX_PAGES.map((x) => ({ value: x.key, label: x.name }))}
              onChange={(val) => setPageKey(val?.value || "")}
              placeholder="Select EX Page"
              className="mb-4"
            />

            <button
              onClick={createWorkflow}
              className="w-full p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow"
            >
              Create Workflow
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}