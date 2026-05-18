
"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";
import VoucherCanvasDialog from "@/components/VoucherCanvasDialog";
// Shared imports
import { 
  only2Digits, 
  cleanAmount, 
  formatAmount, 
  numberToArabicWords, 
  waitForImages 
} from "@/lib/voucher/utils";

import {
  DEFAULT_GLOBAL_TEXT_STYLE,
  DEFAULT_FIELD_STYLES,
  clampFontSize,
  normalizeHexColor,
  normalizeGlobalTextStyle,
  normalizeFieldStyles
} from "@/lib/voucher/styles";

import {
  COMPANIES,
  TEMPLATE_SWITCH_DATE,
  POS_OLD,
  EXTRA_OLD,
  POS_NEW,
  EXTRA_NEW,
} from "@/lib/voucher/companies";

function buildLegacyStyles(doc) {
  const mainColor = normalizeHexColor(doc?.fontColorMain, "#111827");
  const accentColor = normalizeHexColor(doc?.fontColorAccent, "#111827");

  const amountSize = clampFontSize(doc?.fontSizeAmount, 16);
  const wordsSize = clampFontSize(doc?.fontSizeWords, 16);
  const descSize = clampFontSize(doc?.fontSizeDesc, 16);
  const extraSize = clampFontSize(doc?.fontSizeExtra, 16);

  const global = {
    fontSize: extraSize,
    fontWeight: 700,
    color: accentColor,
  };

  const fields = {
    ...DEFAULT_FIELD_STYLES,
    amount: { fontSize: amountSize, fontWeight: 800, color: mainColor },
    words: { fontSize: wordsSize, fontWeight: 700, color: mainColor },
    desc: { fontSize: descSize, fontWeight: 600, color: mainColor },
    bank: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    fxRate: { fontSize: extraSize, fontWeight: 800, color: accentColor },
    receivedBy: { fontSize: extraSize, fontWeight: 600, color: accentColor },
    beneficiary: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    notes: { fontSize: extraSize, fontWeight: 600, color: accentColor },
    chequeNo: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    nationalId: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    phone: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    sanadNo: { fontSize: extraSize, fontWeight: 700, color: accentColor },
    date: { fontSize: extraSize, fontWeight: 800, color: accentColor },
    voucherNo: { fontSize: extraSize, fontWeight: 800, color: accentColor },
    currencyMark: { fontSize: extraSize, fontWeight: 800, color: accentColor },
  };

  return { global, fields };
}

