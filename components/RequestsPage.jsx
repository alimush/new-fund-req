"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus,
  FiArrowLeft,
  FiClock,
  FiCheckCircle,
  FiFileText,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import StatusBadge from "@/components/StatusBadge";

import CreateRequestModal from "@/components/CreateRequestModal";

export default function RequestsPage({ companyKey }) {
  const router = useRouter();
  const { permissions } = usePermissions();
const canViewAll =
  Array.isArray(permissions) &&
  permissions.includes(PERMISSIONS.VIEW_REPORTS);
  const canCreate =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.CREATE_REQUEST);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [q, setQ] = useState("");
  const [mounted, setMounted] = useState(false);
  const allowedCompanies = useMemo(() => {
    if (!Array.isArray(permissions)) return [];
  
    // مثال: صلاحيات الشركات بصيغة COMPANY:<KEY>
    return permissions
      .filter((p) => typeof p === "string" && p.startsWith("COMPANY:"))
      .map((p) => p.replace("COMPANY:", "").trim())
      .filter(Boolean);
  }, [permissions]);

  useEffect(() => setMounted(true), []);
  
  

  const fetchRequests = useCallback(async () => {
    if (!companyKey) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/requests?company=${companyKey}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data?.data)) setRequests(data.data);
      else setRequests([]);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [companyKey]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const currentUsername = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("username") || "";
  }, []);

  // =========================
  // Motion Variants
  // =========================
  const pageV = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: "easeOut" },
    },
  };

  const staggerV = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
  };

  const sectionV = {
    hidden: { opacity: 0, y: 10, scale: 0.995 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.28, ease: "easeOut" },
    },
  };

  const cardV = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
    exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
  };

  // =========================
  // Normalize + Sort
  // =========================
  const normalized = useMemo(() => {
    const list = (requests || []).map((r) => {
      const status = String(r.status || "").toLowerCase();
      const createdBy = String(r.createdBy || "");
      const isMine =
        currentUsername &&
        createdBy.toLowerCase() === String(currentUsername).toLowerCase();

      const createdAtTs = r.createdAt ? new Date(r.createdAt).getTime() : 0;

      return {
        ...r,
        _status: status,
        _isMine: isMine,
        _isPending: status === "pending",
        _isCancelled: status === "cancelled",
        _isApproved: status === "approved",
        _isRejected: status === "rejected",
        _createdAtTs: createdAtTs,
      };
    });

    return list.sort((a, b) => b._createdAtTs - a._createdAtTs);
  }, [requests, currentUsername]);

  // =========================
  // Stats
  // =========================
 // ✅ أولاً
const myRequests = useMemo(() => {
  return normalized.filter((r) => r._isMine).slice(0, 20);
}, [normalized]);

