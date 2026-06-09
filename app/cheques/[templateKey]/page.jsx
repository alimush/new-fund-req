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
  FiSliders,
} from "react-icons/fi";
import { printChequeData, printChequeImageOnly, printChequeWithImage } from "@/lib/cheques/printCheque";
import { defaultPrintCalib } from "@/lib/cheques/printCalib";
import ChequePrintSettingsModal from "@/components/cheques/ChequePrintSettingsModal";
import { getChequeTemplate, isValidChequeTemplateKey } from "@/lib/cheques/templates";
import { getChequePrintDimensions } from "@/lib/cheques/chequePrintDimensions";
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

  const printDims = useMemo(
    () => (baseTemplate ? getChequePrintDimensions(baseTemplate) : null),
    [baseTemplate]
  );

  const [mergedFields, setMergedFields] = useState([]);
  const [values, setValues] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [layoutMode, setLayoutMode] = useState(false);
  const [layoutSelectedKey, setLayoutSelectedKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printingImage, setPrintingImage] = useState(false);
  const [printingWithData, setPrintingWithData] = useState(false);
  const [printPreviewMode, setPrintPreviewMode] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savingDateStyle, setSavingDateStyle] = useState(false);
  const [dateShowSlashes, setDateShowSlashes] = useState(true);
  const [textFieldLayout, setTextFieldLayout] = useState(null);
  const [lastSavedId, setLastSavedId] = useState(null);
  const [printCalib, setPrintCalib] = useState(null);
  const [printModal, setPrintModal] = useState({ open: false, mode: "data" });
  const [printing, setPrinting] = useState(false);

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
          printCalib: json.printCalib || defaultPrintCalib(baseTemplate, fields),
        };
      }
    } catch {
      //
    }
    return {
      fields: fieldsFromTemplate(baseTemplate),
      dateShowSlashes: fallbackSlashes,
      printCalib: defaultPrintCalib(
        baseTemplate,
        fieldsFromTemplate(baseTemplate)
      ),
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
      const { fields, dateShowSlashes: slashes, printCalib: calib } = await loadLayout();
      if (cancelled) return;
      setMergedFields(fields);
      setDateShowSlashes(slashes);
      setPrintCalib(calib);
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

  const openPrintModal = (mode) => {
    if (!template || layoutMode) return;
    setPrintModal({ open: true, mode });
  };

  const quickPrint = async (mode) => {
    if (!template || layoutMode) return;
    await runPrint(mode, null, false);
  };

  const runPrint = async (mode, calib, useProvidedCalib = false) => {
    if (!template) return false;
    const base = {
      template,
      templateKey,
      fields: mergedFields,
      values,
      dateShowSlashes,
      textFieldLayout,
      title: template.name,
      printCalib: calib,
      useProvidedCalib,
    };
    if (mode === "data") {
      return printChequeData({
        ...base,
        onStart: () => setPrinting(true),
        onEnd: () => setPrinting(false),
      });
    }
    if (mode === "withImage") {
      return printChequeWithImage({
        ...base,
        onStart: () => setPrintingWithData(true),
        onEnd: () => setPrintingWithData(false),
      });
    }
    return printChequeImageOnly({
      template,
      fields: mergedFields,
      title: template.name,
      printCalib: calib,
      onStart: () => setPrintingImage(true),
      onEnd: () => setPrintingImage(false),
    });
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
      showToast("تم الحفظ — جاري الطباعة بإعدادات القالب…", "success");
      await quickPrint("data");
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
            onClick={() => setPrintPreviewMode((v) => !v)}
            disabled={layoutMode}
            title="معاينة بنفس أبعاد الطباعة بدون صورة القالب"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-50 ${
              printPreviewMode
                ? "bg-sky-600 text-white"
                : "border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
            }`}
          >
            {printPreviewMode ? "معاينة الصورة" : "معاينة الطباعة"}
          </button>
          <button
            type="button"
            onClick={() => quickPrint("data")}
            disabled={printing || printingWithData || printingImage || saving || layoutMode}
            title="طباعة البيانات على صك فارغ"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          >
            <FiPrinter className={printing ? "animate-pulse" : ""} />
            {printing ? "جاري الطباعة…" : "طباعة على صك فارغ"}
          </button>
          <button
            type="button"
            onClick={() => quickPrint("withImage")}
            disabled={printingWithData || printingImage || printing || saving || layoutMode || !template?.image}
            title="طباعة صورة الصك مع البيانات"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <FiPrinter className={printingWithData ? "animate-pulse" : ""} />
            {printingWithData ? "جاري الطباعة…" : "طباعة الصك والبيانات"}
          </button>
          <button
            type="button"
            onClick={() => quickPrint("imageOnly")}
            disabled={printingImage || printingWithData || printing || saving || layoutMode || !template?.image}
            title="طباعة صورة الصك فقط بدون بيانات — للتجربة"
            className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-extrabold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            <FiPrinter className={printingImage ? "animate-pulse" : ""} />
            {printingImage ? "جاري الطباعة…" : "طباعة الصك"}
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
          <button
            type="button"
            onClick={() => openPrintModal("data")}
            disabled={layoutMode}
            title="ضبط إعدادات الطباعة المحفوظة لهذا القالب"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FiSliders />
            ضبط الطباعة
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
              : printPreviewMode
              ? `معاينة الطباعة — ${printDims?.widthMm ?? "?"}×${printDims?.heightMm ?? "?"} مم (بيانات فقط على صك فارغ)`
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
            printMode={printPreviewMode}
          />
        </motion.div>
      </div>

      <ChequePrintSettingsModal
        open={printModal.open}
        mode={printModal.mode}
        template={template}
        templateKey={templateKey}
        initialCalib={printCalib}
        canSave={canLayoutEditor}
        previewFields={mergedFields}
        previewValues={values}
        dateShowSlashes={dateShowSlashes}
        textFieldLayout={textFieldLayout}
        onClose={() => setPrintModal({ open: false, mode: "data" })}
        onSaved={(saved) => setPrintCalib(saved)}
        onPrint={(calib) => runPrint(printModal.mode, calib, true)}
      />
    </div>
  );
}
