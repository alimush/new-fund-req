/**
 * يملأ فورمة التقرير اليومي الأصلية (Excel) كما هي — مع الحفاظ على التنسيق والصور.
 */

import * as ExcelJSModule from "exceljs";
import { formatVoucherDateDisplay } from "./voucherDate";

const ExcelJS = ExcelJSModule?.default ?? ExcelJSModule;

const TEMPLATE_URL = "/templates/voucher-daily-form.xlsx";

const ARABIC_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const COMPANY_NAMES = {
  "Al-Ghadeer": "شركة الغدير",
  "Badur-Baghdad": "شركة بدور بغداد",
  "Badur-Baghdad-Safebox-Istishar": "بدور بغداد - صندوق امانات مصرف الستشار",
  "Tiba-Al-najaf": "طيبة النجف",
  "Ghadeer-Karbala": "غدير كربلاء",
  "Badur-Al-Najaf": "بدور النجف",
  "Ghadeer-Investments": "الغدير - صندوق فرعي - كربلاء",
  "Ghadeer-Karbala-Sub": "غدير كربلاء - الصندوق الفرعي",
  "Ghadeer-Najaf-Sub": "الغدير الفرعي - النجف",
  "010": "010 (Test)",
};

/** تخطيط كل ورقة في الفورمة الأصلية */
const LAYOUTS = {
  "بدور بغداد": {
    day: "D3",
    date: "D4",
    cashier: "D5",
    maker: "D6",
    fx: "D7",
    prevIqd: "D8",
    prevUsd: "D9",
    dataStart: 18,
    dataEnd: 27,
    totalRow: 28,
    summary: {
      receipt: "D38",
      bankIn: "D39",
      payment: "D40",
      bankOut: "D41",
      pending: "D42",
      voided: "D43",
    },
  },
  "غدير كربلاء": {
    day: "D3",
    date: "D4",
    cashier: "D5",
    maker: "D6",
    fx: "D7",
    prevIqd: "D8",
    prevUsd: "D9",
    dataStart: 18,
    dataEnd: 27,
    totalRow: 28,
    summary: {
      receipt: "D35",
      bankIn: "D36",
      payment: "D37",
      bankOut: "D38",
      pending: "D39",
      voided: "D40",
    },
  },
};

const GHADEER_SHEET = "شركـــة الغـــديـــر";

LAYOUTS[GHADEER_SHEET] = {
  day: "D3",
  date: "D4",
  cashier: "D5",
  maker: "D6",
  fx: "D7",
  prevIqd: "D8",
  prevUsd: "D9",
  dataStart: 19,
  dataEnd: 30,
  totalRow: 31,
  summary: {
    receipt: "D41",
    bankIn: "D42",
    payment: "D43",
    bankOut: "D44",
    pending: "D45",
    voided: "D46",
  },
};

/** شركة → ورقة القالب الأساسية */
const COMPANY_SHEET_MAP = {
  "Badur-Baghdad": "بدور بغداد",
  "Al-Ghadeer": GHADEER_SHEET,
  "Ghadeer-Karbala": "غدير كربلاء",
  "Badur-Baghdad-Safebox-Istishar": "بدور بغداد",
  "Badur-Al-Najaf": "بدور بغداد",
  "Tiba-Al-najaf": "بدور بغداد",
  "Ghadeer-Investments": "غدير كربلاء",
  "Ghadeer-Karbala-Sub": "غدير كربلاء",
  "Ghadeer-Najaf-Sub": GHADEER_SHEET,
  "010": GHADEER_SHEET,
};

function companyName(key) {
  if (!key) return "شركة";
  const resolved = resolveCompanyKey(key);
  return COMPANY_NAMES[resolved] || String(key);
}

function resolveCompanyKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return "unknown";
  const found = Object.keys(COMPANY_NAMES).find(
    (k) => k.toLowerCase() === s.toLowerCase()
  );
  return found || s;
}

function preferredSourceSheet(companyKey) {
  const key = resolveCompanyKey(companyKey);
  return COMPANY_SHEET_MAP[key] || "بدور بغداد";
}

