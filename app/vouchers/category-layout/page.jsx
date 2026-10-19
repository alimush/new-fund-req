"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiMove, FiSave } from "react-icons/fi";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS, hasPermission } from "@/lib/permission";
import {
  COMPANIES,
  POS_NEW,
  getCompanyCategoryChecklist,
  getCompanyExtra,
} from "@/lib/voucher/companies";
import {
  buildDefaultCategoryLayoutFields,
  buildDefaultVoucherLayoutFields,
  categoryLayoutKey,
  getFieldLabel,
  mergeCategoryFieldsIntoLayout,
  mergeVoucherLayoutFields,
  parseCategoryLayoutKey,
} from "@/lib/voucher/voucherLayout";

export default function VoucherCategoryLayoutPage() {
  const router = useRouter();
  const { permissions } = usePermissions();
  const canLayout = hasPermission(permissions, PERMISSIONS.VOUCHERS_FIELD_LAYOUT);

  const companiesWithCats = useMemo(
    () => COMPANIES.filter((c) => getCompanyCategoryChecklist(c).length > 0),
    []
  );

  const [companyKey, setCompanyKey] = useState(
    () => companiesWithCats[0]?.key || "Badur-Signature"
  );
  const [previewMode, setPreviewMode] = useState("receipt");
  const [fields, setFields] = useState([]);
  const [allLayoutFields, setAllLayoutFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const paperRef = useRef(null);
  const dragRef = useRef(null);

  const company = useMemo(
    () => companiesWithCats.find((c) => c.key === companyKey) || null,
    [companiesWithCats, companyKey]
  );

  const checklist = useMemo(
    () => getCompanyCategoryChecklist(company),
    [company]
  );

  const currentImg = useMemo(() => {
    if (!company) return "";
    return previewMode === "payment"
      ? company.paymentImg || company.paymentImgJpg
      : company.receiptImg || company.receiptImgJpg;
  }, [company, previewMode]);

  const load = useCallback(async () => {
    if (!company?.key) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ companyKey: company.key });
      const res = await fetch(`/api/vouchers/layout?${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      const EXTRA = getCompanyExtra(company, false);
      const defaults = buildDefaultVoucherLayoutFields({
        company,
        POS: POS_NEW,
        EXTRA,
      });
      const merged = mergeVoucherLayoutFields(
        defaults,
        json?.success ? json.data?.fields || [] : []
      );
      setAllLayoutFields(merged);

      const catDefaults = buildDefaultCategoryLayoutFields(company);
      const catSaved = (merged || []).filter((f) =>
        String(f.key || "").startsWith("cat:")
      );
      const catMerged = mergeVoucherLayoutFields(catDefaults, catSaved);
      // دائماً أظهر المربعات — حتى لو الدمج فاضي نرجع للافتراضي
      setFields(catMerged.length ? catMerged : catDefaults);
    } catch (err) {
      console.error(err);
      setFields(buildDefaultCategoryLayoutFields(company) || []);
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    if (!Array.isArray(permissions)) return;
    if (!canLayout) {
      router.replace("/vouchers");
      return;
    }
    load();
  }, [permissions, canLayout, router, load]);

  const updateField = useCallback((key, patch) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f))
    );
  }, []);

  const startDrag = useCallback(
    (e, fieldKey) => {
      if (!paperRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedKey(fieldKey);

      const rect = paperRef.current.getBoundingClientRect();
      const field = fields.find((f) => f.key === fieldKey);
      if (!field || !rect?.width || !rect?.height) return;

      dragRef.current = {
        key: fieldKey,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: field.left,
        startTop: field.top,
        rectW: rect.width,
        rectH: rect.height,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ((ev.clientX - d.startX) / d.rectW) * 100;
        const dy = ((ev.clientY - d.startY) / d.rectH) * 100;
        updateField(d.key, {
          left: Math.round((d.startLeft + dx) * 100) / 100,
          top: Math.round((d.startTop + dy) * 100) / 100,
        });
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [fields, updateField]
  );

  const save = async () => {
    if (!company?.key) return;
    try {
      setSaving(true);
      const merged = mergeCategoryFieldsIntoLayout(allLayoutFields, fields);
      const res = await fetch("/api/vouchers/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyKey: company.key,
          fields: merged,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "فشل الحفظ");
      }
      if (Array.isArray(json.data?.fields)) {
        setAllLayoutFields(json.data.fields);
        const catDefaults = buildDefaultCategoryLayoutFields(company);
        const catSaved = json.data.fields.filter((f) =>
          String(f.key || "").startsWith("cat:")
        );
        setFields(mergeVoucherLayoutFields(catDefaults, catSaved));
      }
      alert("تم حفظ مواضع جيك بوكس الفئة (صرف + قبض)");
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (!Array.isArray(permissions)) return null;
  if (!canLayout) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/vouchers")}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <FiArrowRight />
            رجوع للوصولات
          </button>

          <div className="text-right">
            <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
              ترتيب جيك بوكس الفئة
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              اسحب كل مربع لمكانه — الأسماء ظاهرة بوضوح — الحفظ مشترك للصرف والقبض
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-extrabold text-slate-700">الصندوق</label>
            <select
              value={companyKey}
              onChange={(e) => setCompanyKey(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
            >
              {companiesWithCats.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="ms-2 flex rounded-xl bg-slate-100 p-1">
              {[
                { key: "receipt", label: "معاينة قبض" },
                { key: "payment", label: "معاينة صرف" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPreviewMode(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                    previewMode === opt.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || loading || !fields.length}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FiSave className={saving ? "animate-spin" : ""} />
            {saving ? "جاري الحفظ..." : "حفظ المواضع"}
          </button>
        </div>

        {/* قائمة الأسماء الواضحة */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {checklist.map((item) => {
            const f = fields.find((x) => x.key === categoryLayoutKey(item.key));
            const active = selectedKey === categoryLayoutKey(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedKey(categoryLayoutKey(item.key))}
                className={`rounded-2xl p-3 text-right ring-1 transition ${
                  active
                    ? "bg-amber-50 ring-amber-300"
                    : "bg-white ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-extrabold text-slate-900">
                  {item.label}
                </div>
                <div className="mt-1 text-[11px] font-bold text-slate-500" dir="ltr">
                  top: {f?.top ?? "—"}% · left: {f?.left ?? "—"}%
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl bg-white/70 p-3 ring-1 ring-slate-200 sm:p-4">
          {loading ? (
            <div className="py-20 text-center font-extrabold text-slate-500">
              جاري التحميل...
            </div>
          ) : (
            <div
              ref={paperRef}
              className="relative mx-auto overflow-hidden bg-white"
              style={{
                width: "210mm",
                maxWidth: "100%",
                aspectRatio: "210 / 297",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImg}
                alt={company?.name || "voucher"}
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-fill"
              />

              {(fields.length ? fields : buildDefaultCategoryLayoutFields(company)).map(
                (f) => {
                const catKey = parseCategoryLayoutKey(f.key);
                const label =
                  checklist.find((x) => x.key === catKey)?.label ||
                  getFieldLabel(f.key, company);
                const selected = selectedKey === f.key;
                return (
                  <div
                    key={f.key}
                    onMouseDown={(e) => startDrag(e, f.key)}
                    className={`absolute z-30 flex cursor-move flex-col items-center justify-center rounded-xl border-[3px] px-2 select-none shadow-lg ${
                      selected
                        ? "border-amber-500 bg-amber-300"
                        : "border-violet-700 bg-violet-300"
                    }`}
                    style={{
                      top: `${f.top ?? 55}%`,
                      left: `${f.left ?? 20}%`,
                      width: `${Math.max(Number(f.width) || 12, 12)}%`,
                      height: `${Math.max(Number(f.height) || 6, 6)}%`,
                      minWidth: 96,
                      minHeight: 44,
                    }}
                    title={label}
                  >
                    <FiMove className="mb-0.5 text-slate-900" size={14} />
                    <span className="max-w-full truncate text-center text-xs font-black leading-tight text-slate-900">
                      {label}
                    </span>
                  </div>
                );
              }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
