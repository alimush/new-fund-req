/**
 * يملأ فورمة التقرير اليومي (التقرير_اليومي_صندوق_الغدير.xlsx)
 * مع الحفاظ على التنسيق والصور والصيغ.
 */

import * as ExcelJSModule from "exceljs";
import { formatVoucherDateDisplay } from "./voucherDate";

const ExcelJS = ExcelJSModule?.default ?? ExcelJSModule;

const TEMPLATE_URL = "/templates/voucher-daily-form.xlsx";
const TEMPLATE_FILE = "voucher-daily-form.xlsx";

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

/** تخطيط موحّد لكل أوراق الفورمة الجديدة */
const LAYOUT = {
  day: "C2",
  date: "C3",
  cashier: "C4",
  maker: "C5",
  fundName: "C6",
  title: "D2",
  prevIqd: "C7",
  prevUsd: "C8",
  dataStart: 12,
  dataEnd: 22,
  totalRow: 23,
  balRow: 24,
  summary: {
    receipt: "C32",
    bankIn: "C33",
    payment: "C34",
    bankOut: "C35",
    pending: "C36",
    voided: "C37",
    total: "C38",
  },
};

/** شركة → ورقة الفورمة */
const COMPANY_SHEET_MAP = {
  "Al-Ghadeer": "شركة الغدير",
  "Badur-Baghdad": "شركة بدور بغداد",
  "Badur-Baghdad-Safebox-Istishar": "بدور بغداد - أمانات المستشار",
  "Tiba-Al-najaf": "طيبة النجف",
  "Ghadeer-Karbala": "غدير كربلاء",
  "Badur-Al-Najaf": "بدور النجف",
  "Ghadeer-Investments": "الغدير - فرعي كربلاء",
  "Ghadeer-Karbala-Sub": "غدير كربلاء - الفرعي",
  "Ghadeer-Najaf-Sub": "الغدير الفرعي - النجف",
  "010": "شركة الغدير",
};

const DEFAULT_SOURCE_SHEET = "شركة الغدير";

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
  return COMPANY_SHEET_MAP[key] || DEFAULT_SOURCE_SHEET;
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

/** مربع صح «شيك رقم» على الوصل (cbTwo) — شيك عيني */
function isChequeVoucher(voucher) {
  return Boolean(voucher?.cbTwo);
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

function shiftAddr(addr, extra) {
  const col = String(addr).replace(/\d+/g, "");
  const row = Number(String(addr).replace(/\D+/g, ""));
  return `${col}${row + extra}`;
}

function ensureRtl(ws, sourceWs) {
  const base =
    sourceWs?.views?.[0] ||
    ws.views?.[0] ||
    {
      workbookViewId: 0,
      state: "normal",
      showRuler: true,
      showRowColHeaders: true,
      showGridLines: true,
      zoomScale: 70,
      zoomScaleNormal: 100,
      style: "pageBreakPreview",
    };

  ws.views = [
    {
      ...JSON.parse(JSON.stringify(base)),
      rightToLeft: true,
    },
  ];

  if (sourceWs?.pageSetup) {
    try {
      ws.pageSetup = JSON.parse(JSON.stringify(sourceWs.pageSetup));
    } catch {
      /* ignore */
    }
  }
  if (sourceWs?.properties) {
    try {
      ws.properties = {
        ...ws.properties,
        ...JSON.parse(JSON.stringify(sourceWs.properties)),
      };
    } catch {
      /* ignore */
    }
  }
}

function clearCell(ws, addr) {
  ws.getCell(addr).value = null;
}

function setValue(ws, addr, value) {
  ws.getCell(addr).value = value === undefined ? null : value;
}

function clearDataRow(ws, row) {
  for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]) {
    clearCell(ws, `${col}${row}`);
  }
}

function voucherDocCodes(voucher) {
  const mode = normalizeMode(voucher.mode);
  const cheque = isChequeVoucher(voucher);

  if (cheque) {
    return mode === "payment"
      ? { code: "صرف مصرفي", label: "صرف مصرفي" }
      : { code: "قبض مصرفي", label: "قبض مصرفي" };
  }

  return mode === "payment"
    ? { code: "صرف", label: "وصل صرف" }
    : { code: "قبض", label: "وصل قبض" };
}

