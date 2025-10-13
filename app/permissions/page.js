"use client";
import { useState, useEffect } from "react";
import Select from "react-select";
import { motion } from "framer-motion";

export default function PermissionsPage() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCompanies, setSelectedCompanies] = useState([]);

  // 🟢 جلب اليوزريه من Mongo API
  useEffect(() => {
    const fetchUsers = async () => {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setUsers(
          data.data.map((u) => ({
            value: u._id,
            label: u.username,
          }))
        );
      }
    };
    fetchUsers();
  }, []);

  // 🟢 الشركات (ثابتة حاليا – تكدر تخليها من DB)
  useEffect(() => {
    setCompanies([
      { value: "Al-Ghadeer", label: "الغدير" },
      { value: "Al-Rida", label: "الرضا" },
      { value: "Al-Mezan", label: "الميزان" },
      { value: "Badur-Baghdad", label: "بدور بغداد" },
      { value: "Ghadeer-Karbala", label: "غدير كربلاء" },
      { value: "Tiba-Al-najaf", label: "طيبة النجف" },
      { value: "Badur-Al-najaf", label: "بدور النجف" },
    ]);
  }, []);

  const handleSave = async () => {
    if (!selectedUser) {
      alert("اختار يوزر أولاً");
      return;
    }
    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUser.value,
        companies: selectedCompanies.map((c) => c.value),
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert("✅ تم حفظ الصلاحيات");
    } else {
      alert("❌ فشل: " + data.error);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-700">إدارة الصلاحيات</h1>

        {/* 🟢 اختيار يوزر */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">اختر يوزر</label>
          <Select
            instanceId="user-select"   // ✅ هذا يحل مشكلة الـ hydration
            options={users}
            value={selectedUser}
            onChange={setSelectedUser}
            placeholder="ابحث أو اختر يوزر"
            isClearable
            className="text-sm"
          />
        </div>

        {/* 🟢 اختيار شركات */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">اختر الشركات</label>
          <Select
            instanceId="company-select"   // ✅ هذا أيضاً يحل المشكلة
            options={companies}
            value={selectedCompanies}
            onChange={setSelectedCompanies}
            placeholder="ابحث أو اختر شركات"
            isMulti
            isClearable
            className="text-sm"
          />
        </div>

        {/* زر الحفظ */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl bg-gray-800 text-white font-medium shadow-md hover:bg-gray-900 transition"
        >
          حفظ الصلاحيات
        </motion.button>
      </div>
    </div>
  );
}
