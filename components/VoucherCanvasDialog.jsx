"use client";

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  startTransition,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import VoucherRichTextInput from "@/components/VoucherRichTextInput";
import PersonNameSuggestDropdown from "@/components/PersonNameSuggestDropdown";
import ChequeSuggestDropdown from "@/components/ChequeSuggestDropdown";
import DescSuggestDropdown from "@/components/DescSuggestDropdown";
import VoucherPersonIdentityPanel from "@/components/VoucherPersonIdentityPanel";
import { useVoucherPersonSuggest } from "@/hooks/useVoucherPersonSuggest";
import { useVoucherChequeSuggest } from "@/hooks/useVoucherChequeSuggest";
import { useVoucherDescSuggest } from "@/hooks/useVoucherDescSuggest";
import { applyStyleToRange, getStyleAtRange, trimStyleRange } from "@/lib/voucher/fieldColorRuns";
import {
  FiPrinter,
  FiX,
  FiType,
  FiBold,
  FiMinus,
  FiPlus,
  FiEdit2,
  FiSave,
  FiMove,
} from "react-icons/fi";
import { Cairo } from "next/font/google";
import VoucherDateModal from "@/components/VoucherDateModal";
import VoucherCategoryChecklist from "@/components/VoucherCategoryChecklist";
import { isAlGhadeerMain } from "@/lib/voucher/utils";
import { usePermissions } from "@/context/PermissionContext";
import { PERMISSIONS, hasPermission } from "@/lib/permission";
import {
  buildDefaultVoucherLayoutFields,
  applyLayoutToPosExtra,
  applyLayoutToCategoryChecklist,
  fieldsToMap,
  getFieldLabel,
  DEFAULT_VOUCHER_NO_POS,
  isCategoryLayoutField,
} from "@/lib/voucher/voucherLayout";
import { POS_NEW, getCompanyExtra } from "@/lib/voucher/companies";
import {
  readCachedVoucherLayout,
  writeCachedVoucherLayout,
  prefetchVoucherLayout,
} from "@/lib/voucher/voucherLayoutCache";

function layoutFieldsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every(
    (f, i) =>
      f.key === b[i]?.key &&
      f.top === b[i]?.top &&
      f.left === b[i]?.left &&
      f.width === b[i]?.width &&
      f.height === b[i]?.height
  );
}

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700", "800"],
});

const pctStyle = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

const DEFAULT_GLOBAL_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const DEFAULT_FIELD_STYLES = {
  amount: { fontSize: 16, fontWeight: 800, color: "#111827" },
  words: { fontSize: 16, fontWeight: 700, color: "#111827" },
  desc: { fontSize: 16, fontWeight: 600, color: "#111827" },
  bank: { fontSize: 13, fontWeight: 700, color: "#111827" },
  fxRate: { fontSize: 16, fontWeight: 800, color: "#111827" },
  receivedBy: { fontSize: 16, fontWeight: 600, color: "#111827" },
  beneficiary: { fontSize: 16, fontWeight: 700, color: "#111827" },
  notes: { fontSize: 16, fontWeight: 600, color: "#111827" },
  chequeNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  nationalId: { fontSize: 16, fontWeight: 700, color: "#111827" },
  phone: { fontSize: 16, fontWeight: 700, color: "#111827" },
  sanadNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
  date: { fontSize: 16, fontWeight: 800, color: "#111827" },
  voucherNo: { fontSize: 16, fontWeight: 800, color: "#111827" },
  currencyMark: { fontSize: 16, fontWeight: 800, color: "#111827" },
};

const clampFontSize = (v, fallback = 16) => {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  return Math.max(8, Math.min(72, Number(n)));
};

const clampFontWeight = (v, fallback = 700) => {
  const n = String(v ?? "").replace(/[^\d]/g, "");
  if (!n) return Number(fallback);
  const num = Number(n);
  const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  return steps.reduce((prev, curr) =>
    Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
  );
};

const normalizeColor = (v, fallback = "#111827") => {
  const s = String(v || "").trim();
  return /^#([0-9a-fA-F]{6})$/.test(s) ? s : fallback;
};