function safeSheetName(name) {
  const cleaned = String(name || "Sheet")
    .replace(/[\\/?*[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 31) || "Sheet";
}

function parseAmount(v) {
  const cleaned = String(v ?? "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function isUsd(currency) {
  const s = String(currency || "").trim().toUpperCase();
  return (
    s === "USD" ||
    s.includes("USD") ||
    s.includes("DOLLAR") ||
    s.includes("دولار")
  );
}

function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase();
  if (m === "payment" || m.includes("صرف")) return "payment";
  return "receipt";
}

function arabicDayFromIso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return ARABIC_DAYS[d.getDay()] || "";
}

function reportMeta(dateFrom, dateTo) {
  const from = String(dateFrom || "").trim();
  const to = String(dateTo || "").trim();

  if (from && to && from === to) {
    return { day: arabicDayFromIso(from), date: from };
  }
  if (from && to) return { day: "", date: `${from} → ${to}` };
  if (from) return { day: arabicDayFromIso(from), date: from };
  if (to) return { day: arabicDayFromIso(to), date: to };

  const today = new Date();
  return {
    day: ARABIC_DAYS[today.getDay()],
    date: today.toISOString().slice(0, 10),
  };
}

function pickFxRate(vouchers) {
  for (const v of vouchers) {
    const n = Number(String(v.fxRate ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function sortVouchers(list) {
  return [...list].sort((a, b) => {
    const da = String(formatVoucherDateDisplay(a) || "");
    const db = String(formatVoucherDateDisplay(b) || "");
    if (da !== db) return da.localeCompare(db);
    return Number(a.seq || 0) - Number(b.seq || 0);
  });
}

function findSheet(workbook, name) {
  return (
    workbook.getWorksheet(name) ||
    workbook.worksheets.find((ws) => ws.name === name) ||
    null
  );
}

function layoutForSheet(sheetName) {
  if (LAYOUTS[sheetName]) return { ...LAYOUTS[sheetName] };
  return { ...LAYOUTS["بدور بغداد"] };
}

function clearCell(ws, addr) {
  ws.getCell(addr).value = null;
}

function setValue(ws, addr, value) {
  ws.getCell(addr).value = value === undefined ? null : value;
}

function clearDataRow(ws, row) {
  for (const col of ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]) {
    clearCell(ws, `${col}${row}`);
  }
}

function writeDataRow(ws, row, voucher) {
  clearDataRow(ws, row);

  const mode = normalizeMode(voucher.mode);
  const amount = parseAmount(voucher.amount);
  const usd = isUsd(voucher.currency);
  const docType = mode === "payment" ? "وصل صرف" : "وصل قبض";

  if (mode === "receipt") {
    setValue(ws, `${usd ? "E" : "C"}${row}`, amount || null);
  } else {
    setValue(ws, `${usd ? "F" : "D"}${row}`, amount || null);
  }

  setValue(ws, `G${row}`, formatVoucherDateDisplay(voucher) || null);
  setValue(ws, `H${row}`, voucher.bank || null);
  setValue(ws, `I${row}`, voucher.chequeNo || null);

  const fx = Number(String(voucher.fxRate ?? "").replace(/,/g, "").trim());
  setValue(ws, `J${row}`, Number.isFinite(fx) && fx > 0 ? fx : null);
  setValue(ws, `K${row}`, docType);
  setValue(
    ws,
    `L${row}`,
    voucher.voucherNo || String(voucher.seq ?? "").padStart(5, "0")
  );
  setValue(ws, `M${row}`, voucher.description || null);
}

function ensureCapacity(ws, layout, needed) {
  const capacity = layout.dataEnd - layout.dataStart + 1;
  if (needed <= capacity) return layout;

  const extra = needed - capacity;
  const insertAt = layout.dataEnd + 1;
  const templateRow = layout.dataStart;

  ws.spliceRows(insertAt, 0, ...Array.from({ length: extra }, () => []));

  for (let i = 0; i < extra; i++) {
    const targetRow = insertAt + i;
    const src = ws.getRow(templateRow);
    const dst = ws.getRow(targetRow);
    if (src.height) dst.height = src.height;

    src.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const t = dst.getCell(colNumber);
      if (colNumber === 2) {
        const base = layout.dataStart === 19 ? 19 : 17;
        t.value = { formula: `ROW()-${base}` };
      } else {
        t.value = null;
      }
      if (cell.style) {
        try {
          t.style = JSON.parse(JSON.stringify(cell.style));
        } catch {
          /* ignore */
        }
      }
    });
  }

  const newDataEnd = layout.dataEnd + extra;
  const newTotalRow = layout.totalRow + extra;
  const openBalRow = layout.dataStart === 19 ? 18 : 17;

  setValue(ws, `C${newTotalRow}`, {
    formula: `SUM(C${openBalRow}:C${newDataEnd})`,
  });
  setValue(ws, `D${newTotalRow}`, {
    formula: `SUM(D${layout.dataStart}:D${newDataEnd})`,
  });
  setValue(ws, `E${newTotalRow}`, {
    formula: `SUM(E${openBalRow}:E${newDataEnd})`,
  });
  setValue(ws, `F${newTotalRow}`, {
    formula: `SUM(F${layout.dataStart}:F${newDataEnd})`,
  });

  const shift = extra;
  const summary = {};
  for (const [k, addr] of Object.entries(layout.summary)) {
    const col = addr.replace(/\d+/g, "");
    const row = Number(addr.replace(/\D+/g, "")) + shift;
    summary[k] = `${col}${row}`;
  }

  return {
    ...layout,
    dataEnd: newDataEnd,
    totalRow: newTotalRow,
    summary,
  };
}

function fillSheet(ws, vouchers, meta) {
  let layout = layoutForSheet(ws.name);
  const rows = sortVouchers(vouchers);

  setValue(ws, layout.day, meta.day || null);
  setValue(ws, layout.date, meta.date || null);
  clearCell(ws, layout.cashier);
  clearCell(ws, layout.maker);

  const fx = pickFxRate(rows);
  if (fx != null) setValue(ws, layout.fx, fx);
  else clearCell(ws, layout.fx);

  if (ws.getCell(layout.prevIqd).value == null) setValue(ws, layout.prevIqd, 0);
  if (ws.getCell(layout.prevUsd).value == null) setValue(ws, layout.prevUsd, 0);

  layout = ensureCapacity(ws, layout, Math.max(rows.length, 0));

  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    clearDataRow(ws, r);
  }

  rows.forEach((v, i) => {
    writeDataRow(ws, layout.dataStart + i, v);
  });

  const receiptCount = rows.filter((v) => normalizeMode(v.mode) === "receipt")
    .length;
  const paymentCount = rows.filter((v) => normalizeMode(v.mode) === "payment")
    .length;

  setValue(ws, layout.summary.receipt, receiptCount);
  clearCell(ws, layout.summary.bankIn);
  setValue(ws, layout.summary.payment, paymentCount);
  clearCell(ws, layout.summary.bankOut);
  clearCell(ws, layout.summary.pending);
  clearCell(ws, layout.summary.voided);

  // أعد صيغة المجموع حتى لا تبقى نتيجة قديمة مخزّنة من العيّنة
  const sumStart = layout.summary.receipt;
  const sumEnd = layout.summary.voided;
  const totalAddr = (() => {
    const col = sumStart.replace(/\d+/g, "");
    const endRow = Number(sumEnd.replace(/\D+/g, ""));
    return `${col}${endRow + 1}`;
  })();
  setValue(ws, totalAddr, {
    formula: `SUM(${sumStart}:${sumEnd})`,
    result: receiptCount + paymentCount,
  });
}

function cloneSheet(workbook, sourceName, newName) {
  const source = findSheet(workbook, sourceName);
  if (!source) return null;

  const name = safeSheetName(newName);
  if (findSheet(workbook, name)) return findSheet(workbook, name);

  const clone = workbook.addWorksheet(name);

  source.columns.forEach((col, idx) => {
    if (!col) return;
    const c = clone.getColumn(idx + 1);
    if (col.width != null) c.width = col.width;
    if (col.hidden != null) c.hidden = col.hidden;
  });

  source.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const newRow = clone.getRow(rowNumber);
    if (row.height != null) newRow.height = row.height;
    if (row.hidden != null) newRow.hidden = row.hidden;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const target = newRow.getCell(colNumber);
      target.value = cell.value;
      try {
        target.style = JSON.parse(JSON.stringify(cell.style || {}));
      } catch {
        /* ignore */
      }
      if (cell.numFmt) target.numFmt = cell.numFmt;
    });
  });

  const merges = source.model?.merges || [];
  for (const m of merges) {
    try {
      clone.mergeCells(m);
    } catch {
      /* ignore */
    }
  }

  try {
    for (const img of source.getImages()) {
      const range = img.range || {};
      const spec = { editAs: range.editAs || "oneCell" };
      if (range.tl) spec.tl = range.tl;
      if (range.br) spec.br = range.br;
      if (range.ext) spec.ext = range.ext;
      clone.addImage(img.imageId, spec);
    }
  } catch {
    /* ignore */
  }

  return clone;
}

