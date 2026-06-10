"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import PaymentPlanLayoutCanvas from "@/components/ex/PaymentPlanLayoutCanvas";
import PaymentPlanLayoutPanel from "@/components/ex/PaymentPlanLayoutPanel";
import { PAYMENT_PLAN_TEMPLATE } from "@/lib/ex/paymentPlanTemplate";
import { fieldsFromPaymentPlanTemplate } from "@/lib/ex/paymentPlanLayoutMerge";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/lib/permission";

export default function PaymentPlanLayoutPage() {
  const router = useRouter();
  const { permissions } = usePermissions();

  const canEdit =
    Array.isArray(permissions) &&
    (permissions.includes(PERMISSIONS.EX) ||
      permissions.includes(PERMISSIONS.EX_Create_Request) ||
      permissions.includes(PERMISSIONS.VIEW_ALL_REPORTS));

  const [fields, setFields] = useState(() => fieldsFromPaymentPlanTemplate());
  const [tableRowHeight, setTableRowHeight] = useState(
    PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight
  );
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingLayout, setSavingLayout] = useState(false);
  const [toast, setToast] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadLayout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ex/payment-plan-layout", { cache: "no-store" });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "تعذر التحميل");
      setFields(Array.isArray(json.data) ? json.data : fieldsFromPaymentPlanTemplate());
      setTableRowHeight(
        Number(json.tableRowHeight) || PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight
      );
      setUpdatedAt(json.updatedAt || null);
    } catch (e) {
      setToast(e?.message || "تعذر تحميل التخطيط");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const onUpdateField = (key, partial) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...partial } : f))
    );
  };

  const onSaveLayout = async () => {
    if (!canEdit) return;
    setSavingLayout(true);
    try {
      const res = await fetch("/api/ex/payment-plan-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, tableRowHeight }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "فشل الحفظ");
      setFields(Array.isArray(json.data) ? json.data : fields);
      setTableRowHeight(
        Number(json.tableRowHeight) || PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight
      );
      setUpdatedAt(json.updatedAt || null);
      setToast(json.message || "تم الحفظ");
    } catch (e) {
      setToast(e?.message || "فشل الحفظ");
    } finally {
      setSavingLayout(false);
    }
  };

  const onResetLayout = async () => {
    if (!canEdit) return;
    if (!window.confirm("إعادة القالب للوضع الافتراضي؟")) return;
    setSavingLayout(true);
    try {
      const res = await fetch("/api/ex/payment-plan-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "فشل الإعادة");
      setFields(fieldsFromPaymentPlanTemplate());
      setTableRowHeight(PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight);
      setSelectedKey(null);
      setUpdatedAt(json.updatedAt || null);
      setToast(json.message || "تمت الإعادة");
    } catch (e) {
      setToast(e?.message || "فشل الإعادة");
    } finally {
      setSavingLayout(false);
    }
  };

  if (!canEdit && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl bg-white p-8 shadow text-center max-w-md">
          <p className="font-extrabold text-gray-800 mb-4">لا تملك صلاحية تعديل القالب</p>
          <button
            type="button"
            onClick={() => router.push("/ex/payment-plan")}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/ex/payment-plan")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <FiArrowLeft /> رجوع
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                ترتيب قالب الاستثناءات (A4)
              </h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                اسحب الحقول أو عدّل Top / Left ثم احفظ
                {updatedAt
                  ? ` — آخر حفظ: ${new Date(updatedAt).toLocaleString("ar-IQ")}`
                  : " — القالب الافتراضي"}
              </p>
            </div>
          </div>
        </div>

        {toast ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-900">
            <FiCheckCircle />
            {toast}
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 w-full min-w-0">
              <PaymentPlanLayoutCanvas
                fields={fields}
                tableRowHeight={tableRowHeight}
                layoutMode={canEdit}
                selectedKey={selectedKey}
                onSelectField={setSelectedKey}
                onFieldChange={onUpdateField}
              />
            </div>

            <PaymentPlanLayoutPanel
              fields={fields}
              selectedKey={selectedKey}
              onSelectField={setSelectedKey}
              onUpdateField={onUpdateField}
              tableRowHeight={tableRowHeight}
              onTableRowHeightChange={setTableRowHeight}
              onSaveLayout={onSaveLayout}
              onResetLayout={onResetLayout}
              savingLayout={savingLayout}
              canEdit={canEdit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
