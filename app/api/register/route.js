"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [group, setGroup] = useState("");
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // ⬅️ جلب الكروبات
  const fetchGroups = async () => {
    const res = await fetch("/api/permissions");
    const data = await res.json();
    if (data.success) setGroups(data.data);
  };

  // ⬅️ جلب المستخدمين
  const fetchUsers = async (query = "") => {
    try {
      const res = await fetch(`/api/users?q=${query}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchGroups();
  }, []);

  // ➕ إضافة مستخدم
  const handleRegister = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, group }),
    });

    if (res.ok) {
      setUsername("");
      setPassword("");
      setGroup("");
      fetchUsers(search);
      setSuccessMsg("✅ User created successfully!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } else {
      const data = await res.json();
      alert(data.error || "❌ Failed to register user");
    }
  };

  // ✏️ تعديل مستخدم
  const handleEdit = async () => {
    if (!selectedUser) return;

    const res = await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedUser._id,
        username: selectedUser.username,
        password: selectedUser.password,
        group: selectedUser.group,
      }),
    });

    if (res.ok) {
      fetchUsers(search);
      setSuccessMsg("✅ User updated successfully!");
      setTimeout(() => setSuccessMsg(""), 2000);
      setIsModalOpen(false);
    }
  };

  // 🗑 حذف
  const handleDelete = async (id) => {
    if (!confirm("هل تريد حذف هذا المستخدم؟")) return;
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    fetchUsers(search);
    setIsModalOpen(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-sky-100 to-sky-200">
      <motion.div
        className="bg-white/90 shadow-xl rounded-2xl p-8 w-full max-w-md text-gray-800 backdrop-blur-md border border-gray-200"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <h1 className="text-2xl font-bold text-center text-indigo-700 mb-6">
          Users Management
        </h1>

        {/* 🔍 البحث */}
        <input
          type="text"
          placeholder="🔍 Search by username"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            fetchUsers(e.target.value);
          }}
          className="w-full border rounded-lg p-3 mb-4 outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {/* ➕ إضافة */}
        <form onSubmit={handleRegister} className="space-y-4 mb-6">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />

          {/* 🆕 اختيار كروب */}
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="w-full border rounded-lg p-3 outline-none bg-white"
            required
          >
            <option value="">اختر الكروب</option>
            {groups.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>

          <motion.button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold p-3 rounded-lg shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Add User
          </motion.button>
        </form>

        {/* قائمة المستخدمين */}
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          Registered Users
        </h2>

        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {users.map((u) => (
            <li
              key={u._id}
              className="flex justify-between items-center p-3 bg-sky-50 rounded-md border text-sm text-gray-700"
            >
              <span>{u.username}</span>
              <motion.button
                onClick={() => {
                  setSelectedUser(u);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1 bg-indigo-500 text-white rounded text-xs"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Details
              </motion.button>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* مودال التفاصيل */}
      <AnimatePresence>
        {isModalOpen && selectedUser && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl p-6 w-96"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h2 className="text-xl font-bold text-indigo-600 mb-4">
                User Details
              </h2>

              {/* Username */}
              <input
                type="text"
                value={selectedUser.username}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    username: e.target.value,
                  })
                }
                className="w-full border rounded-lg p-2 mb-3"
              />

              {/* Password */}
              <input
                type="text"
                value={selectedUser.password}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    password: e.target.value,
                  })
                }
                className="w-full border rounded-lg p-2 mb-3"
              />

              {/* تعديل الكروب */}
              <select
                value={selectedUser.group || ""}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    group: e.target.value,
                  })
                }
                className="w-full border rounded-lg p-2 mb-3"
              >
                <option value="">اختر الكروب</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2">
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-yellow-500 text-white rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => handleDelete(selectedUser._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Delete
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-400 text-white rounded"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}