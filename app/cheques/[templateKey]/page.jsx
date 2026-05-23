"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FiArrowRight,
  FiRefreshCw,
  FiMove,
  FiEdit3,
  FiPrinter,
} from "react-icons/fi";
import { printChequeData } from "@/lib/cheques/printCheque";
import { getChequeTemplate, isValidChequeTemplateKey } from "@/lib/cheques/templates";
import {
  fieldsFromTemplate,
  layoutPayloadFromFields,
  mergeTemplateFields,
} from "@/lib/cheques/mergeFields";
import { amountNumericToWordsLines } from "@/lib/cheques/amountWords";
import { singleLineText } from "@/lib/cheques/singleLineText";
import ChequeCanvas, {
  buildEmptyChequeValues,
  chequeValuesToPayload,
  getDefaultTextFieldLayout,
} from "@/components/cheques/ChequeCanvas";
import ChequeInputsSidebar from "@/components/cheques/ChequeInputsSidebar";
import ChequeLayoutPanel from "@/components/cheques/ChequeLayoutPanel";
import { useToast } from "@/components/ui/ToastProvider";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";

export default function ChequeEditorPage() {
  const params = useParams();
  const { showToast } = useToast();
  const { canUseCheques, canLayoutEditor, ready } = useChequeAccess();
  const templateKey = String(params?.templateKey || "").trim();

  const baseTemplate = useMemo(
    () => (isValidChequeTemplateKey(templateKey) ? getChequeTemplate(templateKey) : null),
    [templateKey]
  );

  const [mergedFields, setMergedFields] = useState([]);
  const [values, setValues] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [layoutMode, setLayoutMode] = useState(false);
  const [layoutSelectedKey, setLayoutSelectedKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savingDateStyle, setSavingDateStyle] = useState(false);
  const [dateShowSlashes, setDateShowSlashes] = useState(true);
  const [textFieldLayout, setTextFieldLayout] = useState(null);
  const [lastSavedId, setLastSavedId] = useState(null);

  const template = baseTemplate;

  const loadLayout = useCallback(async () => {
    if (!baseTemplate) {
      return {
        fields: [],
        dateShowSlashes: true,
      };
    }
    const fallbackSlashes = baseTemplate.dateShowSlashesDefault ?? true;
    try {
      const res = await fetch(
        `/api/cheques/layout?templateKey=${encodeURIComponent(templateKey)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json?.success) {
        const fields =
          Array.isArray(json.data) && json.data.length
            ? mergeTemplateFields(baseTemplate, json.data)
            : fieldsFromTemplate(baseTemplate);
        return {
          fields,
          dateShowSlashes:
            typeof json.dateShowSlashes === "boolean"
              ? json.dateShowSlashes
              : fallbackSlashes,
        };
      }
    } catch {
      //
    }
    return {
      fields: fieldsFromTemplate(baseTemplate),
      dateShowSlashes: fallbackSlashes,
    };
  }, [baseTemplate, templateKey]);

  useEffect(() => {
    if (!canLayoutEditor && layoutMode) {
      setLayoutMode(false);
    }
  }, [canLayoutEditor, layoutMode]);

  useEffect(() => {
    if (!baseTemplate) return;

    setMergedFields([]);
    setLayoutMode(false);
    setLayoutSelectedKey(null);
    setActiveField(null);

    let cancelled = false;
    (async () => {
      const { fields, dateShowSlashes: slashes } = await loadLayout();
      if (cancelled) return;
      setMergedFields(fields);
      setDateShowSlashes(slashes);
      setTextFieldLayout(getDefaultTextFieldLayout(fields));
      setValues(buildEmptyChequeValues(baseTemplate, fields));
      setLastSavedId(null);
      setLayoutSelectedKey(fields[0]?.key || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateKey, baseTemplate, loadLayout]);

  const handleValuesChange = useCallback((next) => {
    setValues((prev) => {
      const merged = typeof next === "function" ? next(prev) : next;
      if (merged.amountNumeric !== prev.amountNumeric && !layoutMode) {
        const { line1 } = amountNumericToWordsLines(merged.amountNumeric);
        return {
          ...merged,
          amountWords: singleLineText(line1),
        };
      }
      return merged;
    });
  }, [layoutMode]);

  const resetForm = useCallback(() => {
    if (!baseTemplate) return;
    setValues(buildEmptyChequeValues(baseTemplate, mergedFields));
    setTextFieldLayout(getDefaultTextFieldLayout(mergedFields));
    setLastSavedId(null);
    setActiveField(null);
  }, [baseTemplate, mergedFields]);

  const handleFieldLayoutChange = useCallback((key, partial) => {
    setMergedFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...partial } : f))
    );
  }, []);

  const postLayout = async (slashes) => {
    const res = await fetch("/api/cheques/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey,
        fields: layoutPayloadFromFields(mergedFields, baseTemplate),
        dateShowSlashes: slashes,
      }),
    });
    return res.json();
  };

  const handleSaveDateStyle = async (slashes) => {
    setSavingDateStyle(true);
    setDateShowSlashes(slashes);
    try {
      const json = await postLayout(slashes);
      if (!json?.success) {
        showToast(json?.error || "فشل حفظ شكل التاريخ", "error");
        return;
      }
      const saved =
        typeof json.dateShowSlashes === "boolean"
          ? json.dateShowSlashes
          : slashes;
      setDateShowSlashes(saved);
      showToast(
        saved
          ? "تم حفظ التاريخ مع فواصل / / /"
          : "تم حفظ التاريخ بدون فواصل",
        "success"
      );
    } catch {
      showToast("خطأ في الاتصال", "error");
    } finally {
      setSavingDateStyle(false);
    }
  };

  const handleSaveLayout = async () => {
    setSavingLayout(true);
    try {
      const json = await postLayout(dateShowSlashes);
      if (!json?.success) {
        showToast(json?.error || "فشل حفظ التخطيط", "error");
        return;
      }
      showToast(`تم حفظ تخطيط «${baseTemplate?.name}» فقط`, "success");

      const refreshed = await loadLayout();
      setMergedFields(refreshed.fields);
      setDateShowSlashes(refreshed.dateShowSlashes);
      setTextFieldLayout(getDefaultTextFieldLayout(refreshed.fields));
    } catch {
      showToast("خطأ في الاتصال", "error");
    } finally {
      setSavingLayout(false);
    }
  };

  const handleResetLayout = async () => {
    if (!baseTemplate) return;
    const defaults = fieldsFromTemplate(baseTemplate);
    setMergedFields(defaults);
    setDateShowSlashes(baseTemplate.dateShowSlashesDefault ?? true);
    setTextFieldLayout(getDefaultTextFieldLayout(defaults));
    showToast(`إعادة افتراضيات «${baseTemplate.name}» فقط — احفظ لتثبيتها`, "info");
  };

  const handleCreateAndPrint = async () => {
    if (!template || layoutMode) return;
    setSaving(true);
    try {
      const payload = {
        ...chequeValuesToPayload(templateKey, values, template, textFieldLayout),
        status: "issued",
      };

      const res = await fetch("/api/cheques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json?.success) {
        showToast(json?.error || "فشل الحفظ", "error");
        return;
      }

      setLastSavedId(json.data?._id);
      showToast("تم الحفظ — جاري فتح الطباعة…", "success");

      await printChequeData({
        template,
        fields: mergedFields,
        values,
        dateShowSlashes,
        textFieldLayout,
        title: template.name,
      });
    } catch {
      showToast("خطأ في الاتصال", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!ready || !canUseCheques) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري التحقق من الصلاحيات…
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-lg mx-auto text-center py-20" dir="rtl">
        <p className="text-slate-700 font-bold">قالب الصك غير موجود</p>
        <Link
          href="/cheques"
          className="mt-4 inline-block text-emerald-700 font-extrabold"
        >
          العودة لقائمة الصكوك
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto pb-16" dir="rtl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/cheques"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-2"
          >
            <FiArrowRight />
            نظام الصكوك
          </Link>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            {template.name}
          </h1>
          <p className="text-slate-600 font-semibold text-sm mt-1">
            {template.bankName} — {template.drawerName}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canLayoutEditor ? (
            <button
              type="button"
              onClick={() => {
                const enteringLayout = !layoutMode;
                setLayoutMode(enteringLayout);
                if (enteringLayout) {
                  const textF = mergedFields.find((f) => f.key === "text");
                  setLayoutSelectedKey(textF?.key || mergedFields[0]?.key || null);
                } else {
                  setTextFieldLayout(getDefaultTextFieldLayout(mergedFields));
                }
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold ${
                layoutMode
                  ? "bg-amber-500 text-white"
                  : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
            >
              {layoutMode ? <FiEdit3 /> : <FiMove />}
              {layoutMode ? "وضع الإدخال" : "ترتيب الحقول"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetForm}
            disabled={saving || layoutMode}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FiRefreshCw />
            جديد
          </button>
          <button
            type="button"
            onClick={handleCreateAndPrint}
            disabled={saving || layoutMode}
            title="يحفظ الصك ثم يطبع البيانات على صك فارغ في الطابعة"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <FiPrinter className={saving ? "animate-pulse" : ""} />
            {saving ? "جاري الإنشاء والطباعة…" : "إنشاء وطباعة"}
          </button>
        </div>
      </div>

      {lastSavedId ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm font-bold"
        >
          تم الحفظ في قاعدة البيانات — يمكن استرجاعه لاحقاً من التقرير.
        </motion.div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
        {layoutMode ? (
          <ChequeLayoutPanel
            templateKey={templateKey}
            templateName={template.name}
            template={template}
            fields={mergedFields}
            selectedKey={layoutSelectedKey}
            onSelectField={setLayoutSelectedKey}
            onUpdateField={handleFieldLayoutChange}
            onSaveLayout={handleSaveLayout}
            onResetLayout={handleResetLayout}
            savingLayout={savingLayout}
            dateShowSlashes={dateShowSlashes}
            onDateShowSlashesChange={setDateShowSlashes}
            onSaveDateStyle={handleSaveDateStyle}
            savingDateStyle={savingDateStyle}
          />
        ) : (
          <ChequeInputsSidebar
            template={template}
            fields={mergedFields}
            values={values}
            onChange={handleValuesChange}
            activeField={activeField}
            onFieldFocus={setActiveField}
            onFieldBlur={() => setActiveField(null)}
          />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 min-w-0 w-full rounded-3xl border border-slate-200/80 bg-white p-3 md:p-5 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.25)] sticky top-20"
        >
          <p className="hidden md:block text-xs font-bold text-slate-500 mb-3 text-center">
            {layoutMode
              ? "لتعديل افتراضي text (المستشار): اختر text واسحبه أو عدّل X/Y — ثم احفظ التخطيط"
              : "مربع text (أزرق): تحريك/تكبير لهذا الصك فقط — الافتراضي من «ترتيب الحقول»"}
          </p>
          <ChequeCanvas
            template={template}
            fields={mergedFields}
            values={values}
            onChange={handleValuesChange}
            activeField={activeField}
            onFieldFocus={setActiveField}
            onFieldBlur={() => setActiveField(null)}
            layoutMode={layoutMode}
            layoutSelectedKey={layoutSelectedKey}
            onLayoutSelectField={setLayoutSelectedKey}
            onFieldLayoutChange={handleFieldLayoutChange}
            dateShowSlashes={dateShowSlashes}
            textFieldLayout={textFieldLayout}
            onTextFieldLayoutChange={setTextFieldLayout}
            textFieldAdjustable={!layoutMode}
          />
        </motion.div>
      </div>
    </div>
  );
}
