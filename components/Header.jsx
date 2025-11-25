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
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export default function Header({ onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState(null);
  const { permissions, user } = usePermissions();
  useEffect(() => {
    const updateUser = () => {
      const storedUser = localStorage.getItem("username");
      setUsername(storedUser || null);
      if (!storedUser) setMenuOpen(false);
    };
    updateUser();
    window.addEventListener("userChanged", updateUser);
    return () => window.removeEventListener("userChanged", updateUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("username");
    setUsername(null);
    window.dispatchEvent(new Event("userChanged"));
    if (onLogout) onLogout();
    router.push("/login");
  };

  return (
    <motion.header
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="sticky top-0 z-50 w-full
                 backdrop-blur-xl border-b border-gray-800/60
                 bg-gradient-to-b from-gray-800 via-gray-750 to-gray-900
                 shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
    >
      {/* 🔹 استخدم grid بدون max-w حتى تبقى أقصى اليمين واليسار */}
      <div className="w-full grid grid-cols-3 items-center px-6 h-16">
        {/* يسار */}
        <div className="flex flex-col items-start leading-tight relative">
          <span
            className={`font-bold text-2xl tracking-tight
                        bg-gradient-to-r from-gray-300 via-gray-100 to-white
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
            className="text-base sm:text-lg md:text-2xl font-bold tracking-tight
                       bg-gradient-to-r from-gray-200 via-gray-100 to-white
                       text-transparent bg-clip-text"
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
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl
                             bg-gray-800/80 border border-gray-600 shadow-sm"
                >
                  <FaUserCircle className="text-gray-200 text-2xl" />
                  <span className="text-sm font-medium text-gray-100">
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
                      className="absolute right-0 top-12 w-56 overflow-hidden rounded-2xl
                                 border border-gray-600 bg-gray-800 shadow-xl"
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
      router.push("/permissions");
    }}
    icon={<MdPolicy className="text-gray-200" />}
    label="إدارة الصلاحيات"
  />
)}
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/reports");
                          }}
                          icon={<FaSquarePollVertical className="text-gray-200" />}
                          label="تقارير"
                        />
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
        ${danger ? "text-red-400 hover:bg-red-900/40" : "text-gray-200 hover:bg-gray-700"}`}
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
    </motion.button>
  );
}