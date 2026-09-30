/**
 * Voucher daily cash report — built from a brand-new ExcelJS Workbook.
 * No XLSX template load, no JSZip/XML post-processing.
 * Design recreated via ExcelJS cell/sheet APIs (ARGB colors only).
 */

import * as ExcelJSModule from "exceljs";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { formatVoucherDateDisplay } from "./voucherDate.js";
import {
  getCompanyExcelTheme,
  GHADEER_EXCEL_THEME,
} from "./companyExcelTheme.js";
import {
  getVoucherDocType,
  isAlGhadeerMain,
  isZeroNetVoucher,
  resolveCashCurrency,
} from "./utils.js";

const ExcelJS = ExcelJSModule?.default ?? ExcelJSModule;
const requireConfig = createRequire(import.meta.url);

function loadBundledCompanyFormConfig() {
  try {
    return requireConfig("./companyFormConfig.json");
  } catch {
    return null;
  }
}

const SAFE_PRINT_DPI = 600;

/** Excel character-width ≈ (px − 5) / 7 for Calibri */
function excelWidthFromPx(px) {
  const n = Number(px);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(((n - 5) / 7) * 100) / 100;
}

/** Column B (التفاصيل) — full column width */
const DETAILS_COL_WIDTH = excelWidthFromPx(337);

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
  "Badur-Baghdad-Elite": "بدور بغداد - Elite",
  "Badur-Elite-MIB": "بدور ايليت - MIB",
  "Tiba-Al-najaf": "طيبة النجف",
  "Ghadeer-Karbala": "غدير كربلاء",
  "Badur-Al-Najaf": "بدور النجف",
  "Ghadeer-Investments": "الغدير - صندوق فرعي - كربلاء",
  "Ghadeer-Karbala-Sub": "غدير كربلاء - الصندوق الفرعي",
  "Ghadeer-Najaf-Sub": "الغدير الفرعي - النجف",
  "010": "010 (Test)",
};

/** تخطيط فورمة الصندوق (أعمدة G..K للمستندات، وصندوق ملخص دينار/دولار) */
const LAYOUT = {
  day: "C2",
  date: "C3",
  cashier: "C4",
  fundName: "C6",
  title: "D2",
  prevIqd: "C7",
  prevUsd: "C8",
  prevEur: "C9",
  dataStart: 12,
  dataEnd: 22,
  totalRow: 23,
  balRow: 24,
  cashBox: {
    headerRow: 26,
    iqdRow: 27,
    usdRow: 28,
    eurRow: 29,
    noteRow: 30,
  },
  summary: {
    receipt: "C33",
    bankIn: "C34",
    payment: "C35",
    bankOut: "C36",
    pending: "C37",
    voided: "C38",
    total: "C39",
  },
};

/**
 * Flexible column map for daily cash sheet.
 * Cash currency pairs are ordered; bank/cheque/docs auto-shift after the last pair.
 * Al-Ghadeer main adds EUR — reorder `cashPairs` here if the sheet order changes.
 */
function getColumnLayout(companyKey) {
  const withEur = isAlGhadeerMain(companyKey);

  const cashPairs = [
    {
      key: "iqd",
      inCol: "C",
      outCol: "D",
      title: "صندوق - الدينار",
      prevLabel: "B7",
      prevValue: "C7",
      prevText: "الرصيد السابق - دينار",
    },
    {
      key: "usd",
      inCol: "E",
      outCol: "F",
      title: "صندوق - الدولار",
      prevLabel: "B8",
      prevValue: "C8",
      prevText: "الرصيد السابق - دولار",
    },
  ];

  if (withEur) {
    cashPairs.push({
      key: "eur",
      inCol: "G",
      outCol: "H",
      title: "صندوق - اليورو",
      prevLabel: "B9",
      prevValue: "C9",
      prevText: "الرصيد السابق - يورو",
    });
  }

  const lastCashOut = cashPairs[cashPairs.length - 1].outCol;
  const startIdx = COL_LETTERS.indexOf(lastCashOut) + 1;
  const bankCol = COL_LETTERS[startIdx];
  const chequeCol = COL_LETTERS[startIdx + 1];
  const fxCol = COL_LETTERS[startIdx + 2];
  const typeCol = COL_LETTERS[startIdx + 3];
  const noCol = COL_LETTERS[startIdx + 4];

  return {
    withEur,
    cashPairs,
    bank: { col: bankCol, title: "اسم الحساب المصرفي" },
    cheque: { col: chequeCol, title: "رقم الصك" },
    docs: {
      fx: fxCol,
      type: typeCol,
      no: noCol,
      title: "المستندات",
      groupStart: fxCol,
      groupEnd: noCol,
    },
    lastCol: noCol,
    dataCols: lettersBetween("A", noCol),
    amountCols: cashPairs.flatMap((p) => [p.inCol, p.outCol]),
  };
}

function getReportLayout(companyKey) {
  const cols = getColumnLayout(companyKey);
  if (!cols.withEur) {
    return {
      ...LAYOUT,
      prevEur: null,
      cashBox: {
        headerRow: 26,
        iqdRow: 27,
        usdRow: 28,
        eurRow: null,
        noteRow: 29,
      },
    };
  }
  return { ...LAYOUT };
}

function lettersBetween(start, end) {
  const a = COL_LETTERS.indexOf(String(start).toUpperCase());
  const b = COL_LETTERS.indexOf(String(end).toUpperCase());
  if (a < 0 || b < 0 || b < a) return [];
  return COL_LETTERS.slice(a, b + 1);
}

/** Merges for Al-Ghadeer main (EUR columns G-H, bank/docs shifted). */
const ALGHADEER_EUR_MERGES = [
  "D2:I5",
  "J2:M8",
  "D6:I8",
  "C10:D10",
  "E10:F10",
  "G10:H10",
  "A10:A11",
  "B10:B11",
  "I10:I11",
  "J10:J11",
  "K10:M10",
  "A23:B23",
  "A24:B24",
  "C24:D24",
  "E24:F24",
  "G24:H24",
  "D26:F26",
  "G26:H26",
  "I26:M26",
  "D27:F27",
  "G27:H27",
  "I27:M27",
  "D28:F28",
  "G28:H28",
  "I28:M28",
  "D29:F29",
  "G29:H29",
  "I29:M29",
  "D30:M30",
  "A31:F31",
  "G31:M31",
  "G32:M32",
  "G33:M33",
  "G34:M34",
  "G35:M35",
  "G36:M36",
  "G37:M37",
  "G38:M38",
  "A41:D41",
  "H41:M41",
  "A42:D42",
  "H42:M42",
];