// ✅ بعدها
const stats = useMemo(() => {
  const total = myRequests.length;
  const approved = myRequests.filter((r) => r._isApproved).length;
  const pending = myRequests.filter((r) => r._isPending).length;

  return { total, approved, pending };
}, [myRequests]);

  // =========================
  // Search helpers
  // =========================
  const buildHaystack = useCallback((r) => {
    return [
      r.requestCode,
      r.company,
      r.requestType,
      r.description,
      r.currency,
      r.department,
      r.createdBy,
      r._id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }, []);

  // =========================
  // Sections
  // =========================
 // ✅ فقط ريكوستات اليوزر الحالي


// ❌ نخليها فاضية حالياً// ✅ Pending Approvals (غير مالتي) فقط للي عنده VIEW_REPORTS
const pendingOthers = useMemo(() => {
  if (!canViewAll) return []; // ما عنده صلاحية -> لا يطلع شي
  return normalized.filter((r) => r._isPending && !r._isMine).slice(0, 20);
}, [normalized, canViewAll]);

// ✅ Cancelled (كل الشركات المسموحة) فقط للي عنده VIEW_REPORTS
// وإذا ما عنده صلاحية -> خليها مالته
const cancelled = useMemo(() => {
  const text = q.trim().toLowerCase();
  const base = canViewAll
    ? normalized.filter((r) => r._isCancelled)
    : myRequests.filter((r) => r._isCancelled);

  if (!text) return base;
  return base.filter((r) => buildHaystack(r).includes(text));
}, [normalized, myRequests, q, buildHaystack, canViewAll]);

// ✅ Approved & Rejected (كل الشركات المسموحة) فقط للي عنده VIEW_REPORTS
// وإذا ما عنده صلاحية -> خليها مالته
const archivedOther = useMemo(() => {
  const text = q.trim().toLowerCase();
  const base = canViewAll
    ? normalized.filter((r) => r._isApproved || r._isRejected)
    : myRequests.filter((r) => r._isApproved || r._isRejected);

  if (!text) return base;
  return base.filter((r) => buildHaystack(r).includes(text));
}, [normalized, myRequests, q, buildHaystack, canViewAll]);

  // =========================
  // UI Components
  // =========================
  

  const SoftSpinner = ({ label }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center py-14"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white/35 ring-1 ring-white/25 px-4 py-3">
        <div className="w-6 h-6 rounded-full border-4 border-white/70 border-t-transparent animate-spin" />
        <div className="text-sm font-bold text-gray-900">
          {label || "Loading..."}
        </div>
      </div>
    </motion.div>
  );

  const EmptyState = ({ icon: Icon, title, subtitle }) => (
    <motion.div
      variants={sectionV}
      className="rounded-3xl bg-white/30 ring-1 ring-white/25 p-10 text-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-white/40 ring-1 ring-white/25 flex items-center justify-center text-gray-700"
      >
        {Icon ? <Icon /> : <FiFileText />}
      </motion.div>
      <div className="text-sm font-black text-gray-900">{title}</div>
      {subtitle && (
        <div className="text-xs text-gray-800/70 mt-1">{subtitle}</div>
      )}
    </motion.div>
  );

  const RequestCard = ({ r, compact = false, index = 0 }) => {
    const dateText = r.createdAt
      ? new Date(r.createdAt).toLocaleDateString()
      : "-";

    return (
      <motion.div
        layout
        variants={cardV}
        custom={index}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.995 }}
        className={[
          "relative cursor-pointer rounded-2xl",
          "bg-white/45 backdrop-blur-xl",
          "ring-1 ring-white/30",
          "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.25)]",
          "hover:bg-white/60 hover:ring-white/45",
          "transition-colors",
          compact ? "p-4" : "p-5",
        ].join(" ")}
        onClick={() => router.push(`/requests/${companyKey}/${r._id}`)}
      >
        {/* glow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-80" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              <span className="text-xs text-gray-600/80">{dateText}</span>
            </div>

            <div className="mt-2 text-sm font-extrabold text-gray-900 line-clamp-1">
              {r.requestType || "Request"}
            </div>

            <div className="mt-1 text-xs text-gray-700/80 line-clamp-2">
              {r.description || "-"}
            </div>

            <div className="mt-2 text-[11px] font-mono text-gray-700/80">
              {r.requestCode || r._id}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[11px] text-gray-600/80">Currency</div>
            <div className="text-sm font-black text-gray-900">
              {r.currency || "-"}
            </div>
          </div>
        </div>

        <div className="relative mt-3 flex items-center justify-between text-xs text-gray-700/80">
          <span className="inline-flex items-center gap-1">
            <FiFileText />
            {r.company || companyKey}
          </span>
          <span className="truncate max-w-[55%]">
            By: {r.createdBy || "Unknown"}
          </span>
        </div>
      </motion.div>
    );
  };

  const SectionShell = ({ title, subtitle, icon: Icon, children, right }) => (
    <motion.div
      variants={sectionV}
      className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] overflow-hidden"
    >
      <div className="px-5 py-4 bg-white/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="mt-0.5 h-10 w-10 rounded-2xl bg-white/35 ring-1 ring-white/30 backdrop-blur flex items-center justify-center text-gray-800">
                <Icon />
              </div>
            )}
            <div>
              <div className="text-sm font-black text-gray-900">{title}</div>
              {subtitle && (
                <div className="text-xs text-gray-700/80">{subtitle}</div>
              )}
            </div>
          </div>

          {right}
        </div>
      </div>

      <div className="p-5">{children}</div>
    </motion.div>
  );

  const ScrollBox = ({ children, height = "max-h-[520px]" }) => (
    <div
      className={[
        height,
        "overflow-y-auto pr-1",
        "scrollbar-thin",
        "scrollbar-thumb-gray-300/60 scrollbar-track-transparent",
      ].join(" ")}
    >
      {children}
    </div>
  );

  const StatCard = ({ title, value, icon: Icon, iconClass }) => (
    <motion.div
      variants={sectionV}
      whileHover={{ y: -2 }}
      className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]"
    >
      <div className="text-xs text-gray-700/80">{title}</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-3xl font-black text-gray-900">{value}</div>
        <div className="h-11 w-11 rounded-2xl bg-white/45 ring-1 ring-white/25 flex items-center justify-center">
          <Icon className={iconClass} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      variants={pageV}
      initial="hidden"
      animate="show"
      className="min-h-screen w-full"
    >
      {/* Background glass */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200" />
      <div className="fixed inset-0 -z-10 opacity-70">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute top-28 right-10 h-80 w-80 rounded-full bg-purple-200/35 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* ===== Top Bar ===== */}
        <motion.div
          variants={staggerV}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <motion.div variants={sectionV} className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={() => router.push("/home")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/40 backdrop-blur-xl ring-1 ring-white/30 text-gray-800 shadow-sm hover:bg-white/55"
              title="Back to Dashboard"
            >
              <FiArrowLeft />
              Back
            </motion.button>

            <div className="flex flex-col gap-1">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Fund Requests Management
              </h1>

              <div className="flex items-center gap-2 text-sm text-gray-800/80">
                <span className="font-semibold">Company:</span>
                <span className="px-2.5 py-1 rounded-xl bg-white/45 backdrop-blur ring-1 ring-white/25 text-gray-900 font-extrabold">
                  {companyKey}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={sectionV}
            className="flex items-center gap-2"
          >
            {canCreate && (
              <motion.button
                onClick={() => setIsCreateOpen(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-900/85 backdrop-blur text-white shadow hover:bg-gray-900"
              >
                <FiPlus />
                Create Request
              </motion.button>
            )}
          </motion.div>
        </motion.div>

        {/* ===== Stats ===== */}
        <motion.div
          variants={staggerV}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <StatCard
            title="Approved Requests"
            value={stats.approved}
            icon={FiCheckCircle}
            iconClass="text-green-700"
          />
          <StatCard
            title="Pending Requests"
            value={stats.pending}
            icon={FiClock}
            iconClass="text-amber-700"
          />
          <StatCard
            title="Total Requests"
            value={stats.total}
            icon={FiFileText}
            iconClass="text-blue-700"
          />
        </motion.div>

        {/* ===== Two columns ===== */}
        <motion.div
          variants={staggerV}
          initial="hidden"
          animate="show"
          className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Left: Pending Others */}
          <SectionShell
            title="Pending Approvals"
            subtitle="Pending requests created by other users"
            icon={FiClock}
            right={
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchRequests}
                className="text-xs font-bold px-3 py-2 rounded-2xl bg-white/35 ring-1 ring-white/25 hover:bg-white/50"
                title="Refresh"
              >
                Refresh
              </motion.button>
            }
          >
            {loading ? (
              <SoftSpinner label="Loading pending approvals..." />
            ) : pendingOthers.length === 0 ? (
              <EmptyState
                icon={FiClock}
                title="No Pending Requests"
                subtitle="There are no pending requests from other users"
              />
            ) : (
              <ScrollBox height="max-h-[520px]">
                <motion.div variants={staggerV} initial="hidden" animate="show">
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {pendingOthers.map((r, idx) => (
                        <RequestCard key={r._id} r={r} compact index={idx} />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </ScrollBox>
            )}
          </SectionShell>

          {/* Right: My Requests */}
          <SectionShell
            title="My All Requests"
            subtitle={
              mounted && currentUsername
                ? `Requests created by: ${currentUsername}`
                : "Requests created by:"
            }
            icon={FiFileText}
          >
            {loading ? (
              <SoftSpinner label="Loading my requests..." />
            ) : myRequests.length === 0 ? (
              <EmptyState
                icon={FiFileText}
                title="No Requests"
                subtitle="You haven’t created any requests yet"
              />
            ) : (
              <ScrollBox height="max-h-[520px]">
                <motion.div variants={staggerV} initial="hidden" animate="show">
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {myRequests.map((r, idx) => (
                        <RequestCard key={r._id} r={r} compact index={idx} />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </ScrollBox>
            )}
          </SectionShell>
        </motion.div>

        {/* ===== Bottom: Archive + Search ===== */}
        <motion.div
          variants={staggerV}
          initial="hidden"
          animate="show"
          className="mt-6"
        >
          <SectionShell
            title="Archive"
            subtitle="Cancelled requests + Approved/Rejected requests"
            icon={FiSearch}
            right={
              <div className="relative w-full sm:w-96">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600/70" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by code / description / user / type..."
                  className="w-full pl-9 pr-3 py-2 rounded-2xl bg-white/40 backdrop-blur-xl ring-1 ring-white/25 text-sm text-gray-900 placeholder:text-gray-600/70 outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cancelled */}
              <SectionShell
                title="Cancelled Requests"
                subtitle="All cancelled requests"
                icon={FiXCircle}
              >
                {loading ? (
                  <SoftSpinner label="Loading cancelled..." />
                ) : cancelled.length === 0 ? (
                  <motion.div variants={sectionV} className="text-center py-6">
                    <div className="text-sm font-black text-gray-900">
                      No cancelled requests
                    </div>
                    {q?.trim() ? (
                      <div className="text-xs text-gray-800/70 mt-1">
                        Try another keyword
                      </div>
                    ) : null}
                  </motion.div>
                ) : (
                  <ScrollBox height="max-h-[620px]">
                    <motion.div variants={staggerV} initial="hidden" animate="show">
                      <div className="grid grid-cols-1 gap-4">
                        <AnimatePresence initial={false}>
                          {cancelled.map((r, idx) => (
                            <RequestCard key={r._id} r={r} index={idx} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </ScrollBox>
                )}
              </SectionShell>

              {/* Approved + Rejected */}
              <SectionShell
                title="Approved & Rejected Requests"
                subtitle="All approved and rejected requests"
                icon={FiCheckCircle}
              >
                {loading ? (
                  <SoftSpinner label="Loading approved & rejected..." />
                ) : archivedOther.length === 0 ? (
                  <motion.div variants={sectionV} className="text-center py-6">
                    <div className="text-sm font-black text-gray-900">
                      No approved/rejected requests
                    </div>
                    {q?.trim() ? (
                      <div className="text-xs text-gray-800/70 mt-1">
                        Try another keyword
                      </div>
                    ) : null}
                  </motion.div>
                ) : (
                  <ScrollBox height="max-h-[620px]">
                    <motion.div variants={staggerV} initial="hidden" animate="show">
                      <div className="grid grid-cols-1 gap-4">
                        <AnimatePresence initial={false}>
                          {archivedOther.map((r, idx) => (
                            <RequestCard key={r._id} r={r} index={idx} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </ScrollBox>
                )}
              </SectionShell>
            </div>
          </SectionShell>
        </motion.div>
      </div>

      {/* Modal */}
      {canCreate && (
        <CreateRequestModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          companyKey={companyKey}
          onCreated={async () => {
            await fetchRequests();
          }}
        />
      )}
    </motion.div>
  );
}