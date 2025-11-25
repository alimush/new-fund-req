"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiShield,
  FiUsers,
  FiPlus,
  FiTrash2,FiX , FiLayers
} from "react-icons/fi";

export default function PermissionsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Popup controls
  const [popupOpen, setPopupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [saving, setSaving] = useState(false);

  // 🟦 تحميل الكروبات
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/permissions");
        const data = await res.json();
        if (data.success) setGroups(data.data);
      } catch (err) {
        console.error("❌ Load groups error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 🟦 إنشاء كروب
  const createGroup = async () => {
    if (!newGroupName.trim()) {
      alert("اكتب اسم الكروب");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName }),
      });

      const data = await res.json();
      if (data.success) {
        setGroups((prev) => [...prev, data.data]);
        setNewGroupName("");
        setPopupOpen(false);
      }
    } catch (err) {
      console.error("❌ Create group error:", err);
    } finally {
      setSaving(false);
    }
  };

  // 🟥 حذف كروب
  const deleteGroup = async (id) => {
    if (!confirm("هل تريد حذف هذا الكروب؟")) return;

    try {
      const res = await fetch(`/api/permissions?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setGroups((prev) => prev.filter((g) => g._id !== id));
      }
    } catch (err) {
      console.error("❌ Delete group error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
          <FiShield className="text-blue-600" />
          Permission Groups
        </h1>

        <button
          onClick={() => setPopupOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-black/90 shadow-lg"
        >
          <FiPlus /> Add Group
        </button>
      </div>

      {/* GROUPS LIST */}
      {loading ? (
        <div className="flex justify-center mt-20 text-gray-600">
          Loading groups...
        </div>
      ) : groups.length === 0 ? (
        <p className="text-gray-600 text-center text-lg italic">
          No groups created yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {groups.map((g) => (
            <motion.div
            key={g._id}
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.25 }}
            onClick={() => (window.location.href = `/permissions/${g._id}`)}
            className="group cursor-pointer p-7 rounded-3xl bg-white/90 
                       border border-gray-200 shadow-lg hover:shadow-2xl 
                       hover:bg-white transition relative overflow-hidden"
          >
          
            {/* DELETE BUTTON */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteGroup(g._id);
              }}
              className="absolute top-4 right-4 text-red-500 hover:text-red-700 
                         p-2 rounded-full hover:bg-red-50 transition"
            >
              <FiTrash2 />
            </button>
          
            {/* GROUP NAME */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 tracking-wide">
                {g.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Click to manage users, permissions & companies
              </p>
            </div>
          
            {/* INFO ROWS */}
            <div className="space-y-4">
          
              {/* USERS */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-2xl 
                                flex items-center justify-center shadow-md">
                  <FiUsers className="text-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Users</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {g.users?.length || 0}
                  </p>
                </div>
              </div>
          
              {/* PERMISSIONS */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl 
                                flex items-center justify-center shadow-md">
                  <FiShield className="text-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Permissions</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {g.permissions?.length || 0}
                  </p>
                </div>
              </div>
          
              {/* COMPANIES — NEW SECTION */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-600 text-white rounded-2xl 
                                flex items-center justify-center shadow-md">
                  <FiLayers className="text-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Companies</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {g.companies?.length || 0}
                  </p>
                </div>
              </div>
          
            </div>
          </motion.div>
          ))}
        </div>
      )}

      {/* POPUP ADD GROUP */}
      <AnimatePresence>
        {popupOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-md"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-semibold text-gray-900">
                  Create New Group
                </h3>
                <button
                  onClick={() => setPopupOpen(false)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                >
                  <FiX />
                </button>
              </div>

              <input
                type="text"
                placeholder="Group name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl bg-gray-50 text-gray-800 
                           focus:ring-2 focus:ring-blue-400"
              />

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setPopupOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>

                <button
                  onClick={createGroup}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white 
                             hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}