"use client";

import { useState, useEffect, useMemo } from "react";
import { FaUserCircle, FaBars, FaHome, FaUserPlus, FaSignOutAlt, FaTimes } from "react-icons/fa";
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
import { FiClock, FiLink, FiCreditCard, FiShuffle } from "react-icons/fi";
import { resolveHeaderTitle } from "@/lib/headerTitle";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const panelVariants = {
  closed: { x: "100%" },
  open: { x: 0 },
};

const backdropVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
};

const listVariants = {
  open: {
    transition: { staggerChildren: 0.045, delayChildren: 0.12 },
  },
  closed: {
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

const itemVariants = {
  closed: { opacity: 0, x: 24 },
  open: { opacity: 1, x: 0 },
};

function MenuIcon({ color = "text-blue-400", children }) {
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/90 text-base ring-1 ring-slate-600/80 ${color}`}
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

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const nextUsername = user?.username || null;
    setUsername(nextUsername);
    if (!nextUsername) setMenuOpen(false);
  }, [user]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  const canViewReports =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VIEW_REPORTS);

  const canAccessCheques = hasPermission(permissions, PERMISSIONS.CHEQUES);
  const canManage = permissions?.includes(PERMISSIONS.MANAGE_PERMISSIONS);

  const headerTitle = useMemo(() => resolveHeaderTitle(pathname), [pathname]);
  const isLoginPage = pathname === "/login";

  const menuSections = useMemo(() => {
    const sections = [];

    sections.push({
      title: "التنقل",
      items: [
        {
          key: "home",
          label: "الرئيسية",
          icon: (
            <MenuIcon color="text-amber-500">
              <FaHome />
            </MenuIcon>
          ),
          onClick: () => router.push("/home"),
        },
      ],
    });

    const adminItems = [];

    if (canManage) {
      adminItems.push(
        {
          key: "register",
          label: "إنشاء يوزر جديد",
          icon: (
            <MenuIcon color="text-indigo-500">
              <FaUserPlus />
            </MenuIcon>
          ),
          onClick: () => router.push("/register"),
        },
        {
          key: "workflow",
          label: "الموافقات",
          icon: (
            <MenuIcon color="text-purple-500">
              <GoWorkflow />
            </MenuIcon>
          ),
          onClick: () => router.push("/workflow"),
        },
        {
          key: "requests-workflow",
          label: "وورك فلو الطلبات",
          icon: (
            <MenuIcon color="text-violet-500">
              <GoWorkflow />
            </MenuIcon>
          ),
          onClick: () => router.push("/admin/requests-workflow"),
        },
        {
          key: "transfer-requests",
          label: "نقل بين المستخدمين",
          icon: (
            <MenuIcon color="text-rose-500">
              <FiShuffle />
            </MenuIcon>
          ),
          onClick: () => router.push("/admin/transfer-requests"),
        },
        {
          key: "voucher-links",
          label: "ربط الوصولات بالطلبات",
          icon: (
            <MenuIcon color="text-blue-500">
              <FiLink />
            </MenuIcon>
          ),
          onClick: () => router.push("/admin/voucher-links"),
        },
        {
          key: "ex-workflow",
          label: "ex workflow",
          icon: (
            <MenuIcon color="text-slate-400">
              <GoWorkflow />
            </MenuIcon>
          ),
          onClick: () => router.push("ex/workflow"),
        },
        {
          key: "permissions",
          label: "إدارة الصلاحيات",
          icon: (
            <MenuIcon color="text-emerald-500">
              <MdPolicy />
            </MenuIcon>
          ),
          onClick: () => router.push("/permissions"),
        }
      );
    }

    if (adminItems.length) {
      sections.push({ title: "الإدارة", items: adminItems });
    }

    const systemItems = [];

    if (permissions?.includes(PERMISSIONS.RECEIPTS)) {
      systemItems.push({
        key: "vouchers",
        label: "وصل صرف وقبض",
        icon: (
          <MenuIcon color="text-teal-500">
            <IoReceipt />
          </MenuIcon>
        ),
        onClick: () => router.push("/vouchers"),
      });
    }

    if (canAccessCheques) {
      systemItems.push({
        key: "cheques",
        label: "نظام الصكوك",
        icon: (
          <MenuIcon color="text-cyan-500">
            <FiCreditCard />
          </MenuIcon>
        ),
        onClick: () => router.push("/cheques"),
      });
    }

    if (permissions?.includes(PERMISSIONS.EX) && !isExOnlyUser) {
      systemItems.push({
        key: "ex-home",
        label: "طلبات الحجز",
        icon: (
          <MenuIcon color="text-orange-500">
            <FaFileInvoice />
          </MenuIcon>
        ),
        onClick: () => router.push("/ex/ex-home"),
      });
    }

    if (systemItems.length) {
      sections.push({ title: "الأنظمة", items: systemItems });
    }

    const reportItems = [];

    if (canViewReports) {
      reportItems.push({
        key: "reports",
        label: "تقارير",
        icon: (
          <MenuIcon color="text-purple-500">
            <FaSquarePollVertical />
          </MenuIcon>
        ),
        onClick: () => openNewTab("/reports"),
      });
    }

    if (permissions?.includes(PERMISSIONS.RECEIPTS)) {
      reportItems.push(
        {
          key: "disbursement-track",
          label: "تتبع صرف الطلبات",
          icon: (
            <MenuIcon color="text-amber-500">
              <FiClock />
            </MenuIcon>
          ),
          onClick: () => openNewTab("/receipts/disbursement"),
        },
        {
          key: "voucher-reports",
          label: "تقارير الوصلات",
          icon: (
            <MenuIcon color="text-indigo-500">
              <FaSquarePollVertical />
            </MenuIcon>
          ),
          onClick: () => openNewTab("/vouchers/reports"),
        }
      );
    }

    if (reportItems.length) {
      sections.push({ title: "التقارير", items: reportItems });
    }

    return sections;
  }, [
    canAccessCheques,
    canManage,
    canViewReports,
    isExOnlyUser,
    permissions,
    router,
  ]);

  const handleLogout = async () => {
    try {
      sessionStorage.clear();
      await fetch("/api/logout", { method: "POST", credentials: "include" }).catch(
        () => {}
      );
      setUsername(null);
      closeMenu();
      window.dispatchEvent(new Event("userChanged"));
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    }
  };

  if (isLoginPage) return null;

  return (
    <>
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
          <div className="flex min-w-0 justify-center px-1">
            <h1
              onClick={isLoginPage ? undefined : () => router.push("/home")}
              title={headerTitle}
              className={`truncate bg-gradient-to-r from-slate-100 via-white to-slate-200 bg-clip-text text-center text-base font-extrabold tracking-tight text-transparent sm:text-lg md:max-w-[min(100%,28rem)] md:text-xl ${
                isLoginPage ? "cursor-default" : "cursor-pointer transition hover:opacity-80"
              }`}
            >
              {headerTitle}
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
                    aria-expanded={menuOpen}
                  >
                    <motion.div
                      animate={{ rotate: menuOpen ? 90 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {menuOpen ? (
                        <FaTimes className="text-base" />
                      ) : (
                        <FaBars className="text-base" />
                      )}
                    </motion.div>
                  </motion.button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && pathname !== "/login" && username ? (
          <>
            <motion.button
              type="button"
              key="menu-backdrop"
              aria-label="إغلاق القائمة"
              initial="closed"
              animate="open"
              exit="closed"
              variants={backdropVariants}
              transition={{ duration: 0.28, ease: "easeOut" }}
              onClick={closeMenu}
              className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-sm"
            />

            <motion.aside
              key="menu-panel"
              initial="closed"
              animate="open"
              exit="closed"
              variants={panelVariants}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-[61] flex w-[min(100vw,320px)] flex-col border-l border-slate-600/70 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.65)]"
            >
              <div className="border-b border-slate-700/80 px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-400/90">
                      القائمة
                    </p>
                    <p className="mt-1 truncate text-lg font-extrabold text-slate-100">
                      {username}
                    </p>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                      {headerTitle}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeMenu}
                    className="rounded-xl border border-slate-600/70 bg-slate-800/80 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    aria-label="إغلاق"
                  >
                    <FaTimes className="text-sm" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                <motion.div
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={listVariants}
                  className="space-y-5"
                >
                  {menuSections.map((section) => (
                    <div key={section.title}>
                      <motion.p
                        variants={itemVariants}
                        className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"
                      >
                        {section.title}
                      </motion.p>

                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <MenuItem
                            key={item.key}
                            variants={itemVariants}
                            onClick={() => {
                              closeMenu();
                              item.onClick();
                            }}
                            icon={item.icon}
                            label={item.label}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="border-t border-slate-700/80 p-3">
                <MenuItem
                  onClick={handleLogout}
                  icon={
                    <MenuIcon color="text-red-500">
                      <FaSignOutAlt />
                    </MenuIcon>
                  }
                  label="تسجيل خروج"
                  danger
                />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function MenuItem({ onClick, icon, label, danger = false, variants }) {
  return (
    <motion.button
      type="button"
      variants={variants}
      whileHover={{ x: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold transition ${
        danger
          ? "text-red-400 hover:bg-red-950/40"
          : "text-slate-200 hover:bg-slate-800/80"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </motion.button>
  );
}
