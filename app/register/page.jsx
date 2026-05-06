"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/ToastProvider";

export default function RegisterPage() {
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // ✅ NEW
  const [password, setPassword] = useState("");

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState(""); // ✅ NEW (اختياري)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [arabicName, setArabicName] = useState("");
  // ✅ حالة صلاحية/دخول
  const [authError, setAuthError] = useState("");

  // =========================
  // ✅ Helper: show message for 401/403
  // =========================
  const apiFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: options.headers || {},
    });

    if (res.status === 401) {
      setAuthError("❌ لازم تسوي Login أولاً.");
      throw new Error("Unauthorized");
    }

    if (res.status === 403) {
      setAuthError("⛔ ما عندك صلاحية MANAGE_PERMISSIONS.");
      throw new Error("Forbidden");
    }

    return res;
  };

  // 🟢 جلب المستخدمين
  const fetchUsers = async (query = "") => {
    try {
      setAuthError("");
      const res = await apiFetch(`/api/users?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      // إذا authError مضبوط، ما نحتاج نسوي شي
      console.error("Error fetching users:", err);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ➕ إنشاء مستخدم
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setAuthError("");
      const res = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }), // ✅
      });

      if (res.ok) {
        setUsername("");
        setEmail(""); // ✅
        setPassword("");
        fetchUsers(search);
        setSuccessMsg("User created successfully");
        showToast("تم إنشاء المستخدم بنجاح", "success");
        setTimeout(() => setSuccessMsg(""), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "فشل إنشاء المستخدم", "error");
      }
    } catch (err) {
      console.error("Error register:", err);
    }
  };

  // 🗑 حذف
  const handleDelete = async (id) => {
    if (!confirm("هل تريد حذف هذا المستخدم؟")) return;
    try {
      setAuthError("");
      await apiFetch(`/api/users?id=${id}`, { method: "DELETE" });
      fetchUsers(search);
      setIsModalOpen(false);
      showToast("تم حذف المستخدم", "success");
    } catch (err) {
      console.error("Error delete:", err);
    }
  };

  // ✏️ تعديل
  const handleEdit = async () => {
    if (!selectedUser) return;

    const payload = {
      id: selectedUser._id,
      username: selectedUser.username,
      arabicName: selectedUser.arabicName || "",
      email: selectedUser.email || "", // ✅
    };

    // ✅ إذا كتب باسورد جديد نرسله، غير هذا لا
    if (newPassword.trim()) payload.password = newPassword;

    try {
      setAuthError("");
      const res = await apiFetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fetchUsers(search);
        setSuccessMsg("User updated successfully");
        showToast("تم تحديث المستخدم بنجاح", "success");
        setTimeout(() => setSuccessMsg(""), 2000);
        setIsModalOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "فشل تحديث المستخدم", "error");
      }
    } catch (err) {
      console.error("Error edit:", err);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden p-6 md:p-10"
    >
      {/* زخارف خلفية */}
      <div className="absolute -top-40 -left-32 w-[30rem] h-[30rem] rounded-full bg-gray-300/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-slate-400/20 blur-3xl" />

      <motion.div
        className="relative mx-auto w-full max-w-6xl rounded-3xl border border-gray-200/60 bg-white/65 p-6 text-gray-800 shadow-2xl backdrop-blur-xl md:p-8"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <h1
          className="mb-2 text-center text-2xl font-bold 
                     bg-gradient-to-r from-gray-600 via-slate-700 to-gray-900 
                     bg-clip-text text-transparent"
        >
          Users Management
        </h1>
        <p className="mb-6 text-center text-sm text-gray-600">
          إدارة المستخدمين مع واجهة أوضح وتجربة أسرع.
        </p>

        {/* ✅ رسالة صلاحيات/دخول */}
        <AnimatePresence>
          {authError && (
            <motion.div
              className="mb-4 text-red-600 font-medium text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {authError}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm">
            {/* 🔍 البحث */}
            <input
              type="text"
              placeholder="🔍 Search by username"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                fetchUsers(e.target.value);
              }}
              className="mb-4 w-full rounded-lg border border-gray-300 bg-white/90 p-3 outline-none focus:ring-2 focus:ring-gray-400"
            />

            {/* ➕ إضافة */}
            <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 
                       outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
            required
          />
          <input
  type="text"
  placeholder="الاسم بالعربي"
  value={arabicName}
  onChange={(e) => setArabicName(e.target.value)}
  className="w-full border border-gray-300 rounded-lg p-3 
             outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
/>

          {/* ✅ Email */}
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 
                       outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
          />

          <input
            type="text"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 
                       outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
            required
          />

          <motion.button
            type="submit"
            className="w-full bg-gradient-to-r from-gray-500 via-slate-600 to-gray-800 
                       text-white font-bold p-3 rounded-lg shadow-lg 
                       hover:from-gray-600 hover:to-gray-900 transition"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={!!authError}
            title={authError ? "لازم صلاحية MANAGE_PERMISSIONS" : "Add User"}
          >
            Add User
          </motion.button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm">
            {/* ✅ رسالة نجاح */}
            <AnimatePresence>
              {successMsg && (
                <motion.div
                  className="mb-4 text-center font-medium text-green-600"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 📋 قائمة المستخدمين */}
            <h2 className="mb-2 text-lg font-semibold text-gray-700">
              Registered Users
            </h2>

            <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {users.length > 0 ? (
            users.map((u) => (
              <li
                key={u._id}
                className="flex items-center justify-between rounded-lg border border-gray-200 
                           bg-white/60 rounded-lg border border-gray-200 
                           p-3 text-sm text-gray-700 backdrop-blur-sm transition hover:bg-white"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.username}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {u.email || "No email"}
                  </div>
                </div>

                <motion.button
                  onClick={() => {
                    setSelectedUser(u);
                    setNewPassword("");
                    setIsModalOpen(true);
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={!!authError}
                >
                  Details
                </motion.button>
              </li>
            ))
          ) : (
            <p className="text-gray-500 text-sm">No users found.</p>
          )}
            </ul>
          </div>
        </div>
      </motion.div>

      {/* 🟢 مودال التفاصيل والتعديل */}
      <AnimatePresence>
        {isModalOpen && selectedUser && !authError && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white/90 rounded-xl shadow-xl p-6 w-96 
                         border border-gray-200 backdrop-blur-lg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2
                className="text-xl font-bold 
                           bg-gradient-to-r from-gray-600 via-slate-700 to-gray-900 
                           text-transparent bg-clip-text mb-4"
              >
                User Details
              </h2>

              {/* فورم التعديل */}
              <div className="space-y-3 mb-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    Username
                  </label>
                  <input
                    type="text"
                    value={selectedUser.username}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser,
                        username: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2 mt-1 
                               outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
                  />
                </div>
                <div>
  <label className="block text-sm font-medium text-gray-600">
    الاسم بالعربي
  </label>
  <input
    type="text"
    value={selectedUser.arabicName || ""}
    onChange={(e) =>
      setSelectedUser({ ...selectedUser, arabicName: e.target.value })
    }
    className="w-full border border-gray-300 rounded-lg p-2 mt-1 
               outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
  />
</div>

                {/* ✅ Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    Email
                  </label>
                  <input
                    type="email"
                    value={selectedUser.email || ""}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, email: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg p-2 mt-1 
                               outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
                  />
                </div>

                {/* ✅ New Password (اختياري) */}
                <div>
                  <label className="block text-sm font-medium text-gray-600">
                    New Password (optional)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave empty to keep current"
                    className="w-full border border-gray-300 rounded-lg p-2 mt-1 
                               outline-none focus:ring-2 focus:ring-gray-400 bg-white/70"
                  />
                </div>
              </div>

              {/* الأزرار */}
              <div className="flex justify-end gap-2">
                <motion.button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Save
                </motion.button>
                <motion.button
                  onClick={() => handleDelete(selectedUser._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Delete
                </motion.button>
                <motion.button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}