function buildEffectiveDate(existingVoucher, yy, mm, dd) {
  const y = String(yy || "").trim();
  const m = String(mm || "").trim();
  const d = String(dd || "").trim();

  if (y && m && d) {
    const fullYear = Number(y) >= 50 ? `19${y}` : `20${y}`;
    const dt = new Date(`${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  const raw = existingVoucher?.voucherDate || existingVoucher?.createdAt;
  if (!raw) return new Date();

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

export default function VoucherModal({
  open,
  onClose,
  request,
  companyKey,
  requestCompanyKey,
  requestId,
  onSaved,
}) {
  const paperRef = useRef(null);

  const yyRef = useRef(null);
  const mmRef = useRef(null);
  const ddRef = useRef(null);
  const amountRef = useRef(null);
  const wordsRef = useRef(null);
  const descRef = useRef(null);
  const bankRef = useRef(null);
  const fxRef = useRef(null);
  const receivedByRef = useRef(null);
  const beneficiaryRef = useRef(null);
  const notesRef = useRef(null);

  const chequeNoRef = useRef(null);
  const nationalIdRef = useRef(null);
  const phoneRef = useRef(null);
  const sanadRef = useRef(null);

  const [requestData, setRequestData] = useState(request || null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  const [existingVoucher, setExistingVoucher] = useState(null);
  const [voucherNo, setVoucherNo] = useState(null);

  const [vDateYY, setVDateYY] = useState("");
  const [vDateMM, setVDateMM] = useState("");
  const [vDateDD, setVDateDD] = useState("");

  const [vAmount, setVAmount] = useState("");
  const [vWords, setVWords] = useState("");
  const [vDesc, setVDesc] = useState("");
  const [vCurrency, setVCurrency] = useState("IQD");

  const [vBank, setVBank] = useState("");
  const [vFxRate, setVFxRate] = useState("");
  const [vReceivedBy, setVReceivedBy] = useState("");
  const [vBeneficiary, setVBeneficiary] = useState("");
  const [vNotes, setVNotes] = useState("");

  const [vChequeNo, setVChequeNo] = useState("");
  const [vNationalId, setVNationalId] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vSanadNo, setVSanadNo] = useState("");

  const [cbOne, setCbOne] = useState(false);
  const [cbTwo, setCbTwo] = useState(false);

  const [globalTextStyle, setGlobalTextStyle] = useState(DEFAULT_GLOBAL_TEXT_STYLE);
  const [fieldStyles, setFieldStyles] = useState(DEFAULT_FIELD_STYLES);

  const templateCompanyKey = existingVoucher?.companyKey || companyKey;

  const selectedCompany = useMemo(() => {
    const normalizedKey = String(templateCompanyKey || "").trim().toLowerCase();
    return (
      COMPANIES.find((c) => {
        return String(c.key).trim().toLowerCase() === normalizedKey;
      }) ?? null
    );
  }, [templateCompanyKey]);

  const today = useMemo(() => new Date(), []);
  const todayYY = String(today.getFullYear()).slice(-2);
  const todayMM = String(today.getMonth() + 1).padStart(2, "0");
  const todayDD = String(today.getDate()).padStart(2, "0");

  const fillFromRequest = useCallback(
    (reqDoc) => {
      if (!reqDoc) return;
      // إذا عندنا وصل محفوظ مسبقًا، لا نرجع ننسخ من الطلب.
      // حتى تبقى التعديلات على الوصل مستقلة عن داتا الطلب.
      if (existingVoucher?._id) return;

      const items = Array.isArray(reqDoc?.items) ? reqDoc.items : [];
      const total = items.reduce(
        (sum, it) => sum + (Number(it?.qty) || 0) * (Number(it?.price) || 0),
        0
      );

      const currency = String(reqDoc?.currency || "IQD").toUpperCase();
      const formattedAmount = formatAmount(total);
      const words = `${numberToArabicWords(total)} ${
        currency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير"
      }`.trim();

      setVAmount(formattedAmount);
      setVWords(words);
      setVDesc(reqDoc?.description || "");
      setVCurrency(currency);

      setVDateYY(todayYY);
      setVDateMM(todayMM);
      setVDateDD(todayDD);
    },
    [existingVoucher?._id, todayYY, todayMM, todayDD]
  );

  const hydrateFromVoucherDoc = useCallback((doc) => {
    if (!doc) return;

    setExistingVoucher(doc);
    setVoucherNo(doc?.seq ?? null);

    setVDateYY(doc?.vDateYY || doc?.dateParts?.yy || "");
    setVDateMM(doc?.vDateMM || doc?.dateParts?.mm || "");
    setVDateDD(doc?.vDateDD || doc?.dateParts?.dd || "");

    const amountRaw =
      doc?.vAmount ??
      doc?.amountText ??
      (typeof doc?.amount === "number" ? String(doc.amount) : "");
    setVAmount(amountRaw ? formatAmount(amountRaw) : "");

    setVWords(doc?.vWords || doc?.amountWords || "");
    setVDesc(doc?.vDesc || doc?.description || "");
    setVCurrency(String(doc?.vCurrency || doc?.currency || "IQD").toUpperCase());

    setVBank(doc?.bank || doc?.vBank || "");
    setVFxRate(doc?.fxRate || doc?.vFxRate || "");
    setVReceivedBy(doc?.receivedBy || doc?.vReceivedBy || "");
    setVBeneficiary(doc?.beneficiary || doc?.vBeneficiary || "");
    setVNotes(doc?.notes || doc?.vNotes || "");

    setVChequeNo(doc?.chequeNo || doc?.vChequeNo || "");
    setVNationalId(doc?.nationalId || doc?.vNationalId || "");
    setVPhone(doc?.phone || doc?.vPhone || "");
    setVSanadNo(doc?.sanadNo || doc?.vSanadNo || "");

    setCbOne(Boolean(doc?.cbOne));
    setCbTwo(Boolean(doc?.cbTwo));

    if (doc?.globalTextStyle || doc?.fieldStyles) {
      const normalizedGlobal = normalizeGlobalTextStyle(doc?.globalTextStyle || {});
      const normalizedFields = normalizeFieldStyles(doc?.fieldStyles || {}, normalizedGlobal);
      setGlobalTextStyle(normalizedGlobal);
      setFieldStyles(normalizedFields);
    } else {
      const legacy = buildLegacyStyles(doc);
      setGlobalTextStyle(legacy.global);
      setFieldStyles(legacy.fields);
    }
  }, []);

  const loadExistingVoucher = useCallback(async () => {
    if (!companyKey || !requestId) return null;
    const res = await fetch(
      `/api/vouchers?companyKey=${encodeURIComponent(companyKey)}&requestCompanyKey=${encodeURIComponent(
        requestCompanyKey || companyKey
      )}&requestId=${encodeURIComponent(requestId)}&mode=payment`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return null;
    return json.data || null;
  }, [companyKey, requestId, requestCompanyKey]);

  useEffect(() => {
    setRequestData(request || null);
  }, [request]);

  useEffect(() => {
    if (!open || !requestId || request) return;

    let cancelled = false;

    const loadRequest = async () => {
      try {
        setLoadingRequest(true);

        // إذا عندك endpoint ثاني للريكوست بدله هنا
        const res = await fetch(`/api/requests/view?id=${encodeURIComponent(requestId)}`, {
          credentials: "include",
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok) {
          const doc = json?.data || json?.request || null;
          if (doc) setRequestData(doc);
        }
      } catch (err) {
        console.error("Failed to load request:", err);
      } finally {
        if (!cancelled) setLoadingRequest(false);
      }
    };

    loadRequest();

    return () => {
      cancelled = true;
    };
  }, [open, requestId, request]);

  useEffect(() => {
    if (!open || !companyKey || !requestId) return;

    let cancelled = false;

    const runLoadExistingVoucher = async () => {
      try {
        setLoadingVoucher(true);
        const doc = await loadExistingVoucher();
        if (cancelled) return;

        if (doc) {
          hydrateFromVoucherDoc(doc);
        } else {
          setExistingVoucher(null);
          setVoucherNo(null);
          if (requestData) fillFromRequest(requestData);
        }
      } catch (err) {
        console.error("Failed to load existing voucher:", err);
        if (!cancelled && requestData) fillFromRequest(requestData);
      } finally {
        if (!cancelled) setLoadingVoucher(false);
      }
    };

    runLoadExistingVoucher();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    companyKey,
    requestId,
    requestCompanyKey,
    requestData,
    loadExistingVoucher,
    hydrateFromVoucherDoc,
    fillFromRequest,
  ]);

  const effectiveDate = useMemo(() => {
    return buildEffectiveDate(existingVoucher, vDateYY, vDateMM, vDateDD);
  }, [existingVoucher, vDateYY, vDateMM, vDateDD]);

  const useOldTemplate = useMemo(() => {
    if (!effectiveDate) return true;
    return effectiveDate < TEMPLATE_SWITCH_DATE;
  }, [effectiveDate]);

  const currentPOS = useMemo(() => (useOldTemplate ? POS_OLD : POS_NEW), [useOldTemplate]);
  const currentEXTRA = useMemo(() => (useOldTemplate ? EXTRA_OLD : EXTRA_NEW), [useOldTemplate]);

  const currentImg = useMemo(() => {
    if (!selectedCompany) return "";
    return useOldTemplate
      ? selectedCompany.paymentImgJpg
      : selectedCompany.paymentImgPng;
  }, [selectedCompany, useOldTemplate]);
  const isLockedAfterCreate = Boolean(existingVoucher?._id);
  const noop = () => {};

  const onYYChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateYY(v);
    if (v.length === 2) mmRef.current?.focus();
  };

  const onMMChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateMM(v);
    if (v.length === 2) ddRef.current?.focus();
  };

  const onDDChange = (e) => {
    const v = only2Digits(e.target.value);
    setVDateDD(v);
  };

  const onDateKeyDown = (e, which) => {
    if (e.key !== "Backspace") return;
    if (which === "mm" && !vDateMM) yyRef.current?.focus();
    if (which === "dd" && !vDateDD) mmRef.current?.focus();
  };

  const printCurrentPreviewA4 = async () => {
    if (!paperRef.current) return;

    try {
      setPrinting(true);

      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      await waitForImages(paperRef.current);

      const dataUrl = await toPng(paperRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
      });

      const printStyles = useOldTemplate
        ? `
          .page {
            width: 210mm;
            height: 297mm;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            overflow: hidden;
            background: #fff;
            padding-top: 5mm;
          }
          img {
            width: 210mm;
            height: auto;
            max-height: 297mm;
            display: block;
            object-fit: contain;
            object-position: top center;
          }
        `
        : `
          .page {
            width: 210mm;
            height: 297mm;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            overflow: hidden;
            background: #fff;
            padding-top: 0;
          }
          img {
            width: 210mm;
            height: 297mm;
            display: block;
            object-fit: fill;
            object-position: top center;
          }
        `;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        setPrinting(false);
        iframe.remove();
        return;
      }

      doc.open();
      doc.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Print Voucher</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm;
                height: 297mm;
                overflow: hidden;
                background: #fff;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              ${printStyles}
            </style>
          </head>
          <body>
            <div class="page">
              <img id="p" />
            </div>
            <script>
              const img = document.getElementById("p");
              img.src = ${JSON.stringify(dataUrl)};
              img.onload = () => {
                setTimeout(() => {
                  window.focus();
                  window.print();
                }, 100);
              };
              window.onafterprint = () => {
                try {
                  parent.postMessage({ type: "IFRAME_PRINT_DONE" }, "*");
                } catch (e) {}
              };
            </script>
          </body>
        </html>
      `);
      doc.close();

      const onMsg = (ev) => {
        if (ev?.data?.type !== "IFRAME_PRINT_DONE") return;

        window.removeEventListener("message", onMsg);

        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 50);

        setPrinting(false);
      };

      window.addEventListener("message", onMsg);
    } catch (e) {
      console.error(e);
      alert("تعذر طباعة الوصل.");
      setPrinting(false);
    }
  };

  const buildPayload = () => {
    const amountCleaned = cleanAmount(vAmount);
    const amountNumber = amountCleaned ? Number(amountCleaned) : 0;
  
    const payloadCompanyKey = existingVoucher?.companyKey || companyKey;

    return {
      companyKey: payloadCompanyKey,
      requestCompanyKey: requestCompanyKey || companyKey,
      companyName: selectedCompany?.name || payloadCompanyKey,
      mode: "payment",
      requestId,
  
      vDateYY,
      vDateMM,
      vDateDD,
  
      amount: amountNumber,
      vAmount: amountNumber,
  
      vWords,
      vDesc,
      vCurrency,

      vBank,
      vFxRate,
      vReceivedBy,
      vBeneficiary,
      vNotes,

      vChequeNo,
      vNationalId,
      vPhone,
      vSanadNo,

      cbOne,
      cbTwo,

      globalTextStyle,
      fieldStyles,

      // legacy support
      fontSizeAmount: String(fieldStyles?.amount?.fontSize || 16),
      fontSizeWords: String(fieldStyles?.words?.fontSize || 16),
      fontSizeDesc: String(fieldStyles?.desc?.fontSize || 16),
      fontSizeExtra: String(fieldStyles?.bank?.fontSize || 16),
      fontColorMain: fieldStyles?.amount?.color || "#111827",
      fontColorAccent: fieldStyles?.bank?.color || "#111827",
    };
  };

  const createVoucher = async () => {
    try {
      setSaving(true);

      const res = await fetch("/api/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to create voucher");
      }

      const doc = json.data || null;
      if (doc) {
        // بعد الإنشاء، نقرأ من الوصل نفسه حتى تصير كل الحقول من الداتا المخزونة فعليًا
        const freshDoc = await loadExistingVoucher();
        hydrateFromVoucherDoc(freshDoc || doc);
      }

      await onSaved?.(doc);
      await printCurrentPreviewA4();
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر إنشاء الوصل");
    } finally {
      setSaving(false);
    }
  };

  const saveEditedVoucher = async () => {
    if (!existingVoucher?._id) return;

    try {
      setSaving(true);

      const res = await fetch("/api/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: existingVoucher._id,
          ...buildPayload(),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to save voucher");
      }

      const doc = json.data || null;
      if (doc) {
        // بعد الحفظ، نرجع نجيب الداتا من الوصل
        const freshDoc = await loadExistingVoucher();
        hydrateFromVoucherDoc(freshDoc || doc);
      }

      await onSaved?.(doc);
    } catch (err) {
      console.error(err);
      alert(err.message || "تعذر حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    if (!existingVoucher?._id && !vDateYY && !vDateMM && !vDateDD) {
      setVDateYY(todayYY);
      setVDateMM(todayMM);
      setVDateDD(todayDD);
    }
  }, [open, existingVoucher?._id, vDateYY, vDateMM, vDateDD, todayYY, todayMM, todayDD]);

  useEffect(() => {
    if (!open) return;
    const cleaned = cleanAmount(vAmount);
    if (!cleaned) {
      setVWords("");
      return;
    }
    const currencyText = vCurrency === "USD" ? "دولار فقط لا غير" : "دينار فقط لا غير";
    setVWords(`${numberToArabicWords(cleaned)} ${currencyText}`.trim());
  }, [open, vAmount, vCurrency]);

  if (!open || !selectedCompany) return null;

  return (
    <VoucherCanvasDialog
      open={open}
      onClose={onClose}
      onPrintOnly={printCurrentPreviewA4}
      isPrinting={printing || saving || loadingVoucher || loadingRequest}
      selectedCompany={selectedCompany}
      hasBeenCreated={isLockedAfterCreate}
      printOnlyButtonText="طباعة"
      printingOnlyButtonText="جاري الطباعة..."
      createButtonText="إنشاء"
      creatingButtonText="جاري الإنشاء..."
      isPayment={true}
      isViewPage={false}
      editMode={true}
      onToggleEdit={() => {}}
      onSave={saveEditedVoucher}
      isSaving={saving}
      onCreate={createVoucher}
      paperRef={paperRef}
      currentImg={currentImg}
      POS={currentPOS}
      EXTRA={currentEXTRA}
      vDateYY={vDateYY}
      vDateMM={vDateMM}
      vDateDD={vDateDD}
      todayYY={todayYY}
      todayMM={todayMM}
      todayDD={todayDD}
      vCurrency={vCurrency}
      vAmount={vAmount}
      vWords={vWords}
      vDesc={vDesc}
      vBank={vBank}
      vFxRate={vFxRate}
      vReceivedBy={vReceivedBy}
      vBeneficiary={vBeneficiary}
      vNotes={vNotes}
      cbOne={cbOne}
      cbTwo={cbTwo}
      voucherNo={voucherNo}
      yyRef={yyRef}
      mmRef={mmRef}
      ddRef={ddRef}
      amountRef={amountRef}
      wordsRef={wordsRef}
      descRef={descRef}
      fxRef={fxRef}
      receivedByRef={receivedByRef}
      bankRef={bankRef}
      beneficiaryRef={beneficiaryRef}
      notesRef={notesRef}
      onYYChange={isLockedAfterCreate ? noop : onYYChange}
      onMMChange={isLockedAfterCreate ? noop : onMMChange}
      onDDChange={isLockedAfterCreate ? noop : onDDChange}
      onDateKeyDown={isLockedAfterCreate ? noop : onDateKeyDown}
      setVCurrency={isLockedAfterCreate ? noop : setVCurrency}
      setVAmount={isLockedAfterCreate ? noop : setVAmount}
      setVWords={isLockedAfterCreate ? noop : setVWords}
      setVDesc={isLockedAfterCreate ? noop : setVDesc}
      setVFxRate={isLockedAfterCreate ? noop : setVFxRate}
      setVReceivedBy={isLockedAfterCreate ? noop : setVReceivedBy}
      setVBank={isLockedAfterCreate ? noop : setVBank}
      setVBeneficiary={isLockedAfterCreate ? noop : setVBeneficiary}
      setVNotes={isLockedAfterCreate ? noop : setVNotes}
      setCbOne={isLockedAfterCreate ? noop : setCbOne}
      setCbTwo={isLockedAfterCreate ? noop : setCbTwo}
      vChequeNo={vChequeNo}
      chequeNoRef={chequeNoRef}
      setVChequeNo={isLockedAfterCreate ? noop : setVChequeNo}
      vNationalId={vNationalId}
      vPhone={vPhone}
      vSanadNo={vSanadNo}
      nationalIdRef={nationalIdRef}
      phoneRef={phoneRef}
      sanadRef={sanadRef}
      setVNationalId={isLockedAfterCreate ? noop : setVNationalId}
      setVPhone={isLockedAfterCreate ? noop : setVPhone}
      setVSanadNo={isLockedAfterCreate ? noop : setVSanadNo}
      cleanAmount={cleanAmount}
      formatAmount={formatAmount}
      globalTextStyle={globalTextStyle}
      setGlobalTextStyle={isLockedAfterCreate ? noop : setGlobalTextStyle}
      fieldStyles={fieldStyles}
      setFieldStyles={isLockedAfterCreate ? noop : setFieldStyles}
    />
  );
}
