"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiLink,
  FiSearch,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
} from "react-icons/fi";
import { PERMISSIONS } from "@/lib/permission";
import { usePermissions } from "@/context/PermissionContext";
import { useToast } from "@/components/ui/ToastProvider";

const ISSUE_LABELS = {
  no_voucher: "لا يوجد وصل في النظام",
  missing_step_id: "وصل موجود — voucherId ناقص على الطلب",
  step_mismatch: "ربط غير متطابق بين الطلب والوصل",
};

function fmtAmount(n, currency = "IQD") {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return `${v.toLocaleString("en-US")} ${currency}`;
}

export default function AdminVoucherLinksPage() {
  const router = useRouter();
  const { companies } = usePermissions();
  const { showToast } = useToast();

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, page: 1, pageSize: 25 });
  const [apiCompanies, setApiCompanies] = useState([]);

  const [companyFilter, setCompanyFilter] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [appliedCompany, setAppliedCompany] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [voucherQuery, setVoucherQuery] = useState("");
  const [voucherResults, setVoucherResults] = useState([]);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const companyOptions = useMemo(() => {
    const merged = [
      ...new Set(
        [...(apiCompanies || []), ...(companies || [])]
          .map((c) => String(c || "").trim())
          .filter(Boolean)
      ),
    ];
    return merged.sort();
  }, [apiCompanies, companies]);

  useEffect(() => {
    const guard = async () => {
      try {
        const res = await fetch("/api/user-permissions", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
        if (!perms.includes(PERMISSIONS.MANAGE_PERMISSIONS)) {
          router.replace("/home");
          return;
        }
        setAuthorized(true);
      } catch {
        router.replace("/home");
      }
    };
    guard();
  }, [router]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ resource: "requests" });
      if (appliedCompany) params.set("company", appliedCompany);
      if (appliedCode.trim()) params.set("requestCode", appliedCode.trim());
      params.set("page", String(meta.page));
      params.set("pageSize", String(meta.pageSize));

      const res = await fetch(`/api/admin/voucher-links?${params}`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        router.replace("/home");
        return;
      }
      const json = await res.json();
      if (json?.success) {
        setRows(Array.isArray(json.data) ? json.data : []);
        setMeta((m) => ({ ...m, ...(json.meta || {}) }));
        if (Array.isArray(json.filters?.companies)) {
          setApiCompanies(json.filters.companies);
        }
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [appliedCompany, appliedCode, meta.page, meta.pageSize, router]);

  useEffect(() => {
    if (!authorized) return;
    fetchRequests();
  }, [authorized, fetchRequests]);

  const searchVouchers = useCallback(async () => {
    if (!selectedRequest) return;
    setVoucherLoading(true);
    setSelectedVoucher(null);
    try {
      const params = new URLSearchParams({
        resource: "vouchers",
        companyKey: selectedRequest.companyKey,
        requestId: selectedRequest._id,
      });
      if (voucherQuery.trim()) params.set("q", voucherQuery.trim());

      const res = await fetch(`/api/admin/voucher-links?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.success) {
        setVoucherResults(Array.isArray(json.data) ? json.data : []);
      } else {
        setVoucherResults([]);
        showToast(json?.error || "تعذر البحث عن وصولات", "error");
      }
    } catch {
      setVoucherResults([]);
      showToast("خطأ في البحث", "error");
    } finally {
      setVoucherLoading(false);
    }
  }, [selectedRequest, voucherQuery, showToast]);

  useEffect(() => {
    if (!selectedRequest) {
      setVoucherResults([]);
      setSelectedVoucher(null);
      return;
    }
    const t = setTimeout(() => {
      searchVouchers();
    }, 300);
    return () => clearTimeout(t);
  }, [selectedRequest, searchVouchers]);

  const applyFilters = () => {
    setAppliedCompany(companyFilter);
    setAppliedCode(codeInput);
    setMeta((m) => ({ ...m, page: 1 }));
    setSelectedRequest(null);
    setSelectedVoucher(null);
  };

  const handleLink = async () => {
    if (!selectedRequest || !selectedVoucher) {
      showToast("اختر الطلب والوصل", "error");
      return;
    }
    setLinking(true);
    try {
      const res = await fetch("/api/admin/voucher-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestCompanyKey: selectedRequest.companyKey,
          requestId: selectedRequest._id,
          voucherId: selectedVoucher._id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        showToast(json?.error || "فشل الربط", "error");
        return;
      }
      showToast(`تم الربط — وصل ${json.voucherNo || selectedVoucher.voucherNo}`, "success");
      setSelectedRequest(null);
      setSelectedVoucher(null);
      setVoucherQuery("");
      fetchRequests();
    } catch {
      showToast("خطأ في الربط", "error");
    } finally {
      setLinking(false);
    }
  };

  if (!authorized) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center text-gray-600"
      >
        جاري التحقق من الصلاحيات...
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto mb-6"
      >
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
          <FiLink className="text-emerald-600" />
          ربط الوصولات بالطلبات
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          طلبات معتمدة بدون ربط وصل صحيح — اختر الطلب ثم رقم الوصل
        </p>
      </motion.div>

      <div className="max-w-7xl mx-auto mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">الشركة</label>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">الكل</option>
            {companyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">كود الطلب</label>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="WAS-AL-GHADEER-..."
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm min-w-[200px]"
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold"
        >
          <FiSearch />
          تطبيق
        </button>
        <button
          type="button"
          onClick={() => fetchRequests()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold"
        >
          <FiRefreshCw />
          تحديث
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests list */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white shadow-lg overflow-hidden">
          <motion.div className="px-4 py-3 border-b bg-gray-50/80 font-extrabold text-gray-800">
            طلبات تحتاج ربط ({meta.total})
          </motion.div>
          {loading ? (
            <p className="p-6 text-center text-gray-500">جاري التحميل...</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-gray-500">لا توجد طلبات مطابقة</p>
          ) : (
            <ul className="max-h-[520px] overflow-y-auto divide-y">
              {rows.map((r) => {
                const active = selectedRequest?._id === r._id;
                return (
                  <li key={r._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequest(r);
                        setSelectedVoucher(null);
                        setVoucherQuery("");
                      }}
                      className={`w-full text-right p-4 transition ${
                        active ? "bg-emerald-50 ring-1 ring-inset ring-emerald-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <motion.div className="font-mono font-bold text-gray-900">{r.requestCode || r._id}</motion.div>
                      <motion.div className="text-sm text-gray-700 mt-1 line-clamp-2">{r.description || "-"}</motion.div>
                      <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-2">
                        <span>{r.companyKey}</span>
                        <span>{fmtAmount(r.amount, r.currency)}</span>
                        {r.voucherProcessedAt ? (
                          <span className="text-amber-700">مصروف</span>
                        ) : null}
                      </div>
                      <div className="text-xs mt-1 text-rose-700 font-semibold">
                        {ISSUE_LABELS[r.linkIssue] || r.linkIssue}
                        {r.linkedVoucherNo ? ` · وصل DB: ${r.linkedVoucherNo}` : ""}
                        {r.stepVoucherNo ? ` · خطوة: ${r.stepVoucherNo}` : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t text-sm">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setMeta((m) => ({ ...m, page: m.page - 1 }))}
                className="flex items-center gap-1 disabled:opacity-40"
              >
                <FiChevronRight />
                السابق
              </button>
              <span>
                {meta.page} / {meta.totalPages}
              </span>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setMeta((m) => ({ ...m, page: m.page + 1 }))}
                className="flex items-center gap-1 disabled:opacity-40"
              >
                التالي
                <FiChevronLeft />
              </button>
            </div>
          )}
        </div>

        {/* Voucher picker */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50/80 font-extrabold text-gray-800">
            اختيار الوصل
          </div>
          {!selectedRequest ? (
            <p className="p-6 text-center text-gray-500">اختر طلباً من القائمة</p>
          ) : (
            <div className="p-4">
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm">
                <div className="font-mono font-bold">{selectedRequest.requestCode}</div>
                <div className="text-gray-600 mt-1">{selectedRequest.description}</div>
                <div className="text-xs mt-2 text-gray-500">
                  {fmtAmount(selectedRequest.amount, selectedRequest.currency)}
                </div>
              </div>

              <label className="text-xs font-bold text-gray-600 block mb-1">بحث برقم الوصل</label>
              <input
                value={voucherQuery}
                onChange={(e) => setVoucherQuery(e.target.value)}
                placeholder="00195 أو 195"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3"
              />

              {voucherLoading ? (
                <p className="text-center text-gray-500 py-4">جاري البحث...</p>
              ) : voucherResults.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm">
                  لا وصولات غير مربوطة مطابقة — جرّب رقماً آخر
                </p>
              ) : (
                <ul className="max-h-[320px] overflow-y-auto divide-y border rounded-xl">
                  {voucherResults.map((v) => {
                    const active = selectedVoucher?._id === v._id;
                    return (
                      <li key={v._id}>
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(v)}
                          className={`w-full text-right p-3 text-sm transition ${
                            active ? "bg-emerald-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="font-mono font-extrabold text-lg">
                            {v.voucherNo}
                            {v.isLinked ? (
                              <span className="text-xs text-amber-600 mr-2">(مربوط مسبقاً)</span>
                            ) : null}
                          </div>
                          <div className="text-gray-600 mt-1">{v.description || "-"}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {fmtAmount(v.amount, v.currency)} · {v.companyKey}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <button
                type="button"
                disabled={!selectedVoucher || linking}
                onClick={handleLink}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white font-extrabold disabled:opacity-50"
              >
                <FiCheck />
                {linking ? "جاري الربط..." : "ربط الوصل بالطلب"}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
