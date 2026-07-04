"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { syncPrintCalibFontsFromLayout } from "@/lib/cheques/chequeFontSync";
import ChequePrintSettingsModal from "@/components/cheques/ChequePrintSettingsModal";
import { getChequeTemplate, isValidChequeTemplateKey } from "@/lib/cheques/templates";
import {
  LAYOUT_FONT_SCALE_DEFAULT,
  clampLayoutFontScale,
} from "@/lib/cheques/chequeDesignMetrics";
import {
  fieldsFromTemplate,
  layoutPayloadFromFields,
  mergeTemplateFields,
} from "@/lib/cheques/mergeFields";
import { mergeAmountWordsLines } from "@/lib/cheques/amountWords";
import {
  clampTextLayout,
  layoutFromField,
  fieldWithChequePosition,
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
  TEXT_KEY,
  mergePerChequeLayoutsIntoFields,
} from "@/lib/cheques/textFieldLayout";
import ChequeCanvas, {
  buildEmptyChequeValues,
  chequeValuesToPayload,
  getDefaultAmountWordsLayouts,
  getDefaultTextFieldLayout,
} from "@/components/cheques/ChequeCanvas";
import ChequeInputsSidebar from "@/components/cheques/ChequeInputsSidebar";
import ChequeFieldFontBar from "@/components/cheques/ChequeFieldFontBar";
import ChequeLayoutPanel from "@/components/cheques/ChequeLayoutPanel";
import { useToast } from "@/components/ui/ToastProvider";
import { useChequeAccess } from "@/components/cheques/useChequeAccess";
import {
  applyBranchToTemplate,
  isBranchedTemplateKey,
  branchesPagePath,
  getSharedLayoutProfile,
  isSharedLayoutMainBranch,
  usesSharedMainBranchSettings,
  sharedLayoutMainBranchPath,
} from "@/lib/cheques/chequeBranches";
import {
  applyDateGroupPositionChange,
  ensureSlashLayoutFields,
  isDateLayoutKey,
} from "@/lib/cheques/dateSlashLayout";

function fontPartial(partial) {
  const out = {};
  if (partial?.fontSize != null) out.fontSize = partial.fontSize;
  if (partial?.fontWeight != null) out.fontWeight = partial.fontWeight;
  return out;
}

function ChequeEditorPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const {
    canUseCheques,
    canLayoutEditor,
    canManagePrintSettings,
    canPrintCheques,
    ready,
  } = useChequeAccess();
  const templateKey = String(params?.templateKey || "").trim();
  const branchKey = String(searchParams.get("branch") || "").trim().toLowerCase();

  const baseTemplate = useMemo(
    () => (isValidChequeTemplateKey(templateKey) ? getChequeTemplate(templateKey) : null),
    [templateKey]
  );

  const [branch, setBranch] = useState(null);
  const [branchLoading, setBranchLoading] = useState(false);

  const [mergedFields, setMergedFields] = useState([]);
  const [values, setValues] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [layoutMode, setLayoutMode] = useState(false);
  const [layoutSelectedKey, setLayoutSelectedKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printingImage, setPrintingImage] = useState(false);
  const [printingWithData, setPrintingWithData] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savingDateStyle, setSavingDateStyle] = useState(false);
  const [dateShowSlashes, setDateShowSlashes] = useState(true);
  const [dateMoveMode, setDateMoveMode] = useState("unified");
  const [textFieldLayout, setTextFieldLayout] = useState(null);
  const [amountWordsLayout, setAmountWordsLayout] = useState(null);
  const [amountWordsLine2Layout, setAmountWordsLine2Layout] = useState(null);
  const [lastSavedId, setLastSavedId] = useState(null);
  const [printCalib, setPrintCalib] = useState(null);
  const [globalFontScale, setGlobalFontScale] = useState(LAYOUT_FONT_SCALE_DEFAULT);
  const [printModal, setPrintModal] = useState({ open: false, mode: "data" });
  const [printing, setPrinting] = useState(false);

  const template = useMemo(() => {
    if (!baseTemplate) return null;
    if (isBranchedTemplateKey(templateKey)) {
      if (!branchKey) return null;
      if (!branch) return null;
      return applyBranchToTemplate(baseTemplate, branch);
    }
    return baseTemplate;
  }, [baseTemplate, templateKey, branchKey, branch]);

  useEffect(() => {
    if (!ready || !canUseCheques) return;
    if (isBranchedTemplateKey(templateKey) && !branchKey) {
      router.replace(branchesPagePath(templateKey));
    }
  }, [ready, canUseCheques, templateKey, branchKey, router]);

  useEffect(() => {
    if (!isBranchedTemplateKey(templateKey) || !branchKey) {
      setBranch(null);
      setBranchLoading(false);
      return;
    }
    let cancelled = false;
    setBranchLoading(true);
    fetch(
      `/api/cheques/branches?templateKey=${encodeURIComponent(templateKey)}&branchKey=${encodeURIComponent(branchKey)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success || !json.branch) {
          showToast(json?.error || "الفرع غير موجود", "error");
          router.replace(branchesPagePath(templateKey));
          return;
        }
        setBranch(json.branch);
      })
      .catch(() => {
        if (!cancelled) {
          showToast("تعذّر تحميل الفرع", "error");
          router.replace(branchesPagePath(templateKey));
        }
      })
      .finally(() => {
        if (!cancelled) setBranchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateKey, branchKey, router, showToast]);

  useEffect(() => {
    if (!branch?.accountNumber) return;
    setValues((prev) => {
      if (prev.accountNumber) return prev;
      return { ...prev, accountNumber: branch.accountNumber };
    });
  }, [branch?.accountNumber, branch?.branchKey]);

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
          globalFontScale: clampLayoutFontScale(json.globalFontScale ?? 100),
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
      globalFontScale: LAYOUT_FONT_SCALE_DEFAULT,
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
      const { fields, dateShowSlashes: slashes, printCalib: calib, globalFontScale: scale } =
        await loadLayout();
      if (cancelled) return;
      setMergedFields(fields);
      setDateShowSlashes(slashes);
      setPrintCalib(calib);
      setGlobalFontScale(scale ?? LAYOUT_FONT_SCALE_DEFAULT);
      setTextFieldLayout(getDefaultTextFieldLayout(fields));
      const amountLayouts = getDefaultAmountWordsLayouts(fields);
      setAmountWordsLayout(amountLayouts.amountWordsLayout);
      setAmountWordsLine2Layout(amountLayouts.amountWordsLine2Layout);
      setValues(buildEmptyChequeValues(baseTemplate, fields));
      setLastSavedId(null);
      setLayoutSelectedKey(fields[0]?.key || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [templateKey, baseTemplate, loadLayout]);

  const usesSharedMainLayout = useMemo(
    () => usesSharedMainBranchSettings(templateKey, branchKey),
    [templateKey, branchKey]
  );

  const sharedLayoutProfile = useMemo(
    () => getSharedLayoutProfile(templateKey),
    [templateKey]
  );

  const isSharedLayoutProfileEditor = useMemo(
    () => isSharedLayoutMainBranch(templateKey, branchKey),
    [templateKey, branchKey]
  );

  const bootstrapLayoutMode = useCallback(() => {
    const textF = mergedFields.find((f) => f.key === "text");
    setLayoutSelectedKey(textF?.key || mergedFields[0]?.key || null);
    setTextFieldLayout((prev) => prev || getDefaultTextFieldLayout(mergedFields));
    const amountLayouts = getDefaultAmountWordsLayouts(mergedFields);
    setAmountWordsLayout((prev) => prev || amountLayouts.amountWordsLayout);
    setAmountWordsLine2Layout((prev) => prev || amountLayouts.amountWordsLine2Layout);
    setLayoutMode(true);
  }, [mergedFields]);

  useEffect(() => {
    if (searchParams.get("layout") !== "1") return;
    if (!isSharedLayoutMainBranch(templateKey, branchKey)) return;
    if (!mergedFields.length || layoutMode) return;
    bootstrapLayoutMode();
    router.replace(sharedLayoutMainBranchPath(templateKey), { scroll: false });
  }, [
    searchParams,
    templateKey,
    branchKey,
    mergedFields.length,
    layoutMode,
    bootstrapLayoutMode,
    router,
  ]);

  const toggleLayoutMode = useCallback(() => {
    if (layoutMode) {
      setLayoutMode(false);
      return;
    }
    if (usesSharedMainLayout) {
      const profile = getSharedLayoutProfile(templateKey);
      showToast(
        `ترتيب الحقول والطباعة موحّدة — يُفتح الفرع الرئيسي (${profile?.mainBranchLabel || "الرئيسي"})`,
        "info"
      );
      router.push(`${sharedLayoutMainBranchPath(templateKey)}&layout=1`);
      return;
    }
    bootstrapLayoutMode();
  }, [
    layoutMode,
    usesSharedMainLayout,
    templateKey,
    router,
    showToast,
    bootstrapLayoutMode,
  ]);

  const openPrintSettings = useCallback(() => {
    if (usesSharedMainLayout) {
      const profile = getSharedLayoutProfile(templateKey);
      showToast(
        `إعدادات الطباعة موحّدة — يُفتح الفرع الرئيسي (${profile?.mainBranchLabel || "الرئيسي"})`,
        "info"
      );
      router.push(`${sharedLayoutMainBranchPath(templateKey)}&printSettings=1`);
      return;
    }
    setPrintModal({ open: true, mode: "data" });
  }, [usesSharedMainLayout, templateKey, router, showToast]);

  useEffect(() => {
    if (searchParams.get("printSettings") !== "1") return;
    if (!isSharedLayoutMainBranch(templateKey, branchKey)) return;
    if (!canManagePrintSettings) return;
    setPrintModal({ open: true, mode: "data" });
    router.replace(sharedLayoutMainBranchPath(templateKey), { scroll: false });
  }, [
    searchParams,
    templateKey,
    branchKey,
    canManagePrintSettings,
    router,
  ]);

  const layoutFontLayouts = useMemo(
    () => ({
      textFieldLayout,
      amountWordsLayout,
      amountWordsLine2Layout,
    }),
    [textFieldLayout, amountWordsLayout, amountWordsLine2Layout]
  );

  const syncedPrintCalib = useMemo(() => {
    if (!printCalib || !baseTemplate || !mergedFields.length) return printCalib;
    return syncPrintCalibFontsFromLayout(
      printCalib,
      mergedFields,
      baseTemplate,
      layoutFontLayouts
    );
  }, [printCalib, mergedFields, baseTemplate, layoutFontLayouts]);

  const handleValuesChange = useCallback((next) => {
    setValues((prev) => {
      const merged = typeof next === "function" ? next(prev) : next;
      if (merged.amountNumeric !== prev.amountNumeric && !layoutMode) {
        const amountField = mergedFields.find((f) => f.key === AMOUNT_WORDS_KEY);
        const effectiveAmountField = amountField
          ? fieldWithChequePosition(amountField, amountWordsLayout)
          : null;
        return mergeAmountWordsLines(
          merged,
          effectiveAmountField,
          baseTemplate,
          globalFontScale
        );
      }
      return merged;
    });
  }, [layoutMode, mergedFields, baseTemplate, globalFontScale, amountWordsLayout]);

  const wasLayoutModeRef = useRef(layoutMode);

  useEffect(() => {
    const exitingLayout = wasLayoutModeRef.current && !layoutMode;
    wasLayoutModeRef.current = layoutMode;
    if (!exitingLayout || !baseTemplate) return;

    setValues((prev) => {
      if (!prev.amountNumeric) return prev;
      const amountField = mergedFields.find((f) => f.key === AMOUNT_WORDS_KEY);
      const effectiveAmountField = amountField
        ? fieldWithChequePosition(amountField, amountWordsLayout)
        : null;
      return mergeAmountWordsLines(
        prev,
        effectiveAmountField,
        baseTemplate,
        globalFontScale
      );
    });

    const amountLayouts = getDefaultAmountWordsLayouts(mergedFields);
    setAmountWordsLayout(amountLayouts.amountWordsLayout);
    setAmountWordsLine2Layout(amountLayouts.amountWordsLine2Layout);
  }, [layoutMode, baseTemplate, mergedFields, globalFontScale, amountWordsLayout]);

  const resetForm = useCallback(() => {
    if (!baseTemplate) return;
    setValues(buildEmptyChequeValues(baseTemplate, mergedFields));
    setTextFieldLayout(getDefaultTextFieldLayout(mergedFields));
    const amountLayouts = getDefaultAmountWordsLayouts(mergedFields);
    setAmountWordsLayout(amountLayouts.amountWordsLayout);
    setAmountWordsLine2Layout(amountLayouts.amountWordsLine2Layout);
    setLastSavedId(null);
    setActiveField(null);
  }, [baseTemplate, mergedFields]);

  const handleFieldLayoutChange = useCallback((key, partial) => {
    if (key === TEXT_KEY) {
      setTextFieldLayout((prev) => {
        const base =
          prev || layoutFromField(mergedFields.find((f) => f.key === TEXT_KEY));
        return clampTextLayout(partial, base);
      });
      setMergedFields((prev) =>
        prev.map((f) => (f.key === TEXT_KEY ? { ...f, ...partial } : f))
      );
      return;
    }

    if (key === AMOUNT_WORDS_KEY || key === AMOUNT_WORDS_LINE2_KEY) {
      const defaults = getDefaultAmountWordsLayouts(mergedFields);
      const layoutKey =
        key === AMOUNT_WORDS_KEY ? "amountWordsLayout" : "amountWordsLine2Layout";
      const setLayout =
        key === AMOUNT_WORDS_KEY ? setAmountWordsLayout : setAmountWordsLine2Layout;

      setLayout((prev) => {
        const base =
          prev ||
          defaults[layoutKey] ||
          layoutFromField(mergedFields.find((f) => f.key === key));
        return clampTextLayout(partial, base);
      });

      const fp = fontPartial(partial);
      if (Object.keys(fp).length) {
        setAmountWordsLayout((prev) => {
          const base =
            prev ||
            defaults.amountWordsLayout ||
            layoutFromField(mergedFields.find((f) => f.key === AMOUNT_WORDS_KEY));
          return clampTextLayout(fp, base);
        });
        setAmountWordsLine2Layout((prev) => {
          const base =
            prev ||
            defaults.amountWordsLine2Layout ||
            layoutFromField(mergedFields.find((f) => f.key === AMOUNT_WORDS_LINE2_KEY));
          return clampTextLayout(fp, base);
        });
        setMergedFields((prev) =>
          prev.map((f) =>
            f.key === AMOUNT_WORDS_KEY || f.key === AMOUNT_WORDS_LINE2_KEY
              ? { ...f, ...fp }
              : f
          )
        );
      } else {
        setMergedFields((prev) =>
          prev.map((f) => (f.key === key ? { ...f, ...partial } : f))
        );
      }
      return;
    }

    setMergedFields((prev) => {
      if (isDateLayoutKey(key)) {
        if (dateMoveMode === "unified") {
          return ensureSlashLayoutFields(
            applyDateGroupPositionChange(prev, key, partial, dateShowSlashes)
          );
        }
        return ensureSlashLayoutFields(
          prev.map((f) => (f.key === key ? { ...f, ...partial } : f))
        );
      }
      return ensureSlashLayoutFields(
        prev.map((f) => (f.key === key ? { ...f, ...partial } : f))
      );
    });
  }, [dateShowSlashes, dateMoveMode]);

  const handleAmountWordsLayoutChange = useCallback(
    (partial) => {
      setAmountWordsLayout((prev) => {
        const defaults = getDefaultAmountWordsLayouts(mergedFields);
        const base =
          prev ||
          defaults.amountWordsLayout ||
          layoutFromField(mergedFields.find((f) => f.key === AMOUNT_WORDS_KEY));
        return clampTextLayout({ ...partial }, base);
      });

      const fp = fontPartial(partial);
      if (Object.keys(fp).length) {
        setAmountWordsLine2Layout((prev) => {
          const defaults = getDefaultAmountWordsLayouts(mergedFields);
          const base =
            prev ||
            defaults.amountWordsLine2Layout ||
            layoutFromField(mergedFields.find((f) => f.key === AMOUNT_WORDS_LINE2_KEY));
          return clampTextLayout(fp, base);
        });
        setMergedFields((prev) =>
          prev.map((f) =>
            f.key === AMOUNT_WORDS_KEY || f.key === AMOUNT_WORDS_LINE2_KEY
              ? { ...f, ...fp }
              : f
          )
        );
      }
    },
    [mergedFields]
  );

  const handleAmountWordsLine2LayoutChange = useCallback(
    (partial) => {
      setAmountWordsLine2Layout((prev) => {
        const defaults = getDefaultAmountWordsLayouts(mergedFields);
        const base =
          prev ||
          defaults.amountWordsLine2Layout ||
          layoutFromField(mergedFields.find((f) => f.key === AMOUNT_WORDS_LINE2_KEY));
        return clampTextLayout({ ...partial }, base);
      });

      const fp = fontPartial(partial);
      if (Object.keys(fp).length) {
        setAmountWordsLayout((prev) => {
          const defaults = getDefaultAmountWordsLayouts(mergedFields);
          const base =
            prev ||
            defaults.amountWordsLayout ||
            layoutFromField(mergedFields.find((f) => f.key === AMOUNT_WORDS_KEY));
          return clampTextLayout(fp, base);
        });
        setMergedFields((prev) =>
          prev.map((f) =>
            f.key === AMOUNT_WORDS_KEY || f.key === AMOUNT_WORDS_LINE2_KEY
              ? { ...f, ...fp }
              : f
          )
        );
      }
    },
    [mergedFields]
  );

  const buildLayoutFieldsForSave = useCallback(() => {
    return mergePerChequeLayoutsIntoFields(mergedFields, {
      textFieldLayout,
      amountWordsLayout,
      amountWordsLine2Layout,
    });
  }, [mergedFields, textFieldLayout, amountWordsLayout, amountWordsLine2Layout]);

  const handleTextFieldLayoutChange = useCallback(
    (partial) => {
      setTextFieldLayout((prev) => {
        const base =
          prev || layoutFromField(mergedFields.find((f) => f.key === TEXT_KEY));
        const next =
          typeof partial === "function"
            ? partial(base)
            : clampTextLayout(partial, base);
        setMergedFields((fields) =>
          fields.map((f) => (f.key === TEXT_KEY ? { ...f, ...next } : f))
        );
        return next;
      });
    },
    [mergedFields]
  );

  const postLayout = async (slashes, fieldsOverride) => {
    const fields = fieldsOverride || mergedFields;
    const res = await fetch("/api/cheques/layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey,
        fields: layoutPayloadFromFields(fields, baseTemplate),
        dateShowSlashes: slashes,
        globalFontScale,
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
      const fieldsToSave = buildLayoutFieldsForSave();
      setMergedFields(fieldsToSave);
      const json = await postLayout(dateShowSlashes, fieldsToSave);
      if (!json?.success) {
        showToast(json?.error || "فشل حفظ التخطيط", "error");
        return;
      }
      showToast(`تم حفظ تخطيط «${baseTemplate?.name}» فقط`, "success");

      const refreshed = await loadLayout();
      setMergedFields(refreshed.fields);
      setDateShowSlashes(refreshed.dateShowSlashes);
      setGlobalFontScale(refreshed.globalFontScale ?? LAYOUT_FONT_SCALE_DEFAULT);
      const savedTextLayout = getDefaultTextFieldLayout(refreshed.fields);
      const savedAmountLayouts = getDefaultAmountWordsLayouts(refreshed.fields);
      setTextFieldLayout(savedTextLayout);
      setAmountWordsLayout(savedAmountLayouts.amountWordsLayout);
      setAmountWordsLine2Layout(savedAmountLayouts.amountWordsLine2Layout);
      setValues((prev) =>
        mergeAmountWordsLines(
          prev,
          refreshed.fields.find((f) => f.key === "amountWords"),
          baseTemplate,
          refreshed.globalFontScale ?? LAYOUT_FONT_SCALE_DEFAULT
        )
      );
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
    setGlobalFontScale(LAYOUT_FONT_SCALE_DEFAULT);
    setTextFieldLayout(getDefaultTextFieldLayout(defaults));
    const amountLayouts = getDefaultAmountWordsLayouts(defaults);
    setAmountWordsLayout(amountLayouts.amountWordsLayout);
    setAmountWordsLine2Layout(amountLayouts.amountWordsLine2Layout);
    showToast(`إعادة افتراضيات «${baseTemplate.name}» فقط — احفظ لتثبيتها`, "info");
  };

  const openPrintModal = (mode) => {
    if (!template || layoutMode) return;
    setPrintModal({ open: true, mode });
  };

  const quickPrint = async (mode) => {
    if (!template || layoutMode) return;
    await runPrint(mode, syncedPrintCalib, Boolean(syncedPrintCalib));
  };

  const runPrint = async (mode, calib, useProvidedCalib = false, printerName = "", copyCount, printMode) => {
    if (!template) return false;
    const effectiveMode = printMode || mode;
    const base = {
      template,
      templateKey,
      fields: mergedFields,
      values,
      dateShowSlashes,
      textFieldLayout,
      amountWordsLayout,
      amountWordsLine2Layout,
      title: template.name,
      printCalib: calib,
      layoutFontScale: globalFontScale,
      useProvidedCalib,
      printerName,
      copyCount,
      printMode: effectiveMode,
    };
    if (effectiveMode === "data") {
      return printChequeData({
        ...base,
        onStart: () => setPrinting(true),
        onEnd: () => setPrinting(false),
      });
    }
    if (effectiveMode === "withImage") {
      return printChequeWithImage({
        ...base,
        onStart: () => setPrintingWithData(true),
        onEnd: () => setPrintingWithData(false),
      });
    }
    return printChequeImageOnly({
      ...base,
      useProvidedCalib,
      copyCount,
      onStart: () => setPrintingImage(true),
      onEnd: () => setPrintingImage(false),
    });
  };

  const handleCreateAndPrint = async () => {
    if (!template || layoutMode) return;
    setSaving(true);
    try {
      const payload = {
        ...chequeValuesToPayload(
          templateKey,
          values,
          template,
          textFieldLayout,
          amountWordsLayout,
          amountWordsLine2Layout
        ),
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

  if (isBranchedTemplateKey(templateKey) && (branchLoading || (branchKey && !template))) {
    return (
      <div className="py-20 text-center text-slate-600 font-bold" dir="rtl">
        جاري تحميل الفرع…
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
            href={
              isBranchedTemplateKey(templateKey)
                ? branchesPagePath(templateKey)
                : "/cheques"
            }
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 mb-2"
          >
            <FiArrowRight />
            {isBranchedTemplateKey(templateKey) ? "اختر الفرع" : "نظام الصكوك"}
          </Link>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">
            {template.name}
          </h1>
          <p className="text-slate-600 font-semibold text-sm mt-1">
            {template.bankName}
            {template.drawerName ? ` — ${template.drawerName}` : ""}
          </p>
          {branch?.accountNumber ? (
            <p className="text-slate-500 text-xs font-semibold mt-1">
              رقم الحساب: {branch.accountNumber}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canLayoutEditor ? (
            <button
              type="button"
              onClick={toggleLayoutMode}
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
          {canPrintCheques ? (
            <>
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
                title="طباعة صورة الصك فقط بدون بيانات"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-extrabold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
              >
                <FiPrinter className={printingImage ? "animate-pulse" : ""} />
                {printingImage ? "جاري الطباعة…" : "طباعة الصك"}
              </button>
            </>
          ) : null}
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
          {canManagePrintSettings ? (
            <button
              type="button"
              onClick={openPrintSettings}
              disabled={layoutMode}
              title="ضبط إعدادات الطباعة المحفوظة لهذا القالب"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FiSliders />
              ضبط الطباعة
            </button>
          ) : null}
        </div>
      </div>

      {usesSharedMainLayout && sharedLayoutProfile ? (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-950 leading-relaxed">
          <strong className="font-extrabold">إعدادات موحّدة مع الفرع الرئيسي</strong> —{" "}
          {sharedLayoutProfile.bankLabel} ({sharedLayoutProfile.mainBranchLabel}): ترتيب الحقول،
          التاريخ، وضبط الطباعة نفسها لكل الأفرع. هنا تُدخل بيانات الصك وتطبع على صورة فرع{" "}
          <span className="font-extrabold">{template?.branch || branch?.name}</span> فقط.
        </div>
      ) : null}

      {isSharedLayoutProfileEditor && layoutMode && sharedLayoutProfile ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 leading-relaxed">
          التعديلات التي تحفظها هنا تُطبَّق على{" "}
          <strong className="font-extrabold">{sharedLayoutProfile.allBranchesNote}</strong> — يختلف
          شكل الصك المطبوع مسبقاً فقط.
        </div>
      ) : null}

      {lastSavedId ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm font-bold"
        >
          تم الحفظ في قاعدة البيانات — يمكن استرجاعه لاحقاً من التقرير.
        </motion.div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
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
            dateMoveMode={dateMoveMode}
            onDateMoveModeChange={setDateMoveMode}
            onSaveDateStyle={handleSaveDateStyle}
            savingDateStyle={savingDateStyle}
            globalFontScale={globalFontScale}
            onGlobalFontScaleChange={setGlobalFontScale}
            textFieldLayout={textFieldLayout}
            amountWordsLayout={amountWordsLayout}
            amountWordsLine2Layout={amountWordsLine2Layout}
            layoutAppliesToAllBranches={isSharedLayoutProfileEditor}
          />
        ) : (
          <div className="order-2 lg:order-1">
            <ChequeInputsSidebar
              template={template}
              fields={mergedFields}
              values={values}
              onChange={handleValuesChange}
              activeField={activeField}
              onFieldFocus={setActiveField}
              globalFontScale={globalFontScale}
              amountWordsLayout={amountWordsLayout}
            />
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-[1.85] min-w-0 w-full order-1 lg:order-2 rounded-3xl border border-slate-200/80 bg-white p-2 md:p-4 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.25)] lg:sticky lg:top-20 overflow-hidden"
        >
          <p className="hidden md:block text-xs font-bold text-slate-500 mb-2 text-center">
            {layoutMode
              ? "ترتيب الحقول: اختر «المدير المفوض» واسحبه يساراً/يميناً — ثم احفظ التخطيط"
              : "معاينة الصك — «المدير المفوض»: اسحب من أي حافة حول الحقل لتحريك موضعه"}
          </p>
          <div className="w-full min-w-0">
            <ChequeCanvas
              template={template}
              fields={mergedFields}
              values={values}
              onChange={handleValuesChange}
              activeField={activeField}
              onFieldFocus={setActiveField}
              layoutMode={layoutMode}
              layoutSelectedKey={layoutSelectedKey}
              onLayoutSelectField={setLayoutSelectedKey}
              onFieldLayoutChange={handleFieldLayoutChange}
              dateShowSlashes={dateShowSlashes}
              dateMoveMode={dateMoveMode}
              textFieldLayout={textFieldLayout}
              onTextFieldLayoutChange={handleTextFieldLayoutChange}
              amountWordsLayout={amountWordsLayout}
              amountWordsLine2Layout={amountWordsLine2Layout}
              textFieldAdjustable={!layoutMode}
              globalFontScale={globalFontScale}
            />
          </div>
          {!layoutMode ? (
            <ChequeFieldFontBar
              activeField={activeField}
              fields={mergedFields}
              textFieldLayout={textFieldLayout}
              amountWordsLayout={amountWordsLayout}
              amountWordsLine2Layout={amountWordsLine2Layout}
              onTextFieldLayoutChange={handleTextFieldLayoutChange}
              onAmountWordsLayoutChange={handleAmountWordsLayoutChange}
              onAmountWordsLine2LayoutChange={handleAmountWordsLine2LayoutChange}
              onFieldLayoutChange={handleFieldLayoutChange}
            />
          ) : null}
        </motion.div>
      </div>

      <ChequePrintSettingsModal
        open={printModal.open}
        mode={printModal.mode}
        template={template}
        templateKey={templateKey}
        initialCalib={syncedPrintCalib}
        canSave={canManagePrintSettings}
        previewFields={mergedFields}
        previewValues={values}
        dateShowSlashes={dateShowSlashes}
        textFieldLayout={textFieldLayout}
        amountWordsLayout={amountWordsLayout}
        amountWordsLine2Layout={amountWordsLine2Layout}
        layoutFontScale={globalFontScale}
        onClose={() => setPrintModal({ open: false, mode: "data" })}
        onSaved={(saved) => setPrintCalib(saved)}
        onPrint={(calib, meta) =>
          runPrint(
            meta?.printMode || printModal.mode,
            calib,
            true,
            meta?.printerName || "",
            meta?.copyCount,
            meta?.printMode
          )
        }
      />
    </div>
  );
}

export default function ChequeEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center font-bold text-slate-600" dir="rtl">
          جاري التحميل…
        </div>
      }
    >
      <ChequeEditorPageContent />
    </Suspense>
  );
}
