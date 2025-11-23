"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { motion } from "framer-motion";

export default function TestPage() {
  const { permissions, user } = usePermissions();
  const [groups, setGroups] = useState([]);

  // 🔵 تحميل كل الكروبات من MongoDB
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch("/api/permissions");
        const data = await res.json();
        if (data.success) setGroups(data.data || []);
      } catch (err) {
        console.error("Error loading groups:", err);
      }
    };
    fetchGroups();
  }, []);

  return (
    <div className="p-10 max-w-4xl mx-auto space-y-10">
      <h1 className="text-4xl font-extrabold tracking-tight text-gray-800 text-center">
        🧪 Permissions Debug Dashboard
      </h1>

      {/* 🟦 User Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-xl rounded-2xl p-6 border border-gray-200"
      >
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">👤 User Info</h2>

        {user ? (
          <div className="space-y-1 text-gray-700">
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Username:</strong> {user.username}</p>
          </div>
        ) : (
          <p className="text-red-600">⚠️ No user logged in</p>
        )}
      </motion.div>

      {/* 🟦 Current User Permissions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-xl rounded-2xl p-6 border border-gray-200"
      >
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          🔑 User Permissions
        </h2>

        {permissions?.length ? (
          <div className="flex flex-wrap gap-2">
            {permissions.map((p, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-medium border border-green-300"
              >
                {p}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">لا توجد صلاحيات محفوظة لهذا المستخدم</p>
        )}
      </motion.div>

      {/* 🟦 All Defined Permissions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-xl rounded-2xl p-6 border border-gray-200"
      >
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          📌 All System Permissions
        </h2>

        <div className="flex flex-wrap gap-2">
          {Object.values(PERMISSIONS).map((perm, idx) => (
            <span
              key={idx}
              className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm font-medium border border-blue-300"
            >
              {perm}
            </span>
          ))}
        </div>
      </motion.div>

      {/* 🟦 Permission Groups */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-xl rounded-2xl p-6 border border-gray-200"
      >
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          🗂️ Permission Groups
        </h2>

        {groups.length === 0 ? (
          <p className="text-gray-500">لا توجد مجموعات صلاحيات.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div
                key={g._id}
                className="border border-gray-300 rounded-xl p-4 bg-gray-50"
              >
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  📁 {g.name}
                </h3>

                {/* Users */}
                <div className="mb-3">
                  <h4 className="font-medium text-gray-700 mb-1">👥 Users:</h4>
                  <div className="flex flex-wrap gap-2">
                    {g.users?.map((u) => (
                      <span
                        key={u._id}
                        className="px-2 py-1 text-sm bg-purple-100 text-purple-700 border border-purple-300 rounded-lg"
                      >
                        {u.username}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">🔑 Permissions:</h4>
                  <div className="flex flex-wrap gap-2">
                    {g.permissions?.map((p, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-sm bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-lg"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}