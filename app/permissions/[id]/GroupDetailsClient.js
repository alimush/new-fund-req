"use client";

import { use , useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiUsers,
  FiShield,
  FiPlus,
  FiSearch,
  FiX,
  FiCheckCircle,
  FiFileText,
  FiBarChart2,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Select from "react-select";
import { PERMISSIONS } from "@/lib/permission";

// const COMPANY_OPTIONS = [
//   "Al-Ghadeer",
//   "Al-Rida",
//   "Al-Mezan",
//   "Badur-Baghdad",
//   "Ghadeer-Karbala",
//   "Tiba-Al-najaf",
//   "badur-Al-najaf"
// ];
// 🧩 Icon لكل صلاحية (الخيار A)
const PERMISSION_ICONS = {
  create_request: FiFileText,
  view_reports: FiBarChart2,
  approve_request: FiCheckCircle,
  manage_users: FiUsers,
  manage_permissions: FiShield,
};

function getPermissionIcon(key, className = "text-gray-500") {
  const Icon = PERMISSION_ICONS[key] || FiShield;
  return <Icon className={className} />;
}
export default function GroupDetailsClient({ groupId }) {
  const [group, setGroup] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  const [groupUsers, setGroupUsers] = useState([]);
  const [groupPermissions, setGroupPermissions] = useState([]);
  const [groupCompanies, setGroupCompanies] = useState([]);
  // Popup states
  const [userPopupOpen, setUserPopupOpen] = useState(false);
  const [permPopupOpen, setPermPopupOpen] = useState(false);

  const [selectedUserOptions, setSelectedUserOptions] = useState([]);
  const [permSearch, setPermSearch] = useState("");

  const [saving, setSaving] = useState(false);

  // 🟦 تحميل بيانات الكروب + كل المستخدمين
  useEffect(() => {
    if (!groupId) return;

    const load = async () => {
      try {
        // load group
        const resGroup = await fetch(`/api/permissions?id=${groupId}`);
        const dataGroup = await resGroup.json();

        // load users
        const resUsers = await fetch("/api/users");
        const dataUsers = await resUsers.json();
        setAllUsers(dataUsers || []);
        if (dataGroup.success) {
          const g = dataGroup.data;
          setGroup(g);
          setGroupUsers(g.users || []);
          setGroupPermissions(g.permissions || []);
          setGroupCompanies(g.companies || []);
        }

        if (dataUsers.success) {
          setAllUsers(dataUsers.data || []);
        }
      } catch (err) {
        console.error("❌ Load group details error:", err);
      }
    };

    load();
  }, [groupId]);

  // 🟦 Users options for React Select (يستثني الموجودين بالكروب)
  const availableUserOptions = allUsers
    .filter(
      (u) => !groupUsers.some((gu) => String(gu._id) === String(u._id))
    )
    .map((u) => ({
      value: u._id,
      label: `${u.username || u.name || u.email} ${
        u.email ? `— ${u.email}` : ""
      }`,
    }));

  const addSelectedUsers = () => {
    if (!selectedUserOptions.length) {
      setUserPopupOpen(false);
      return;
    }

    const newUsers = [...groupUsers];

    selectedUserOptions.forEach((opt) => {
      const found = allUsers.find((u) => String(u._id) === String(opt.value));
      if (found && !newUsers.some((u) => String(u._id) === String(found._id))) {
        newUsers.push(found);
      }
    });

    setGroupUsers(newUsers);
    setSelectedUserOptions([]);
    setUserPopupOpen(false);
  };

  const removeUser = async (id) => {
    const updatedUsers = groupUsers.filter(u => String(u._id) !== String(id));
    setGroupUsers(updatedUsers);
  
    // 🔥 حفظ مباشرة في MongoDB
    await fetch("/api/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: groupId,
        name: group?.name || "",
        users: groupUsers.map((u) => u._id),
        permissions: groupPermissions,
        companies: groupCompanies,   // ← 🔥 لازم نرسلها
      }),
    });
  };

  // 🟦 Permissions search + إضافة
  const permissionEntries = Object.entries(PERMISSIONS);
  const filteredPermissions = permissionEntries.filter(([key, label]) => {
    if (groupPermissions.includes(key)) return false;
    if (!permSearch.trim()) return true;
    const q = permSearch.toLowerCase();
    return (
      key.toLowerCase().includes(q) || label.toLowerCase().includes(q)
    );
  });

  const addPermission = (key) => {
    if (!groupPermissions.includes(key)) {
      setGroupPermissions((prev) => [...prev, key]);
    }
  };

  const removePermission = async (key) => {
    const updatedPermissions = groupPermissions.filter(p => p !== key);
    setGroupPermissions(updatedPermissions);
  
    // 🔥 تحديث MongoDB فوراً
    await fetch("/api/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: groupId,
        name: group?.name || "",
        users: groupUsers.map(u => u._id),
        permissions: updatedPermissions,
      }),
    });
  };
  // 🟦 حفظ التغييرات
  const saveChanges = async () => {
    if (!groupId) {
      alert("Group ID missing – cannot save.");
      return;
    }
  
    try {
      setSaving(true);
  
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: groupId,
          name: group?.name || "",
          users: groupUsers.map((u) => u._id),
          permissions: groupPermissions,
          companies: groupCompanies   // ← ← ← الحل
        }),
      });
  
      const data = await res.json();
  
      if (data.success) {
        alert("Saved successfully");
        setGroup(data.data);
        setGroupUsers(data.data.users || []);
        setGroupPermissions(data.data.permissions || []);
        setGroupCompanies(data.data.companies || []);
      } else {
        alert(data.error || "Failed to update");
      }
    } catch (err) {
      console.error(err);
      alert("Error while saving changes");
    } finally {
      setSaving(false);
    }
  };

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600">
        Loading group...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 p-6 md:p-10">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
            <FiShield className="text-blue-600" />
            Permission Group
          </h1>
          <p className="mt-1 text-gray-600">
            Manage users & permissions for:{" "}
            <span className="font-semibold text-gray-900">{group.name}</span>
          </p>
        </div>

        <button
          onClick={() => (window.location.href = "/permissions")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-white hover:bg-gray-900 shadow"
        >
          <FiArrowLeft /> Back
        </button>
      </div>

      {/* SUMMARY STATS */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3 bg-white/80 border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
          <FiUsers className="text-gray-500" />
          <div>
            <div className="text-xs text-gray-500">Users in group</div>
            <div className="font-semibold text-gray-900">
              {groupUsers.length}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/80 border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
          <FiShield className="text-gray-500" />
          <div>
            <div className="text-xs text-gray-500">Permissions</div>
            <div className="font-semibold text-gray-900">
              {groupPermissions.length}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT: USERS */}
        <motion.div
          className="bg-white/90 border border-gray-200 rounded-2xl shadow-sm p-6"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FiUsers className="text-blue-600" /> Users in this group
            </h2>
            <button
              onClick={() => setUserPopupOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm hover:bg-black/90"
            >
              <FiPlus /> Add users
            </button>
          </div>

          {groupUsers.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No users added yet. Click &ldquo;Add users&rdquo; to start.
            </p>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {groupUsers.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm font-semibold">
                      {(u.username || u.name || u.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {u.username || u.name || u.email}
                      </div>
                      {u.email && (
                        <div className="text-xs text-gray-500">
                          {u.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeUser(u._id)}
                    className="p-1.5 rounded-full hover:bg-red-50 text-red-500"
                    title="Remove from group"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* RIGHT: PERMISSIONS */}
        <motion.div
          className="bg-white/90 border border-gray-200 rounded-2xl shadow-sm p-6"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FiShield className="text-blue-600" /> Permissions
            </h2>
            <button
              onClick={() => setPermPopupOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm hover:bg-black/90"
            >
              <FiPlus /> Add permissions
            </button>
          </div>

          {groupPermissions.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No permissions assigned yet. Click &ldquo;Add permissions&rdquo; to
              choose.
            </p>
          ) : (
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
              {groupPermissions.map((key) => {
                const label = PERMISSIONS[key] || key;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800/90 text-white flex items-center justify-center">
                        {getPermissionIcon(key, "text-white text-lg")}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {label}
                        </div>
                        <div className="text-xs text-gray-500">
                          Key: <span className="font-mono">{key}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removePermission(key)}
                      className="p-1.5 rounded-full hover:bg-red-50 text-red-500"
                      title="Remove permission"
                    >
                      <FiX />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
        {/* Companies Section
<motion.div
  className="bg-white/90 border border-gray-200 rounded-2xl shadow-sm p-6 mt-8"
  initial={{ opacity: 0, y: 25 }}
  animate={{ opacity: 1, y: 0 }}
>
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-semibold text-gray-800">
      Companies
    </h2>
    <Select
      options={COMPANY_OPTIONS.map(c => ({ value: c, label: c }))}
      onChange={(val) => {
        if (!val) return;
        if (!groupCompanies.includes(val.value)) {
          setGroupCompanies([...groupCompanies, val.value]);
        }
      }}
      className="w-48"
      placeholder="Add company"
    />
  </div>

  {groupCompanies.length === 0 ? (
    <p className="text-sm text-gray-500 italic">No companies assigned.</p>
  ) : (
    <div className="space-y-2">
      {groupCompanies.map((c, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between border px-3 py-2 rounded-xl bg-gray-50"
        >
          <span className="text-sm font-medium">{c}</span>
          <button
            onClick={() =>
              setGroupCompanies(groupCompanies.filter(x => x !== c))
            }
            className="p-1.5 rounded-full text-red-500 hover:bg-red-50"
          >
            <FiX />
          </button>
        </div>
      ))}
    </div>
  )}
</motion.div> */}
      </div>

      {/* SAVE BUTTON */}
      <div className="mt-10 flex justify-end">
        <button
          onClick={saveChanges}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-blue-600 text-white flex items-center gap-2 shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
              Saving...
            </>
          ) : (
            <>
              <FiCheckCircle /> Save Changes
            </>
          )}
        </button>
      </div>

      {/* POPUP: ADD USERS (React Select) */}
      <AnimatePresence>
        {userPopupOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                  <FiUsers className="text-blue-600" /> Add users to group
                </h3>
                <button
                  onClick={() => setUserPopupOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <FiX />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-3">
                Search and select one or more users to add to this permission
                group.
              </p>

              <Select
                options={availableUserOptions}
                isMulti
                isSearchable
                value={selectedUserOptions}
                onChange={(val) => setSelectedUserOptions(val || [])}
                className="text-sm"
                classNamePrefix="select"
                placeholder="Search users..."
                noOptionsMessage={() => "No more users available"}
              />

              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => {
                    setSelectedUserOptions([]);
                    setUserPopupOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={addSelectedUsers}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700"
                >
                  <FiCheckCircle /> Add selected
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POPUP: ADD PERMISSIONS (Search + Icons) */}
      <AnimatePresence>
        {permPopupOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                  <FiShield className="text-blue-600" /> Add permissions
                </h3>
                <button
                  onClick={() => setPermPopupOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <FiX />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4 border border-gray-200 rounded-xl px-3 py-2 bg-gray-50">
                <FiSearch className="text-gray-400" />
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  placeholder="Search permissions by key or label..."
                />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {filteredPermissions.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    No permissions match your search or all are already added.
                  </p>
                ) : (
                  filteredPermissions.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => addPermission(key)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-left transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center">
                          {getPermissionIcon(key, "text-white text-lg")}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {label}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {key}
                          </div>
                        </div>
                      </div>
                      <FiPlus className="text-gray-400" />
                    </button>
                  ))
                )}
              </div>

              <div className="flex justify-end mt-5">
                <button
                  onClick={() => setPermPopupOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
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