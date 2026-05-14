"use client";
import { useState, useEffect } from "react";
import { FaUserCircle, FaBars, FaHome, FaUserPlus, FaSignOutAlt } from "react-icons/fa";
import { GoWorkflow } from "react-icons/go";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Poppins } from "next/font/google";
import { MdPolicy } from "react-icons/md";
import { FaSquarePollVertical } from "react-icons/fa6";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import { IoReceipt } from "react-icons/io5";
import { FaFileInvoice } from "react-icons/fa";
import { FiClock } from "react-icons/fi";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export default function Header({ onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState(null);
  
  const { permissions, user, companies } = usePermissions();
  const isExOnlyUser = Array.isArray(companies)
    && companies.length === 1
    && String(companies[0] || "").trim() === "EX";

  const openNewTab = (path) => {
    window.open(path, "_blank", "noopener,noreferrer");
  };
  useEffect(() => {
    const nextUsername = user?.username || null;
    setUsername(nextUsername);
    if (!nextUsername) setMenuOpen(false);
  }, [user]);
  const canViewReports =
  Array.isArray(permissions) &&
  permissions.includes(PERMISSIONS.VIEW_REPORTS);
  
  const handleLogout = async () => {
    try {
      // (اختياري) امسح sessionStorage
      sessionStorage.clear();
  
      // نادِ endpoint يمسح cookie userId
      await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(() => {});
  
      // حدّث الحالة
      setUsername(null);
      setMenuOpen(false);
      window.dispatchEvent(new Event("userChanged"));
  
      // تحويل + منع الرجوع بالـ back لصفحات محمية
      router.replace("/login");
      router.refresh(); // يساعد يفشل أي data cached بالـ app router
    } catch (e) {
      router.replace("/login");
    }
  };

  return (
    <motion.header
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="sticky top-0 z-50 w-full border-b border-gray-700/70 bg-gradient-to-b from-gray-900 via-gray-850 to-gray-900/95 backdrop-blur-xl shadow-[0_10px_28px_-18px_rgba(0,0,0,0.75)]"
    >
      {/* 🔹 استخدم grid بدون max-w حتى تبقى أقصى اليمين واليسار */}
      <div className="grid h-16 w-full grid-cols-3 items-center px-4 sm:px-6">
        {/* يسار */}
        <div className="flex flex-col items-start leading-tight relative">
          <span
            className={`font-bold text-2xl tracking-tight
                        bg-gradient-to-r from-gray-200 via-gray-100 to-white
                        text-transparent bg-clip-text ${poppins.className}`}
          >
            SPC
          </span>
          <span className={`text-[11px] text-gray-300 ${poppins.className}`}>
            Developed by SPC team
          </span>
          <span className="absolute -bottom-2 left-0 h-[2px] w-16 rounded-full
                           bg-gradient-to-r from-gray-500 via-gray-400 to-gray-300 opacity-80" />
        </div>

      {/* الوسط – العنوان */}
<div className="flex justify-center">
  <h1
    onClick={() => router.push("/home")}
    className="cursor-pointer
               text-base sm:text-lg md:text-2xl font-bold tracking-tight
               bg-gradient-to-r from-gray-200 via-gray-100 to-white
               text-transparent bg-clip-text
               hover:opacity-80 transition"
  >
    Fund Request
  </h1>
</div>

        {/* يمين */}
        <div className="flex justify-end items-center relative">
          <AnimatePresence>
            {pathname !== "/login" && username && (
              <motion.div
                key="user-cluster"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="flex items-center gap-3"
              >
                {/* بطاقة اليوزر */}
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  className="flex items-center gap-2 rounded-xl border border-gray-600/80 bg-gray-800/80 px-3 py-1.5 shadow-sm"
                >
                  <FaUserCircle className="text-2xl text-gray-200" />
                  <span className="text-sm font-semibold text-gray-100">
                    {username}
                  </span>
                </motion.div>

                {/* زر المنيو */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setMenuOpen((v) => !v)}
                  className={`p-2 rounded-xl border transition 
                    ${menuOpen
                      ? "bg-gray-700 border-gray-500"
                      : "bg-gray-800 hover:bg-gray-700 border-gray-600"}`}
                  aria-label="menu"
                >
                  <motion.div
                    animate={{ rotate: menuOpen ? 90 : 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    <FaBars className="text-gray-200 text-lg" />
                  </motion.div>
                </motion.button>

                {/* المنيو المنسدلة */}
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      key="menu"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl border border-gray-600/80 bg-gray-900/95 shadow-xl backdrop-blur"
                    >
                      <div className="p-1">
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/home");
                          }}
                          icon={<FaHome className="text-gray-200" />}
                          label="الرئيسية"
                        />
                         {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) && (
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/register");
                          }}
                          icon={<FaUserPlus className="text-gray-200" />}
                          label="إنشاء يوزر جديد"
                        />)}
                         {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) && (
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/workflow");
                          }}
                          icon={<GoWorkflow className="text-gray-200" />}
                          label="الموافقات "
                        />)}
                         {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) && (
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/admin/requests-workflow");
                          }}
                          icon={<GoWorkflow className="text-gray-200" />}
                          label="وورك فلو الطلبات"
                        />)}
                         {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) && (
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("ex/workflow");
                          }}
                          icon={<GoWorkflow className="text-gray-200" />}
                          label="ex workflow "
                        />)}



                      {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) && (
  <MenuItem
    onClick={() => {
      setMenuOpen(false);
      router.push("/permissions");
    }}
    icon={<MdPolicy className="text-gray-200" />}
    label="إدارة الصلاحيات"
  />
)}
                      {permissions?.includes(PERMISSIONS.RECEIPTS) && (
  <MenuItem
    onClick={() => {
      setMenuOpen(false);
      router.push("/vouchers");
    }}
    icon={<IoReceipt className="text-gray-200" />}
    label="وصل صرف وقبض"
  />
)}

{permissions?.includes(PERMISSIONS.EX) && !isExOnlyUser && (
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/ex/ex-home");
                          }}
                          icon={<FaFileInvoice className="text-gray-200" />}
                          label="طلبات الحجز"
                        />)}

{canViewReports && (
  <MenuItem
    onClick={() => {
      setMenuOpen(false);
      openNewTab("/reports");
    }}
    icon={<FaSquarePollVertical className="text-gray-200" />}
    label="تقارير"
  />
)}


{permissions?.includes(PERMISSIONS.RECEIPTS) && (
  <MenuItem
    onClick={() => {
      setMenuOpen(false);
      router.push("/receipts/disbursement");
    }}
    icon={<FiClock className="text-gray-200" />}
    label="تتبع صرف الطلبات"
  />
)}
{permissions?.includes(PERMISSIONS.RECEIPTS) && (
  <MenuItem
    onClick={() => {
      setMenuOpen(false);
      openNewTab("/vouchers/reports");
    }}
    icon={<FaSquarePollVertical className="text-gray-200" />}
    label="تقارير الوصلات"
  />
)}
                        <MenuItem
                          onClick={handleLogout}
                          icon={<FaSignOutAlt className="text-red-400" />}
                          label="تسجيل خروج"
                          danger
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.header>
  );
}

function MenuItem({ onClick, icon, label, danger = false }) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition
        ${danger ? "text-red-400 hover:bg-red-900/30" : "text-gray-200 hover:bg-gray-700/70"}`}
    >
      <span className="text-base">{icon}</span>
      <span className="font-semibold">{label}</span>
    </motion.button>
  );
}