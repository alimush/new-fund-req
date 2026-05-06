"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiPlus,
  FiArrowLeft,
  FiClock,
  FiCheckCircle,
  FiFileText,
  FiSearch,
  FiXCircle,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import PaymentPlanA4_Generator from "@/components/ex/payment-plan";

// ✅ Permissions
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

// ✅ نفس صفحة Requests
import StatusBadge from "@/components/StatusBadge";

const norm = (v) => String(v ?? "").trim().toLowerCase();

function paginate(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  return { page: p, totalPages, total, items: list.slice(start, start + pageSize) };
}

function Pager({ page, totalPages, onPage }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className={[
          "px-3 py-2 rounded-2xl text-[13px] font-extrabold ring-1 inline-flex items-center gap-2",
          page <= 1
            ? "bg-gray-200/60 ring-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-white/55 ring-white/30 hover:bg-white/70",
        ].join(" ")}
      >
        <FiChevronLeft /> Prev
      </button>

      <div className="text-[13px] font-extrabold text-gray-800/80">
        Page <span className="text-gray-900">{page}</span> /{" "}
        <span className="text-gray-900">{totalPages}</span>
      </div>

      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className={[
          "px-3 py-2 rounded-2xl text-[13px] font-extrabold ring-1 inline-flex items-center gap-2",
          page >= totalPages
            ? "bg-gray-200/60 ring-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-white/55 ring-white/30 hover:bg-white/70",
        ].join(" ")}
      >
        Next <FiChevronRight />
      </button>
    </div>
  );
}