async function loadTemplateWorkbook(templateBuffer) {
  const workbook = new ExcelJS.Workbook();
  if (templateBuffer) {
    await workbook.xlsx.load(templateBuffer);
    return workbook;
  }

  if (typeof window !== "undefined") {
    const res = await fetch(TEMPLATE_URL);
    if (!res.ok) throw new Error("تعذر تحميل فورمة التقرير");
    const buf = await res.arrayBuffer();
    await workbook.xlsx.load(buf);
    return workbook;
  }

  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const filePath = join(process.cwd(), "public/templates/voucher-daily-form.xlsx");
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

/**
 * @param {Array} vouchers
 * @param {{ dateFrom?: string, dateTo?: string, templateBuffer?: ArrayBuffer, companyFilter?: string }} [options]
 * @returns {Promise<ExcelJS.Workbook>}
 */
export async function buildDailyCashReportWorkbook(vouchers, options = {}) {
  const workbook = await loadTemplateWorkbook(options.templateBuffer);
  const meta = reportMeta(options.dateFrom, options.dateTo);
  const list = Array.isArray(vouchers) ? vouchers : [];

  const byCompany = new Map();
  for (const v of list) {
    const key = resolveCompanyKey(v.companyKey);
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(v);
  }

  // إن وُجد فلتر شركة محدد، اقتصر عليه حتى لو وصلت بيانات أخرى بالخطأ
  const companyFilter = String(options.companyFilter || "all").trim();
  if (companyFilter && companyFilter.toLowerCase() !== "all") {
    const only = resolveCompanyKey(companyFilter);
    for (const key of [...byCompany.keys()]) {
      if (key.toLowerCase() !== only.toLowerCase()) byCompany.delete(key);
    }
  }

  const orderedKeys = [];
  for (const key of Object.keys(COMPANY_NAMES)) {
    if (byCompany.has(key)) orderedKeys.push(key);
  }
  for (const key of byCompany.keys()) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const claimedSheets = new Set();

  for (const key of orderedKeys) {
    const companyVouchers = byCompany.get(key) || [];
    if (!companyVouchers.length) continue;

    const sourceName = preferredSourceSheet(key);
    let targetName = sourceName;
    let ws = findSheet(workbook, targetName);

    if (!ws || claimedSheets.has(targetName)) {
      const cloneName = safeSheetName(companyName(key));
      ws = cloneSheet(workbook, sourceName, cloneName);
      targetName = ws?.name || cloneName;
    }

    if (!ws) continue;
    claimedSheets.add(targetName);
    fillSheet(ws, companyVouchers, meta);
  }

  // احذف أوراق القالب غير المستخدمة (شركات خارج الفلتر) + الأرصدة إن كانت شركة واحدة
  const balancesSheet = workbook.worksheets.find((w) =>
    /ارصد|أرصد|الرص/.test(String(w.name || ""))
  );
  const keepBalances = orderedKeys.length > 1;

  for (const ws of [...workbook.worksheets]) {
    if (claimedSheets.has(ws.name)) continue;
    if (keepBalances && balancesSheet && ws.id === balancesSheet.id) continue;
    try {
      workbook.removeWorksheet(ws.id);
    } catch {
      /* ignore */
    }
  }

  return workbook;
}

export async function buildDailyCashReportBuffer(vouchers, options = {}) {
  const workbook = await buildDailyCashReportWorkbook(vouchers, options);
  return workbook.xlsx.writeBuffer();
}

const api = {
  buildDailyCashReportWorkbook,
  buildDailyCashReportBuffer,
};

export default api;
