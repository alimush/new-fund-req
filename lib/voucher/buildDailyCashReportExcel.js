/**
 * Voucher daily cash report — built from a brand-new ExcelJS Workbook.
 * No XLSX template load, no JSZip/XML post-processing.
 * Design recreated via ExcelJS cell/sheet APIs (ARGB colors only).
 */

import * as ExcelJSModule from "exceljs";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { formatVoucherDateDisplay } from "./voucherDate.js";

const ExcelJS = ExcelJSModule?.default ?? ExcelJSModule;

const SAFE_PRINT_DPI = 600;

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
  maker: "C5",
  fundName: "C6",
  title: "D2",
  prevIqd: "C7",
  prevUsd: "C8",
  dataStart: 12,
  dataEnd: 22,
  totalRow: 23,
  balRow: 24,
  cashBox: {
    headerRow: 26,
    iqdRow: 27,
    usdRow: 28,
    noteRow: 29,
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

/** شركة → اسم ورقة التقرير */
const COMPANY_SHEET_MAP = {
  "Al-Ghadeer": "شركة الغدير",
  "Badur-Baghdad": "شركة بدور بغداد",
  "Badur-Baghdad-Safebox-Istishar": "بدور بغداد - أمانات المستشار",
  "Badur-Baghdad-Elite": "بدور بغداد - Elite",
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
 * Loaded as JSON config — never loads the XLSX into the workbook.
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
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf8"));
    }
  }
  return {};
}

const COMPANY_FORM_CONFIG = loadCompanyFormConfig();

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