export default function VoucherCanvasDialog({
  open,
  onClose,
  onPrint,
  isPrinting,
  selectedCompany,
  isPayment,
  paperRef,
  currentImg,
  POS: posProp,
  EXTRA: extraProp,
  editMode = false,
  onToggleEdit,
  onSave,
  isSaving = false,
  isViewPage = false,

  vDateYY,
  vDateMM,
  vDateDD,
  todayYY,
  todayMM,
  todayDD,
  printButtonText = "إنشاء وطباعة",
  printingButtonText = "جاري الإنشاء والطباعة...",
  hasBeenCreated = false,
  onCreate,
  onPrintOnly,
  createButtonText = "إنشاء",
  creatingButtonText = "جاري الإنشاء...",
  printOnlyButtonText = "طباعة",
  printingOnlyButtonText = "جاري الطباعة...",

  vCurrency,
  vAmount,
  vWords,
  vDesc,
  vBank,
  vFxRate,
  vReceivedBy,
  vBeneficiary,
  vNotes,
  cbOne,
  cbTwo,
  categoryChecklist = [],
  categoryChecks = {},
  onToggleCategoryCheck,
  voucherNo,

  yyRef,
  mmRef,
  ddRef,
  amountRef,
  wordsRef,
  descRef,
  fxRef,
  receivedByRef,
  bankRef,
  beneficiaryRef,
  notesRef,

  onYYChange,
  onMMChange,
  onDDChange,
  onDateKeyDown,

  setVCurrency,
  setVAmount,
  setVWords,
  setVDesc,
  setVFxRate,
  setVReceivedBy,
  setVBank,
  setVBeneficiary,
  setVNotes,
  setCbOne,
  setCbTwo,

  vChequeNo,
  chequeNoRef,
  setVChequeNo,
  chequeId = null,
  setChequeId,

  vNationalId,
  vPhone,
  vSanadNo,

  nationalIdRef,
  phoneRef,
  sanadRef,

  setVNationalId,
  setVPhone,
  setVSanadNo,

  cleanAmount,
  formatAmount,

  globalTextStyle = DEFAULT_GLOBAL_TEXT_STYLE,
  setGlobalTextStyle,
  fieldStyles = DEFAULT_FIELD_STYLES,
  setFieldStyles,
  fieldColorRuns = {},
  setFieldColorRuns,
  onImageLoad,
}) {
  const { permissions } = usePermissions();
  const canLayout = hasPermission(permissions, PERMISSIONS.VOUCHERS_FIELD_LAYOUT);

  const [selectedField, setSelectedField] = useState(null);
  const [fieldSelection, setFieldSelection] = useState(null);
  const [layoutMode, setLayoutMode] = useState(false);
  const [layoutFields, setLayoutFields] = useState([]);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutReady, setLayoutReady] = useState(true);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutSelectedKey, setLayoutSelectedKey] = useState(null);
  const layoutDragRef = useRef(null);

  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [tmpDate, setTmpDate] = useState({
    yearShort: vDateYY || todayYY || "",
    month: vDateMM || todayMM || "",
    day: vDateDD || todayDD || "",
  });

  const personSuggestEnabled = open && (!isViewPage || editMode);
  const activePersonFieldRef = useRef("receivedBy");
  const {
    options: personOptions,
    show: personShow,
    activeIdx: personActiveIdx,
    setActiveIdx: setPersonActiveIdx,
    pos: personPos,
    boxRef: personBoxRef,
    openFor: openPersonSuggest,
    close: closePersonSuggest,
    handleKeyDown: handlePersonSuggestKeyDown,
  } = useVoucherPersonSuggest({
    companyKey: "",
    enabled: personSuggestEnabled,
    minLength: 2,
  });

  const {
    options: chequeOptions,
    show: chequeShow,
    activeIdx: chequeActiveIdx,
    setActiveIdx: setChequeActiveIdx,
    pos: chequePos,
    boxRef: chequeBoxRef,
    openFor: openChequeSuggest,
    close: closeChequeSuggest,
    handleKeyDown: handleChequeSuggestKeyDown,
  } = useVoucherChequeSuggest({
    enabled: personSuggestEnabled,
    minLength: 1,
  });

  const {
    options: descOptions,
    show: descShow,
    activeIdx: descActiveIdx,
    setActiveIdx: setDescActiveIdx,
    pos: descPos,
    boxRef: descBoxRef,
    openFor: openDescSuggest,
    close: closeDescSuggest,
    handleKeyDown: handleDescSuggestKeyDown,
  } = useVoucherDescSuggest({
    companyKey: selectedCompany?.key || "",
    enabled: personSuggestEnabled,
    minLength: 2,
  });

  const applyChequePick = useCallback(
    (opt) => {
      if (!opt) return;

      const number = String(opt.chequeNumber || "").trim();
      if (number) setVChequeNo?.(number);
      setChequeId?.(opt.chequeId || opt.id || null);

      if (opt.bankName) setVBank?.(opt.bankName);
      if (opt.payee) setVReceivedBy?.(opt.payee);

      if (opt.amountText || opt.amount != null) {
        const cleaned = cleanAmount?.(
          opt.amountText || String(opt.amount ?? "")
        );
        if (cleaned) {
          setVAmount?.(formatAmount ? formatAmount(cleaned) : cleaned);
        }
      }
      if (opt.amountWords) setVWords?.(opt.amountWords);
      if (opt.currency) {
        const c = String(opt.currency || "").toUpperCase();
        if (c === "USD") setVCurrency?.("USD");
        else if (c === "EUR" && isAlGhadeerMain(selectedCompany?.key))
          setVCurrency?.("EUR");
        else setVCurrency?.("IQD");
      }

      // شيك مربوط → تفعيل صندوق الشيك
      setCbTwo?.(true);
      setCbOne?.(false);

      closeChequeSuggest();
    },
    [
      cleanAmount,
      closeChequeSuggest,
      formatAmount,
      setCbOne,
      setCbTwo,
      setChequeId,
      setVAmount,
      setVBank,
      setVChequeNo,
      setVCurrency,
      setVReceivedBy,
      setVWords,
      selectedCompany?.key,
    ]
  );

  const handleChequeNoChange = useCallback(
    (text) => {
      setVChequeNo?.(text);
      // تغيير الرقم يدوياً يقطع الربط حتى يُختار اقتراح من جديد
      if (chequeId) setChequeId?.(null);
      openChequeSuggest(text, chequeNoRef);
    },
    [chequeId, chequeNoRef, openChequeSuggest, setChequeId, setVChequeNo]
  );

  const handleChequeKeyDown = useCallback(
    (e) => {
      const action = handleChequeSuggestKeyDown(e);
      if (action === "pick" && chequeActiveIdx >= 0) {
        applyChequePick(chequeOptions[chequeActiveIdx]);
      }
    },
    [
      applyChequePick,
      chequeActiveIdx,
      chequeOptions,
      handleChequeSuggestKeyDown,
    ]
  );

  const applyPersonPick = useCallback(
    (opt) => {
      if (!opt) return;

      const activeField = activePersonFieldRef.current || "receivedBy";
      if (activeField === "beneficiary") {
        setVBeneficiary?.(opt.name || "");
      } else {
        setVReceivedBy?.(opt.name || "");
      }

      if (opt.nationalId) setVNationalId?.(opt.nationalId);
      if (opt.phone) setVPhone?.(opt.phone);
      if (opt.bank) setVBank?.(opt.bank);
      if (opt.chequeNo) setVChequeNo?.(opt.chequeNo);
      if (opt.sanadNo) setVSanadNo?.(opt.sanadNo);

      closePersonSuggest();
    },
    [
      closePersonSuggest,
      setVBank,
      setVBeneficiary,
      setVChequeNo,
      setVNationalId,
      setVPhone,
      setVReceivedBy,
      setVSanadNo,
    ]
  );

  const makePersonChangeHandler = useCallback(
    (fieldName, setter, inputRef) => (text) => {
      activePersonFieldRef.current = fieldName;
      setter(text);
      openPersonSuggest(fieldName, text, inputRef);
    },
    [openPersonSuggest]
  );

  const handlePersonKeyDown = useCallback(
    (e) => {
      const action = handlePersonSuggestKeyDown(e);
      if (action === "pick" && personActiveIdx >= 0) {
        applyPersonPick(personOptions[personActiveIdx]);
      }
    },
    [applyPersonPick, handlePersonSuggestKeyDown, personActiveIdx, personOptions]
  );

  const handleReceivedByChange = useMemo(
    () => makePersonChangeHandler("receivedBy", setVReceivedBy, receivedByRef),
    [makePersonChangeHandler, setVReceivedBy, receivedByRef]
  );

  const handleBeneficiaryChange = useMemo(
    () => makePersonChangeHandler("beneficiary", setVBeneficiary, beneficiaryRef),
    [makePersonChangeHandler, setVBeneficiary, beneficiaryRef]
  );

  const applyDescPick = useCallback(
    (opt) => {
      if (!opt) return;
      const text = String(opt.text || opt.label || "").trim();
      if (text) setVDesc?.(text);
      closeDescSuggest();
    },
    [closeDescSuggest, setVDesc]
  );

  const handleDescChange = useCallback(
    (text) => {
      setVDesc?.(text);
      openDescSuggest(text, descRef);
    },
    [descRef, openDescSuggest, setVDesc]
  );

  const handleDescKeyDown = useCallback(
    (e) => {
      const action = handleDescSuggestKeyDown(e);
      if (action === "pick" && descActiveIdx >= 0) {
        applyDescPick(descOptions[descActiveIdx]);
      }
    },
    [applyDescPick, descActiveIdx, descOptions, handleDescSuggestKeyDown]
  );

  const only2Digits = (value) => String(value || "").replace(/\D/g, "").slice(0, 2);

  const openDateModal = () => {
    setTmpDate({
      yearShort: vDateYY || todayYY || "",
      month: vDateMM || todayMM || "",
      day: vDateDD || todayDD || "",
    });
    setDateModalOpen(true);
  };

  const saveDateModal = () => {
    onYYChange?.({ target: { value: tmpDate.yearShort } });
    onMMChange?.({ target: { value: tmpDate.month } });
    onDDChange?.({ target: { value: tmpDate.day } });
    setDateModalOpen(false);
  };

  const fieldLabels = useMemo(
    () => ({
      date: "التاريخ",
      amount: "المبلغ",
      words: "المبلغ بالحروف",
      desc: "الوصف",
      bank: "البنك",
      fxRate: "سعر الصرف",
      receivedBy: "استلمت من",
      beneficiary: "المستفيد",
      notes: "الملاحظات",
      chequeNo: "رقم الشيك",
      nationalId: "البطاقة الوطنية",
      phone: "رقم الهاتف",
      sanadNo: "رقم السند",
      voucherNo: "رقم الوصل",
      currencyMark: "علامة العملة",
    }),
    []
  );

  const allFieldKeys = useMemo(() => Object.keys(fieldStyles || {}), [fieldStyles]);

  const getStyle = (fieldKey) => {
    const perField = fieldStyles?.[fieldKey] || {};
    return {
      fontSize: clampFontSize(perField.fontSize, globalTextStyle.fontSize),
      fontWeight: clampFontWeight(perField.fontWeight, globalTextStyle.fontWeight),
      color: normalizeColor(perField.color, globalTextStyle.color),
    };
  };

  const mergeFieldTextStyle = (fieldKey, extra = {}) => {
    const s = getStyle(fieldKey);
    return {
      background: "transparent",
      border: "none",
      outline: "none",
      caretColor: s.color,
      fontFamily: "inherit",
      color: s.color,
      lineHeight: 1.25,
      resize: "none",
      overflow: "hidden",
      fontSize: `${s.fontSize}px`,
      fontWeight: s.fontWeight,
      ...extra,
    };
  };

  const hasActiveTextSelection =
    Boolean(selectedField) &&
    fieldSelection?.fieldKey === selectedField &&
    fieldSelection.end > fieldSelection.start;

  const getFieldStyleDefaults = (fieldKey) => {
    const s = getStyle(fieldKey);
    return {
      color: s.color,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
    };
  };

  const applySelectionStyle = (fieldKey, patch) => {
    if (
      fieldSelection?.fieldKey === fieldKey &&
      fieldSelection.end > fieldSelection.start
    ) {
      const text = String(fieldTextValues[fieldKey] ?? "");
      const { start, end } = trimStyleRange(
        text,
        fieldSelection.start,
        fieldSelection.end
      );
      if (end > start) {
        updateFieldColorRuns(
          fieldKey,
          applyStyleToRange(
            text,
            fieldColorRuns?.[fieldKey] || [],
            start,
            end,
            patch,
            getFieldStyleDefaults(fieldKey)
          )
        );
        return true;
      }
    }
    return false;
  };

  const setFieldFontSize = (fieldKey, size) => {
    const numeric = clampFontSize(size, 16);
    if (applySelectionStyle(fieldKey, { fontSize: numeric })) return;

    setFieldStyles((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev?.[fieldKey] || {}),
        fontSize: numeric,
      },
    }));
  };

  const setFieldFontWeight = (fieldKey, weight) => {
    const numeric = clampFontWeight(weight, 700);
    if (applySelectionStyle(fieldKey, { fontWeight: numeric })) return;

    setFieldStyles((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev?.[fieldKey] || {}),
        fontWeight: numeric,
      },
    }));
  };

  const fieldTextValues = useMemo(
    () => ({
      words: vWords,
      desc: vDesc,
      bank: vBank,
      fxRate: vFxRate,
      receivedBy: vReceivedBy,
      beneficiary: vBeneficiary,
      notes: vNotes,
      chequeNo: vChequeNo,
      nationalId: vNationalId,
      phone: vPhone,
      sanadNo: vSanadNo,
    }),
    [
      vWords,
      vDesc,
      vBank,
      vFxRate,
      vReceivedBy,
      vBeneficiary,
      vNotes,
      vChequeNo,
      vNationalId,
      vPhone,
      vSanadNo,
    ]
  );

  const toolbarStyle = useMemo(() => {
    if (!selectedField) {
      return { fontSize: 16, fontWeight: 700, color: "#111827" };
    }

    const base = getStyle(selectedField);

    if (fieldSelection?.fieldKey !== selectedField) return base;

    const text = String(fieldTextValues[selectedField] ?? "");
    if (!text.length) return base;

    const start = Number(fieldSelection.start) || 0;
    const end = Number(fieldSelection.end) || 0;
    const at = getStyleAtRange(
      text,
      fieldColorRuns?.[selectedField] || [],
      start,
      end,
      getFieldStyleDefaults(selectedField)
    );

    return {
      fontSize: at.fontSize,
      fontWeight: at.fontWeight,
      color: at.color,
    };
  }, [
    selectedField,
    fieldSelection,
    fieldColorRuns,
    fieldTextValues,
    fieldStyles,
    globalTextStyle,
  ]);

  const updateFieldColorRuns = useCallback(
    (fieldKey, runs) => {
      if (!setFieldColorRuns) return;
      setFieldColorRuns((prev) => ({
        ...(prev || {}),
        [fieldKey]: runs,
      }));
    },
    [setFieldColorRuns]
  );

  const setFieldColor = (fieldKey, color) => {
    const normalized = normalizeColor(color, "#111827");
    if (applySelectionStyle(fieldKey, { color: normalized })) return;

    setFieldStyles((prev) => ({
      ...prev,
      [fieldKey]: {
        ...(prev?.[fieldKey] || {}),
        color: normalized,
      },
    }));
  };

  const applyToAllFields = () => {
    if (!selectedField) return;
    const current = getStyle(selectedField);

    setGlobalTextStyle({
      fontSize: current.fontSize,
      fontWeight: current.fontWeight,
      color: current.color,
    });

    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = {
          ...(next[key] || {}),
          fontSize: current.fontSize,
          fontWeight: current.fontWeight,
          color: current.color,
        };
      });
      return next;
    });
  };

  const setAllFontSize = (size) => {
    const numeric = clampFontSize(size, 16);
    setGlobalTextStyle((prev) => ({ ...prev, fontSize: numeric }));
    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...(next[key] || {}), fontSize: numeric };
      });
      return next;
    });
  };

  const setAllFontWeight = (weight) => {
    const numeric = clampFontWeight(weight, 700);
    setGlobalTextStyle((prev) => ({ ...prev, fontWeight: numeric }));
    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...(next[key] || {}), fontWeight: numeric };
      });
      return next;
    });
  };

  const setAllColor = (color) => {
    const normalized = normalizeColor(color, "#111827");
    setGlobalTextStyle((prev) => ({ ...prev, color: normalized }));
    setFieldStyles((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...(next[key] || {}), color: normalized };
      });
      return next;
    });
  };

  const nudgeSelectedSize = (diff) => {
    if (!selectedField) return;
    const current = toolbarStyle.fontSize;
    const next = Math.max(8, Math.min(72, current + diff));
    setFieldFontSize(selectedField, next);
  };

  const nudgeSelectedWeight = (diff) => {
    if (!selectedField) return;
    const current = toolbarStyle.fontWeight;
    const next = Math.max(100, Math.min(900, current + diff));
    setFieldFontWeight(selectedField, next);
  };

  const nudgeAllSize = (diff) => {
    const next = Math.max(8, Math.min(72, globalTextStyle.fontSize + diff));
    setAllFontSize(next);
  };

  const nudgeAllWeight = (diff) => {
    const next = Math.max(100, Math.min(900, globalTextStyle.fontWeight + diff));
    setAllFontWeight(next);
  };

  const oneLineRtl = (fieldKey) =>
    mergeFieldTextStyle(fieldKey, {
      textAlign: "right",
      whiteSpace: "nowrap",
    });

  const oneLineLtr = (fieldKey) =>
    mergeFieldTextStyle(fieldKey, {
      textAlign: "left",
      whiteSpace: "nowrap",
    });

  const multiLineRtl = (fieldKey) =>
    mergeFieldTextStyle(fieldKey, {
      textAlign: "right",
    });

  const editableFieldProps = (fieldKey) => ({
    onFocus: () => setSelectedField(fieldKey),
    onClick: () => setSelectedField(fieldKey),
  });

  const richFieldProps = (fieldKey, value, onChange, options = {}) => {
    const fieldStyle = getStyle(fieldKey);
    return {
      fieldKey,
      value,
      colorRuns: fieldColorRuns?.[fieldKey] || [],
      defaultColor: fieldStyle.color,
      defaultFontSize: fieldStyle.fontSize,
      defaultFontWeight: fieldStyle.fontWeight,
      onChange,
      onColorRunsChange: (runs) => updateFieldColorRuns(fieldKey, runs),
      onSelectionChange: setFieldSelection,
      ...editableFieldProps(fieldKey),
      ...options,
    };
  };

  /** أساس موحّد للصرف والقبض — نفس POS/EXTRA بغض النظر عن نوع الوصل */
  const layoutBasePOS = POS_NEW;
  const layoutBaseEXTRA = useMemo(
    () => getCompanyExtra(selectedCompany, false),
    [selectedCompany?.key]
  );

  // قبل الرسم: طبّق الكاش/الافتراضي حتى ما يطلع الوصل فاضي بعد السبنر
  useLayoutEffect(() => {
    if (!open || !selectedCompany?.key) return;
    const defaults = buildDefaultVoucherLayoutFields({
      company: selectedCompany,
      POS: POS_NEW,
      EXTRA: getCompanyExtra(selectedCompany, false),
    });
    const cached = readCachedVoucherLayout(selectedCompany.key);
    setLayoutFields(cached || defaults);
    setLayoutReady(true);
    setLayoutLoading(false);
    setLayoutMode(false);
    setLayoutSelectedKey(null);
  }, [open, selectedCompany?.key]);

  useEffect(() => {
    if (!open || !selectedCompany?.key) return undefined;
    let cancelled = false;

    const companyKey = selectedCompany.key;
    const defaults = buildDefaultVoucherLayoutFields({
      company: selectedCompany,
      POS: POS_NEW,
      EXTRA: getCompanyExtra(selectedCompany, false),
    });
    const cached = readCachedVoucherLayout(companyKey);

    const applyFields = (fields) => {
      if (cancelled || !fields?.length) return;
      writeCachedVoucherLayout(companyKey, fields);
      startTransition(() => {
        if (cancelled) return;
        setLayoutFields((prev) => (layoutFieldsEqual(prev, fields) ? prev : fields));
      });
    };

    // تحديث خلفي فقط — لا نعلّق الواجهة ولا ننتظر الشبكة
    const schedule =
      typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
        ? (cb) => window.requestIdleCallback(cb, { timeout: 1200 })
        : (cb) => window.setTimeout(cb, cached ? 400 : 0);
    const cancelSchedule =
      typeof window !== "undefined" && typeof window.cancelIdleCallback === "function"
        ? (id) => window.cancelIdleCallback(id)
        : (id) => clearTimeout(id);

    const idleId = schedule(() => {
      if (cancelled) return;
      void prefetchVoucherLayout(companyKey)
        .then((fields) => applyFields(fields || cached || defaults))
        .catch(() => {
          if (!cached) applyFields(defaults);
        });
    });

    return () => {
      cancelled = true;
      cancelSchedule(idleId);
    };
  }, [open, selectedCompany?.key]);

  const fieldsMap = useMemo(() => fieldsToMap(layoutFields), [layoutFields]);

  const { pos, extra } = useMemo(() => {
    const applied = applyLayoutToPosExtra(layoutBasePOS, layoutBaseEXTRA, fieldsMap);
    return { pos: applied.POS, extra: applied.EXTRA };
  }, [layoutBaseEXTRA, fieldsMap]);

  const liveChecklist = useMemo(
    () => applyLayoutToCategoryChecklist(categoryChecklist, fieldsMap),
    [categoryChecklist, fieldsMap]
  );

  const voucherNoPos = fieldsMap.voucherNo || DEFAULT_VOUCHER_NO_POS;

  const updateLayoutField = useCallback((key, patch) => {
    setLayoutFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f))
    );
  }, []);

  const startLayoutDrag = useCallback(
    (e, fieldKey) => {
      if (!layoutMode || !paperRef?.current) return;
      e.preventDefault();
      e.stopPropagation();
      setLayoutSelectedKey(fieldKey);

      const rect = paperRef.current.getBoundingClientRect();
      const field = layoutFields.find((f) => f.key === fieldKey);
      if (!field || !rect?.width || !rect?.height) return;

      layoutDragRef.current = {
        key: fieldKey,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: field.left,
        startTop: field.top,
        rectW: rect.width,
        rectH: rect.height,
      };

      const onMove = (ev) => {
        const d = layoutDragRef.current;
        if (!d) return;
        const dx = ((ev.clientX - d.startX) / d.rectW) * 100;
        const dy = ((ev.clientY - d.startY) / d.rectH) * 100;
        updateLayoutField(d.key, {
          left: Math.round((d.startLeft + dx) * 100) / 100,
          top: Math.round((d.startTop + dy) * 100) / 100,
        });
      };

      const onUp = () => {
        layoutDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [layoutMode, paperRef, layoutFields, updateLayoutField]
  );

  const saveLayout = useCallback(async () => {
    if (!selectedCompany?.key || !canLayout) return;
    try {
      setLayoutSaving(true);
      const res = await fetch("/api/vouchers/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyKey: selectedCompany.key,
          fields: layoutFields,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "فشل حفظ التخطيط");
      }
      if (Array.isArray(json.data?.fields)) {
        writeCachedVoucherLayout(selectedCompany.key, json.data.fields);
        setLayoutFields(json.data.fields);
      } else {
        writeCachedVoucherLayout(selectedCompany.key, layoutFields);
      }
      setLayoutMode(false);
      setLayoutSelectedKey(null);
      alert("تم حفظ الإحداثيات — نفس الترتيب لوصل الصرف والقبض");
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر حفظ التخطيط");
    } finally {
      setLayoutSaving(false);
    }
  }, [selectedCompany?.key, canLayout, layoutFields]);

  if (!selectedCompany) return null;

  const customerPersonName = vReceivedBy;
  const allowEur = isAlGhadeerMain(selectedCompany?.key);

  const dateStyle = getStyle("date");
  const currencyMarkStyle = getStyle("currencyMark");
  const voucherNoStyle = getStyle("voucherNo");

  const currencyMarkPos =
    vCurrency === "USD"
      ? pos.currencyUSDBox
      : vCurrency === "EUR" && allowEur && pos.currencyEURBox
        ? pos.currencyEURBox
        : pos.currencyIQDBox;

  const easeOut = [0.22, 1, 0.36, 1];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/40 p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: easeOut }}
          onClick={onClose}
        >
          <div className="min-h-full flex items-start justify-center py-4 sm:py-6">
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[1180px] rounded-3xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/25 shadow-[0_18px_45px_-25px_rgba(0,0,0,0.45)]"
              initial={{ opacity: 0, y: 28, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.99 }}
              transition={{ duration: 0.32, ease: easeOut, delay: 0.04 }}
            >
              <div className="flex items-center justify-between px-5 py-4 bg-white/25">
                <div className="text-sm font-extrabold text-gray-900">
                  {isPayment ? "وصل صرف" : "وصل قبض"} — {selectedCompany.name}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                {allowEur ? (
                  <div className="flex items-center gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-slate-200/80">
                    {[
                      { code: "IQD", label: "دينار" },
                      { code: "USD", label: "دولار" },
                      { code: "EUR", label: "يورو" },
                    ].map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setVCurrency?.(opt.code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                          vCurrency === opt.code
                            ? "bg-emerald-600 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {canLayout ? (
                  layoutMode ? (
                    <>
                      <button
                        type="button"
                        onClick={saveLayout}
                        disabled={layoutSaving || layoutLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm font-extrabold hover:bg-emerald-700 disabled:opacity-60 transition-all duration-150"
                      >
                        <FiSave className={`text-lg ${layoutSaving ? "animate-spin" : ""}`} />
                        {layoutSaving ? "جاري الحفظ..." : "حفظ الإحداثيات"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setLayoutSelectedKey(null);
                          setLayoutMode(false);
                          // أعد التحميل من السيرفر لإلغاء التعديلات غير المحفوظة
                          try {
                            const qs = new URLSearchParams({
                              companyKey: selectedCompany.key,
                            });
                            const res = await fetch(`/api/vouchers/layout?${qs}`, {
                              credentials: "include",
                              cache: "no-store",
                            });
                            const json = await res.json();
                            if (json?.success && Array.isArray(json.data?.fields)) {
                              writeCachedVoucherLayout(
                                selectedCompany.key,
                                json.data.fields
                              );
                              setLayoutFields(json.data.fields);
                              setLayoutReady(true);
                            }
                          } catch {
                            /* ignore */
                          }
                        }}
                        disabled={layoutSaving}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 ring-1 ring-black/10 font-extrabold text-gray-800 hover:bg-white transition-all duration-150"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLayoutMode(true)}
                      disabled={layoutLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 text-white shadow-sm font-extrabold hover:bg-amber-600 disabled:opacity-60 transition-all duration-150"
                      title="ترتيب أماكن كل الحقول بما فيها جيك بوكس الفئة"
                    >
                      <FiMove className="text-lg" />
                      ترتيب الحقول
                    </button>
                  )
                ) : null}
                {isViewPage && !editMode && !layoutMode ? (
  <button
    onClick={onToggleEdit}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white shadow-sm font-extrabold hover:bg-blue-700 hover:shadow-md active:scale-[0.97] transition-all duration-150"
  >
    <FiEdit2 className="text-lg" />
    Edit
  </button>
) : isViewPage && editMode && !layoutMode ? (
  <button
    onClick={onSave}
    disabled={isSaving}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm font-extrabold hover:bg-emerald-700 hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-150"
  >
    <FiSave className={`text-lg ${isSaving ? "animate-spin" : ""}`} />
    {isSaving ? "Saving..." : "Save"}
  </button>
) : null}

  <button
    onClick={() => {
      if (!hasBeenCreated) {
        onCreate?.();
      } else {
        onPrintOnly?.();
      }
    }}
    disabled={isPrinting}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/70 backdrop-blur ring-1 ring-black/5 shadow-sm font-extrabold text-gray-800 hover:bg-white hover:shadow-md active:scale-[0.97] disabled:opacity-60 transition-all duration-150"
  >
    <FiPrinter className={`text-lg ${isPrinting ? "animate-spin" : ""}`} />
    {!hasBeenCreated
      ? isPrinting
        ? creatingButtonText || "جاري الإنشاء..."
        : createButtonText || "إنشاء"
      : isPrinting
      ? printingOnlyButtonText || "جاري الطباعة..."
      : printOnlyButtonText || "طباعة"}
  </button>

  <button
    onClick={() => onClose?.()}
    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-600 text-white shadow-sm font-extrabold hover:bg-red-700 hover:shadow-md active:scale-[0.97] transition-all duration-150"
  >
    <FiX className="text-lg" />
    إغلاق
  </button>
</div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
                  <div className="rounded-3xl bg-white/35 backdrop-blur-2xl ring-1 ring-white/25 p-4">
                    <div className="w-full">
                      <div
                        ref={paperRef}
                        className={`relative bg-white overflow-hidden ${cairo.className}`}
                        style={{
                          width: "210mm",
                          height: "297mm",
                          margin: "0 auto",
                        }}
                      >
                        <img
                          src={currentImg}
                          alt="voucher"
                          onLoad={onImageLoad}
                          draggable={false}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "fill",
                            objectPosition: "top center",
                            userSelect: "none",
                            pointerEvents: "none",
                          }}
                        />

                        <div className="absolute inset-0">
                        <div
                          className={`absolute leading-none ${cairo.className}`}
                          style={{
                            ...pctStyle(currencyMarkPos),
                            fontSize: `${currencyMarkStyle.fontSize}px`,
                            fontWeight: currencyMarkStyle.fontWeight,
                            color: currencyMarkStyle.color,
                          }}
                        >
                          ✓
                        </div>

                        <div
                          className={`absolute flex items-center gap-2 text-white font-extrabold ${cairo.className}`}
                          style={{ ...pctStyle(pos.date), fontSize: "12px" }}
                        >
                          <span style={{ transform: "translateX(-12px)" }}>{vDateYY || todayYY}</span>
                          <span style={{ transform: "translateX(-2px)" }}>{vDateMM || todayMM}</span>
                          <span style={{ transform: "translateX(1px)" }}>{vDateDD || todayDD}</span>
                        </div>

                        {cbOne ? (
                          <div
                            className={`absolute leading-none ${cairo.className}`}
                            style={{
                              ...pctStyle(extra.cb1),
                              fontSize: `${currencyMarkStyle.fontSize}px`,
                              fontWeight: currencyMarkStyle.fontWeight,
                              color: currencyMarkStyle.color,
                            }}
                          >
                            ✓
                          </div>
                        ) : null}

                        {cbTwo ? (
                          <div
                            className={`absolute leading-none ${cairo.className}`}
                            style={{
                              ...pctStyle(extra.cb2),
                              fontSize: `${currencyMarkStyle.fontSize}px`,
                              fontWeight: currencyMarkStyle.fontWeight,
                              color: currencyMarkStyle.color,
                            }}
                          >
                            ✓
                          </div>
                        ) : null}

                        <VoucherCategoryChecklist
                          items={liveChecklist}
                          values={categoryChecks}
                          showMarks
                          showHits={false}
                          className={cairo.className}
                          markStyle={{
                            fontSize: `${currencyMarkStyle.fontSize}px`,
                            fontWeight: currencyMarkStyle.fontWeight,
                            color: currencyMarkStyle.color,
                          }}
                        />

                        {voucherNo !== null || layoutMode ? (
                          <div
                            className={`absolute ${cairo.className}`}
                            style={{
                              top: `${voucherNoPos.top}%`,
                              left: `${voucherNoPos.left}%`,
                              fontSize: "12px",
                              fontWeight: voucherNoStyle.fontWeight,
                              direction: "ltr",
                              textAlign: "left",
                              letterSpacing: "1px",
                              color: voucherNoStyle.color,
                            }}
                          >
                            NO:{String(voucherNo ?? 0).padStart(5, "0")}
                          </div>
                        ) : null}

                        <div
                          className="absolute inset-0"
                          style={{
                            pointerEvents: layoutMode ? "none" : "auto",
                          }}
                        >
                          <div
                            className="absolute flex items-center gap-5"
                            style={{
                              ...pctStyle(pos.date),
                              width: `${pos.date?.width ?? 22}%`,
                              height: `${pos.date?.height ?? 7}%`,
                            }}
                          >
                            <textarea
                              ref={yyRef}
                              inputMode="numeric"
                              value={vDateYY}
                              onChange={onYYChange}
                              maxLength={2}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              className="h-full resize-none"
                              style={{
                                width: "28px",
                                height: "100%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                              }}
                              dir="rtl"
                            />

                            <textarea
                              ref={mmRef}
                              inputMode="numeric"
                              value={vDateMM}
                              onChange={onMMChange}
                              maxLength={2}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                onDateKeyDown?.(e, "mm");
                              }}
                              className="h-full resize-none"
                              style={{
                                width: "28px",
                                height: "100%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                              }}
                              dir="rtl"
                            />

                            <textarea
                              ref={ddRef}
                              inputMode="numeric"
                              value={vDateDD}
                              onChange={onDDChange}
                              maxLength={2}
                              rows={1}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                                onDateKeyDown?.(e, "dd");
                              }}
                              className="h-full resize-none"
                              style={{
                                width: "28px",
                                height: "100%",
                                opacity: 0,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                              }}
                              dir="rtl"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => setVCurrency("USD")}
                            className="absolute"
                            style={{ ...pctStyle(pos.currencyUSDBox), width: "7%", height: "7%", opacity: 0 }}
                            aria-label="USD"
                          />
                          <button
                            type="button"
                            onClick={() => setVCurrency("IQD")}
                            className="absolute"
                            style={{ ...pctStyle(pos.currencyIQDBox), width: "7%", height: "7%", opacity: 0 }}
                            aria-label="IQD"
                          />
                          {allowEur && pos.currencyEURBox ? (
                            <button
                              type="button"
                              onClick={() => setVCurrency("EUR")}
                              className="absolute"
                              style={{
                                ...pctStyle(pos.currencyEURBox),
                                width: "7%",
                                height: "7%",
                                opacity: 0,
                              }}
                              aria-label="EUR"
                            />
                          ) : null}

                          <VoucherRichTextInput
                            ref={receivedByRef}
                            {...richFieldProps("receivedBy", vReceivedBy, handleReceivedByChange, {
                              singleLine: true,
                              className: "absolute resize-none",
                              style: {
                                ...pctStyle(extra.receivedBy),
                                width: `${extra.receivedBy.width}%`,
                                height: `${extra.receivedBy.height}%`,
                                ...oneLineRtl("receivedBy"),
                              },
                              direction: "rtl",
                              onKeyDown: handlePersonKeyDown,
                            })}
                          />

                          {extra.nationalId ? (
                            <VoucherRichTextInput
                              ref={nationalIdRef}
                              {...richFieldProps("nationalId", vNationalId, setVNationalId, {
                                singleLine: true,
                                className: "absolute resize-none",
                                style: {
                                  ...pctStyle(extra.nationalId),
                                  width: `${extra.nationalId.width}%`,
                                  height: `${extra.nationalId.height}%`,
                                  ...oneLineRtl("nationalId"),
                                },
                                direction: "rtl",
                              })}
                            />
                          ) : null}

                          {extra.phone ? (
                            <VoucherRichTextInput
                              ref={phoneRef}
                              {...richFieldProps("phone", vPhone, setVPhone, {
                                singleLine: true,
                                className: "absolute resize-none",
                                style: {
                                  ...pctStyle(extra.phone),
                                  width: `${extra.phone.width}%`,
                                  height: `${extra.phone.height}%`,
                                  ...oneLineRtl("phone"),
                                },
                                direction: "rtl",
                              })}
                            />
                          ) : null}

                          {extra.sanadNo ? (
                            <VoucherRichTextInput
                              ref={sanadRef}
                              {...richFieldProps("sanadNo", vSanadNo, setVSanadNo, {
                                singleLine: true,
                                className: "absolute resize-none",
                                style: {
                                  ...pctStyle(extra.sanadNo),
                                  width: `${extra.sanadNo.width}%`,
                                  height: `${extra.sanadNo.height}%`,
                                  ...oneLineRtl("sanadNo"),
                                },
                                direction: "rtl",
                              })}
                            />
                          ) : null}

                          <VoucherRichTextInput
                            ref={wordsRef}
                            {...richFieldProps("words", vWords, setVWords, {
                              className: "absolute resize-none",
                              style: {
                                ...pctStyle(pos.amountWords),
                                width: `${pos.amountWords.width}%`,
                                height: "13%",
                                ...multiLineRtl("words"),
                              },
                              direction: "rtl",
                            })}
                          />

                          <VoucherRichTextInput
                            ref={descRef}
                            {...richFieldProps("desc", vDesc, handleDescChange, {
                              className: "absolute resize-none",
                              style: {
                                ...pctStyle(pos.description),
                                width: `${pos.description.width}%`,
                                height: `${pos.description.height}%`,
                                ...multiLineRtl("desc"),
                              },
                              direction: "rtl",
                              onKeyDown: handleDescKeyDown,
                              onFocus: () => {
                                setSelectedField("desc");
                                if (String(vDesc || "").trim().length >= 2) {
                                  openDescSuggest(vDesc, descRef);
                                }
                              },
                            })}
                          />

                          <VoucherRichTextInput
                            ref={bankRef}
                            {...richFieldProps("bank", vBank, setVBank, {
                              singleLine: true,
                              className: "absolute resize-none",
                              style: {
                                ...pctStyle(extra.bank),
                                width: `${extra.bank.width}%`,
                                height: `${extra.bank.height}%`,
                                ...oneLineRtl("bank"),
                              },
                              direction: "rtl",
                            })}
                          />

                          {extra.beneficiary ? (
                            <VoucherRichTextInput
                              ref={beneficiaryRef}
                              {...richFieldProps(
                                "beneficiary",
                                vBeneficiary,
                                handleBeneficiaryChange,
                                {
                                  singleLine: true,
                                  className: "absolute resize-none",
                                  style: {
                                    ...pctStyle(extra.beneficiary),
                                    width: `${extra.beneficiary.width}%`,
                                    height: `${extra.beneficiary.height}%`,
                                    ...oneLineRtl("beneficiary"),
                                  },
                                  direction: "rtl",
                                  onKeyDown: handlePersonKeyDown,
                                }
                              )}
                            />
                          ) : null}

                          {extra.chequeNo ? (
                            <VoucherRichTextInput
                              ref={chequeNoRef}
                              {...richFieldProps("chequeNo", vChequeNo, handleChequeNoChange, {
                                singleLine: true,
                                className: "absolute resize-none",
                                style: {
                                  ...pctStyle(extra.chequeNo),
                                  width: `${extra.chequeNo.width}%`,
                                  height: `${extra.chequeNo.height}%`,
                                  ...oneLineLtr("chequeNo"),
                                },
                                direction: "ltr",
                                onKeyDown: handleChequeKeyDown,
                                onFocus: () =>
                                  openChequeSuggest(vChequeNo, chequeNoRef),
                              })}
                            />
                          ) : null}

                          <VoucherRichTextInput
                            ref={notesRef}
                            {...richFieldProps("notes", vNotes, setVNotes, {
                              className: "absolute resize-none",
                              style: {
                                ...pctStyle(extra.notes),
                                width: `${extra.notes.width}%`,
                                height: `${extra.notes.height}%`,
                                ...multiLineRtl("notes"),
                              },
                              direction: "rtl",
                            })}
                          />

                          <textarea
                            ref={amountRef}
                            value={vAmount}
                            onChange={(e) => {
                              const cleaned = cleanAmount(e.target.value);
                              if (!cleaned) {
                                setVAmount("");
                                return;
                              }
                              setVAmount(formatAmount(cleaned));
                            }}
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            className="absolute resize-none"
                            style={{
                              ...pctStyle(pos.amountFixed),
                              width: "22%",
                              height: "7%",
                              ...oneLineLtr("amount"),
                            }}
                            dir="ltr"
                            {...editableFieldProps("amount")}
                          />

                          <VoucherRichTextInput
                            ref={fxRef}
                            {...richFieldProps("fxRate", vFxRate, setVFxRate, {
                              singleLine: true,
                              className: "absolute resize-none",
                              style: {
                                ...pctStyle(extra.fxRate),
                                width: `${extra.fxRate.width}%`,
                                height: `${extra.fxRate.height}%`,
                                ...oneLineLtr("fxRate"),
                              },
                              direction: "ltr",
                            })}
                          />

                          <label
                            className="absolute"
                            style={{
                              ...pctStyle(extra.cb1),
                              width: `${extra.cb1?.width ?? 3}%`,
                              height: `${extra.cb1?.height ?? 3}%`,
                              opacity: 0,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={cbOne}
                              onChange={(e) => setCbOne(e.target.checked)}
                              style={{ width: "100%", height: "100%", margin: 0, cursor: "pointer" }}
                            />
                          </label>

                          <label
                            className="absolute"
                            style={{
                              ...pctStyle(extra.cb2),
                              width: `${extra.cb2?.width ?? 3}%`,
                              height: `${extra.cb2?.height ?? 3}%`,
                              opacity: 0,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={cbTwo}
                              onChange={(e) => setCbTwo(e.target.checked)}
                              style={{ width: "100%", height: "100%", margin: 0, cursor: "pointer" }}
                            />
                          </label>

                          {!(isViewPage && !editMode) && !layoutMode ? (
                            <VoucherCategoryChecklist
                              items={liveChecklist}
                              values={categoryChecks}
                              showMarks={false}
                              showHits
                              onToggle={onToggleCategoryCheck}
                            />
                          ) : null}
                        </div>

                        {layoutMode ? (
                          <div className="absolute inset-0 z-20">
                            {layoutFields.map((f) => {
                              const selected = layoutSelectedKey === f.key;
                              const isCat = isCategoryLayoutField(f.key);
                              const label = getFieldLabel(f.key, selectedCompany);
                              return (
                                <div
                                  key={f.key}
                                  onMouseDown={(e) => startLayoutDrag(e, f.key)}
                                  className={`absolute flex items-center justify-center rounded-lg border-2 cursor-move select-none ${
                                    selected
                                      ? "border-amber-500 bg-amber-300/70"
                                      : isCat
                                        ? "border-violet-600 bg-violet-300/65"
                                        : "border-sky-400/90 bg-sky-300/35"
                                  }`}
                                  style={{
                                    top: `${f.top}%`,
                                    left: `${f.left}%`,
                                    width: `${Math.max(f.width || 8, isCat ? 10 : 6)}%`,
                                    height: `${Math.max(f.height || 4, isCat ? 5 : 3)}%`,
                                    minWidth: isCat ? 88 : 28,
                                    minHeight: isCat ? 36 : 18,
                                    zIndex: isCat ? 25 : 20,
                                  }}
                                  title={label}
                                >
                                  <span
                                    className={`px-0.5 truncate max-w-full text-slate-900 ${
                                      isCat
                                        ? "text-[11px] font-black"
                                        : "text-[9px] font-extrabold"
                                    }`}
                                  >
                                    {label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={openDateModal}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل تاريخ
                          </button>

                          <button
                            type="button"
                            onClick={() => amountRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل مبلغ
                          </button>

                          {chequeNoRef ? (
                            <button
                              type="button"
                              onClick={() => chequeNoRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل رقم الشيك
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => wordsRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل مبلغ بالحروف
                          </button>

                          {nationalIdRef ? (
                            <button
                              type="button"
                              onClick={() => nationalIdRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل البطاقة الوطنية
                            </button>
                          ) : null}

                          {phoneRef ? (
                            <button
                              type="button"
                              onClick={() => phoneRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل رقم الهاتف
                            </button>
                          ) : null}

                          {sanadRef ? (
                            <button
                              type="button"
                              onClick={() => sanadRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل رقم السند
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => descRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل وصف
                          </button>

                          <button
                            type="button"
                            onClick={() => fxRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل سعر الصرف
                          </button>

                          <button
                            type="button"
                            onClick={() => receivedByRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل استلمت من
                          </button>

                          <button
                            type="button"
                            onClick={() => bankRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل بنك
                          </button>

                          {beneficiaryRef ? (
                            <button
                              type="button"
                              onClick={() => beneficiaryRef.current?.focus()}
                              className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                            >
                              تعديل مستفيد
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => notesRef.current?.focus()}
                            className="px-4 py-2 rounded-2xl bg-white/70 hover:bg-white ring-1 ring-black/5 font-extrabold text-gray-800 transition"
                          >
                            تعديل ملاحظات
                          </button>

                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticky top-4 rounded-3xl bg-white/55 backdrop-blur-2xl ring-1 ring-white/30 p-4 shadow-sm">
                    <VoucherPersonIdentityPanel
                      personName={customerPersonName}
                      disabled={isViewPage && !editMode}
                    />

                    <div className="flex items-center gap-2 mb-4 text-gray-900 font-extrabold">
                      <FiType />
                      أدوات النص
                    </div>

                    <div className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3 mb-4">
                      <div className="text-xs text-gray-500 mb-1">الحقل المحدد</div>
                      <div className="font-extrabold text-gray-900">
                        {selectedField ? fieldLabels[selectedField] : "ما محدد"}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3 mb-4">
                      <div className="font-extrabold text-gray-900 mb-3">تعديل الحقل المحدد</div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>حجم الخط</span>
                          <span>{selectedField ? toolbarStyle.fontSize : "-"} px</span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => nudgeSelectedSize(-1)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiMinus />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeSelectedSize(1)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiPlus />
                          </button>
                        </div>

                        <input
                          type="range"
                          min="8"
                          max="72"
                          step="1"
                          value={selectedField ? toolbarStyle.fontSize : 16}
                          disabled={!selectedField}
                          onChange={(e) => selectedField && setFieldFontSize(selectedField, e.target.value)}
                          className="w-full"
                        />
                        {hasActiveTextSelection ? (
                          <p className="mt-2 text-xs font-bold text-emerald-700">
                            سيتطبق الحجم على النص المحدد فقط
                          </p>
                        ) : null}
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>سماكة الخط</span>
                          <span>{selectedField ? toolbarStyle.fontWeight : "-"}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => nudgeSelectedWeight(-100)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiMinus />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeSelectedWeight(100)}
                            disabled={!selectedField}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center disabled:opacity-40"
                          >
                            <FiBold />
                          </button>
                        </div>

                        <input
                          type="range"
                          min="100"
                          max="900"
                          step="100"
                          value={selectedField ? toolbarStyle.fontWeight : 700}
                          disabled={!selectedField}
                          onChange={(e) => selectedField && setFieldFontWeight(selectedField, e.target.value)}
                          className="w-full"
                        />
                        {hasActiveTextSelection ? (
                          <p className="mt-2 text-xs font-bold text-emerald-700">
                            ستطبق السماكة على النص المحدد فقط
                          </p>
                        ) : null}
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>لون الخط</span>
                          <span
                            className="inline-block w-6 h-6 rounded border border-gray-300"
                            style={{
                              backgroundColor: selectedField
                                ? toolbarStyle.color || "#111827"
                                : "#111827",
                            }}
                          />
                        </div>

                        <input
                          type="color"
                          value={selectedField ? toolbarStyle.color || "#111827" : "#111827"}
                          disabled={!selectedField}
                          onChange={(e) => selectedField && setFieldColor(selectedField, e.target.value)}
                          className="w-full h-10 rounded-xl border border-black/10 bg-white cursor-pointer disabled:opacity-40"
                        />
                        {hasActiveTextSelection ? (
                          <p className="mt-2 text-xs font-bold text-emerald-700">
                            سيتطبق اللون على النص المحدد فقط
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-gray-600 leading-5">
                            حدّد جزءًا من النص داخل الحقل ثم عدّل الحجم أو السماكة أو اللون، أو غيّر الإعدادات لتطبيقها على الحقل كاملًا.
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={applyToAllFields}
                        disabled={!selectedField}
                        className="mt-4 w-full px-4 py-2.5 rounded-2xl bg-gray-900 text-white font-extrabold disabled:opacity-40"
                      >
                        تطبيق إعدادات الحقل على الكل
                      </button>
                    </div>

                    <div className="rounded-2xl bg-white/60 ring-1 ring-black/5 p-3">
                      <div className="font-extrabold text-gray-900 mb-3">تعديل كل الانبتات</div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>حجم الخط العام</span>
                          <span>{globalTextStyle.fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => nudgeAllSize(-1)}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center"
                          >
                            <FiMinus />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeAllSize(1)}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center"
                          >
                            <FiPlus />
                          </button>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="72"
                          step="1"
                          value={globalTextStyle.fontSize}
                          onChange={(e) => setAllFontSize(e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>سماكة الخط العامة</span>
                          <span>{globalTextStyle.fontWeight}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => nudgeAllWeight(-100)}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center"
                          >
                            <FiMinus />
                          </button>
                          <button
                            type="button"
                            onClick={() => nudgeAllWeight(100)}
                            className="w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 grid place-items-center"
                          >
                            <FiBold />
                          </button>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="900"
                          step="100"
                          value={globalTextStyle.fontWeight}
                          onChange={(e) => setAllFontWeight(e.target.value)}
                          className="w-full"
                        />
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm font-bold text-gray-700 mb-2">
                          <span>اللون العام</span>
                          <span
                            className="inline-block w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: globalTextStyle.color }}
                          />
                        </div>
                        <input
                          type="color"
                          value={globalTextStyle.color}
                          onChange={(e) => setAllColor(e.target.value)}
                          className="w-full h-10 rounded-xl border border-black/10 bg-white cursor-pointer"
                        />
                      </div>

                      <div className="mt-4 text-xs text-gray-600 leading-6">
                        اضغط على أي حقل داخل الوصل، وبعدها عدّل الحجم أو السماكة أو اللون من هنا.
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white/60 ring-1 ring-black/5 p-3">
                      <div className="text-sm font-extrabold text-gray-900 mb-2">الحقول</div>
                      <div className="flex flex-wrap gap-2">
                        {allFieldKeys.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedField(key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                              selectedField === key
                                ? "bg-gray-900 text-white"
                                : "bg-white text-gray-800 ring-1 ring-black/5"
                            }`}
                          >
                            {fieldLabels[key] || key}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <VoucherDateModal
                open={dateModalOpen}
                tmpDate={tmpDate}
                setTmpDate={setTmpDate}
                only2Digits={only2Digits}
                onClose={() => setDateModalOpen(false)}
                onSave={saveDateModal}
              />

              <PersonNameSuggestDropdown
                show={personShow}
                options={personOptions}
                activeIdx={personActiveIdx}
                setActiveIdx={setPersonActiveIdx}
                pos={personPos}
                boxRef={personBoxRef}
                onPick={applyPersonPick}
              />

              <ChequeSuggestDropdown
                show={chequeShow}
                options={chequeOptions}
                activeIdx={chequeActiveIdx}
                setActiveIdx={setChequeActiveIdx}
                pos={chequePos}
                boxRef={chequeBoxRef}
                onPick={applyChequePick}
              />

              <DescSuggestDropdown
                show={descShow}
                options={descOptions}
                activeIdx={descActiveIdx}
                setActiveIdx={setDescActiveIdx}
                pos={descPos}
                boxRef={descBoxRef}
                onPick={applyDescPick}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}