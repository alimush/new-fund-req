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
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";
import StatusBadge from "@/components/StatusBadge";
import CreateRequestModal from "@/components/CreateRequestModal";

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
          "px-3 py-2 rounded-2xl text-[13px] font-extrabold ring-1",
          page <= 1
            ? "bg-gray-200/60 ring-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-white/55 ring-white/30 hover:bg-white/70",
        ].join(" ")}
      >
        Prev
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
          "px-3 py-2 rounded-2xl text-[13px] font-extrabold ring-1",
          page >= totalPages
            ? "bg-gray-200/60 ring-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-white/55 ring-white/30 hover:bg-white/70",
        ].join(" ")}
      >
        Next
      </button>
    </div>
  );
}

export default function RequestsPage({ companyKey }) {
  const router = useRouter();
  const { permissions, companies } = usePermissions();

  const canCreate =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.CREATE_REQUEST);

  const PAGE_SIZE = 20;

  // ===== Access Guard =====
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!companyKey) return;
    if (!Array.isArray(companies)) return;

    // إذا الشركات عندك تختلف كـ case، نخلي مقارنة lower
    const ok = companies.map((x) => norm(x)).includes(norm(companyKey));

    if (!ok) {
      setAccessDenied(true);
      router.replace("/home");
      return;
    }

    setAccessDenied(false);
    setAccessChecked(true);
  }, [companyKey, companies, router]);

  const getUserIdOrRedirect = () => {
    const userId =
      typeof window !== "undefined" ? localStorage.getItem("userId") : null;
    if (!userId) {
      router.replace("/login");
      return null;
    }
    return userId;
  };

  const currentUsername = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("username") || "";
  }, []);

  // ===== Search (controlled) =====
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // ===== My status filter (ONLY on My Requests) =====
  const [myStatus, setMyStatus] = useState("all"); // all|approved|pending|rejected|cancelled

  // ===== Data =====
  const [myRequests, setMyRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== Pagination =====
  const [pageMy, setPageMy] = useState(1);
  const [pagePending, setPagePending] = useState(1);

  // ===== Modal =====
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // ===== Suggestions =====
  const [mounted, setMounted] = useState(false);
  const searchBoxRef = useRef(null);

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

  // ✅ نخفي الاقتراحات عند scroll حتى ما يصير “هزّة”
  useEffect(() => {
    const onScroll = () => {
      if (!showSuggest) return;
      setShowSuggest(false);
      setActiveIdx(-1);
      setSuggestPos((p) => ({ ...p, open: false }));
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
  }, [showSuggest, updateSuggestPosition]);

  const suggestWrapRef = useRef(null);

  const closeSuggest = useCallback(() => {
    setShowSuggest(false);
    setActiveIdx(-1);
    setSuggestions([]);
    setSuggestPos((p) => ({ ...p, open: false }));
  }, []);
  
  useEffect(() => {
    const handler = (e) => {
      const inSearch = searchBoxRef.current?.contains(e.target);
      const inSuggest = suggestWrapRef.current?.contains(e.target);
      if (inSearch || inSuggest) return;
      if (showSuggest) closeSuggest();
    };
  
    // ✅ capture: ما يخرب ضغطات السيليكت والازرار
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [showSuggest, closeSuggest]);

  const suggestionPool = useMemo(() => {
    const all = [...(pendingApprovals || []), ...(myRequests || [])];
    const set = new Set();
    const out = [];
    for (const r of all) {
      const items = [
        r.requestCode,
        r.requestType,
        r.description,
        r.department,
        r.currency,
        r.createdBy,
      ]
        .filter(Boolean)
        .map((x) => String(x).trim());

      for (const s of items) {
        const key = s.toLowerCase();
        if (!key) continue;
        if (set.has(key)) continue;
        set.add(key);
        out.push(s);
      }
    }
    return out;
  }, [pendingApprovals, myRequests]);

  const computeSuggestions = useCallback(
    (text) => {
      const t = String(text || "").trim().toLowerCase();
      if (!t) return [];
      return suggestionPool
        .filter((x) => String(x).toLowerCase().includes(t))
        .slice(0, 8);
    },
    [suggestionPool]
  );

  const pickSuggestion = (val) => {
    setSearchText(val); // ✅ يبقى بالانبت
    setAppliedSearch(String(val || "").trim()); // ✅ يفلتر
    setShowSuggest(false);
    setSuggestions([]);
    setActiveIdx(-1);
    setSuggestPos((p) => ({ ...p, open: false }));
    setPageMy(1);
    setPagePending(1);
  };

  // ===== Fetch =====
  const fetchAll = useCallback(async () => {
    if (!companyKey) return;
    const userId = getUserIdOrRedirect();
    if (!userId) return;

    setLoading(true);
    try {
      const base = `/api/requests?company=${encodeURIComponent(companyKey)}`;

      const q = String(appliedSearch || "").trim();
      const qPart = q ? `&q=${encodeURIComponent(q)}` : "";

      // ✅ status فقط على mine
      const st = String(myStatus || "all").toLowerCase();
      const stPart = st && st !== "all" ? `&status=${encodeURIComponent(st)}` : `&status=all`;

      const mineUrl = `${base}&scope=mine${stPart}${qPart}`;
      const pendingUrl = `${base}&scope=pending${qPart}`;

      const [resMine, resPending] = await Promise.all([
        fetch(mineUrl, { cache: "no-store", headers: { "x-user-id": userId } }),
        fetch(pendingUrl, { cache: "no-store", headers: { "x-user-id": userId } }),
      ]);

      if ([401, 403].includes(resMine.status) || [401, 403].includes(resPending.status)) {
        router.replace("/home");
        return;
      }

      const jMine = await resMine.json();
      const jPending = await resPending.json();

      setMyRequests(jMine?.success && Array.isArray(jMine?.data) ? jMine.data : []);
      setPendingApprovals(jPending?.success && Array.isArray(jPending?.data) ? jPending.data : []);
    } catch {
      setMyRequests([]);
      setPendingApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [companyKey, router, appliedSearch, myStatus]);

  // initial load
  useEffect(() => {
    if (!accessChecked || accessDenied) return;
    fetchAll();
  }, [accessChecked, accessDenied, fetchAll]);

  // fetch only when applied search OR myStatus changes
  useEffect(() => {
    if (!accessChecked || accessDenied) return;
    setPageMy(1);
    setPagePending(1);
    fetchAll();
  }, [appliedSearch, myStatus]); // eslint-disable-line

  // ===== Pagination computed + clamp =====
  const myPaged = useMemo(() => paginate(myRequests, pageMy, PAGE_SIZE), [myRequests, pageMy]);
  const pendingPaged = useMemo(() => paginate(pendingApprovals, pagePending, PAGE_SIZE), [pendingApprovals, pagePending]);

  useEffect(() => {
    if (pageMy > myPaged.totalPages) setPageMy(myPaged.totalPages);
  }, [pageMy, myPaged.totalPages]);

  useEffect(() => {
    if (pagePending > pendingPaged.totalPages) setPagePending(pendingPaged.totalPages);
  }, [pagePending, pendingPaged.totalPages]);

  // ===== Stats (من طلباتي الحالية بعد فلتر السيرفر) =====
  const stats = useMemo(() => {
    const total = myRequests.length;
    const approved = myRequests.filter((r) => norm(r.status) === "approved").length;
    const pending = myRequests.filter((r) => norm(r.status) === "pending").length;
    return { total, approved, pending };
  }, [myRequests]);

  if (!accessChecked) return null;
  if (accessDenied) return null;

  const SuggestionsPortal = () => {
    if (!mounted) return null;
    if (!showSuggest) return null;
    if (!suggestPos.open) return null;
    if (!suggestions.length) return null;
  
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
                onMouseDown={(e) => e.preventDefault()} // ✅ يمنع blur قبل click
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

  const RequestCard = ({ r }) => {
    const dateText = r.createdAt
      ? new Date(r.createdAt).toLocaleDateString()
      : "-";
  
    const fmt = useMemo(
      () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
      []
    );
  
    const totalAmount =
      typeof r.totalAmount === "number"
        ? r.totalAmount
        : Array.isArray(r.items)
        ? r.items.reduce(
            (sum, it) =>
              sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
            0
          )
        : 0;
  
    return (
      <div
        onClick={() => router.push(`/requests/${companyKey}/${r._id}`)}
        className="
          group relative cursor-pointer rounded-2xl
          bg-white/60 backdrop-blur-xl
          ring-1 ring-black/5
          shadow-[0_12px_35px_-18px_rgba(0,0,0,0.28)]
          p-5
          transition-all duration-300
          hover:-translate-y-[2px]
          hover:bg-white/75
          hover:ring-black/10
          hover:shadow-[0_18px_55px_-22px_rgba(0,0,0,0.38)]
        "
      >
        {/* glow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-white/45 via-transparent to-transparent" />
  
        <div className="relative flex items-start justify-between gap-4">
          {/* LEFT */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              <span className="text-[12px] font-semibold text-gray-600">
                {dateText}
              </span>
            </div>
  
            <div className="mt-2 text-[18px] font-extrabold text-gray-900 line-clamp-1">
              {r.requestType || "Request"}
            </div>
  
            <div className="mt-2 text-[14px] text-gray-800/90 leading-relaxed line-clamp-2">
              {r.description || "-"}
            </div>
  
            <div className="mt-3 text-[12px] font-mono font-semibold text-gray-700/85">
              {r.requestCode || r._id}
            </div>
          </div>
  
          {/* RIGHT SIDE */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            
            {/* Amount Card */}
            <div
              className="
                rounded-xl px-4 py-3
                bg-white/35 backdrop-blur-2xl
                ring-1 ring-white/60
                shadow-[0_10px_26px_-16px_rgba(0,0,0,0.35)]
                transition-all duration-300
                group-hover:bg-white/45
              "
            >
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Amount
              </div>
  
              <div className="mt-1 text-[18px] font-black text-gray-900 tabular-nums break-words">
                {fmt.format(totalAmount)}
              </div>
            </div>
  
            {/* Currency Card (منفصل تماما) */}
            {r.currency && (
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
                {r.currency}
              </div>
            )}
  
          </div>
        </div>
  
        {/* Bottom Row */}
        <div className="relative mt-4 flex items-center justify-between gap-3 text-[13px] text-gray-700/85">
          <span className="inline-flex items-center gap-2 min-w-0">
            <FiFileText className="text-[16px]" />
            <span className="truncate max-w-[240px] font-semibold">
              {r.company || companyKey}
            </span>
          </span>
  
          <span className="truncate max-w-[55%]">
            By:{" "}
            <span className="font-extrabold text-gray-900">
              {r.createdBy || "Unknown"}
            </span>
          </span>
        </div>
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
              onClick={() => router.push("/home")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 backdrop-blur-xl ring-1 ring-white/35 text-gray-900 shadow-sm hover:bg-white/60"
            >
              <FiArrowLeft /> Back
            </button>

            <div className="flex flex-col gap-1">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Fund Requests
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-800/80">
                <span className="font-semibold">الشركة:</span>
                <span className="px-2.5 py-1 rounded-xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-gray-900 font-extrabold">
                  {companyKey}
                </span>
              </div>
            </div>
          </div>

          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-900/90 backdrop-blur text-white shadow hover:bg-gray-900"
            >
              <FiPlus /> Create Request
            </button>
          )}
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
                      setShowSuggest(false);
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
                    setShowSuggest(false);
                    setActiveIdx(-1);
                    setSuggestPos((p) => ({ ...p, open: false }));
                  }
                }}
                placeholder="اكتب كود / وصف / نوع الطلب..."
                className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-[15px] text-gray-900 placeholder:text-gray-600/70 outline-none focus:ring-2 focus:ring-white/45"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAppliedSearch(searchText.trim())}
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
                  setShowSuggest(false);
                  setSuggestions([]);
                  setActiveIdx(-1);
                  setSuggestPos((p) => ({ ...p, open: false }));
                }}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/55 ring-1 ring-white/30 text-gray-900 font-extrabold shadow-sm hover:bg-white/70"
              >
                <FiXCircle /> مسح
              </button>
            </div>
          </div>

          <div className="mt-3 text-[12px] font-bold text-gray-700/70">
            
          </div>
        </div>

        {/* Suggestions Portal */}
        {mounted && showSuggest && suggestPos.open && suggestions.length > 0 ? (
          <SuggestionsPortal />
        ) : null}

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
            subtitle="Requests that are pending with you"
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
                      <RequestCard key={r._id} r={r} />
                    ))}
                  </div>
                </ScrollBox>

                <Pager page={pendingPaged.page} totalPages={pendingPaged.totalPages} onPage={setPagePending} />
              </>
            )}
          </SectionShell>

          {/* My Requests + Status Filter هنا فقط */}
          <SectionShell
            title="طلباتي"
            subtitle={currentUsername ? `Requests created by: ${currentUsername}` : "Requests created by:"}
            icon={FiFileText}
            right={
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 ring-1 ring-white/30">
                  <FiFilter className="text-gray-700" />
                  <select
                    value={myStatus}
                    onChange={(e) => setMyStatus(e.target.value)}
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
                onChange={(e) => setMyStatus(e.target.value)}
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
            ) : myRequests.length === 0 ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">لا يوجد طلبات حسب الفلتر</div>
            ) : (
              <>
                <ScrollBox>
                  <div className="space-y-3">
                    {myPaged.items.map((r) => (
                      <RequestCard key={r._id} r={r} />
                    ))}
                  </div>
                </ScrollBox>

                <Pager page={myPaged.page} totalPages={myPaged.totalPages} onPage={setPageMy} />
              </>
            )}
          </SectionShell>
        </div>
      </div>

      {canCreate && (
        <CreateRequestModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          companyKey={companyKey}
          userId={typeof window !== "undefined" ? localStorage.getItem("userId") : null}
          onCreated={async () => {
            await fetchAll();
          }}
        />
      )}
    </div>
  );
}