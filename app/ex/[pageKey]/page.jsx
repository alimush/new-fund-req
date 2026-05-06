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
  FiRefreshCcw,
} from "react-icons/fi";
import { useRouter, useParams } from "next/navigation";
import { getExForm } from "@/lib/exForms/registry";

// ✅ Permissions
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

// ✅ نفس اللي تستخدمه بصفحة Requests
import StatusBadge from "@/components/StatusBadge";

// ✅ Create Modal / Generator (مثل ما عندك)
import ReplaceBookingTransferGenerator from "@/components/ex/ReplaceBookingTransferGenerator";

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

function formatDate(v) {
  try {
    if (!v) return "-";
    const d = typeof v === "string" || typeof v === "number" ? new Date(v) : v;
    if (!d || isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  } catch {
    return String(v || "-");
  }
}

function pickFirst(obj, keys = []) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function buildCardLines(r, cfg) {
  const fields = Array.isArray(cfg?.fields) ? cfg.fields : [];

  const ignore = new Set([
    "customerName",
    "name",
    "fullName",
    "clientName",
    "createdBy",
    "createdById",
    "attachments",
    "_id",
    "pageKey",
    "workflow",
    "currentStep",
    "status",
    "__v",
    "updatedAt",
    "createdAt",
  ]);

  // ✅ formatter بسيط للقيم
  const formatValue = (val) => {
    if (val === undefined || val === null) return "";

    // Date object
    if (val instanceof Date) return formatDate(val);

    // arrays
    if (Array.isArray(val)) {
      if (!val.length) return "";
      // إذا array نصوص/أرقام
      if (val.every((x) => ["string", "number", "boolean"].includes(typeof x))) {
        const s = val.join(", ");
        return s.length > 60 ? s.slice(0, 60) + "…" : s;
      }
      // array objects -> تجاهل حتى لا يخرب الكارد
      return "";
    }

    // objects
    if (typeof val === "object") {
      // إذا object بسيط مثل {label,value} أو {name}
      const maybe =
        val?.label ??
        val?.name ??
        val?.title ??
        val?.value ??
        val?.text ??
        "";
      if (maybe) return String(maybe);
      return "";
    }

    // primitives
    const s = String(val).trim();
    if (!s) return "";

    // إذا القيمة تبدو تاريخ
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
      return formatDate(s);
    }

    return s;
  };

  const candidates = fields
    .map((f) => ({
      name: f?.name,
      label: f?.label || f?.name,
      type: f?.type,
    }))
    .filter((f) => f.name && !ignore.has(f.name));

  const lines = [];

  for (const c of candidates) {
    const raw = r?.[c.name];
    let v = formatValue(raw);
    if (!v) continue;

    // ✅ قص أطول من 60
    v = v.length > 60 ? v.slice(0, 60) + "…" : v;

    lines.push({ label: c.label, value: v });
    if (lines.length >= 3) break;
  }

  // ✅ fallback إذا ماكو شي ينعرض
  if (!lines.length) {
    const fallbackPairs = [
      { label: "الوحدة القديمة", value: r?.oldUnitNo },
      { label: "الوحدة الجديدة", value: r?.newUnitNo },
      { label: "المبلغ", value: r?.amountNumber },
      { label: "التاريخ", value: r?.dateDMY || r?.createdAt },
    ];

    for (const x of fallbackPairs) {
      const v = formatValue(x.value);
      if (!v) continue;
      lines.push({ label: x.label, value: v.length > 60 ? v.slice(0, 60) + "…" : v });
      if (lines.length >= 3) break;
    }
  }

  return lines;
}