export default function PaymentPlansPage() {
  const router = useRouter();

  // ✅ Permission hook
  const { permissions, user } = usePermissions();
  const canCreate =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.EX_Create_Request);

  // ===== User =====
  const currentUsername = useMemo(() => user?.username || "", [user]);

  const currentUserId = useMemo(() => user?.id || "", [user]);

  // ===== Data =====
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== Create Modal =====
  const [openCreate, setOpenCreate] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  // ===== Search (controlled + applied) =====
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // ✅ فلتر الستيتس فقط على "طلباتي"
  const [myStatus, setMyStatus] = useState("all"); // all|approved|pending|rejected|cancelled

  // ===== Pagination (خانيتين) =====
  const PAGE_SIZE = 20;
  const [pageMy, setPageMy] = useState(1);
  const [pagePending, setPagePending] = useState(1);

  // ===== Suggestions =====
  const [mounted, setMounted] = useState(false);
  const searchBoxRef = useRef(null);
  const suggestWrapRef = useRef(null);

  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggestPos, setSuggestPos] = useState({ open: false, top: 0, left: 0, width: 0 });

  useEffect(() => setMounted(true), []);

  const updateSuggestPosition = useCallback(() => {
    const el = searchBoxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSuggestPos({ open: true, top: r.bottom + 8, left: r.left, width: r.width });
  }, []);

  const closeSuggest = useCallback(() => {
    setShowSuggest(false);
    setActiveIdx(-1);
    setSuggestions([]);
    setSuggestPos((p) => ({ ...p, open: false }));
  }, []);

  // ✅ hide suggestions on scroll/resize
  useEffect(() => {
    const onScroll = () => {
      if (!showSuggest) return;
      closeSuggest();
    };
    const onResize = () => {
      if (!showSuggest) return;
      updateSuggestPosition();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [showSuggest, closeSuggest, updateSuggestPosition]);

  // ✅ close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      const inSearch = searchBoxRef.current?.contains(e.target);
      const inSuggest = suggestWrapRef.current?.contains(e.target);
      if (inSearch || inSuggest) return;
      if (showSuggest) closeSuggest();
    };

    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [showSuggest, closeSuggest]);

  // ===== Fetch (مثل Requests: يجيب داتا مره وحده، والفلترة تصير بالكلينت) =====
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ex/payment-plans`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      setItems(j?.success && Array.isArray(j.data) ? j.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ===== Suggestions pool =====
  const suggestionPool = useMemo(() => {
    const set = new Set();
    const out = [];
    for (const r of items || []) {
      const parts = [
        r.customer,
        r.unitNo,
        r.createdBy,
        r._id,
        r.status,
        r.pageKey,
      ]
        .filter(Boolean)
        .map((x) => String(x).trim());

      for (const s of parts) {
        const k = s.toLowerCase();
        if (!k) continue;
        if (set.has(k)) continue;
        set.add(k);
        out.push(s);
      }
    }
    return out;
  }, [items]);

  const computeSuggestions = useCallback(
    (text) => {
      const t = String(text || "").trim().toLowerCase();
      if (!t) return [];
      return suggestionPool.filter((x) => String(x).toLowerCase().includes(t)).slice(0, 8);
    },
    [suggestionPool]
  );

  const pickSuggestion = (val) => {
    setSearchText(val);
    setAppliedSearch(String(val || "").trim());
    closeSuggest();
    setPageMy(1);
    setPagePending(1);
  };

  // ===== Apply Search (client-side) =====
  const appliedFiltered = useMemo(() => {
    const q = norm(appliedSearch);
    if (!q) return items;

    return (items || []).filter((r) => {
      const hay = [
        r.customer,
        r.unitNo,
        r.createdBy,
        r._id,
        r.pageKey,
        r.status,
      ]
        .filter(Boolean)
        .join(" | ");
      return norm(hay).includes(q);
    });
  }, [items, appliedSearch]);

  // ===== Helpers: isMine / isPendingWithMe =====
  const isMine = useCallback(
    (r) => {
      const byId = String(r?.createdById || "").trim();
      if (byId && currentUserId && byId === String(currentUserId)) return true;

      const byName = String(r?.createdBy || "").trim().toLowerCase();
      if (byName && currentUsername) {
        const u = String(currentUsername).trim().toLowerCase();
        if (byName === u) return true;
      }
      return false;
    },
    [currentUserId, currentUsername]
  );

  const isPendingWithMe = useCallback(
    (r) => {
      // ✅ يعتمد على نفس شكل الـ EX workflow اللي عندك
      const cs = Number.isInteger(r?.currentStep) ? r.currentStep : -1;
      if (cs < 0) return false;

      const step = r?.workflow?.steps?.[cs];
      const stepStatus = norm(step?.status || "pending");
      if (stepStatus !== "pending") return false;

      const users = Array.isArray(step?.users) ? step.users : [];
      const me = String(currentUserId || "");
      if (!me) return false;

      return users.some((u) => {
        if (!u) return false;
        if (typeof u === "string" || typeof u === "number") return String(u) === me;
        if (typeof u === "object" && u._id) return String(u._id) === me;
        return String(u) === me;
      });
    },
    [currentUserId]
  );

  // ===== Split: Pending / Mine =====
  const pendingApprovals = useMemo(() => {
    return (appliedFiltered || []).filter(isPendingWithMe);
  }, [appliedFiltered, isPendingWithMe]);

  const myPlansAll = useMemo(() => {
    return (appliedFiltered || []).filter(isMine);
  }, [appliedFiltered, isMine]);

  // ===== My status filter only on My Plans =====
  const myPlans = useMemo(() => {
    const st = norm(myStatus || "all");
    if (!st || st === "all") return myPlansAll;

    return (myPlansAll || []).filter((r) => norm(r?.status) === st);
  }, [myPlansAll, myStatus]);

  // ===== Stats (من طلباتي قبل فلتر الستيتس) =====
  const stats = useMemo(() => {
    const total = myPlansAll.length;
    const approved = myPlansAll.filter((r) => norm(r.status) === "approved").length;
    const pending = myPlansAll.filter((r) => norm(r.status) === "pending").length;
    return { total, approved, pending };
  }, [myPlansAll]);

  // ===== Pagination per column =====
  const myPaged = useMemo(() => paginate(myPlans, pageMy, PAGE_SIZE), [myPlans, pageMy]);
  const pendingPaged = useMemo(
    () => paginate(pendingApprovals, pagePending, PAGE_SIZE),
    [pendingApprovals, pagePending]
  );

  useEffect(() => {
    if (pageMy > myPaged.totalPages) setPageMy(myPaged.totalPages);
  }, [pageMy, myPaged.totalPages]);

  useEffect(() => {
    if (pagePending > pendingPaged.totalPages) setPagePending(pendingPaged.totalPages);
  }, [pagePending, pendingPaged.totalPages]);

  const totalItems = appliedFiltered.length;

  const SuggestionsPortal = () => {
    if (!mounted || !showSuggest || !suggestPos.open || !suggestions.length) return null;

    return createPortal(
      <div
        ref={suggestWrapRef}
        style={{
          position: "fixed",
          top: suggestPos.top,
          left: suggestPos.left,
          width: suggestPos.width,
          zIndex: 9999,
        }}
        className="pointer-events-auto"
      >
        <div className="w-full rounded-2xl bg-white/95 backdrop-blur ring-1 ring-black/10 shadow-2xl overflow-hidden">
          <div className="max-h-56 overflow-auto">
            {suggestions.map((s, idx) => (
              <button
                key={`${s}-${idx}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
                className={[
                  "w-full text-left px-4 py-2.5 text-[14px] font-bold",
                  "hover:bg-slate-100",
                  idx === activeIdx ? "bg-slate-100" : "bg-transparent",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const PaymentCard = ({ r }) => {
    const dateText = r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-";
    const createdBy = r?.createdBy || "-";
  
    return (
      <div
        onClick={() => router.push(`/ex/payment-plan/${r._id}`)}
        className="
          group relative cursor-pointer overflow-hidden rounded-2xl
          bg-white/55 backdrop-blur-xl
          ring-1 ring-black/5
          shadow-[0_10px_26px_-18px_rgba(0,0,0,0.22)]
          p-5
          transition-all duration-300
          hover:bg-white/65
          hover:ring-black/10
          hover:shadow-[0_16px_40px_-22px_rgba(0,0,0,0.26)]
          active:scale-[0.995]
        "
      >
        {/* very subtle highlight (مو glow قوي) */}
        <div
          className="
            pointer-events-none absolute inset-0 rounded-2xl
            opacity-0 transition-opacity duration-300
            group-hover:opacity-100
            bg-gradient-to-br from-white/30 via-transparent to-transparent
          "
        />
  
        {/* content */}
        <div className="relative flex items-start justify-between gap-4">
          {/* LEFT */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="transition-transform duration-300 group-hover:scale-[1.02]">
                <StatusBadge status={r?.status || "pending"} />
              </div>
  
              <span className="text-[12px] font-semibold text-gray-600 transition-colors duration-300 group-hover:text-gray-700">
                {dateText}
              </span>
            </div>
  
            <div className="mt-2 text-[18px] font-extrabold text-gray-900 line-clamp-1 transition-colors duration-300 group-hover:text-gray-950">
              {r?.customer || "Payment Plan"}
            </div>
  
            <div className="mt-2 text-[14px] text-gray-800/90 leading-relaxed line-clamp-2 transition-colors duration-300 group-hover:text-gray-900">
              {r?.unitNo ? `Unit: ${r.unitNo}` : "-"}
            </div>
  
            <div className="mt-3 text-[12px] font-mono font-semibold text-gray-700/85 transition-colors duration-300 group-hover:text-gray-800">
              {r?._id}
            </div>
          </div>
  
          {/* RIGHT */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div
              className="
                rounded-xl px-4 py-3
                bg-white/35 backdrop-blur-2xl
                ring-1 ring-white/60
                shadow-[0_8px_20px_-16px_rgba(0,0,0,0.22)]
                transition-all duration-300
                group-hover:bg-white/45
                group-hover:shadow-[0_12px_28px_-18px_rgba(0,0,0,0.24)]
              "
            >
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide transition-colors duration-300 group-hover:text-gray-600">
                Page Key
              </div>
              <div className="mt-1 text-[14px] font-black text-gray-900 break-words max-w-[180px] text-right transition-colors duration-300 group-hover:text-gray-950">
                {r?.pageKey || "-"}
              </div>
            </div>
  
            <div
              className="
                rounded-lg px-3 py-1.5
                bg-white/55 backdrop-blur-xl
                ring-1 ring-black/10
                shadow-sm
                text-[12px] font-bold text-gray-700
                transition-all duration-300
                group-hover:bg-white/70
              "
            >
              By: <span className="font-extrabold text-gray-900">{createdBy}</span>
            </div>
          </div>
        </div>
  
        {/* subtle bottom divider on hover */}
        <div className="pointer-events-none absolute left-5 right-5 bottom-3 h-px bg-gradient-to-r from-transparent via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
    );
  };

  const SectionShell = ({ title, subtitle, icon: Icon, right, children }) => (
    <div className="rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/30 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] overflow-hidden">
      <div className="px-5 py-4 bg-white/25">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="mt-0.5 h-10 w-10 rounded-2xl bg-white/45 ring-1 ring-white/30 backdrop-blur flex items-center justify-center text-gray-800">
                <Icon className="text-xl" />
              </div>
            )}
            <div>
              <div className="text-[16px] font-black text-gray-900">{title}</div>
              {subtitle && <div className="text-[13px] font-bold text-gray-700/80">{subtitle}</div>}
            </div>
          </div>
          {right}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  const ScrollBox = ({ children }) => (
    <div className="max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300/60 scrollbar-track-transparent">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen w-full text-[15px] font-bold text-slate-900">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200" />
      <div className="fixed inset-0 -z-10 opacity-70">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute top-28 right-10 h-80 w-80 rounded-full bg-purple-200/35 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/ex/ex-home")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 backdrop-blur-xl ring-1 ring-white/35 text-gray-900 shadow-sm hover:bg-white/60"
            >
              <FiArrowLeft /> Back
            </button>

            <div className="flex flex-col gap-1">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Payment Plans
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-800/80">
                <span className="font-semibold">Newest → Oldest</span>
                <span className="px-2.5 py-1 rounded-xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-gray-900 font-extrabold">
                  Total (after filter): {totalItems}
                </span>
                {currentUsername ? (
                  <span className="px-2.5 py-1 rounded-xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-gray-900 font-extrabold">
                    User: {currentUsername}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              disabled={loading}
              className={[
                "inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold shadow-sm ring-1",
                loading
                  ? "bg-gray-200 text-gray-500 ring-gray-200 cursor-not-allowed"
                  : "bg-white/55 ring-white/30 hover:bg-white/70",
              ].join(" ")}
            >
              Refresh
            </button>

            {canCreate && (
              <button
                onClick={() => {
                  setCreateKey((k) => k + 1);
                  setOpenCreate(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-900/90 backdrop-blur text-white shadow hover:bg-gray-900"
              >
                <FiPlus /> Create
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/30 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative w-full sm:flex-1" ref={searchBoxRef}>
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600/70" />
              <input
                value={searchText}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchText(v);

                  const list = computeSuggestions(v);
                  setSuggestions(list);
                  setShowSuggest(true);
                  setActiveIdx(-1);
                  updateSuggestPosition();
                  setSuggestPos((p) => ({ ...p, open: true }));
                }}
                onFocus={() => {
                  const list = computeSuggestions(searchText);
                  setSuggestions(list);
                  setShowSuggest(true);
                  setActiveIdx(-1);
                  updateSuggestPosition();
                  setSuggestPos((p) => ({ ...p, open: true }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (showSuggest && suggestions.length && activeIdx >= 0) {
                      pickSuggestion(suggestions[activeIdx]);
                    } else {
                      setAppliedSearch(searchText.trim());
                      closeSuggest();
                      setPageMy(1);
                      setPagePending(1);
                    }
                    return;
                  }

                  if (!showSuggest || !suggestions.length) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIdx((p) => Math.min(p + 1, suggestions.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIdx((p) => Math.max(p - 1, 0));
                  } else if (e.key === "Escape") {
                    closeSuggest();
                  }
                }}
                placeholder="اكتب اسم الزبون / رقم الوحدة / المستخدم..."
                className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-[15px] text-gray-900 placeholder:text-gray-600/70 outline-none focus:ring-2 focus:ring-white/45"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAppliedSearch(searchText.trim());
                  closeSuggest();
                  setPageMy(1);
                  setPagePending(1);
                }}
                disabled={loading}
                className={[
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-extrabold shadow-sm ring-1",
                  loading
                    ? "bg-gray-200 text-gray-500 ring-gray-200 cursor-not-allowed"
                    : "bg-gray-900 text-white ring-gray-900 hover:bg-black",
                ].join(" ")}
              >
                <FiSearch /> بحث
              </button>

              <button
                onClick={() => {
                  setSearchText("");
                  setAppliedSearch("");
                  setMyStatus("all");
                  setPageMy(1);
                  setPagePending(1);
                  closeSuggest();
                }}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/55 ring-1 ring-white/30 text-gray-900 font-extrabold shadow-sm hover:bg-white/70"
              >
                <FiXCircle /> مسح
              </button>
            </div>
          </div>
        </div>

        {mounted && showSuggest && suggestPos.open && suggestions.length > 0 ? <SuggestionsPortal /> : null}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/30 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
            <div className="text-[13px] font-bold text-gray-700/80">طلباتي الموافق عليها</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-3xl font-black text-gray-900">{stats.approved}</div>
              <div className="h-11 w-11 rounded-2xl bg-white/55 ring-1 ring-white/30 flex items-center justify-center">
                <FiCheckCircle className="text-green-700 text-xl" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/30 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
            <div className="text-[13px] font-bold text-gray-700/80">طلباتي قيد الانتظار</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-3xl font-black text-gray-900">{stats.pending}</div>
              <div className="h-11 w-11 rounded-2xl bg-white/55 ring-1 ring-white/30 flex items-center justify-center">
                <FiClock className="text-amber-700 text-xl" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/30 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
            <div className="text-[13px] font-bold text-gray-700/80">مجموع طلباتي</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-3xl font-black text-gray-900">{stats.total}</div>
              <div className="h-11 w-11 rounded-2xl bg-white/55 ring-1 ring-white/30 flex items-center justify-center">
                <FiFileText className="text-blue-700 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending */}
          <SectionShell
            title="قيد الانتظار للموافقة"
            subtitle="Payment plans pending with you"
            icon={FiClock}
            right={<span className="text-[13px] font-extrabold text-gray-800/70">{pendingPaged.total} items</span>}
          >
            {loading ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">Loading...</div>
            ) : pendingApprovals.length === 0 ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">لايوجد قيد الانتظار للموافقة</div>
            ) : (
              <>
                <ScrollBox>
                  <div className="space-y-3">
                    {pendingPaged.items.map((r) => (
                      <PaymentCard key={r._id} r={r} />
                    ))}
                  </div>
                </ScrollBox>

                <Pager page={pendingPaged.page} totalPages={pendingPaged.totalPages} onPage={setPagePending} />
              </>
            )}
          </SectionShell>

          {/* My Plans + Status Filter */}
          <SectionShell
            title="طلباتي"
            subtitle={currentUsername ? `Plans created by: ${currentUsername}` : "Plans created by:"}
            icon={FiFileText}
            right={
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 ring-1 ring-white/30">
                  <FiFilter className="text-gray-700" />
                  <select
                    value={myStatus}
                    onChange={(e) => {
                      setMyStatus(e.target.value);
                      setPageMy(1);
                    }}
                    className="bg-transparent outline-none text-[13px] font-extrabold text-gray-900"
                  >
                    <option value="all">All</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            }
          >
            <div className="sm:hidden mb-3 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 ring-1 ring-white/30">
              <FiFilter className="text-gray-700" />
              <select
                value={myStatus}
                onChange={(e) => {
                  setMyStatus(e.target.value);
                  setPageMy(1);
                }}
                className="bg-transparent outline-none w-full text-[13px] font-extrabold text-gray-900"
              >
                <option value="all">All</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {loading ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">Loading...</div>
            ) : myPlans.length === 0 ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">لا يوجد طلبات حسب الفلتر</div>
            ) : (
              <>
                <ScrollBox>
                  <div className="space-y-3">
                    {myPaged.items.map((r) => (
                      <PaymentCard key={r._id} r={r} />
                    ))}
                  </div>
                </ScrollBox>

                <Pager page={myPaged.page} totalPages={myPaged.totalPages} onPage={setPageMy} />
              </>
            )}
          </SectionShell>
        </div>
      </div>

      {/* Create Modal (حسب الصلاحية) */}
      {canCreate && (
        <PaymentPlanA4_Generator
          key={createKey}
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          onCreate={async (form) => {
            const res = await fetch("/api/ex/payment-plans", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...form,
                pageKey: "exceptions",
                createdBy: user?.username || "User",
                createdById: user?.id || "",
              }),
            });

            const j = await res.json();

            if (j?.success) {
              setOpenCreate(false);
              await fetchAll();
              setPageMy(1);
              setPagePending(1);
            } else {
              throw new Error(j?.error || "Create failed");
            }
          }}
        />
      )}
    </div>
  );
}