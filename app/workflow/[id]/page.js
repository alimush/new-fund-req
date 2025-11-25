"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiUsers, FiPlus, FiX, FiArrowLeft } from "react-icons/fi";
import Select from "react-select";

export default function WorkflowDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [workflow, setWorkflow] = useState(null);
  const [users, setUsers] = useState([]);
  const [steps, setSteps] = useState([]);

  const [loadingWorkflow, setLoadingWorkflow] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkflow();
    loadUsers();
  }, []);

  const loadWorkflow = async () => {
    try {
      const res = await fetch(`/api/workflow?id=${id}`);
      const data = await res.json();

      if (data.success && data.workflow) {
        setWorkflow(data.workflow);

        const normalizedSteps = (data.workflow.steps || []).map((s) => ({
          _id: s._id,
          user: typeof s.user === "string" ? s.user : s.user?._id || "",
        }));

        setSteps(normalizedSteps);
      }
    } catch (err) {
      console.log("Workflow load error:", err);
    }

    setLoadingWorkflow(false);
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.log("Users load error:", err);
    }

    setLoadingUsers(false);
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { user: "" }]);
  };

  const saveSteps = async () => {
    setSaving(true);

    const payload = {
      id,
      steps: steps.map((s) => ({ user: s.user })),
    };

    try {
      const res = await fetch("/api/workflow", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        alert("✔️ تم حفظ الخطوات بنجاح");
        await loadWorkflow();
      } else {
        alert("❌ فشل حفظ Workflow");
      }
    } catch (err) {
      alert("❌ Error saving workflow");
    }

    setSaving(false);
  };

  if (loadingWorkflow)
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-700 text-lg">
        جاري تحميل المعلومات...
      </div>
    );

  if (!workflow)
    return (
      <div className="text-center mt-20 text-gray-700 text-lg">
        لم يتم العثور على الـ Workflow
      </div>
    );

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiUsers className="text-blue-600" /> Workflow: {workflow.name}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            الشركة: <span className="font-semibold">{workflow.company}</span>
          </p>
        </div>

        <button
          onClick={() => router.push("/workflow")}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-black/80 shadow"
        >
          <FiArrowLeft /> Back
        </button>
      </div>

      {/* STEPS */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 border rounded-xl p-5 shadow-lg max-w-2xl mx-auto"
      >
        <h2 className="text-lg font-semibold mb-4">Workflow Steps</h2>

        <div className="space-y-4">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className="p-4 border rounded-xl bg-gray-50 shadow-sm flex items-center justify-between gap-4"
            >
              <span className="text-gray-700 font-medium">Step {idx + 1}</span>

              {loadingUsers ? (
                <div className="w-64 flex justify-center">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <Select
                  options={users.map((u) => ({
                    value: u._id,
                    label: u.username,
                  }))}
                  value={
                    s.user
                      ? (() => {
                          const u = users.find((u) => u._id === s.user);
                          return u ? { value: u._id, label: u.username } : null;
                        })()
                      : null
                  }
                  onChange={(val) => {
                    const updated = [...steps];
                    updated[idx].user = val ? val.value : "";
                    setSteps(updated);
                  }}
                  placeholder="اختر المستخدم"
                  className="w-64"
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

        {/* ADD STEP */}
        <button
          onClick={addStep}
          className="w-full mt-5 bg-gray-900 text-white rounded-xl p-3 hover:bg-black/80 flex items-center justify-center gap-2 text-base"
        >
          <FiPlus /> Add Step
        </button>

        {/* SAVE */}
        <button
          onClick={saveSteps}
          disabled={saving}
          className="w-full mt-3 bg-blue-600 text-white rounded-xl p-3 hover:bg-blue-700 disabled:opacity-50 text-base"
        >
          {saving ? "جاري الحفظ..." : "Save Workflow"}
        </button>
      </motion.div>
    </div>
  );
}