export default function ExListPage() {
  const router = useRouter();
  const params = useParams();

  const pageKey = String(params?.pageKey || "").trim();
  const cfg = useMemo(() => getExForm(pageKey), [pageKey]);

  // ✅ صلاحية Create
  const { permissions, user } = usePermissions();
  const canCreate =
    Array.isArray(permissions) && permissions.includes(PERMISSIONS.EX_Create_Request);

  const currentUsername = useMemo(() => {
    return user?.username || "";
  }, [user]);

  const currentUserId = useMemo(() => {
    return user?.id || "";
  }, [user]);

  // ===== Data =====
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== Create Modal =====
  const [openCreate, setOpenCreate] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  // ===== Search =====
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // ===== My status filter (ONLY on My Requests) =====
  const [myStatus, setMyStatus] = useState("all"); // all|approved|pending|rejected|cancelled

  // ===== Pagination =====
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

  // ===== Fetch =====
  const fetchAll = useCallback(async () => {
    if (!pageKey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ex/${encodeURIComponent(pageKey)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      setItems(j?.success && Array.isArray(j.data) ? j.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [pageKey]);

  useEffect(() => {
    if (!pageKey) return;
    fetchAll();
  }, [pageKey, fetchAll]);

  // ===== Suggestion Pool =====
  const suggestionPool = useMemo(() => {
    const set = new Set();
    const out = [];

    const fields = Array.isArray(cfg?.fields) ? cfg.fields.map((f) => f?.name).filter(Boolean) : [];
    const baseKeys = [
      "customerName",
      "oldUnitNo",
      "newUnitNo",
      "amountNumber",
      "amountWords",
      "createdBy",
      "createdById",
      "_id",
      "pageKey",
      "dateDMY",
      "createdAt",
      "status",
    ];
    const keys = Array.from(new Set([...fields, ...baseKeys]));

    for (const r of items || []) {
      for (const k of keys) {
        const v = r?.[k];
        if (!v) continue;
        const s = String(v).trim();
        if (!s) continue;
        const key = s.toLowerCase();
        if (set.has(key)) continue;
        set.add(key);
        out.push(s);
      }
    }
    return out;
  }, [items, cfg]);

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

  // ===== Apply Search (client-side) =====
  const appliedFiltered = useMemo(() => {
    const q = norm(appliedSearch);
    if (!q) return items;

    const fields = Array.isArray(cfg?.fields) ? cfg.fields.map((f) => f?.name).filter(Boolean) : [];
    const baseKeys = [
      "customerName",
      "oldUnitNo",
      "newUnitNo",
      "amountNumber",
      "amountWords",
      "createdBy",
      "createdById",
      "_id",
      "pageKey",
      "dateDMY",
      "createdAt",
      "status",
    ];
    const keys = Array.from(new Set([...fields, ...baseKeys]));

    return (items || []).filter((r) => {
      const hay = keys.map((k) => r?.[k]).filter(Boolean).join(" | ");
      return norm(hay).includes(q);
    });
  }, [items, appliedSearch, cfg]);

  // ===== Split: Pending / Mine =====
  const pendingApprovals = useMemo(() => {
    return (appliedFiltered || []).filter(isPendingWithMe);
  }, [appliedFiltered, isPendingWithMe]);

  const myRequestsAll = useMemo(() => {
    return (appliedFiltered || []).filter(isMine);
  }, [appliedFiltered, isMine]);

  // ===== My status filter only on My Requests =====
  const myRequests = useMemo(() => {
    const st = norm(myStatus || "all");
    if (!st || st === "all") return myRequestsAll;

    return (myRequestsAll || []).filter((r) => {
      const rs = norm(r?.status);
      return rs === st;
    });
  }, [myRequestsAll, myStatus]);

  // ===== Stats (من طلباتي الحالية بعد الفلتر) =====
  const stats = useMemo(() => {
    if (pageKey === "attachment-only") {
      const attachmentsCount = myRequestsAll.reduce(
        (sum, r) => sum + (Array.isArray(r?.attachments) ? r.attachments.length : 0),
        0
      );
  
      return { total: myRequestsAll.length, attachmentsCount };
    }
  
    const total = myRequestsAll.length;
    const approved = myRequestsAll.filter((r) => norm(r.status) === "approved").length;
    const pending = myRequestsAll.filter((r) => norm(r.status) === "pending").length;
  
    return { total, approved, pending, attachmentsCount: 0 };
  }, [myRequestsAll, pageKey]);

  // ===== Pagination computed + clamp =====
  const myPaged = useMemo(() => paginate(myRequests, pageMy, PAGE_SIZE), [myRequests, pageMy]);
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

  // ===== Suggestions Portal =====
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

  // ===== Cards / Shells (نفس ستايل Requests) =====
  const ExCard = ({ r }) => {
    const dateText = formatDate(r?.dateDMY || r?.createdAt);
    const title =
      pickFirst(r, ["customerName", "clientName", "fullName", "name", "transfereeName"]) ||
      cfg?.title ||
      (r?.pageKey || pageKey) ||
      "Document";

    const lines = buildCardLines(r, cfg);

    return (
      <div
        onClick={() => router.push(`/ex/${encodeURIComponent(r?.pageKey || pageKey)}/${r._id}`)}
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
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-white/45 via-transparent to-transparent" />

        <div className="relative flex items-start justify-between gap-4">
          {/* LEFT */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
            {(r?.pageKey || pageKey) !== "attachment-only" && (
  <StatusBadge status={r?.status || "pending"} />
)}
              <span className="text-[12px] font-semibold text-gray-600">{dateText}</span>
            </div>

            <div className="mt-2 text-[18px] font-extrabold text-gray-900 line-clamp-1">{title}</div>

            <div className="mt-2 text-[14px] text-gray-800/90 leading-relaxed">
              {lines?.length ? (
                <div className="space-y-1">
                  {lines.map((ln, i) => (
                    <div key={i} className="line-clamp-1">
                      <span className="font-extrabold text-gray-900">{ln.label}:</span>{" "}
                      <span className="font-semibold">{ln.value || "-"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-700/80">-</div>
              )}
            </div>

            <div className="mt-3 text-[12px] font-mono font-semibold text-gray-700/85">
              {r._id}
            </div>
          </div>

          {/* RIGHT */}
          <div className="shrink-0 flex flex-col items-end gap-2">
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
                Created By
              </div>
              <div className="mt-1 text-[14px] font-black text-gray-900 break-words max-w-[180px] text-right">
                {pickFirst(r, ["createdBy", "createdByName", "ownerName", "username"]) || "-"}
              </div>
            </div>

            {Array.isArray(r?.attachments) ? (
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
                Attachments: {r.attachments.length}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3 text-[13px] text-gray-700/85">
          <span className="inline-flex items-center gap-2 min-w-0">
            <FiFileText className="text-[16px]" />
            <span className="truncate max-w-[240px] font-semibold">
              {r?.pageKey || pageKey}
            </span>
          </span>

          <span className="truncate max-w-[55%]">
            Step:{" "}
            <span className="font-extrabold text-gray-900">
              {Number.isInteger(r?.currentStep) && r.currentStep >= 0 ? r.currentStep + 1 : "-"}
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

  // ===== Guards =====
  if (!pageKey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10 font-black text-gray-800">
        Missing pageKey in route.
      </div>
    );
  }

  const pageTitle = cfg?.title || pageKey || "Ex Form";

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
              onClick={() => router.push("/ex/ex-home")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/45 backdrop-blur-xl ring-1 ring-white/35 text-gray-900 shadow-sm hover:bg-white/60"
            >
              <FiArrowLeft /> Back
            </button>

            <div className="flex flex-col gap-1">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                {pageTitle}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-800/80">
                <span className="font-semibold">Key:</span>
                <span className="px-2.5 py-1 rounded-xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-gray-900 font-extrabold">
                  {pageKey}
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
              <FiRefreshCcw /> Refresh
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
                      setShowSuggest(false);
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
                    setShowSuggest(false);
                    setActiveIdx(-1);
                    setSuggestPos((p) => ({ ...p, open: false }));
                  }
                }}
                placeholder="ابحث "
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

        {/* Suggestions Portal */}
        {mounted && showSuggest && suggestPos.open && suggestions.length > 0 ? (
          <SuggestionsPortal />
        ) : null}

        {/* Stats (مثل Requests) */}
        {pageKey === "attachment-only" ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/30 p-4 shadow-[0_16px_45px_-30px_rgba(0,0,0,0.45)]">
      <div className="text-[13px] font-bold text-gray-700/80">عدد المرفقات</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-3xl font-black text-gray-900">{stats.attachmentsCount}</div>
        <div className="h-11 w-11 rounded-2xl bg-white/55 ring-1 ring-white/30 flex items-center justify-center">
          <FiFileText className="text-blue-700 text-xl" />
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
) : (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
    {/* خلي الإحصائيات القديمة هنا مثل ما هي */}
  </div>
)}

        {/* Two columns (نفس Requests) */}
        {pageKey === "attachment-only" ? (
  <div className="grid grid-cols-1 gap-6">
    <SectionShell
      title="الاتاج"
      subtitle="جميع طلبات الاتاج"
      icon={FiFileText}
      right={
        <span className="text-[13px] font-extrabold text-gray-800/70">
          {appliedFiltered.length} items
        </span>
      }
    >
      {loading ? (
        <div className="py-10 text-center font-extrabold text-gray-800/70">
          Loading...
        </div>
      ) : appliedFiltered.length === 0 ? (
        <div className="py-10 text-center font-extrabold text-gray-800/70">
          لا يوجد اتاج
        </div>
      ) : (
        <>
          <ScrollBox>
            <div className="space-y-3">
              {paginate(appliedFiltered, pageMy, PAGE_SIZE).items.map((r) => (
                <ExCard key={r._id} r={r} />
              ))}
            </div>
          </ScrollBox>

          <Pager
            page={paginate(appliedFiltered, pageMy, PAGE_SIZE).page}
            totalPages={paginate(appliedFiltered, pageMy, PAGE_SIZE).totalPages}
            onPage={setPageMy}
          />
        </>
      )}
    </SectionShell>
  </div>
) : (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Pending */}
    <SectionShell
      title="قيد الانتظار للموافقة"
      subtitle="Requests that are pending with you"
      icon={FiClock}
      right={
        <span className="text-[13px] font-extrabold text-gray-800/70">
          {pendingPaged.total} items
        </span>
      }
    >
      {loading ? (
        <div className="py-10 text-center font-extrabold text-gray-800/70">
          Loading...
        </div>
      ) : pendingApprovals.length === 0 ? (
        <div className="py-10 text-center font-extrabold text-gray-800/70">
          لايوجد قيد الانتظار للموافقة
        </div>
      ) : (
        <>
          <ScrollBox>
            <div className="space-y-3">
              {pendingPaged.items.map((r) => (
                <ExCard key={r._id} r={r} />
              ))}
            </div>
          </ScrollBox>

          <Pager
            page={pendingPaged.page}
            totalPages={pendingPaged.totalPages}
            onPage={setPagePending}
          />
        </>
      )}
    </SectionShell>

    {/* My Requests + Status Filter */}
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
        <div className="py-10 text-center font-extrabold text-gray-800/70">
          Loading...
        </div>
      ) : myRequests.length === 0 ? (
        <div className="py-10 text-center font-extrabold text-gray-800/70">
          لا يوجد طلبات حسب الفلتر
        </div>
      ) : (
        <>
          <ScrollBox>
            <div className="space-y-3">
              {myPaged.items.map((r) => (
                <ExCard key={r._id} r={r} />
              ))}
            </div>
          </ScrollBox>

          <Pager
            page={myPaged.page}
            totalPages={myPaged.totalPages}
            onPage={setPageMy}
          />
        </>
      )}
    </SectionShell>
  </div>
)}
      </div>

      {/* ✅ Create Modal (فقط لمن عنده CREATE_REQUEST) */}
      {canCreate && (
        <ReplaceBookingTransferGenerator
          key={`${pageKey}-${createKey}`}
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          formKey={pageKey}
          onCreate={async (payload) => {
            const res = await fetch(`/api/ex/${encodeURIComponent(pageKey)}`, {
              method: "POST",
              credentials: "include",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                pageKey,
                createdBy: currentUsername || "User",
                createdById: currentUserId || "",
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