/** شركة → اسم ورقة التقرير */
const COMPANY_SHEET_MAP = {
  "Al-Ghadeer": "شركة الغدير",
  "Badur-Baghdad": "شركة بدور بغداد",
  "Badur-Baghdad-Safebox-Istishar": "بدور بغداد - أمانات المستشار",
  "Badur-Baghdad-Elite": "بدور بغداد - Elite",
  "Badur-Elite-MIB": "بدور ايليت - MIB",
  "Tiba-Al-najaf": "طيبة النجف",
  "Ghadeer-Karbala": "غدير كربلاء",
  "Badur-Al-Najaf": "بدور النجف",
  "Ghadeer-Investments": "الغدير - فرعي كربلاء",
  "Ghadeer-Karbala-Sub": "غدير كربلاء - الفرعي",
  "Ghadeer-Najaf-Sub": "الغدير الفرعي - النجف",
  "010": "شركة الغدير",
};

/**
 * Per-company visual design from فورمة_صندوق_فارغة_excel.xlsx (reference only).
 * Always read from disk so Next/dev never serves a stale require() cache.
 */
function loadCompanyFormConfig() {
  const candidates = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(here, "companyFormConfig.json"));
  } catch {
    /* ignore */
  }
  candidates.push(join(process.cwd(), "lib/voucher/companyFormConfig.json"));
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* try next */
    }
  }
  return loadBundledCompanyFormConfig() || {};
}

function getCompanyFormConfigFresh() {
  return loadCompanyFormConfig();
}

const FALLBACK_MERGES = [
  "D2:I5",
  "J2:K8",
  "D6:I8",
  "C10:D10",
  "E10:F10",
  "I10:K10",
  "A10:A11",
  "B10:B11",
  "G10:G11",
  "H10:H11",
  "A23:B23",
  "A24:B24",
  "C24:D24",
  "E24:F24",
  "D26:F26",
  "G26:H26",
  "I26:K26",
  "D27:F27",
  "G27:H27",
  "I27:K27",
  "D28:F28",
  "G28:H28",
  "I28:K28",
  "D29:K29",
  "A31:F31",
  "G31:K31",
  "G32:K32",
  "G33:K33",
  "G34:K34",
  "G35:K35",
  "G36:K36",
  "G37:K37",
  "G38:K38",
  "A41:D41",
  "H41:K41",
  "A42:D42",
  "H42:K42",
];

const COL_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
];

function getFormConfig(companyKey) {
  const COMPANY_FORM_CONFIG = getCompanyFormConfigFresh();
  const key = resolveCompanyKey(companyKey);
  const withEur = isAlGhadeerMain(key);
  const base =
    COMPANY_FORM_CONFIG[key] ||
    COMPANY_FORM_CONFIG["Al-Ghadeer"] || {
      sheetName: COMPANY_SHEET_MAP[key] || "شركة الغدير",
      widths: {
        1: 4,
        2: DETAILS_COL_WIDTH,
        3: 12,
        4: 12,
        5: 10,
        6: 10,
        7: 14,
        8: 11,
        9: 10,
        10: 20,
        11: 10,
        12: 8.85156,
      },
      heights: {},
      merges: FALLBACK_MERGES,
      orientation: "portrait",
      margins: {
        left: 1,
        right: 1,
        top: 1,
        bottom: 1,
        header: 0.5,
        footer: 0.5,
      },
      logo: null,
    };

  if (!withEur) return base;

  // Al-Ghadeer main: dedicated EUR layout (flexible column map + merges)
  return {
    ...base,
    merges: ALGHADEER_EUR_MERGES,
    widths: {
      ...(base.widths || {}),
      3: 10,
      4: 10,
      5: 10,
      6: 10,
      7: 10,
      8: 10,
      9: 14,
      10: 11,
      11: 10,
      12: 12,
      13: 12,
    },
    heights: {
      ...(base.heights || {}),
      9: 18,
      29: 15.95,
      30: 20.1,
    },
  };
}

/** Semantic amount colors (shared; not brand-dependent). */
const SEMANTIC = {
  receipt: GHADEER_EXCEL_THEME.receipt,
  payment: GHADEER_EXCEL_THEME.payment,
  text: GHADEER_EXCEL_THEME.text,
};

const thin = (color) => ({
  style: "thin",
  color: { argb: color },
});

function themeBorders(theme) {
  return {
    all: {
      top: thin(theme.border),
      left: thin(theme.border),
      bottom: thin(theme.border),
      right: thin(theme.border),
    },
    primary: {
      top: thin(theme.primary),
      left: thin(theme.primary),
      bottom: thin(theme.primary),
      right: thin(theme.primary),
    },
  };
}

function themeFonts(theme) {
  return {
    label: {
      name: "Calibri",
      size: 9,
      bold: true,
      color: { argb: theme.primary },
    },
    value: { name: "Calibri", size: 11, color: { argb: theme.text } },
    title: {
      name: "Calibri",
      size: 14,
      bold: true,
      color: { argb: theme.primary },
    },
    header: {
      name: "Calibri",
      size: 8,
      bold: true,
      color: { argb: theme.primary },
    },
    headerOnPrimary: {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: theme.textOnPrimary || theme.white },
    },
    small: { name: "Calibri", size: 9, bold: true, color: { argb: theme.text } },
    receipt: {
      name: "Calibri",
      size: 9,
      bold: true,
      color: { argb: theme.receipt },
    },
    payment: {
      name: "Calibri",
      size: 9,
      bold: true,
      color: { argb: theme.payment },
    },
    note: { name: "Calibri", size: 8, color: { argb: theme.muted } },
  };
}

function solid(argb) {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  };
}

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
  return COMPANY_SHEET_MAP[key] || COMPANY_SHEET_MAP["Al-Ghadeer"];
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