function writeDataRow(ws, row, voucher, index) {
  clearDataRow(ws, row);

  const mode = normalizeMode(voucher.mode);
  const amount = parseAmount(voucher.amount);
  const usd = isUsd(voucher.currency);
  const cheque = isChequeVoucher(voucher);
  const { code, label } = voucherDocCodes(voucher);
  const voucherNo =
    voucher.voucherNo || String(voucher.seq ?? "").padStart(5, "0");
  const desc = String(voucher.description || "").trim() || null;
  const fx = Number(String(voucher.fxRate ?? "").replace(/,/g, "").trim());

  setValue(ws, `A${row}`, index);
  setValue(ws, `B${row}`, desc || label);

  // شيك عيني: ينزل بالمقبوضات والمصروفات معاً حتى يصفر أثره على الصندوق
  if (cheque) {
    const receiptCol = usd ? "E" : "C";
    const paymentCol = usd ? "F" : "D";
    setValue(ws, `${receiptCol}${row}`, amount || null);
    setValue(ws, `${paymentCol}${row}`, amount || null);
  } else if (mode === "receipt") {
    setValue(ws, `${usd ? "E" : "C"}${row}`, amount || null);
  } else {
    setValue(ws, `${usd ? "F" : "D"}${row}`, amount || null);
  }

  // فورمة (3): G و M مخفيان — البيانات في H..L
  setValue(ws, `H${row}`, voucher.bank || null); // اسم الحساب المصرفي
  setValue(ws, `I${row}`, voucher.chequeNo || null); // رقم الصك
  setValue(ws, `J${row}`, code); // نوع المستند
  setValue(ws, `K${row}`, Number.isFinite(fx) && fx > 0 ? fx : null); // سعر الصرف
  setValue(ws, `L${row}`, voucherNo); // رقم الوصل
}

function rewriteFormulas(ws, layout) {
  const { dataStart, dataEnd, totalRow, balRow, summary } = layout;

  setValue(ws, `C${totalRow}`, {
    formula: `SUM(C${dataStart}:C${dataEnd})`,
  });
  setValue(ws, `D${totalRow}`, {
    formula: `SUM(D${dataStart}:D${dataEnd})`,
  });
  setValue(ws, `E${totalRow}`, {
    formula: `SUM(E${dataStart}:E${dataEnd})`,
  });
  setValue(ws, `F${totalRow}`, {
    formula: `SUM(F${dataStart}:F${dataEnd})`,
  });

  setValue(ws, `C${balRow}`, {
    formula: `C7+C${totalRow}-D${totalRow}`,
  });
  setValue(ws, `E${balRow}`, {
    formula: `C8+E${totalRow}-F${totalRow}`,
  });

  const typeRange = `J${dataStart}:J${dataEnd}`;
  setValue(ws, summary.receipt, { formula: `COUNTIF(${typeRange},"قبض")` });
  setValue(ws, summary.bankIn, {
    formula: `COUNTIF(${typeRange},"قبض مصرفي")`,
  });
  setValue(ws, summary.payment, { formula: `COUNTIF(${typeRange},"صرف")` });
  setValue(ws, summary.bankOut, {
    formula: `COUNTIF(${typeRange},"صرف مصرفي")`,
  });
  setValue(ws, summary.pending, 0);
  setValue(ws, summary.voided, 0);
  setValue(ws, summary.total, {
    formula: `SUM(${summary.receipt}:${summary.voided})`,
  });
}

function ensureCapacity(ws, layout, needed) {
  const capacity = layout.dataEnd - layout.dataStart + 1;
  if (needed <= capacity) return { ...layout };

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
      t.value = colNumber === 1 ? targetRow - layout.dataStart + 1 : null;
      if (cell.style) {
        try {
          t.style = JSON.parse(JSON.stringify(cell.style));
        } catch {
          /* ignore */
        }
      }
    });
  }

  const summary = {};
  for (const [k, addr] of Object.entries(layout.summary)) {
    summary[k] = shiftAddr(addr, extra);
  }

  return {
    ...layout,
    dataEnd: layout.dataEnd + extra,
    totalRow: layout.totalRow + extra,
    balRow: layout.balRow + extra,
    summary,
  };
}

/** يحافظ على أعمدة فورمة (3): G و M مخفيان */
function sanitizeSheetColumns(ws) {
  try {
    ws.getColumn(7).hidden = true; // G
    ws.getColumn(13).hidden = true; // M
  } catch {
    /* ignore */
  }
}

function fillSheet(ws, vouchers, meta, companyKey) {
  let layout = { ...LAYOUT };
  const rows = sortVouchers(vouchers);

  setValue(ws, layout.day, meta.day || null);
  setValue(ws, layout.date, meta.date || null);
  clearCell(ws, layout.cashier);
  clearCell(ws, layout.maker);
  setValue(ws, layout.fundName, companyName(companyKey));

  const titleCell = ws.getCell(layout.title);
  const titleFill = titleCell.fill
    ? JSON.parse(JSON.stringify(titleCell.fill))
    : null;
  titleCell.value = `التقرير اليومي لصندوق ${companyName(companyKey)}`;
  if (titleFill) titleCell.fill = titleFill;

  if (ws.getCell(layout.prevIqd).value == null) setValue(ws, layout.prevIqd, 0);
  if (ws.getCell(layout.prevUsd).value == null) setValue(ws, layout.prevUsd, 0);

  layout = ensureCapacity(ws, layout, Math.max(rows.length, 0));

  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    clearDataRow(ws, r);
    setValue(ws, `A${r}`, r - layout.dataStart + 1);
  }

  rows.forEach((v, i) => {
    writeDataRow(ws, layout.dataStart + i, v, i + 1);
  });

  rewriteFormulas(ws, layout);
  sanitizeSheetColumns(ws);
}