const COL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function getFormConfig(companyKey) {
  const key = resolveCompanyKey(companyKey);
  return (
    COMPANY_FORM_CONFIG[key] ||
    COMPANY_FORM_CONFIG["Al-Ghadeer"] || {
      sheetName: COMPANY_SHEET_MAP[key] || "شركة الغدير",
      widths: {
        1: 4,
        2: 18,
        3: 12,
        4: 12,
        5: 10,
        6: 10,
        7: 14,
        8: 11,
        9: 8.85156,
        10: 6,
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
    }
  );
}

const C = {
  primary: "FF00487C",
  headerBg: "FFE5F0F8",
  headerBgDeep: "FFC6DFF1",
  white: "FFFFFFFF",
  soft: "FFEDF4FA",
  text: "FF000000",
  muted: "FF222222",
  receipt: "FF2E7D5B",
  payment: "FFC44B4B",
  boxBg: "FFEEF7F6",
  noteBg: "FFF0F6F8",
  border: "FF72B0DC",
};

const thin = (color = C.border) => ({
  style: "thin",
  color: { argb: color },
});

const BORDER_ALL = {
  top: thin(),
  left: thin(),
  bottom: thin(),
  right: thin(),
};

const BORDER_PRIMARY = {
  top: thin(C.primary),
  left: thin(C.primary),
  bottom: thin(C.primary),
  right: thin(C.primary),
};

const FONT = {
  label: { name: "Calibri", size: 9, bold: true, color: { argb: C.primary } },
  value: { name: "Calibri", size: 11, color: { argb: C.text } },
  title: { name: "Calibri", size: 14, bold: true, color: { argb: C.primary } },
  header: { name: "Calibri", size: 8, bold: true, color: { argb: C.primary } },
  headerWhite: {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: C.white },
  },
  small: { name: "Calibri", size: 9, bold: true, color: { argb: C.text } },
  receipt: { name: "Calibri", size: 9, bold: true, color: { argb: C.receipt } },
  payment: { name: "Calibri", size: 9, bold: true, color: { argb: C.payment } },
  note: { name: "Calibri", size: 8, color: { argb: C.muted } },
};

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
      styleCell(ws.getCell(r, c), style);
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
  candidates.push(join(process.cwd(), "lib/voucher/assets"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function loadLogoBuffer(logoFile) {
  const file = logoFile || "image3.png";
  const path = join(resolveAssetsDir(), file);
  if (!existsSync(path)) return null;
  return { buffer: readFileSync(path), extension: "png", file };
}

function applyPageSetup(ws, formConfig) {
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
  ws.pageSetup.printArea = "A1:K50";
}

/**
 * Build empty form chrome (labels, merges, styles, logo) on a worksheet.
 */
function paintFormSheet(workbook, ws, companyKey, { withLogo = true } = {}) {
  const formConfig = getFormConfig(companyKey);

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

  const widths = formConfig.widths || {};
  for (let i = 1; i <= 12; i++) {
    const w = widths[String(i)] ?? widths[i];
    if (w != null) ws.getColumn(i).width = Number(w);
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

  // Meta labels (B) + values (C)
  const metaLabels = [
    ["B2", "اليوم"],
    ["B3", "التاريخ"],
    ["B4", "أمين الصندوق"],
    ["B5", "سلم التقرير"],
    ["B6", "اسم صندوق اليوم"],
    ["B7", "الرصيد السابق - دينار"],
    ["B8", "الرصيد السابق - دولار"],
  ];
  for (const [addr, text] of metaLabels) {
    styleCell(ws.getCell(addr), {
      value: text,
      font: FONT.label,
      fill: solid(C.soft),
      border: BORDER_ALL,
      align: alignRight,
    });
  }
  for (const addr of ["C2", "C3", "C4", "C5", "C6", "C7", "C8"]) {
    styleCell(ws.getCell(addr), {
      font: FONT.value,
      fill: solid(C.white),
      border: BORDER_ALL,
      align: alignCenter,
    });
  }

  // Title block
  applyRange(ws, "D2:I5", {
    fill: solid(C.headerBg),
    border: BORDER_PRIMARY,
    font: FONT.title,
    align: alignCenter,
  });
  ws.getCell("D2").value = `التقرير اليومي لصندوق ${name}`;

  applyRange(ws, "D6:I8", {
    fill: solid(C.soft),
    border: BORDER_ALL,
  });
  applyRange(ws, "J2:K8", {
    fill: solid(C.white),
    border: BORDER_ALL,
  });

  // Table header
  styleCell(ws.getCell("A10"), {
    value: "ت",
    font: FONT.header,
    fill: solid(C.headerBgDeep),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("B10"), {
    value: "التفاصيل",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("C10"), {
    value: "صندوق - الدينار",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("E10"), {
    value: "صندوق - الدولار",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("G10"), {
    value: "اسم الحساب المصرفي",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("H10"), {
    value: "رقم الصك",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("I10"), {
    value: "المستندات",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });

  styleCell(ws.getCell("C11"), {
    value: "مقبوضات",
    font: FONT.receipt,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("D11"), {
    value: "مصروفات",
    font: FONT.payment,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("E11"), {
    value: "مقبوضات",
    font: FONT.receipt,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("F11"), {
    value: "مصروفات",
    font: FONT.payment,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("I11"), {
    value: "نوع المستند",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("J11"), {
    value: "سعر الصرف",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("K11"), {
    value: "رقم الوصل",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });

  // Data rows chrome
  for (let r = 12; r <= 22; r++) {
    for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]) {
      styleCell(ws.getCell(`${col}${r}`), {
        border: BORDER_ALL,
        fill: solid(C.white),
        font: FONT.value,
        align: alignCenter,
      });
    }
    ws.getCell(`A${r}`).value = r - 11;
  }

  // Totals / balance
  styleCell(ws.getCell("A23"), {
    value: "المجموع",
    font: FONT.headerWhite,
    fill: solid(C.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("A24"), {
    value: "الرصيد",
    font: FONT.headerWhite,
    fill: solid(C.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  for (const col of ["C", "D", "E", "F"]) {
    styleCell(ws.getCell(`${col}23`), {
      border: BORDER_ALL,
      fill: solid(C.headerBgDeep),
      font: FONT.small,
      align: alignCenter,
    });
    styleCell(ws.getCell(`${col}24`), {
      border: BORDER_ALL,
      fill: solid(C.soft),
      font: FONT.small,
      align: alignCenter,
    });
  }

  // Cash box
  styleCell(ws.getCell("A26"), {
    value: "      الرصيد الحالي",
    font: FONT.small,
    fill: solid(C.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("G26"), {
    value: "      مجموع الاستيرادات",
    font: FONT.receipt,
    fill: solid(C.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("I26"), {
    value: "      مجموع المصروفات والسحوبات",
    font: FONT.payment,
    fill: solid(C.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  for (const r of [27, 28]) {
    applyRange(ws, `D${r}:F${r}`, {
      border: BORDER_ALL,
      fill: solid(C.white),
      align: alignCenter,
    });
    applyRange(ws, `G${r}:H${r}`, {
      border: BORDER_ALL,
      fill: solid(C.white),
      align: alignCenter,
    });
    applyRange(ws, `I${r}:K${r}`, {
      border: BORDER_ALL,
      fill: solid(C.white),
      align: alignCenter,
    });
  }
  styleCell(ws.getCell("C27"), {
    value: "دينار",
    font: FONT.small,
    fill: solid(C.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("C28"), {
    value: "دولار",
    font: FONT.small,
    fill: solid(C.boxBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  applyRange(ws, "D29:K29", {
    value: "الرصيد الحالي = مجموع الاستيرادات − مجموع المصروفات والسحوبات",
    font: FONT.note,
    fill: solid(C.noteBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  ws.getCell("D29").value =
    "الرصيد الحالي = مجموع الاستيرادات − مجموع المصروفات والسحوبات";

  // Summary block
  styleCell(ws.getCell("A31"), {
    value: "      ملخص الوصولات",
    font: FONT.headerWhite,
    fill: solid(C.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("G31"), {
    value: "      ملاحظات أمين الصندوق",
    font: FONT.headerWhite,
    fill: solid(C.primary),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("A32"), {
    value: "ت",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("B32"), {
    value: "تفاصيل",
    font: FONT.header,
    fill: solid(C.headerBg),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("C32"), {
    value: "العدد",
    font: FONT.header,
    fill: solid(C.headerBg),
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
      fill: solid(C.soft),
    });
    styleCell(ws.getCell(`C${row}`), {
      border: BORDER_ALL,
      align: alignCenter,
      font: FONT.value,
    });
    applyRange(ws, `G${row}:K${row}`, {
      border: BORDER_ALL,
      fill: solid(C.white),
    });
  });
  styleCell(ws.getCell("A39"), {
    value: "إجمالي الوصولات",
    font: FONT.header,
    fill: solid(C.headerBgDeep),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("C39"), {
    border: BORDER_ALL,
    fill: solid(C.headerBgDeep),
    font: FONT.small,
    align: alignCenter,
  });

  // Signatures
  styleCell(ws.getCell("A41"), {
    value: "أمين الصندوق",
    font: FONT.label,
    fill: solid(C.soft),
    border: BORDER_ALL,
    align: alignCenter,
  });
  styleCell(ws.getCell("H41"), {
    value: "المدير المالي",
    font: FONT.label,
    fill: solid(C.soft),
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

  applyPageSetup(ws, formConfig);

  if (withLogo && formConfig.logo) {
    const logo = loadLogoBuffer(formConfig.logo.file);
    if (logo) {
      const imageId = workbook.addImage({
        buffer: logo.buffer,
        extension: "png",
      });
      // Exact two-cell anchor from reference فورمة_صندوق_فارغة_excel.xlsx
      ws.addImage(imageId, {
        tl: { ...formConfig.logo.tl },
        br: { ...formConfig.logo.br },
        editAs: "oneCell",
      });
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

function setAmount(ws, addr, value, kind) {
  setValue(ws, addr, value);
  if (value == null || value === "") return;
  applyAmountFontColor(
    ws,
    addr,
    kind === "payment" ? C.payment : C.receipt
  );
}

function clearDataRow(ws, row) {
  for (const col of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]) {
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

  if (cheque) {
    const receiptCol = usd ? "E" : "C";
    const paymentCol = usd ? "F" : "D";
    setAmount(ws, `${receiptCol}${row}`, amount || null, "receipt");
    setAmount(ws, `${paymentCol}${row}`, amount || null, "payment");
  } else if (mode === "receipt") {
    setAmount(ws, `${usd ? "E" : "C"}${row}`, amount || null, "receipt");
  } else {
    setAmount(ws, `${usd ? "F" : "D"}${row}`, amount || null, "payment");
  }

  setValue(ws, `G${row}`, voucher.bank || null);
  setValue(ws, `H${row}`, voucher.chequeNo || null);
  setValue(ws, `I${row}`, code);
  setValue(ws, `J${row}`, Number.isFinite(fx) && fx > 0 ? fx : null);
  setValue(ws, `K${row}`, voucherNo);
}

function rewriteFormulas(ws, layout) {
  const { dataStart, dataEnd, totalRow, balRow, cashBox, summary } = layout;

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
  applyAmountFontColor(ws, `C${totalRow}`, C.receipt);
  applyAmountFontColor(ws, `E${totalRow}`, C.receipt);
  applyAmountFontColor(ws, `D${totalRow}`, C.payment);
  applyAmountFontColor(ws, `F${totalRow}`, C.payment);

  setValue(ws, `C${balRow}`, {
    formula: `C7+C${totalRow}-D${totalRow}`,
  });
  setValue(ws, `E${balRow}`, {
    formula: `C8+E${totalRow}-F${totalRow}`,
  });

  if (cashBox) {
    const { iqdRow, usdRow } = cashBox;
    setValue(ws, `C${iqdRow}`, "دينار");
    setValue(ws, `D${iqdRow}`, { formula: `C${balRow}` });
    setValue(ws, `G${iqdRow}`, { formula: `C${totalRow}` });
    setValue(ws, `I${iqdRow}`, { formula: `D${totalRow}` });
    applyAmountFontColor(ws, `G${iqdRow}`, C.receipt);
    applyAmountFontColor(ws, `I${iqdRow}`, C.payment);

    setValue(ws, `C${usdRow}`, "دولار");
    setValue(ws, `D${usdRow}`, { formula: `E${balRow}` });
    setValue(ws, `G${usdRow}`, { formula: `E${totalRow}` });
    setValue(ws, `I${usdRow}`, { formula: `F${totalRow}` });
    applyAmountFontColor(ws, `G${usdRow}`, C.receipt);
    applyAmountFontColor(ws, `I${usdRow}`, C.payment);
  }

  const typeRange = `I${dataStart}:I${dataEnd}`;
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
  top.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.text } };

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
      color: { argb: C.text },
    };
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
  const cashBox = layout.cashBox
    ? {
        headerRow: layout.cashBox.headerRow + extra,
        iqdRow: layout.cashBox.iqdRow + extra,
        usdRow: layout.cashBox.usdRow + extra,
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
  let layout = { ...LAYOUT };
  const rows = sortVouchers(vouchers);

  setValue(ws, layout.day, meta.day || null);
  setValue(ws, layout.date, meta.date || null);
  clearCell(ws, layout.cashier);
  clearCell(ws, layout.maker);
  setValue(ws, layout.fundName, companyName(companyKey));
  setValue(
    ws,
    layout.title,
    `التقرير اليومي لصندوق ${companyName(companyKey)}`
  );

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
  fillCashierUsername(ws, exportedByUsername);
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

  if (options.emptyForm) {
    const companyFilter = String(options.companyFilter || "all").trim();
    const keys = Object.keys(COMPANY_SHEET_MAP).filter((key) => {
      if (key === "010") return false;
      if (!companyFilter || companyFilter.toLowerCase() === "all") return true;
      return resolveCompanyKey(companyFilter).toLowerCase() === key.toLowerCase();
    });

    for (const key of keys) {
      const ws = createSheet(workbook, key, { withLogo });
      fillSheet(ws, [], meta, key, exportedByUsername);
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

  if (!orderedKeys.length) {
    createSheet(workbook, "Al-Ghadeer", { withLogo });
    return workbook;
  }

  for (const key of orderedKeys) {
    const companyVouchers = byCompany.get(key) || [];
    if (!companyVouchers.length) continue;
    const ws = createSheet(workbook, key, { withLogo });
    fillSheet(ws, companyVouchers, meta, key, exportedByUsername);
  }

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
  LAYOUT,
  COMPANY_SHEET_MAP,
  COMPANY_FORM_CONFIG,
  paintFormSheet,
  getFormConfig,
};

export default api;