function sortVouchers(list) {
  return [...list].sort((a, b) => {
    // مقبوضات أولاً، ثم المصروفات
    const ma = normalizeMode(a?.mode) === "payment" ? 1 : 0;
    const mb = normalizeMode(b?.mode) === "payment" ? 1 : 0;
    if (ma !== mb) return ma - mb;
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

/** Shift merge refs whose rows are at/after insertAt (used after spliceRows). */
function shiftMergeRef(ref, extra, insertAt) {
  return String(ref).replace(/([A-Za-z]+)(\d+)/g, (_, col, rowStr) => {
    const row = Number(rowStr);
    return `${col}${row >= insertAt ? row + extra : row}`;
  });
}

function styleCell(cell, { value, font, fill, border, align, numFmt } = {}) {
  if (value !== undefined) cell.value = value;
  if (font) cell.font = { ...font };
  if (fill) cell.fill = { ...fill };
  if (border) cell.border = JSON.parse(JSON.stringify(border));
  if (align) cell.alignment = { ...align };
  if (numFmt) cell.numFmt = numFmt;
}

function applyRange(ws, range, style) {
  const [a, b] = String(range).split(":");
  const start = ws.getCell(a);
  const end = ws.getCell(b || a);
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      const isMaster = r === start.row && c === start.col;
      // Only write value on the master cell — writing values into merge
      // slaves breaks merges when Excel repairs the file.
      const cellStyle =
        isMaster || style?.value === undefined
          ? style
          : { ...style, value: undefined };
      styleCell(ws.getCell(r, c), cellStyle);
    }
  }
}

function resolveAssetsDir() {
  const candidates = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(join(here, "assets"));
  } catch {
    /* ignore */
  }
  // Next standalone tracing + local monorepo paths
  candidates.push(join(process.cwd(), "lib/voucher/assets"));
  candidates.push(join(process.cwd(), "lib/voucher/templates/logos"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function loadLogoBuffer(logoFile) {
  const file = logoFile || "image3.png";
  const dirs = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    dirs.push(join(here, "assets"));
  } catch {
    /* ignore */
  }
  dirs.push(join(process.cwd(), "lib/voucher/assets"));
  dirs.push(join(process.cwd(), "lib/voucher/templates/logos"));

  const ext = String(file).toLowerCase().endsWith(".jpg") ||
    String(file).toLowerCase().endsWith(".jpeg")
    ? "jpeg"
    : "png";

  for (const dir of dirs) {
    const path = join(dir, file);
    if (existsSync(path)) {
      return { buffer: readFileSync(path), extension: ext, file, path };
    }
  }
  return null;
}

function applyPageSetup(ws, formConfig, lastCol = "K") {
  const margins = formConfig?.margins || {
    left: 1,
    right: 1,
    top: 1,
    bottom: 1,
    header: 0.5,
    footer: 0.5,
  };
  ws.pageSetup = {
    orientation: formConfig?.orientation || "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 100,
    paperSize: 9,
    horizontalDpi: SAFE_PRINT_DPI,
    verticalDpi: SAFE_PRINT_DPI,
    margins: { ...margins },
  };
  ws.pageSetup.printArea = `A1:${lastCol || "K"}50`;
}

const EMU_PER_PX = 9525;

function colWidthCharsToPx(chars) {
  const w = Number(chars);
  if (!Number.isFinite(w) || w <= 0) return 64;
  if (w < 1) return Math.max(1, Math.floor(w * 12));
  return Math.floor(w * 7 + 5);
}

function rowHeightPointsToPx(points) {
  const p = Number(points);
  if (!Number.isFinite(p) || p <= 0) return 20;
  return p * (96 / 72);
}

/**
 * Center a fixed-size logo inside a column span (default J2:K8; Al-Ghadeer EUR → J2:M8).
 */
function centeredLogoTl(ws, ext, { fromCol = 9, toCol = 10 } = {}) {
  const logoW = Math.max(1, Number(ext?.width) || 100);
  const logoH = Math.max(1, Number(ext?.height) || 100);
  const fromRow = 1; // row 2
  const toRow = 7; // row 8
  const startCol = Math.max(0, Number(fromCol) || 0);
  const endCol = Math.max(startCol, Number(toCol) || startCol);

  let boxW = 0;
  for (let c = startCol; c <= endCol; c++) {
    boxW += colWidthCharsToPx(ws.getColumn(c + 1).width);
  }
  let boxH = 0;
  for (let r = fromRow; r <= toRow; r++) {
    const ht =
      ws.getRow(r + 1).height || ws.properties.defaultRowHeight || 15;
    boxH += rowHeightPointsToPx(ht);
  }

  let padX = Math.max(0, (boxW - logoW) / 2);
  let nativeCol = startCol;
  for (let c = startCol; c <= endCol; c++) {
    const w = colWidthCharsToPx(ws.getColumn(c + 1).width);
    if (padX <= w || c === endCol) {
      nativeCol = c;
      break;
    }
    padX -= w;
  }

  let padY = Math.max(0, (boxH - logoH) / 2);
  let nativeRow = fromRow;
  for (let r = fromRow; r <= toRow; r++) {
    const h = rowHeightPointsToPx(
      ws.getRow(r + 1).height || ws.properties.defaultRowHeight || 15
    );
    if (padY <= h || r === toRow) {
      nativeRow = r;
      break;
    }
    padY -= h;
  }

  return {
    nativeCol,
    nativeColOff: Math.round(padX * EMU_PER_PX),
    nativeRow,
    nativeRowOff: Math.round(padY * EMU_PER_PX),
  };
}

/**
 * Build empty form chrome (labels, merges, styles, logo) on a worksheet.
 * Column order comes from getColumnLayout(companyKey) — Al-Ghadeer main includes EUR.
 */
function paintFormSheet(workbook, ws, companyKey, { withLogo = true } = {}) {
  const formConfig = getFormConfig(companyKey);
  const cols = getColumnLayout(companyKey);
  const reportLayout = getReportLayout(companyKey);
  const theme = getCompanyExcelTheme(resolveCompanyKey(companyKey));
  const FONT = themeFonts(theme);
  const { all: BORDER_ALL, primary: BORDER_PRIMARY } = themeBorders(theme);

  ws.views = [
    {
      rightToLeft: true,
      state: "normal",
      showGridLines: true,
      zoomScale: 70,
      zoomScaleNormal: 100,
    },
  ];
  ws.properties.defaultRowHeight = 15;

  const maxColIdx = COL_LETTERS.indexOf(cols.lastCol) + 1;
  const widths = formConfig.widths || {};
  for (let i = 1; i <= Math.max(12, maxColIdx); i++) {
    const w = widths[String(i)] ?? widths[i];
    if (w != null) ws.getColumn(i).width = Number(w);
  }
  if (DETAILS_COL_WIDTH != null) {
    ws.getColumn(2).width = DETAILS_COL_WIDTH;
  }

  const heights = formConfig.heights || {};
  for (let r = 1; r <= 50; r++) {
    const ht = heights[String(r)] ?? heights[r];
    if (ht != null) ws.getRow(r).height = Number(ht);
  }

  const merges = formConfig.merges?.length ? formConfig.merges : FALLBACK_MERGES;
  for (const m of merges) {
    try {
      ws.mergeCells(m);
    } catch {
      /* already merged */
    }
  }

  const name = companyName(companyKey);
  const alignCenter = { horizontal: "center", vertical: "middle", wrapText: true };
  const alignRight = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
  const logoEnd = cols.withEur ? "M" : "K";

  // Meta labels + prev balances (driven by cashPairs — EUR appears only for Al-Ghadeer)
  const metaTop = [
    ["B2", "اليوم", "C2"],
    ["B3", "التاريخ", "C3"],
    ["B4", "أمين الصندوق", "C4"],
    ["B6", "اسم صندوق اليوم", "C6"],
  ];
  for (const [labelAddr, text, valueAddr] of metaTop) {
    styleCell(ws.getCell(labelAddr), {
      value: text,
      font: FONT.label,
      fill: solid(theme.soft),
      border: BORDER_ALL,
      align: alignRight,
    });
    styleCell(ws.getCell(valueAddr), {
      font: FONT.value,
      fill: solid(theme.white),
      border: BORDER_ALL,
      align: alignCenter,
    });
  }
  for (const pair of cols.cashPairs) {
    styleCell(ws.getCell(pair.prevLabel), {
      value: pair.prevText,
      font: FONT.label,
      fill: solid(theme.soft),
      border: BORDER_ALL,
      align: alignRight,
    });
    styleCell(ws.getCell(pair.prevValue), {
      value: 0,
      font: FONT.value,
      fill: solid(theme.white),
      border: BORDER_ALL,
      align: alignCenter,
    });
  }

  // Title + logo frame
  applyRange(ws, "D2:I5", {
    fill: solid(theme.headerBg),
    border: BORDER_PRIMARY,
    font: FONT.title,
    align: alignCenter,
  });
  ws.getCell("D2").value = `التقرير اليومي لصندوق ${name}`;

  applyRange(ws, "D6:I8", {
    fill: solid(theme.soft),
    border: BORDER_ALL,
  });
  applyRange(ws, `J2:${logoEnd}8`, {
    fill: solid(theme.white),
    border: BORDER_ALL,
  });

  // Table header — cash pairs then bank/cheque/docs (auto-shifted)
  styleCell(ws.getCell("A10"), {
    value: "ت",
    font: FONT.header,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("B10"), {
    value: "التفاصيل",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });

  for (const pair of cols.cashPairs) {
    styleCell(ws.getCell(`${pair.inCol}10`), {
      value: pair.title,
      font: FONT.header,
      fill: solid(theme.headerBg),
      border: BORDER_ALL,
      align: alignCenter,
    });
    styleCell(ws.getCell(`${pair.inCol}11`), {
      value: "مقبوضات",
      font: FONT.receipt,
      fill: solid(theme.headerBg),
      border: BORDER_ALL,
      align: alignCenter,
    });
    styleCell(ws.getCell(`${pair.outCol}11`), {
      value: "مصروفات",
      font: FONT.payment,
      fill: solid(theme.headerBg),
      border: BORDER_ALL,
      align: alignCenter,
    });
  }

  styleCell(ws.getCell(`${cols.bank.col}10`), {
    value: cols.bank.title,
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`${cols.cheque.col}10`), {
    value: cols.cheque.title,
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`${cols.docs.groupStart}10`), {
    value: cols.docs.title,
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`${cols.docs.fx}11`), {
    value: "سعر الصرف",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`${cols.docs.type}11`), {
    value: "نوع المستند",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`${cols.docs.no}11`), {
    value: "رقم الوصل",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });

  // Data rows chrome
  for (let r = reportLayout.dataStart; r <= reportLayout.dataEnd; r++) {
    for (const col of cols.dataCols) {
      styleCell(ws.getCell(`${col}${r}`), {
        border: BORDER_ALL,
        fill: solid(theme.white),
        font: FONT.value,
        align: alignCenter,
      });
    }
    ws.getCell(`A${r}`).value = r - reportLayout.dataStart + 1;
  }

  // Totals / balance
  styleCell(ws.getCell(`A${reportLayout.totalRow}`), {
    value: "المجموع",
    font: FONT.headerOnPrimary,
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`A${reportLayout.balRow}`), {
    value: "الرصيد",
    font: FONT.headerOnPrimary,
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  for (const col of cols.amountCols) {
    styleCell(ws.getCell(`${col}${reportLayout.totalRow}`), {
      border: BORDER_ALL,
      fill: solid(theme.headerBgDeep),
      font: FONT.small,
      align: alignCenter,
    });
    styleCell(ws.getCell(`${col}${reportLayout.balRow}`), {
      border: BORDER_ALL,
      fill: solid(theme.soft),
      font: FONT.small,
      align: alignCenter,
    });
  }

  // Cash box (IQD / USD / optional EUR + note)
  const box = reportLayout.cashBox;
  const boxEnd = cols.lastCol;
  styleCell(ws.getCell(`A${box.headerRow}`), {
    value: "      الرصيد الحالي",
    font: FONT.small,
    fill: solid(theme.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`G${box.headerRow}`), {
    value: "      مجموع الاستيرادات",
    font: FONT.receipt,
    fill: solid(theme.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell(`I${box.headerRow}`), {
    value: "      مجموع المصروفات والسحوبات",
    font: FONT.payment,
    fill: solid(theme.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });

  const currencyRows = [
    { row: box.iqdRow, label: "دينار" },
    { row: box.usdRow, label: "دولار" },
  ];
  if (cols.withEur && box.eurRow) {
    currencyRows.push({ row: box.eurRow, label: "يورو" });
  }
  for (const { row, label } of currencyRows) {
    applyRange(ws, `D${row}:F${row}`, {
      border: BORDER_ALL,
      fill: solid(theme.white),
      align: alignCenter,
    });
    applyRange(ws, `G${row}:H${row}`, {
      border: BORDER_ALL,
      fill: solid(theme.white),
      align: alignCenter,
    });
    applyRange(ws, `I${row}:${boxEnd}${row}`, {
      border: BORDER_ALL,
      fill: solid(theme.white),
      align: alignCenter,
    });
    styleCell(ws.getCell(`C${row}`), {
      value: label,
      font: FONT.small,
      fill: solid(theme.boxBg),
      border: BORDER_ALL,
      align: alignCenter,
    });
  }

  const noteRow = box.noteRow;
  applyRange(ws, `D${noteRow}:${boxEnd}${noteRow}`, {
    value: "الرصيد الحالي = مجموع الاستيرادات − مجموع المصروفات والسحوبات",
    font: FONT.note,
    fill: solid(theme.noteBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  ws.getCell(`D${noteRow}`).value =
    "الرصيد الحالي = مجموع الاستيرادات − مجموع المصروفات والسحوبات";

  // Summary block
  const notesEnd = cols.lastCol;
  styleCell(ws.getCell("A31"), {
    value: "      ملخص الوصولات",
    font: FONT.headerOnPrimary,
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("G31"), {
    value: "      ملاحظات أمين الصندوق",
    font: FONT.headerOnPrimary,
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("A32"), {
    value: "ت",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("B32"), {
    value: "تفاصيل",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("C32"), {
    value: "العدد",
    font: FONT.header,
    fill: solid(theme.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });

  const summaryRows = [
    [33, "وصل قبض"],
    [34, "قبض مصرفي"],
    [35, "وصل صرف"],
    [36, "صرف مصرفي"],
    [37, "وصلات ملغاة"],
    [38, "وصلات باطلة"],
  ];
  summaryRows.forEach(([row, label], idx) => {
    styleCell(ws.getCell(`A${row}`), {
      value: idx + 1,
      border: BORDER_ALL,
      align: alignCenter,
      font: FONT.small,
    });
    styleCell(ws.getCell(`B${row}`), {
      value: label,
      border: BORDER_ALL,
      align: alignRight,
      font: FONT.small,
      fill: solid(theme.soft),
    });
    styleCell(ws.getCell(`C${row}`), {
      border: BORDER_ALL,
      align: alignCenter,
      font: FONT.value,
    });
    applyRange(ws, `G${row}:${notesEnd}${row}`, {
      border: BORDER_ALL,
      fill: solid(theme.white),
    });
  });
  styleCell(ws.getCell("A39"), {
    value: "إجمالي الوصولات",
    font: FONT.header,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("C39"), {
    border: BORDER_ALL,
    fill: solid(theme.headerBgDeep),
    font: FONT.small,
    align: alignCenter,
  });

  // Signatures
  styleCell(ws.getCell("A41"), {
    value: "أمين الصندوق",
    font: FONT.label,
    fill: solid(theme.soft),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("H41"), {
    value: "المدير المالي",
    font: FONT.label,
    fill: solid(theme.soft),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("A42"), {
    value: "________________",
    font: FONT.note,
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("H42"), {
    value: "________________",
    font: FONT.note,
    border: BORDER_ALL,
    align: alignCenter,
  });

  applyPageSetup(ws, formConfig, cols.lastCol);

  if (withLogo && formConfig.logo) {
    const logo = loadLogoBuffer(formConfig.logo.file);
    if (logo) {
      const imageId = workbook.addImage({
        buffer: logo.buffer,
        extension: "png",
      });
      const ext = formConfig.logo.ext
        ? {
            width: Number(formConfig.logo.ext.width),
            height: Number(formConfig.logo.ext.height),
          }
        : null;
      const logoToCol = COL_LETTERS.indexOf(logoEnd); // 0-based for ExcelJS nativeCol
      if (ext?.width > 0 && ext?.height > 0) {
        ws.addImage(imageId, {
          tl: centeredLogoTl(ws, ext, { fromCol: 9, toCol: logoToCol }),
          ext,
          editAs: "oneCell",
        });
      } else {
        ws.addImage(imageId, {
          tl: { ...formConfig.logo.tl },
          br: { ...formConfig.logo.br },
          editAs: "oneCell",
        });
      }
    }
  }
}

function clearCell(ws, addr) {
  ws.getCell(addr).value = null;
}

function setValue(ws, addr, value) {
  ws.getCell(addr).value = value === undefined ? null : value;
}

function applyAmountFontColor(ws, addr, argb) {
  const cell = ws.getCell(addr);
  const prev = cell.font || {};
  cell.font = {
    name: prev.name || "Calibri",
    size: prev.size || 11,
    bold: true,
    color: { argb: String(argb) },
  };
}

const AMOUNT_NUM_FMT = "#,##0.##";
const DATA_ROW_HEIGHT = 24;

function applyAmountNumFmt(ws, addr) {
  const cell = ws.getCell(addr);
  cell.numFmt = AMOUNT_NUM_FMT;
}

function setAmount(ws, addr, value, kind) {
  setValue(ws, addr, value);
  if (value == null || value === "") return;
  applyAmountNumFmt(ws, addr);
  applyAmountFontColor(
    ws,
    addr,
    kind === "payment" ? SEMANTIC.payment : SEMANTIC.receipt
  );
}

function clearDataRow(ws, row, cols) {
  const layout = cols || getColumnLayout(null);
  for (const col of layout.dataCols) {
    if (col === "A") continue;
    clearCell(ws, `${col}${row}`);
  }
}

function writeDataRow(ws, row, voucher, index, cols) {
  const layout = cols || getColumnLayout(null);
  clearDataRow(ws, row, layout);

  const mode = normalizeMode(voucher.mode);
  const amount = parseAmount(voucher.amount);
  let bucket = resolveCashCurrency(voucher.currency);
  if (bucket === "eur" && !layout.withEur) bucket = "iqd";
  const zeroNet = isZeroNetVoucher(voucher);
  const { code, label } = getVoucherDocType(voucher);
  const voucherNo =
    voucher.voucherNo || String(voucher.seq ?? "").padStart(5, "0");
  const desc = String(voucher.description || "").trim() || null;
  const fx = Number(String(voucher.fxRate ?? "").replace(/,/g, "").trim());

  const byKey = Object.fromEntries(layout.cashPairs.map((p) => [p.key, p]));

  setValue(ws, `A${row}`, index);
  setValue(ws, `B${row}`, desc || label);

  const putPair = (inCol, outCol) => {
    if (zeroNet) {
      setAmount(ws, `${inCol}${row}`, amount || null, "receipt");
      setAmount(ws, `${outCol}${row}`, amount || null, "payment");
    } else if (mode === "receipt") {
      setAmount(ws, `${inCol}${row}`, amount || null, "receipt");
    } else {
      setAmount(ws, `${outCol}${row}`, amount || null, "payment");
    }
  };

  const pair = byKey[bucket] || byKey.iqd;
  if (pair) putPair(pair.inCol, pair.outCol);

  setValue(ws, `${layout.bank.col}${row}`, voucher.bank || null);
  setValue(ws, `${layout.cheque.col}${row}`, voucher.chequeNo || null);
  setValue(
    ws,
    `${layout.docs.fx}${row}`,
    Number.isFinite(fx) && fx > 0 ? fx : null
  );
  setValue(ws, `${layout.docs.type}${row}`, code);
  setValue(ws, `${layout.docs.no}${row}`, voucherNo);
}

function rewriteFormulas(ws, layout, cols) {
  const columnLayout = cols || getColumnLayout(null);
  const { dataStart, dataEnd, totalRow, balRow, cashBox, summary } = layout;
  const byKey = Object.fromEntries(
    columnLayout.cashPairs.map((p) => [p.key, p])
  );

  for (const pair of columnLayout.cashPairs) {
    const prevRef = pair.prevValue;
    setValue(ws, `${pair.inCol}${totalRow}`, {
      formula: `${prevRef}+SUM(${pair.inCol}${dataStart}:${pair.inCol}${dataEnd})`,
    });
    setValue(ws, `${pair.outCol}${totalRow}`, {
      formula: `SUM(${pair.outCol}${dataStart}:${pair.outCol}${dataEnd})`,
    });
    applyAmountNumFmt(ws, `${pair.inCol}${totalRow}`);
    applyAmountNumFmt(ws, `${pair.outCol}${totalRow}`);
    applyAmountFontColor(ws, `${pair.inCol}${totalRow}`, SEMANTIC.receipt);
    applyAmountFontColor(ws, `${pair.outCol}${totalRow}`, SEMANTIC.payment);

    setValue(ws, `${pair.inCol}${balRow}`, {
      formula: `${pair.inCol}${totalRow}-${pair.outCol}${totalRow}`,
    });
    applyAmountNumFmt(ws, `${pair.inCol}${balRow}`);
  }

  if (cashBox) {
    const { iqdRow, usdRow, eurRow } = cashBox;
    const paintCashRow = (row, pair) => {
      if (!row || !pair) return;
      const label =
        pair.key === "usd" ? "دولار" : pair.key === "eur" ? "يورو" : "دينار";
      setValue(ws, `C${row}`, label);
      setValue(ws, `D${row}`, { formula: `${pair.inCol}${balRow}` });
      setValue(ws, `G${row}`, { formula: `${pair.inCol}${totalRow}` });
      setValue(ws, `I${row}`, { formula: `${pair.outCol}${totalRow}` });
      applyAmountNumFmt(ws, `D${row}`);
      applyAmountNumFmt(ws, `G${row}`);
      applyAmountNumFmt(ws, `I${row}`);
      applyAmountFontColor(ws, `G${row}`, SEMANTIC.receipt);
      applyAmountFontColor(ws, `I${row}`, SEMANTIC.payment);
    };

    paintCashRow(iqdRow, byKey.iqd);
    paintCashRow(usdRow, byKey.usd);
    if (columnLayout.withEur && eurRow) paintCashRow(eurRow, byKey.eur);
  }

  const docCol = columnLayout.docs.type;
  const typeRange = `${docCol}${dataStart}:${docCol}${dataEnd}`;
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

  clearSummaryAmountColumn(ws, layout);
}

function clearSummaryAmountColumn(ws, layout) {
  const receiptRow = Number(
    String(layout.summary?.receipt || "").replace(/\D/g, "")
  );
  if (!receiptRow) return;
  const headerRow = receiptRow - 1;
  clearCell(ws, `D${headerRow}`);
  for (let r = receiptRow; r <= receiptRow + 5; r++) {
    clearCell(ws, `D${r}`);
  }
}

function fillCashierUsername(ws, username) {
  const name = String(username || "").trim();
  if (!name) return;
  const top = ws.getCell(LAYOUT.cashier);
  top.value = name;
  top.font = { name: "Calibri", size: 11, bold: true, color: { argb: SEMANTIC.text } };

  ws.eachRow((row, rowNumber) => {
    if (rowNumber < 20) return;
    const a = String(row.getCell(1).value || "").trim();
    if (!a.includes("أمين الصندوق")) return;
    const sign = ws.getCell(`A${rowNumber + 1}`);
    sign.value = name;
    sign.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: SEMANTIC.text },
    };
  });
}

function ensureCapacity(ws, layout, needed, formMerges = FALLBACK_MERGES) {
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
    else dst.height = DATA_ROW_HEIGHT;
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

  // Re-assert body merges after splice (header merges stay put).
  // ExcelJS/Excel can drop merges below the insert line — restore them shifted.
  const merges = (formMerges?.length ? formMerges : FALLBACK_MERGES) || [];
  const isHeaderMerge = (ref) => {
    const rows = String(ref)
      .match(/\d+/g)
      ?.map(Number)
      .filter((n) => Number.isFinite(n));
    if (!rows?.length) return false;
    return Math.max(...rows) < layout.dataStart;
  };
  const headerMerges = new Set(merges.filter(isHeaderMerge).map(String));
  const desiredBody = merges
    .filter((m) => !isHeaderMerge(m))
    .map((m) => shiftMergeRef(m, extra, insertAt));

  const current = [];
  try {
    if (ws.model?.merges) current.push(...ws.model.merges);
    else if (ws._merges) current.push(...Object.keys(ws._merges));
  } catch {
    /* ignore */
  }

  for (const ref of current) {
    if (headerMerges.has(String(ref))) continue;
    try {
      ws.unMergeCells(ref);
    } catch {
      /* ignore */
    }
  }
  for (const m of desiredBody) {
    try {
      ws.mergeCells(m);
    } catch {
      /* ignore */
    }
  }

  const summary = {};
  for (const [k, addr] of Object.entries(layout.summary)) {
    summary[k] = shiftAddr(addr, extra);
  }
  const cashBox = layout.cashBox
    ? {
        headerRow: layout.cashBox.headerRow + extra,
        iqdRow: layout.cashBox.iqdRow + extra,
        usdRow: layout.cashBox.usdRow + extra,
        eurRow: layout.cashBox.eurRow
          ? layout.cashBox.eurRow + extra
          : undefined,
        noteRow: layout.cashBox.noteRow + extra,
      }
    : null;

  return {
    ...layout,
    dataEnd: layout.dataEnd + extra,
    totalRow: layout.totalRow + extra,
    balRow: layout.balRow + extra,
    cashBox,
    summary,
  };
}

function fillSheet(ws, vouchers, meta, companyKey, exportedByUsername = "") {
  const cols = getColumnLayout(companyKey);
  let layout = getReportLayout(companyKey);
  const rows = sortVouchers(vouchers);
  const formConfig = getFormConfig(companyKey);

  setValue(ws, layout.day, meta.day || null);
  setValue(ws, layout.date, meta.date || null);
  clearCell(ws, layout.cashier);
  setValue(ws, layout.fundName, companyName(companyKey));
  setValue(
    ws,
    layout.title,
    `التقرير اليومي لصندوق ${companyName(companyKey)}`
  );

  for (const pair of cols.cashPairs) {
    if (ws.getCell(pair.prevValue).value == null) {
      setValue(ws, pair.prevValue, 0);
    }
  }

  layout = ensureCapacity(
    ws,
    layout,
    Math.max(rows.length, 0),
    formConfig.merges?.length ? formConfig.merges : FALLBACK_MERGES
  );

  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    clearDataRow(ws, r, cols);
    setValue(ws, `A${r}`, r - layout.dataStart + 1);
    ws.getRow(r).height = DATA_ROW_HEIGHT;
  }

  rows.forEach((v, i) => {
    writeDataRow(ws, layout.dataStart + i, v, i + 1, cols);
  });

  // Re-assert column B width after row writes / capacity expansion
  if (DETAILS_COL_WIDTH != null) {
    ws.getColumn(2).width = DETAILS_COL_WIDTH;
  }

  rewriteFormulas(ws, layout, cols);
  fillCashierUsername(ws, exportedByUsername);
  return { layout, cols, sheetName: ws.name, companyKey };
}

function createSheet(workbook, companyKey, { withLogo = true } = {}) {
  const formConfig = getFormConfig(companyKey);
  const sheetName = safeSheetName(
    formConfig.sheetName || preferredSourceSheet(companyKey)
  );
  const existing = findSheet(workbook, sheetName);
  if (existing) return existing;
  const ws = workbook.addWorksheet(sheetName);
  paintFormSheet(workbook, ws, companyKey, { withLogo });
  return ws;
}

function excelSheetRef(sheetName) {
  const name = String(sheetName || "").replace(/'/g, "''");
  return `'${name}'`;
}

/**
 * Overview sheet: balances of all fund sheets (EUR column for Al-Ghadeer).
 * Includes empty movements table. Sheet is always last in the workbook.
 */
function createBalancesOverviewSheet(workbook, entries = []) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) return null;

  const existing = findSheet(workbook, "الارصدة");
  if (existing) {
    try {
      workbook.removeWorksheet(existing.id);
    } catch {
      /* ignore */
    }
  }

  const theme = GHADEER_EXCEL_THEME;
  const FONT = themeFonts(theme);
  const { all: BORDER_ALL } = themeBorders(theme);
  const alignC = { horizontal: "center", vertical: "middle", wrapText: true };
  const alignR = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };

  // addWorksheet appends → شيت الارصدة يصير آخر شيت
  const ws = workbook.addWorksheet("الارصدة", {
    views: [{ rightToLeft: true, showGridLines: false, state: "normal" }],
    properties: { defaultRowHeight: 18 },
  });

  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 5;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 12;
  ws.getColumn(6).width = 12;
  for (let c = 7; c <= 14; c++) ws.getColumn(c).width = 12;

  ws.mergeCells("C2:F2");
  styleCell(ws.getCell("C2"), {
    value: "أرصدة الصناديق اليومية",
    font: {
      ...FONT.title,
      color: { argb: theme.textOnPrimary || theme.white },
    },
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignC,
  });
  applyRange(ws, "C2:F2", {
    fill: solid(theme.primary),
    border: BORDER_ALL,
  });
  ws.getCell("C2").value = "أرصدة الصناديق اليومية";
  ws.getCell("C2").font = {
    ...FONT.title,
    color: { argb: theme.textOnPrimary || theme.white },
  };

  ws.getRow(4).height = 22;
  for (const [col, label] of [
    ["C", "الصندوق"],
    ["D", "دينار"],
    ["E", "دولار"],
    ["F", "يورو"],
  ]) {
    styleCell(ws.getCell(`${col}4`), {
      value: label,
      font: FONT.header,
      fill: solid(theme.headerBgDeep),
      border: BORDER_ALL,
      align: alignC,
    });
  }

  const fundStart = 5;
  list.forEach((entry, i) => {
    const r = fundStart + i;
    const bg = i % 2 === 0 ? theme.soft : theme.white;
    const withEur = Boolean(entry.cols?.withEur);
    const balRow = entry.layout?.balRow || LAYOUT.balRow;
    const sheetRef = excelSheetRef(entry.sheetName);
    const iqdPair = entry.cols?.cashPairs?.find((p) => p.key === "iqd");
    const usdPair = entry.cols?.cashPairs?.find((p) => p.key === "usd");
    const eurPair = entry.cols?.cashPairs?.find((p) => p.key === "eur");

    ws.getRow(r).height = 24;
    styleCell(ws.getCell(`C${r}`), {
      value: companyName(entry.companyKey) || entry.sheetName,
      font: FONT.label,
      fill: solid(bg),
      border: BORDER_ALL,
      align: alignR,
    });

    const iqdCol = iqdPair?.inCol || "C";
    const usdCol = usdPair?.inCol || "E";
    styleCell(ws.getCell(`D${r}`), {
      value: { formula: `${sheetRef}!${iqdCol}${balRow}` },
      font: FONT.value,
      fill: solid(bg),
      border: BORDER_ALL,
      align: alignC,
      numFmt: AMOUNT_NUM_FMT,
    });
    styleCell(ws.getCell(`E${r}`), {
      value: { formula: `${sheetRef}!${usdCol}${balRow}` },
      font: FONT.value,
      fill: solid(bg),
      border: BORDER_ALL,
      align: alignC,
      numFmt: AMOUNT_NUM_FMT,
    });

    if (withEur && eurPair) {
      styleCell(ws.getCell(`F${r}`), {
        value: { formula: `${sheetRef}!${eurPair.inCol}${balRow}` },
        font: FONT.label,
        fill: solid(theme.headerBg),
        border: BORDER_ALL,
        align: alignC,
        numFmt: AMOUNT_NUM_FMT,
      });
    } else {
      styleCell(ws.getCell(`F${r}`), {
        value: null,
        fill: solid(bg),
        border: BORDER_ALL,
        align: alignC,
      });
    }
  });

  const fundEnd = fundStart + list.length - 1;
  const totTitle = fundEnd + 2;
  ws.mergeCells(`C${totTitle}:F${totTitle}`);
  applyRange(ws, `C${totTitle}:F${totTitle}`, {
    fill: solid(theme.primary),
    border: BORDER_ALL,
  });
  styleCell(ws.getCell(`C${totTitle}`), {
    value: "اجمالي رصيد الصناديق",
    font: {
      ...FONT.headerOnPrimary,
      size: 12,
    },
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignC,
  });

  const totIqd = totTitle + 1;
  const totUsd = totTitle + 2;
  const totEur = totTitle + 3;

  const paintTotalRow = (row, label, formula) => {
    styleCell(ws.getCell(`C${row}`), {
      value: label,
      font: FONT.label,
      fill: solid(theme.headerBg),
      border: BORDER_ALL,
      align: alignR,
    });
    ws.mergeCells(`D${row}:F${row}`);
    styleCell(ws.getCell(`D${row}`), {
      value: { formula },
      font: FONT.small,
      fill: solid(theme.white),
      border: BORDER_ALL,
      align: alignC,
      numFmt: AMOUNT_NUM_FMT,
    });
    applyRange(ws, `D${row}:F${row}`, {
      fill: solid(theme.white),
      border: BORDER_ALL,
    });
    ws.getCell(`D${row}`).value = { formula };
    ws.getCell(`D${row}`).numFmt = AMOUNT_NUM_FMT;
  };

  paintTotalRow(totIqd, "الدينار", `SUM(D${fundStart}:D${fundEnd})`);
  paintTotalRow(totUsd, "الدولار", `SUM(E${fundStart}:E${fundEnd})`);
  paintTotalRow(totEur, "اليورو", `SUM(F${fundStart}:F${fundEnd})`);

  // ——— جدول حركات فارغ: ت | دينار (قبض/صرف) | دولار (قبض/صرف) | التفاصيل ———
  const moveHeader1 = totEur + 2;
  const moveHeader2 = moveHeader1 + 1;
  const moveDataStart = moveHeader2 + 1;
  const moveRows = 6;
  const moveDataEnd = moveDataStart + moveRows - 1;
  const moveTotal = moveDataEnd + 1;

  ws.getRow(moveHeader1).height = 20;
  ws.getRow(moveHeader2).height = 18;

  ws.mergeCells(`B${moveHeader1}:B${moveHeader2}`);
  applyRange(ws, `B${moveHeader1}:B${moveHeader2}`, {
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
  });
  styleCell(ws.getCell(`B${moveHeader1}`), {
    value: "ت",
    font: FONT.header,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
    align: alignC,
  });

  ws.mergeCells(`C${moveHeader1}:D${moveHeader1}`);
  applyRange(ws, `C${moveHeader1}:D${moveHeader1}`, {
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
  });
  styleCell(ws.getCell(`C${moveHeader1}`), {
    value: "صندوق الدينار",
    font: FONT.header,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
    align: alignC,
  });

  ws.mergeCells(`E${moveHeader1}:F${moveHeader1}`);
  applyRange(ws, `E${moveHeader1}:F${moveHeader1}`, {
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
  });
  styleCell(ws.getCell(`E${moveHeader1}`), {
    value: "صندوق الدولار",
    font: FONT.header,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
    align: alignC,
  });

  ws.mergeCells(`G${moveHeader1}:N${moveHeader2}`);
  applyRange(ws, `G${moveHeader1}:N${moveHeader2}`, {
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
  });
  styleCell(ws.getCell(`G${moveHeader1}`), {
    value: "التفاصيل",
    font: FONT.header,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
    align: alignC,
  });

  for (const [col, label, kind] of [
    ["C", "القبض", "receipt"],
    ["D", "الصرف", "payment"],
    ["E", "القبض", "receipt"],
    ["F", "الصرف", "payment"],
  ]) {
    styleCell(ws.getCell(`${col}${moveHeader2}`), {
      value: label,
      font: kind === "receipt" ? FONT.receipt : FONT.payment,
      fill: solid(theme.headerBg),
      border: BORDER_ALL,
      align: alignC,
    });
  }

  for (let i = 0; i < moveRows; i++) {
    const r = moveDataStart + i;
    ws.getRow(r).height = 22;
    styleCell(ws.getCell(`B${r}`), {
      value: i + 1,
      font: FONT.small,
      fill: solid(theme.white),
      border: BORDER_ALL,
      align: alignC,
    });
    for (const col of ["C", "D", "E", "F"]) {
      styleCell(ws.getCell(`${col}${r}`), {
        value: null,
        fill: solid(theme.white),
        border: BORDER_ALL,
        align: alignC,
        numFmt: AMOUNT_NUM_FMT,
      });
    }
    ws.mergeCells(`G${r}:N${r}`);
    applyRange(ws, `G${r}:N${r}`, {
      fill: solid(theme.white),
      border: BORDER_ALL,
    });
  }

  ws.getRow(moveTotal).height = 20;
  styleCell(ws.getCell(`B${moveTotal}`), {
    value: null,
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
  });
  for (const col of ["C", "D", "E", "F"]) {
    styleCell(ws.getCell(`${col}${moveTotal}`), {
      value: {
        formula: `SUM(${col}${moveDataStart}:${col}${moveDataEnd})`,
      },
      font: FONT.small,
      fill: solid(theme.headerBgDeep),
      border: BORDER_ALL,
      align: alignC,
      numFmt: AMOUNT_NUM_FMT,
    });
  }
  ws.mergeCells(`G${moveTotal}:N${moveTotal}`);
  applyRange(ws, `G${moveTotal}:N${moveTotal}`, {
    fill: solid(theme.headerBgDeep),
    border: BORDER_ALL,
  });

  const closeTitle = moveTotal + 3;
  ws.mergeCells(`C${closeTitle}:F${closeTitle}`);
  applyRange(ws, `C${closeTitle}:F${closeTitle}`, {
    fill: solid(theme.primary),
    border: BORDER_ALL,
  });
  styleCell(ws.getCell(`C${closeTitle}`), {
    value: "اجمالي الرصيد مع حركات القبض والصرف بعد غلق الصندوق",
    font: FONT.headerOnPrimary,
    fill: solid(theme.primary),
    border: BORDER_ALL,
    align: alignC,
  });

  paintTotalRow(
    closeTitle + 1,
    "الدينار",
    `D${totIqd}+C${moveTotal}-D${moveTotal}`
  );
  paintTotalRow(
    closeTitle + 2,
    "الدولار",
    `D${totUsd}+E${moveTotal}-F${moveTotal}`
  );
  paintTotalRow(closeTitle + 3, "اليورو", `D${totEur}`);

  ws.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    paperSize: 9,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
  };

  return ws;
}

/**
 * @param {Array} vouchers
 * @param {{ dateFrom?: string, dateTo?: string, companyFilter?: string, emptyForm?: boolean, exportedByUsername?: string, withLogo?: boolean, withPrintSetup?: boolean }} [options]
 * @returns {Promise<ExcelJS.Workbook>}
 */
export async function buildDailyCashReportWorkbook(vouchers, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GDR Funds";
  workbook.created = new Date();

  const withLogo = options.withLogo !== false;
  const exportedByUsername = String(options.exportedByUsername || "").trim();
  const meta = reportMeta(options.dateFrom, options.dateTo);
  const balanceEntries = [];

  if (options.emptyForm) {
    const companyFilter = String(options.companyFilter || "all").trim();
    const keys = Object.keys(COMPANY_SHEET_MAP).filter((key) => {
      if (key === "010") return false;
      if (!companyFilter || companyFilter.toLowerCase() === "all") return true;
      return resolveCompanyKey(companyFilter).toLowerCase() === key.toLowerCase();
    });

    for (const key of keys) {
      const ws = createSheet(workbook, key, { withLogo });
      const filled = fillSheet(ws, [], meta, key, exportedByUsername);
      if (filled) balanceEntries.push(filled);
    }
    createBalancesOverviewSheet(workbook, balanceEntries);
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

  if (!orderedKeys.length) {
    const ws = createSheet(workbook, "Al-Ghadeer", { withLogo });
    const filled = fillSheet(ws, [], meta, "Al-Ghadeer", exportedByUsername);
    if (filled) balanceEntries.push(filled);
    createBalancesOverviewSheet(workbook, balanceEntries);
    return workbook;
  }

  for (const key of orderedKeys) {
    const companyVouchers = byCompany.get(key) || [];
    if (!companyVouchers.length) continue;
    const ws = createSheet(workbook, key, { withLogo });
    const filled = fillSheet(
      ws,
      companyVouchers,
      meta,
      key,
      exportedByUsername
    );
    if (filled) balanceEntries.push(filled);
  }

  createBalancesOverviewSheet(workbook, balanceEntries);
  return workbook;
}

/**
 * Production export: brand-new workbook → design → data → raw writeBuffer.
 * No template load. No ZIP/XML post-processing.
 */
export async function buildDailyCashReportBuffer(vouchers, options = {}) {
  const workbook = await buildDailyCashReportWorkbook(vouchers, options);
  return workbook.xlsx.writeBuffer();
}

const api = {
  buildDailyCashReportWorkbook,
  buildDailyCashReportBuffer,
  FALLBACK_MERGES,
  ALGHADEER_EUR_MERGES,
  LAYOUT,
  COMPANY_SHEET_MAP,
  getCompanyFormConfigFresh,
  DETAILS_COL_WIDTH,
  paintFormSheet,
  getFormConfig,
  getColumnLayout,
  getReportLayout,
  getCompanyExcelTheme,
};

export default api;
