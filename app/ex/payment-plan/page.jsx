"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FiPlus,
  FiArrowLeft,
  FiFileText,
  FiSearch,
  FiXCircle,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import PaymentPlanA4_Generator from "@/components/ex/payment-plan";

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

  // ===== Data =====
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== Create Modal =====
  const [openCreate, setOpenCreate] = useState(false);
  const [createKey, setCreateKey] = useState(0);

  // ===== Search (controlled + applied) =====
  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // ===== Pagination =====
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

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

  // ✅ hide suggestions on scroll/resize (مثل صفحتك)
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

  // ===== Fetch =====
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // إذا تحب يصير فلترة سيرفر سايد: زيد q=...
      const q = String(appliedSearch || "").trim();
      const url = q ? `/api/ex/payment-plans?q=${encodeURIComponent(q)}` : `/api/ex/payment-plans`;

      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();
      setItems(j?.success && Array.isArray(j.data) ? j.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ===== Suggestions pool (من الداتا الحالية) =====
  const suggestionPool = useMemo(() => {
    const set = new Set();
    const out = [];
    for (const r of items || []) {
      const parts = [r.customer, r.unitNo, r.createdBy, r._id].filter(Boolean).map((x) => String(x).trim());
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
    setPage(1);
  };

  const appliedFiltered = useMemo(() => {
    // إذا سويت فلترة سيرفر سايد، هذا يبقى يشتغل عادي بدون ضرر
    const q = norm(appliedSearch);
    if (!q) return items;
    return (items || []).filter((r) => {
      const hay = [
        r.customer,
        r.unitNo,
        r.createdBy,
        r._id,
        r.pageKey,
      ]
        .filter(Boolean)
        .join(" | ");
      return norm(hay).includes(q);
    });
  }, [items, appliedSearch]);

  const paged = useMemo(() => paginate(appliedFiltered, page, PAGE_SIZE), [appliedFiltered, page]);

  useEffect(() => {
    if (page > paged.totalPages) setPage(paged.totalPages);
  }, [page, paged.totalPages]);

  const currentUsername = useMemo(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("username") || "";
  }, []);

  const totalItems = appliedFiltered.length;

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

  const Card = ({ r }) => {
    const d = r?.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-";
    const createdBy = r?.createdBy || "-";
    return (
      <div
        className="relative cursor-pointer rounded-2xl bg-white/55 backdrop-blur-xl ring-1 ring-white/40 shadow-[0_14px_40px_-18px_rgba(0,0,0,0.28)] hover:bg-white/75 hover:ring-white/60 transition-colors p-5"
        onClick={() => router.push(`/ex/payment-plan/${r._id}`)}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-90" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-gray-700/80">{d}</span>
            </div>

            <div className="mt-2 text-[18px] font-black text-gray-900 line-clamp-1">
              {r.customer || "Payment Plan"}
            </div>

            <div className="mt-2 text-[14px] font-semibold text-gray-800/90 leading-relaxed line-clamp-2">
              {r.unitNo ? `Unit: ${r.unitNo}` : "-"}
            </div>

            <div className="mt-3 text-[12px] font-extrabold font-mono text-gray-700/85 break-all">
              {r._id}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-[12px] font-bold text-gray-600/80">Page Key</div>
            <div className="mt-1 text-[16px] font-black text-gray-900">{r.pageKey || "-"}</div>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3 text-[13px] font-bold text-gray-700/85">
          <span className="inline-flex items-center gap-2">
            <FiFileText className="text-[16px]" />
            <span className="truncate max-w-[240px]">{createdBy}</span>
          </span>

          <span className="truncate max-w-[55%]">
            By: <span className="font-extrabold text-gray-900">{createdBy}</span>
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
    <div className="max-h-[640px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300/60 scrollbar-track-transparent">
      {children}
    </div>
  );

  return (
    <div className="min-h-screen w-full text-[15px] font-bold text-slate-900">
      {/* Background مثل Requests */}
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
                Payment Plans
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-800/80">
                <span className="font-semibold">Showing newest → oldest</span>
                <span className="px-2.5 py-1 rounded-xl bg-white/55 backdrop-blur ring-1 ring-white/30 text-gray-900 font-extrabold">
                  Total: {totalItems}
                </span>
              </div>
              {currentUsername ? (
                <div className="text-[12px] font-bold text-gray-700/70">
                  User: <span className="font-extrabold text-gray-900">{currentUsername}</span>
                </div>
              ) : null}
            </div>
          </div>

          <button
            onClick={() => {
              setCreateKey((k) => k + 1);
              setOpenCreate(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-900/90 backdrop-blur text-white shadow hover:bg-gray-900"
          >
            <FiPlus /> Create
          </button>
        </div>

        {/* Search (نفس ستايل Requests) */}
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
                      setPage(1);
                      fetchAll();
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
                  setPage(1);
                  fetchAll();
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

              {/* ✅ مسح فقط (بدون كانسل) */}
              <button
                onClick={() => {
                  setSearchText("");
                  setAppliedSearch("");
                  setPage(1);
                  closeSuggest();
                  fetchAll();
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

        {/* List Section */}
        <SectionShell
          title="Payment Plans List"
          subtitle="Browse and open plan details"
          icon={FiFileText}
          right={<span className="text-[13px] font-extrabold text-gray-800/70">{paged.total} items</span>}
        >
          {loading ? (
            <div className="py-10 text-center font-extrabold text-gray-800/70">Loading...</div>
          ) : appliedFiltered.length === 0 ? (
            <div className="py-10 text-center font-extrabold text-gray-800/70">لا يوجد بيانات حسب الفلتر</div>
          ) : (
            <>
              <ScrollBox>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  {paged.items.map((r) => (
                    <Card key={r._id} r={r} />
                  ))}
                </div>
              </ScrollBox>

              <Pager page={paged.page} totalPages={paged.totalPages} onPage={setPage} />
            </>
          )}
        </SectionShell>
      </div>

      {/* Create Modal */}
      <PaymentPlanA4_Generator
        key={createKey}
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreate={async (form) => {
          const username = typeof window !== "undefined" ? localStorage.getItem("username") : "";
          const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : "";

          const res = await fetch("/api/ex/payment-plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              pageKey: "exceptions",
              createdBy: username || "User",
              createdById: userId || "",
            }),
          });

          const j = await res.json();

          if (j?.success) {
            setOpenCreate(false);
            await fetchAll();
            setPage(1);
          } else {
            throw new Error(j?.error || "Create failed");
          }
        }}
      />
    </div>
  );
}