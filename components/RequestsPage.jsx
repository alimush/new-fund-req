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
import {
  getApprovalCount,
  getDisbursementCount,
} from "@/lib/notifications/notificationCounts";
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

function CountPill({ count, tone, label }) {
  const n = Number(count) || 0;
  if (!n) return null;
  const toneClass =
    tone === "disbursement"
      ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-[0_6px_14px_-6px_rgba(5,150,105,0.8)]"
      : "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_6px_14px_-6px_rgba(220,38,38,0.85)]";

  return (
    <span
      title={label}
      className={`inline-flex min-h-[26px] items-center gap-1 rounded-full px-2.5 text-[11px] font-black tabular-nums ring-2 ring-white/40 ${toneClass}`}
    >
      {n > 99 ? "99+" : n}
      <span className="hidden sm:inline text-[10px] font-extrabold opacity-95">{label}</span>
    </span>
  );
}

function ScrollBox({ children }) {
  return (
    <div className="max-h-[520px] overflow-y-auto overscroll-y-contain pr-1 scrollbar-thin scrollbar-thumb-gray-300/60 scrollbar-track-transparent">
      {children}
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  icon: Icon,
  right,
  accent,
  badgeCount,
  badgeTone = "approval",
  children,
}) {
  const headerClass =
    accent === "emerald"
      ? "bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-white/20"
      : accent === "red"
        ? "bg-gradient-to-r from-red-500/15 via-rose-500/10 to-white/20"
        : "bg-white/25";
  const iconWrapClass =
    accent === "emerald"
      ? "bg-emerald-500/15 text-emerald-800 ring-emerald-300/45"
      : accent === "red"
        ? "bg-red-500/15 text-red-800 ring-red-300/40"
        : "bg-white/45 text-gray-800 ring-white/30";
  const badgeToneClass =
    badgeTone === "disbursement"
      ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white"
      : "bg-gradient-to-r from-rose-600 to-red-600 text-white";
  const shellClass =
    accent === "emerald"
      ? "bg-emerald-50/30 ring-emerald-200/45"
      : accent === "red"
        ? "bg-red-50/20 ring-red-200/35"
        : "bg-white/40 ring-white/30";

  return (
    <div
      className={`rounded-3xl backdrop-blur-2xl ring-1 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] overflow-hidden ${shellClass}`}
    >
      <div className={`px-5 py-4 ${headerClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <div
                className={`mt-0.5 h-10 w-10 rounded-2xl ring-1 backdrop-blur flex items-center justify-center shrink-0 ${iconWrapClass}`}
              >
                <Icon className="text-xl" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[16px] font-black text-gray-900">{title}</div>
                {Number(badgeCount) > 0 && (
                  <span
                    className={`inline-flex min-h-[24px] items-center rounded-full px-2 text-[11px] font-black tabular-nums ${badgeToneClass}`}
                  >
                    {Number(badgeCount) > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              {subtitle && (
                <div className="text-[13px] font-bold text-gray-700/80">{subtitle}</div>
              )}
            </div>
          </div>
          {right}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function RequestCard({ r, variant = "default", companyKey }) {
  const router = useRouter();
  const isDisbursement = variant === "disbursementPending";
  const dateText = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-";

  const fmt = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }),
    []
  );

  const totalAmount =
    typeof r.totalAmount === "number"
      ? r.totalAmount
      : Array.isArray(r.items)
        ? r.items.reduce(
            (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
            0
          )
        : 0;

  return (
    <div
      onClick={() => router.push(`/requests/${companyKey}/${r._id}`)}
      className={[
        "group relative cursor-pointer rounded-2xl backdrop-blur-xl p-5 transition-all duration-300 hover:-translate-y-[2px]",
        isDisbursement
          ? "bg-gradient-to-br from-emerald-50/95 via-green-50/50 to-white/70 ring-2 ring-emerald-300/50 shadow-[0_12px_35px_-18px_rgba(5,150,105,0.22)] hover:ring-emerald-400/60 hover:shadow-[0_18px_55px_-22px_rgba(5,150,105,0.3)]"
          : "bg-white/60 ring-1 ring-black/5 shadow-[0_12px_35px_-18px_rgba(0,0,0,0.28)] hover:bg-white/75 hover:ring-black/10 hover:shadow-[0_18px_55px_-22px_rgba(0,0,0,0.38)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-white/45 via-transparent to-transparent" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={r.status} />
            <span className="text-[12px] font-semibold text-gray-600">{dateText}</span>
          </div>

          <div className="mt-2 text-[18px] font-extrabold text-gray-900 line-clamp-1">
            {r.requestType || "Request"}
          </div>

          <div className="mt-2 text-[14px] text-gray-800/90 leading-relaxed line-clamp-2">
            {r.description || "-"}
          </div>

          <div className="mt-3 text-[12px] font-mono font-semibold text-gray-700/85">
            {r.requestCode || r._id}
            {r.voucherNo ? (
              <span className="mr-2 text-emerald-700"> · وصل {r.voucherNo}</span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="rounded-xl px-4 py-3 bg-white/35 backdrop-blur-2xl ring-1 ring-white/60 shadow-[0_10px_26px_-16px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:bg-white/45">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Amount
            </div>
            <div className="mt-1 text-[18px] font-black text-gray-900 tabular-nums break-words">
              {fmt.format(totalAmount)}
            </div>
          </div>

          {r.currency ? (
            <div className="rounded-lg px-3 py-1.5 bg-white/55 backdrop-blur-xl ring-1 ring-black/10 shadow-sm text-[12px] font-bold text-gray-700 transition-all duration-300 group-hover:bg-white/70">
              {r.currency}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3 text-[13px] text-gray-700/85">
        <span className="inline-flex items-center gap-2 min-w-0">
          <FiFileText className="text-[16px]" />
          <span className="truncate max-w-[240px] font-semibold">{r.company || companyKey}</span>
        </span>

        <span className="truncate max-w-[55%]">
          By: <span className="font-extrabold text-gray-900">{r.createdBy || "Unknown"}</span>
        </span>
      </div>
    </div>
  );
}

export default function RequestsPage({ companyKey }) {
  const router = useRouter();
  const { permissions, companies, user, permissionsLoaded } = usePermissions();

  const canCreate =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.CREATE_REQUEST);

  const canViewReceipts =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.RECEIPTS);

  const canDelegateVoucher =
    Array.isArray(permissions) &&
    permissions.includes(PERMISSIONS.VOUCHER_DELEGATE);

  const PAGE_SIZE = 20;

  // ===== Access Guard =====
  const [accessChecked, setAccessChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!companyKey) return;

    // انتظر اكتمال /api/user-permissions — companies=[] قبل التحميل لا تعني رفض صلاحية
    if (!permissionsLoaded) {
      setAccessChecked(false);
      setAccessDenied(false);
      return;
    }

    if (!user?.id) {
      setAccessChecked(false);
      setAccessDenied(false);
      return;
    }

    if (!Array.isArray(companies)) return;

    const ok = companies.some((x) => norm(x) === norm(companyKey));

    if (!ok) {
      setAccessDenied(true);
      setAccessChecked(false);
      router.replace("/home");
      return;
    }

    setAccessDenied(false);
    setAccessChecked(true);
  }, [companyKey, companies, user?.id, permissionsLoaded, router]);

  const currentUsername = useMemo(() => {
    return user?.username || "";
  }, [user]);

  // ===== Search (controlled) =====
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // ===== My status filter (ONLY on My Requests) =====
  const [myStatus, setMyStatus] = useState("all"); // all|approved|pending|rejected|cancelled

  // ===== Data =====
  const [myRequests, setMyRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [delegatedRequests, setDelegatedRequests] = useState([]);
  const [disbursedByMe, setDisbursedByMe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifyCounts, setNotifyCounts] = useState(null);

  const notifyApproval = getApprovalCount(notifyCounts || {}, companyKey);
  const notifyDisbursement =
    canViewReceipts && !canDelegateVoucher
      ? getDisbursementCount(notifyCounts || {}, companyKey)
      : 0;

  // ===== Pagination =====
  const [pageMy, setPageMy] = useState(1);
  const [pagePending, setPagePending] = useState(1);
  const [pageDelegated, setPageDelegated] = useState(1);
  const [pageDisbursed, setPageDisbursed] = useState(1);

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

  // إخفاء الاقتراحات عند scroll الصفحة (مو داخل صناديق القوائم)
  useEffect(() => {
    const onScroll = (e) => {
      if (!showSuggest) return;
      if (e.target !== document && e.target !== document.documentElement) return;
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
    const all = [
      ...(pendingApprovals || []),
      ...(myRequests || []),
      ...(delegatedRequests || []),
      ...(disbursedByMe || []),
    ];
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
  }, [pendingApprovals, myRequests, delegatedRequests, disbursedByMe]);

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
    setPageDelegated(1);
    setPageDisbursed(1);
  };

  // ===== Fetch =====
  const fetchAll = useCallback(async () => {
    if (!companyKey) return;
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

      const fetches = [
        fetch(mineUrl, { cache: "no-store" }),
        fetch(pendingUrl, { cache: "no-store" }),
      ];
      if (canViewReceipts) {
        const disbursementBase = `/api/receipts/disbursement-report?company=${encodeURIComponent(companyKey)}`;
        const processorPart = user?.id
          ? `&processorUser=${encodeURIComponent(String(user.id))}`
          : "";
        if (canDelegateVoucher) {
          fetches.push(
            fetch(
              `${disbursementBase}&tab=done${processorPart}${qPart}`,
              { cache: "no-store" }
            )
          );
        } else {
          fetches.push(
            fetch(`${disbursementBase}&tab=pending${qPart}`, { cache: "no-store" }),
            fetch(
              `${disbursementBase}&tab=done${processorPart}${qPart}`,
              { cache: "no-store" }
            )
          );
        }
      }

      const responses = await Promise.all(fetches);
      const coreResponses = responses.slice(0, 2);

      const authFailed = coreResponses.some((r) => r.status === 401);
      if (authFailed) {
        router.replace("/login");
        return;
      }

      const coreForbidden = coreResponses.some((r) => r.status === 403);
      if (coreForbidden) {
        setAccessDenied(true);
        setAccessChecked(false);
        router.replace("/home");
        return;
      }

      const jMine = await responses[0].json();
      const jPending = await responses[1].json();

      setMyRequests(jMine?.success && Array.isArray(jMine?.data) ? jMine.data : []);
      setPendingApprovals(jPending?.success && Array.isArray(jPending?.data) ? jPending.data : []);

      if (canViewReceipts) {
        if (canDelegateVoucher) {
          const disbRes = responses[2];
          if (disbRes?.ok) {
            const jDisbursed = await disbRes.json();
            setDisbursedByMe(
              jDisbursed?.success && Array.isArray(jDisbursed?.data)
                ? jDisbursed.data.filter((r) => Boolean(r.voucherNo))
                : []
            );
          } else {
            setDisbursedByMe([]);
          }
          setDelegatedRequests([]);
        } else {
          const delegRes = responses[2];
          const disbRes = responses[3];
          if (delegRes?.ok) {
            const jDelegated = await delegRes.json();
            setDelegatedRequests(
              jDelegated?.success && Array.isArray(jDelegated?.data) ? jDelegated.data : []
            );
          } else {
            setDelegatedRequests([]);
          }
          if (disbRes?.ok) {
            const jDisbursed = await disbRes.json();
            setDisbursedByMe(
              jDisbursed?.success && Array.isArray(jDisbursed?.data)
                ? jDisbursed.data.filter((r) => Boolean(r.voucherNo))
                : []
            );
          } else {
            setDisbursedByMe([]);
          }
        }
      } else {
        setDelegatedRequests([]);
        setDisbursedByMe([]);
      }
    } catch {
      setMyRequests([]);
      setPendingApprovals([]);
      setDelegatedRequests([]);
      setDisbursedByMe([]);
    } finally {
      setLoading(false);
    }
  }, [
    companyKey,
    router,
    appliedSearch,
    myStatus,
    canViewReceipts,
    canDelegateVoucher,
    user?.id,
  ]);

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
    setPageDelegated(1);
    setPageDisbursed(1);
    fetchAll();
  }, [appliedSearch, myStatus]); // eslint-disable-line

  useEffect(() => {
    if (!accessChecked || !companyKey) return;

    let alive = true;

    const loadNotify = async () => {
      try {
        const res = await fetch(
          `/api/notifications/counts?companies=${encodeURIComponent(companyKey)}`,
          { cache: "no-store", credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok && data?.success) setNotifyCounts(data.counts || {});
        else setNotifyCounts({});
      } catch {
        if (alive) setNotifyCounts({});
      }
    };

    loadNotify();
    const t = setInterval(loadNotify, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [companyKey, accessChecked]);

  // ===== Pagination computed + clamp =====
  const myPaged = useMemo(() => paginate(myRequests, pageMy, PAGE_SIZE), [myRequests, pageMy]);
  const pendingPaged = useMemo(() => paginate(pendingApprovals, pagePending, PAGE_SIZE), [pendingApprovals, pagePending]);
  const delegatedPaged = useMemo(
    () => paginate(delegatedRequests, pageDelegated, PAGE_SIZE),
    [delegatedRequests, pageDelegated]
  );
  const disbursedPaged = useMemo(
    () => paginate(disbursedByMe, pageDisbursed, PAGE_SIZE),
    [disbursedByMe, pageDisbursed]
  );

  useEffect(() => {
    if (pageMy > myPaged.totalPages) setPageMy(myPaged.totalPages);
  }, [pageMy, myPaged.totalPages]);

  useEffect(() => {
    if (pagePending > pendingPaged.totalPages) setPagePending(pendingPaged.totalPages);
  }, [pagePending, pendingPaged.totalPages]);
  useEffect(() => {
    if (pageDelegated > delegatedPaged.totalPages) setPageDelegated(delegatedPaged.totalPages);
  }, [pageDelegated, delegatedPaged.totalPages]);
  useEffect(() => {
    if (pageDisbursed > disbursedPaged.totalPages) setPageDisbursed(disbursedPaged.totalPages);
  }, [pageDisbursed, disbursedPaged.totalPages]);

  // ===== Stats (من طلباتي الحالية بعد فلتر السيرفر) =====
  const stats = useMemo(() => {
    const total = myRequests.length;
    const approved = myRequests.filter((r) => norm(r.status) === "approved").length;
    const pending = myRequests.filter((r) => norm(r.status) === "pending").length;
    return { total, approved, pending };
  }, [myRequests]);

  if (!accessChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600 font-bold">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }
  if (accessDenied) return null;

  return (
    <div className="min-h-screen w-full text-[15px] font-bold text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6 sm:px-6">
        {/* Header */}
        <div className="rounded-3xl bg-white/45 p-4 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.35)] ring-1 ring-white/35 backdrop-blur-2xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 backdrop-blur-xl ring-1 ring-white/35 text-gray-900 shadow-sm hover:bg-white/60"
            >
              <FiArrowLeft /> Back
            </button>

            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                Fund Requests
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-800/80">
                <span className="font-semibold">الشركة:</span>
                <span className="max-w-[180px] truncate px-2.5 py-1 rounded-xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-gray-900 font-extrabold sm:max-w-none">
                  {companyKey}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <CountPill count={notifyApproval} tone="approval" label="قيد الموافقة" />
                {canViewReceipts && !canDelegateVoucher && (
                  <CountPill
                    count={notifyDisbursement}
                    tone="disbursement"
                    label="قيد الصرف"
                  />
                )}
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
        </div>

        {/* Search */}
        <div className="rounded-3xl bg-white/50 backdrop-blur-2xl ring-1 ring-white/35 shadow-sm p-4 sm:p-5">
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
                  setPageDelegated(1);
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

        {mounted && showSuggest && suggestPos.open && suggestions.length > 0
          ? createPortal(
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
            )
          : null}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white/50 backdrop-blur-2xl ring-1 ring-white/35 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
            <div className="text-[13px] font-bold text-gray-700/80">طلباتي الموافق عليها</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-3xl font-black text-gray-900">{stats.approved}</div>
              <div className="h-11 w-11 rounded-2xl bg-white/55 ring-1 ring-white/30 flex items-center justify-center">
                <FiCheckCircle className="text-green-700 text-xl" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/50 backdrop-blur-2xl ring-1 ring-white/35 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
            <div className="text-[13px] font-bold text-gray-700/80">طلباتي قيد الانتظار</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-3xl font-black text-gray-900">{stats.pending}</div>
              <div className="h-11 w-11 rounded-2xl bg-white/55 ring-1 ring-white/30 flex items-center justify-center">
                <FiClock className="text-amber-700 text-xl" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/50 backdrop-blur-2xl ring-1 ring-white/35 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
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
            accent="red"
            badgeCount={notifyApproval}
            badgeTone="approval"
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
                      <RequestCard key={r._id} r={r} companyKey={companyKey} />
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
                      <RequestCard key={r._id} r={r} companyKey={companyKey} />
                    ))}
                  </div>
                </ScrollBox>

                <Pager page={myPaged.page} totalPages={myPaged.totalPages} onPage={setPageMy} />
              </>
            )}
          </SectionShell>
        </div>

        {canViewReceipts && (
          <div
            className={
              canDelegateVoucher
                ? "grid grid-cols-1 gap-6"
                : "grid grid-cols-1 lg:grid-cols-2 gap-6"
            }
          >
          {!canDelegateVoucher && (
          <SectionShell
            title="قيد الانتظار للصرف"
            subtitle="نفس تقرير تتبع الصرف — قيد انتظار الصرف"
            icon={FiCheckCircle}
            accent="emerald"
            badgeCount={notifyDisbursement}
            badgeTone="disbursement"
            right={
              <span className="text-[13px] font-extrabold text-gray-800/70">
                {delegatedPaged.total} items
              </span>
            }
          >
            {loading ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">Loading...</div>
            ) : delegatedRequests.length === 0 ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">
                لا يوجد طلبات قيد الانتظار للصرف
              </div>
            ) : (
              <>
                <ScrollBox>
                  <div className="space-y-3">
                    {delegatedPaged.items.map((r) => (
                      <RequestCard key={r._id} r={r} variant="disbursementPending" companyKey={companyKey} />
                    ))}
                  </div>
                </ScrollBox>
                <Pager
                  page={delegatedPaged.page}
                  totalPages={delegatedPaged.totalPages}
                  onPage={setPageDelegated}
                />
              </>
            )}
          </SectionShell>
          )}

          <SectionShell
            title="صرفتها أنا"
              subtitle="طلبات صرفتها أنت على آخر خطوة (مسجّل باسمك على الخطوة) وما زال وصلها موجود"
            icon={FiCheckCircle}
            right={
              <span className="text-[13px] font-extrabold text-gray-800/70">
                {disbursedPaged.total} items
              </span>
            }
          >
            {loading ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">Loading...</div>
            ) : disbursedByMe.length === 0 ? (
              <div className="py-10 text-center font-extrabold text-gray-800/70">
                لا يوجد طلبات صرفتها بعد
              </div>
            ) : (
              <>
                <ScrollBox>
                  <div className="space-y-3">
                    {disbursedPaged.items.map((r) => (
                      <RequestCard key={`disbursed-${r._id}`} r={r} companyKey={companyKey} />
                    ))}
                  </div>
                </ScrollBox>
                <Pager
                  page={disbursedPaged.page}
                  totalPages={disbursedPaged.totalPages}
                  onPage={setPageDisbursed}
                />
              </>
            )}
          </SectionShell>
          </div>
        )}
      </div>

      {canCreate && (
        <CreateRequestModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          companyKey={companyKey}
          onCreated={async () => {
            await fetchAll();
          }}
        />
      )}
    </div>
  );
}