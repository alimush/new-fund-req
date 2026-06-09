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
import { hasPermission, PERMISSIONS } from "@/lib/permission";
import { IoReceipt } from "react-icons/io5";
import { FaFileInvoice } from "react-icons/fa";
import { FiClock, FiLink, FiCreditCard } from "react-icons/fi";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

function MenuIcon({ color = "text-blue-400", children }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800/90 text-sm ring-1 ring-slate-600/80 ${color}`}
    >
      {children}
    </span>
  );
}

export default function Header({ onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState(null);

  const { permissions, user, companies } = usePermissions();
  const isExOnlyUser =
    Array.isArray(companies) &&
    companies.length === 1 &&
    String(companies[0] || "").trim() === "EX";

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

  const canAccessCheques = hasPermission(permissions, PERMISSIONS.CHEQUES);

  const handleLogout = async () => {
    try {
      sessionStorage.clear();
      await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(
        () => {}
      );
      setUsername(null);
      setMenuOpen(false);
      window.dispatchEvent(new Event("userChanged"));
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    }
  };

  return (
    <motion.header
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      className="sticky top-0 z-50 w-full border-b border-slate-700/60 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950/95 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.85)] backdrop-blur-xl"
    >
      <div className="grid h-16 w-full grid-cols-3 items-center px-4 sm:px-6">
        {/* Logo */}
        <div className="relative flex min-w-0 flex-col items-start justify-center leading-tight">
          <span
            className={`text-2xl font-bold tracking-tight text-slate-100 ${poppins.className}`}
          >
            SPC
          </span>
          <span className={`text-[10px] font-semibold text-slate-400 sm:text-[11px] ${poppins.className}`}>
            Developed by SPC team
          </span>
          <span className="absolute -bottom-2 left-0 h-[2px] w-14 rounded-full bg-gradient-to-r from-indigo-500/80 via-blue-400/70 to-slate-500/60" />
        </div>

        {/* Center title */}
        <div className="flex justify-center">
          <h1
            onClick={() => router.push("/home")}
            className="cursor-pointer bg-gradient-to-r from-slate-100 via-white to-slate-200 bg-clip-text text-base font-extrabold tracking-tight text-transparent transition hover:opacity-80 sm:text-lg md:text-xl"
          >
            Fund Request
          </h1>
        </div>

        {/* User + menu */}
        <div className="relative flex items-center justify-end">
          <AnimatePresence>
            {pathname !== "/login" && username ? (
              <motion.div
                key="user-cluster"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="flex items-center gap-2 sm:gap-3"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-600/70 bg-slate-800/75 px-2 py-1 shadow-sm backdrop-blur-sm sm:gap-2 sm:px-2.5 sm:py-1.5"
                >
                  <FaUserCircle className="text-lg text-indigo-400 sm:text-xl" />
                  <span className="max-w-[120px] truncate text-xs font-extrabold text-slate-100 sm:max-w-none sm:text-sm">
                    {username}
                  </span>
                </motion.div>

                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setMenuOpen((v) => !v)}
                  className={`rounded-xl border p-1.5 transition ${
                    menuOpen
                      ? "border-indigo-500/70 bg-indigo-600/25 text-indigo-200"
                      : "border-slate-600/70 bg-slate-800/75 text-slate-200 hover:border-slate-500 hover:bg-slate-700/80"
                  }`}
                  aria-label="menu"
                >
                  <motion.div
                    animate={{ rotate: menuOpen ? 90 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FaBars className="text-base" />
                  </motion.div>
                </motion.button>

                <AnimatePresence>
                  {menuOpen ? (
                    <motion.div
                      key="menu"
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-900/95 shadow-xl backdrop-blur-md"
                    >
                      <div className="border-b border-slate-700/80 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400/90">
                          القائمة
                        </p>
                        <p className="mt-0.5 truncate text-sm font-extrabold text-slate-100">
                          {username}
                        </p>
                      </div>

                      <div className="p-1.5">
                        <MenuItem
                          onClick={() => {
                            setMenuOpen(false);
                            router.push("/home");
                          }}
                          icon={
                            <MenuIcon color="text-amber-600">
                              <FaHome />
                            </MenuIcon>
                          }
                          label="الرئيسية"
                        />

                        {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/register");
                            }}
                            icon={
                              <MenuIcon color="text-indigo-600">
                                <FaUserPlus />
                              </MenuIcon>
                            }
                            label="إنشاء يوزر جديد"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/workflow");
                            }}
                            icon={
                              <MenuIcon color="text-purple-600">
                                <GoWorkflow />
                              </MenuIcon>
                            }
                            label="الموافقات"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/admin/requests-workflow");
                            }}
                            icon={
                              <MenuIcon color="text-violet-600">
                                <GoWorkflow />
                              </MenuIcon>
                            }
                            label="وورك فلو الطلبات"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/admin/voucher-links");
                            }}
                            icon={
                              <MenuIcon color="text-blue-600">
                                <FiLink />
                              </MenuIcon>
                            }
                            label="ربط الوصولات بالطلبات"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("ex/workflow");
                            }}
                            icon={
                              <MenuIcon color="text-slate-600">
                                <GoWorkflow />
                              </MenuIcon>
                            }
                            label="ex workflow"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/permissions");
                            }}
                            icon={
                              <MenuIcon color="text-emerald-600">
                                <MdPolicy />
                              </MenuIcon>
                            }
                            label="إدارة الصلاحيات"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.RECEIPTS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/vouchers");
                            }}
                            icon={
                              <MenuIcon color="text-teal-600">
                                <IoReceipt />
                              </MenuIcon>
                            }
                            label="وصل صرف وقبض"
                          />
                        ) : null}

                        {canAccessCheques ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/cheques");
                            }}
                            icon={
                              <MenuIcon color="text-cyan-600">
                                <FiCreditCard />
                              </MenuIcon>
                            }
                            label="نظام الصكوك"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.EX) && !isExOnlyUser ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              router.push("/ex/ex-home");
                            }}
                            icon={
                              <MenuIcon color="text-orange-600">
                                <FaFileInvoice />
                              </MenuIcon>
                            }
                            label="طلبات الحجز"
                          />
                        ) : null}

                        {canViewReports ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              openNewTab("/reports");
                            }}
                            icon={
                              <MenuIcon color="text-purple-600">
                                <FaSquarePollVertical />
                              </MenuIcon>
                            }
                            label="تقارير"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.RECEIPTS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              openNewTab("/receipts/disbursement");
                            }}
                            icon={
                              <MenuIcon color="text-amber-600">
                                <FiClock />
                              </MenuIcon>
                            }
                            label="تتبع صرف الطلبات"
                          />
                        ) : null}

                        {permissions?.includes(PERMISSIONS.RECEIPTS) ? (
                          <MenuItem
                            onClick={() => {
                              setMenuOpen(false);
                              openNewTab("/vouchers/reports");
                            }}
                            icon={
                              <MenuIcon color="text-indigo-600">
                                <FaSquarePollVertical />
                              </MenuIcon>
                            }
                            label="تقارير الوصلات"
                          />
                        ) : null}

                        <div className="my-1 border-t border-slate-700/80" />

                        <MenuItem
                          onClick={handleLogout}
                          icon={
                            <MenuIcon color="text-red-600">
                              <FaSignOutAlt />
                            </MenuIcon>
                          }
                          label="تسجيل خروج"
                          danger
                        />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
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
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${
        danger
          ? "text-red-400 hover:bg-red-950/40"
          : "text-slate-200 hover:bg-slate-800/80"
      }`}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}