function cloneSheet(workbook, sourceName, newName) {
  const source = findSheet(workbook, sourceName);
  if (!source) return null;

  const name = safeSheetName(newName);
  if (findSheet(workbook, name)) return findSheet(workbook, name);

  const clone = workbook.addWorksheet(name);
  ensureRtl(clone, source);

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

  return clone;
}

async function resolveTemplatePath() {
  const { access } = await import("fs/promises");
  const { join, dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  const { constants } = await import("fs");

  const candidates = [];

  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(here, "templates", TEMPLATE_FILE));
  } catch {
    /* import.meta may be unavailable in some bundles */
  }

  candidates.push(
    join(process.cwd(), "lib/voucher/templates", TEMPLATE_FILE),
    join(process.cwd(), "public/templates", TEMPLATE_FILE)
  );

  try {
    if (typeof __dirname !== "undefined") {
      candidates.push(join(__dirname, "templates", TEMPLATE_FILE));
    }
  } catch {
    /* ignore */
  }

  for (const p of candidates) {
    try {
      await access(p, constants.R_OK);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function loadTemplateFromUrl(templateUrl) {
  if (!templateUrl) return null;
  try {
    const res = await fetch(templateUrl);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function loadTemplateWorkbook(templateBuffer, templateUrl) {
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

  const filePath = await resolveTemplatePath();
  if (filePath) {
    await workbook.xlsx.readFile(filePath);
    return workbook;
  }

  const remoteBuf = await loadTemplateFromUrl(templateUrl);
  if (remoteBuf) {
    await workbook.xlsx.load(remoteBuf);
    return workbook;
  }

  throw new Error(
    `File not found: ${TEMPLATE_FILE} (commit lib/voucher/templates and redeploy)`
  );
}

/**
 * @param {Array} vouchers
 * @param {{ dateFrom?: string, dateTo?: string, templateBuffer?: ArrayBuffer, companyFilter?: string, emptyForm?: boolean }} [options]
 * @returns {Promise<ExcelJS.Workbook>}
 */
export async function buildDailyCashReportWorkbook(vouchers, options = {}) {
  const workbook = await loadTemplateWorkbook(
    options.templateBuffer,
    options.templateUrl
  );

  for (const ws of [...workbook.worksheets]) {
    if (/export\s*summary/i.test(String(ws.name || ""))) {
      try {
        workbook.removeWorksheet(ws.id);
      } catch {
        /* ignore */
      }
    }
  }

  const meta = reportMeta(options.dateFrom, options.dateTo);

  // فورمة فارغة (بدون بيانات) — كل أوراق الشركات
  if (options.emptyForm) {
    const companyFilter = String(options.companyFilter || "all").trim();
    const keys = Object.keys(COMPANY_SHEET_MAP).filter((key) => {
      if (!companyFilter || companyFilter.toLowerCase() === "all") return true;
      return resolveCompanyKey(companyFilter).toLowerCase() === key.toLowerCase();
    });

    const keep = new Set();
    for (const key of keys) {
      if (key === "010") continue;
      const sheetName = COMPANY_SHEET_MAP[key];
      const ws = findSheet(workbook, sheetName);
      if (!ws) continue;
      ensureRtl(ws, ws);
      fillSheet(ws, [], meta, key);
      keep.add(ws.name);
    }

    for (const ws of [...workbook.worksheets]) {
      if (keep.has(ws.name)) continue;
      try {
        workbook.removeWorksheet(ws.id);
      } catch {
        /* ignore */
      }
    }

    return workbook;
  }

  const list = Array.isArray(vouchers) ? vouchers : [];

  const byCompany = new Map();
  for (const v of list) {
    const key = resolveCompanyKey(v.companyKey);
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(v);
  }

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
    const sourceWs = findSheet(workbook, sourceName);
    const mappedName = COMPANY_SHEET_MAP[key];
    const ownsMappedSheet =
      mappedName &&
      sourceWs &&
      sourceWs.name === mappedName &&
      !claimedSheets.has(mappedName);

    let ws = null;

    if (ownsMappedSheet) {
      ws = sourceWs;
    } else {
      ws = cloneSheet(workbook, sourceName, companyName(key));
    }

    if (!ws) continue;

    ensureRtl(ws, sourceWs || ws);
    claimedSheets.add(ws.name);
    fillSheet(ws, companyVouchers, meta, key);
  }

  for (const ws of [...workbook.worksheets]) {
    if (claimedSheets.has(ws.name)) continue;
    try {
      workbook.removeWorksheet(ws.id);
    } catch {
      /* ignore */
    }
  }

  for (const ws of [...workbook.worksheets]) {
    if (/export\s*summary/i.test(String(ws.name || ""))) {
      try {
        workbook.removeWorksheet(ws.id);
      } catch {
        /* ignore */
      }
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
