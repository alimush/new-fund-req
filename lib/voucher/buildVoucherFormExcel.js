/**
 * Receipt / Payment voucher Excel forms — built from brand-new ExcelJS Workbook.
 * Visual design from supplied سند قبض (green) and سند صرف (brown) images.
 * No XLSX template load, no JSZip/XML post-processing.
 */

import * as ExcelJSModule from "exceljs";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ExcelJS = ExcelJSModule?.default ?? ExcelJSModule;

const SAFE_PRINT_DPI = 600;
const AMOUNT_NUM_FMT = "#,##0.##";

/** Receipt = dark green; Payment = brown (from design images) */
const THEME = {
  receipt: {
    primary: "FF1B4332",
    primarySoft: "FFE8F0EC",
    border: "FF1B4332",
    textOnPrimary: "FFFFFFFF",
    label: "FF1B4332",
    muted: "FF333333",
    title: "سند قبض",
  },
  payment: {
    primary: "FF8B4513",
    primarySoft: "FFF5EBE3",
    border: "FF8B4513",
    textOnPrimary: "FFFFFFFF",
    label: "FF8B4513",
    muted: "FF333333",
    title: "سند صرف",
  },
};

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
};

const COMPANY_LOGO_FILE = {
  "Al-Ghadeer": "image3.png",
  "Badur-Baghdad": "image4.png",
  "Badur-Baghdad-Safebox-Istishar": "image4.png",
  "Tiba-Al-najaf": "image5.png",
  "Ghadeer-Karbala": "image1.png",
  "Badur-Al-Najaf": "image2.png",
  "Ghadeer-Investments": "image3.png",
  "Ghadeer-Karbala-Sub": "image1.png",
  "Ghadeer-Najaf-Sub": "image3.png",
  "010": "image3.png",
};

function resolveCompanyKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return "Al-Ghadeer";
  const found = Object.keys(COMPANY_NAMES).find(
    (k) => k.toLowerCase() === s.toLowerCase()
  );
  return found || s;
}

function companyName(key) {
  const k = resolveCompanyKey(key);
  return COMPANY_NAMES[k] || String(key || "الشركة");
}

function solid(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function thin(argb) {
  return { style: "thin", color: { argb } };
}

function boxBorder(color) {
  return {
    top: thin(color),
    left: thin(color),
    bottom: thin(color),
    right: thin(color),
  };
}

function resolveAssetsDir() {
  const candidates = [];
  try {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), "assets"));
  } catch {
    /* ignore */
  }
  candidates.push(join(process.cwd(), "lib/voucher/assets"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function loadLogoBuffer(companyKey) {
  const key = resolveCompanyKey(companyKey);
  const file = COMPANY_LOGO_FILE[key] || "image3.png";
  const path = join(resolveAssetsDir(), file);
  if (!existsSync(path)) return null;
  return { buffer: readFileSync(path), extension: "png", file };
}

function mark(checked) {
  return checked ? "☑" : "☐";
}

function pad2(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "").slice(0, 2);
  return s ? s.padStart(2, "0") : "";
}

function formatVoucherDateParts(voucher) {
  const yy =
    pad2(voucher?.dateParts?.yy) ||
    pad2(voucher?.vDateYY) ||
    (voucher?.voucherDate
      ? String(new Date(voucher.voucherDate).getFullYear()).slice(-2)
      : "");
  const mm =
    pad2(voucher?.dateParts?.mm) ||
    pad2(voucher?.vDateMM) ||
    (voucher?.voucherDate
      ? String(new Date(voucher.voucherDate).getMonth() + 1).padStart(2, "0")
      : "");
  const dd =
    pad2(voucher?.dateParts?.dd) ||
    pad2(voucher?.vDateDD) ||
    (voucher?.voucherDate
      ? String(new Date(voucher.voucherDate).getDate()).padStart(2, "0")
      : "");
  if (!yy && !mm && !dd) return "";
  return `${yy || "  "} / ${mm || "  "} / ${dd || "  "}`;
}

function voucherNumberLabel(voucher) {
  if (voucher?.voucherNo) return String(voucher.voucherNo);
  if (voucher?.seq != null) return String(voucher.seq).padStart(5, "0");
  return "";
}

function parseAmount(v) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function isUsd(currency) {
  const s = String(currency || "").trim().toUpperCase();
  return s === "USD" || s.includes("USD") || s.includes("DOLLAR") || s.includes("دولار");
}

function personName(voucher, mode) {
  if (mode === "payment") {
    return (
      String(voucher?.beneficiary || voucher?.vBeneficiary || "").trim() ||
      String(voucher?.receivedBy || voucher?.vReceivedBy || "").trim()
    );
  }
  return (
    String(voucher?.receivedBy || voucher?.vReceivedBy || "").trim() ||
    String(voucher?.beneficiary || voucher?.vBeneficiary || "").trim()
  );
}

function applyPageSetup(ws) {
  ws.pageSetup = {
    orientation: "portrait",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalDpi: SAFE_PRINT_DPI,
    verticalDpi: SAFE_PRINT_DPI,
    horizontalCentered: true,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
  };
  ws.pageSetup.printArea = "A1:L35";
}

function styleCell(cell, opts = {}) {
  if (opts.value !== undefined) cell.value = opts.value;
  if (opts.font) cell.font = { ...opts.font };
  if (opts.fill) cell.fill = { ...opts.fill };
  if (opts.border) cell.border = JSON.parse(JSON.stringify(opts.border));
  if (opts.align) cell.alignment = { ...opts.align };
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

function fillRange(ws, range, style) {
  const [a, b] = String(range).split(":");
  const start = ws.getCell(a);
  const end = ws.getCell(b || a);
  for (let r = start.row; r <= end.row; r++) {
    for (let c = start.col; c <= end.col; c++) {
      styleCell(ws.getCell(r, c), style);
    }
  }
}

function paintCurrencyRow(ws, voucher, theme) {
  // Clear previous merge attempt by painting fresh — called after structure setup
  const usd = isUsd(voucher?.currency || voucher?.vCurrency);
  const amount = parseAmount(voucher?.amount ?? voucher?.vAmount);
  const fx = String(voucher?.fxRate || voucher?.vFxRate || "").trim();
  const border = theme.border;
  const alignC = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
    readingOrder: "rtl",
  };

  // Undo if already merged from partial — ExcelJS throws if rematch; paintForm creates fresh sheet
  styleCell(ws.getCell("B8"), {
    value: `دينار ${mark(!usd)}`,
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid(theme.primarySoft),
    border: boxBorder(border),
    align: alignC,
  });
  styleCell(ws.getCell("C8"), {
    value: `دولار ${mark(usd)}`,
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid(theme.primarySoft),
    border: boxBorder(border),
    align: alignC,
  });
  ws.mergeCells("D8:E8");
  styleCell(ws.getCell("D8"), {
    value: "سعر الصرف",
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid(theme.primarySoft),
    border: boxBorder(border),
    align: alignC,
  });
  ws.mergeCells("F8:G8");
  styleCell(ws.getCell("F8"), {
    value: fx || null,
    font: { name: "Calibri", size: 12, bold: true, color: { argb: theme.muted } },
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    align: alignC,
  });
  styleCell(ws.getCell("H8"), {
    value: "مبلغ وقدره",
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid(theme.primarySoft),
    border: boxBorder(border),
    align: alignC,
  });
  ws.mergeCells("I8:K8");
  styleCell(ws.getCell("I8"), {
    value: amount || null,
    numFmt: AMOUNT_NUM_FMT,
    font: { name: "Calibri", size: 14, bold: true, color: { argb: theme.muted } },
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    align: alignC,
  });
}

function paintPersonBlock(ws, voucher, theme, mode) {
  const border = theme.border;
  const alignR = {
    horizontal: "right",
    vertical: "middle",
    wrapText: true,
    readingOrder: "rtl",
  };
  const alignC = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
    readingOrder: "rtl",
  };

  const nameLabel =
    mode === "payment" ? "اسم السيد/ة:" : "استلمت من السيد/ة:";
  const rows = [
    [10, nameLabel, personName(voucher, mode)],
    [
      11,
      "رقم البطاقة الوطنية:",
      String(voucher?.nationalId || voucher?.vNationalId || "").trim(),
    ],
    [12, "رقم الهاتف:", String(voucher?.phone || voucher?.vPhone || "").trim()],
    [
      13,
      "مبلغاً وقدره فقط:",
      String(voucher?.amountWords || voucher?.vWords || "").trim(),
    ],
  ];

  for (const [r, label, value] of rows) {
    ws.mergeCells(`B${r}:D${r}`);
    ws.mergeCells(`E${r}:K${r}`);
    styleCell(ws.getCell(`B${r}`), {
      value: label,
      font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
      fill: solid(theme.primarySoft),
      border: boxBorder(border),
      align: alignR,
    });
    styleCell(ws.getCell(`E${r}`), {
      value: value || null,
      font: { name: "Calibri", size: 12, bold: true, color: { argb: theme.muted } },
      fill: solid("FFFFFFFF"),
      border: boxBorder(border),
      align: alignR,
    });
  }
}

function paintPurposeAndNotes(ws, voucher, theme) {
  const border = theme.border;
  const alignC = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
    readingOrder: "rtl",
  };
  const alignR = {
    horizontal: "right",
    vertical: "top",
    wrapText: true,
    readingOrder: "rtl",
  };

  ws.mergeCells("B15:K15");
  styleCell(ws.getCell("B15"), {
    value: "وذلك عن",
    font: {
      name: "Calibri",
      size: 13,
      bold: true,
      color: { argb: theme.textOnPrimary },
    },
    fill: solid(theme.primary),
    border: boxBorder(border),
    align: alignC,
  });

  ws.mergeCells("B16:K18");
  fillRange(ws, "B16:K18", {
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    font: { name: "Calibri", size: 12, color: { argb: theme.muted } },
    align: alignR,
  });
  ws.getCell("B16").value = String(
    voucher?.description || voucher?.vDesc || ""
  ).trim() || null;

  // Payment method row
  const cash = Boolean(voucher?.cbOne);
  const cheque = Boolean(voucher?.cbTwo);
  const chequeNo = String(voucher?.chequeNo || voucher?.vChequeNo || "").trim();
  const bank = String(voucher?.bank || voucher?.vBank || "").trim();

  ws.mergeCells("B20:C20");
  styleCell(ws.getCell("B20"), {
    value: `بموجب   نقداً ${mark(cash)}`,
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid(theme.primarySoft),
    border: boxBorder(border),
    align: alignC,
  });
  ws.mergeCells("D20:F20");
  styleCell(ws.getCell("D20"), {
    value: `شيك رقم  ${chequeNo}${cheque ? "  ☑" : "  ☐"}`,
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    align: alignC,
  });
  ws.mergeCells("G20:K20");
  styleCell(ws.getCell("G20"), {
    value: `على البنك  ${bank}`,
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    align: alignC,
  });

  ws.mergeCells("B22:K22");
  styleCell(ws.getCell("B22"), {
    value: "ملاحظات",
    font: {
      name: "Calibri",
      size: 13,
      bold: true,
      color: { argb: theme.textOnPrimary },
    },
    fill: solid(theme.primary),
    border: boxBorder(border),
    align: alignC,
  });
  ws.mergeCells("B23:K24");
  fillRange(ws, "B23:K24", {
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    font: { name: "Calibri", size: 12, color: { argb: theme.muted } },
    align: alignR,
  });
  ws.getCell("B23").value =
    String(voucher?.notes || voucher?.vNotes || "").trim() || null;
}

function paintSignaturesAndFooter(ws, voucher, theme) {
  const border = theme.border;
  const alignC = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
    readingOrder: "rtl",
  };
  const company = companyName(voucher?.companyKey);
  const employee =
    String(voucher?.createdByName || "").trim() ||
    String(voucher?.createdBy || "").trim();

  ws.mergeCells("B26:F26");
  ws.mergeCells("G26:K26");
  styleCell(ws.getCell("B26"), {
    value: `أسم وتوقيع الموظف (عن ${company})`,
    font: {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: theme.textOnPrimary },
    },
    fill: solid(theme.primary),
    border: boxBorder(border),
    align: alignC,
  });
  styleCell(ws.getCell("G26"), {
    value: "أسم وتوقيع العميل",
    font: {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: theme.textOnPrimary },
    },
    fill: solid(theme.primary),
    border: boxBorder(border),
    align: alignC,
  });

  ws.mergeCells("B27:F31");
  ws.mergeCells("G27:K31");
  fillRange(ws, "B27:F31", {
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    font: { name: "Calibri", size: 12, bold: true, color: { argb: theme.muted } },
    align: alignC,
  });
  fillRange(ws, "G27:K31", {
    fill: solid("FFFFFFFF"),
    border: boxBorder(border),
    align: alignC,
  });
  ws.getCell("B27").value = employee || null;

  // Footer branding from design images (static chrome, not DB fields)
  ws.mergeCells("B33:F33");
  styleCell(ws.getCell("B33"), {
    value: "6035",
    font: { name: "Calibri", size: 22, bold: true, color: { argb: theme.label } },
    align: alignC,
  });
  ws.mergeCells("B34:F34");
  styleCell(ws.getCell("B34"), {
    value: "alghadeerrealestate.com",
    font: { name: "Calibri", size: 11, bold: true, color: { argb: theme.label } },
    align: alignC,
  });
  // QR: no project asset — leave framed placeholder
  ws.mergeCells("H33:K35");
  fillRange(ws, "H33:K35", {
    border: boxBorder(border),
    fill: solid("FFFFFFFF"),
    font: { name: "Calibri", size: 9, color: { argb: "FF999999" } },
    align: alignC,
  });
  ws.getCell("H33").value = "QR";
}

function paintVoucherSheet(workbook, ws, voucher, mode) {
  const theme = mode === "payment" ? THEME.payment : THEME.receipt;
  const border = theme.border;
  const alignC = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
    readingOrder: "rtl",
  };

  ws.views = [{ rightToLeft: true, showGridLines: false, state: "normal" }];
  ws.properties.defaultRowHeight = 18;

  const widths = {
    A: 2.5,
    B: 11,
    C: 11,
    D: 10,
    E: 10,
    F: 10,
    G: 10,
    H: 10,
    I: 10,
    J: 10,
    K: 11,
    L: 2.5,
  };
  for (const [col, w] of Object.entries(widths)) ws.getColumn(col).width = w;

  const heights = {
    1: 8,
    2: 20,
    3: 20,
    4: 20,
    5: 8,
    6: 30,
    7: 8,
    8: 28,
    9: 8,
    10: 24,
    11: 24,
    12: 24,
    13: 24,
    14: 8,
    15: 24,
    16: 26,
    17: 26,
    18: 26,
    19: 8,
    20: 26,
    21: 8,
    22: 24,
    23: 24,
    24: 24,
    25: 8,
    26: 24,
    27: 22,
    28: 22,
    29: 22,
    30: 22,
    31: 22,
    32: 8,
    33: 26,
    34: 16,
    35: 16,
  };
  for (const [r, h] of Object.entries(heights)) ws.getRow(Number(r)).height = h;

  const logo = loadLogoBuffer(voucher?.companyKey);
  if (logo) {
    const imageId = workbook.addImage({
      buffer: logo.buffer,
      extension: "png",
    });
    ws.addImage(imageId, {
      tl: { col: 4.5, row: 0.5 },
      ext: { width: 150, height: 72 },
      editAs: "oneCell",
    });
  }

  // Title bar
  ws.mergeCells("B6:D6");
  ws.mergeCells("E6:H6");
  ws.mergeCells("I6:K6");
  fillRange(ws, "B6:K6", {
    fill: solid(theme.primary),
    border: boxBorder(border),
    font: {
      name: "Calibri",
      size: 13,
      bold: true,
      color: { argb: theme.textOnPrimary },
    },
    align: alignC,
  });
  ws.getCell("B6").value = theme.title;
  ws.getCell("E6").value = `رقم السند    ${voucherNumberLabel(voucher)}`;
  ws.getCell("I6").value = `التاريخ    ${formatVoucherDateParts(voucher)}`;

  paintCurrencyRow(ws, voucher, theme);
  paintPersonBlock(ws, voucher, theme, mode);
  paintPurposeAndNotes(ws, voucher, theme);
  paintSignaturesAndFooter(ws, voucher, theme);
  applyPageSetup(ws);
}

export function paintReceiptVoucherSheet(workbook, ws, voucher) {
  paintVoucherSheet(workbook, ws, voucher, "receipt");
}

export function paintPaymentVoucherSheet(workbook, ws, voucher) {
  paintVoucherSheet(workbook, ws, voucher, "payment");
}

/**
 * @param {object} voucher - voucher document / view payload
 * @returns {Promise<Buffer|ArrayBuffer>}
 */
export async function buildVoucherFormBuffer(voucher) {
  const mode =
    String(voucher?.mode || "").toLowerCase() === "receipt"
      ? "receipt"
      : "payment";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GDR Funds";
  workbook.created = new Date();

  const sheetName = mode === "receipt" ? "سند قبض" : "سند صرف";
  const ws = workbook.addWorksheet(sheetName);

  if (mode === "receipt") paintReceiptVoucherSheet(workbook, ws, voucher);
  else paintPaymentVoucherSheet(workbook, ws, voucher);

  return workbook.xlsx.writeBuffer();
}

const api = {
  buildVoucherFormBuffer,
  paintReceiptVoucherSheet,
  paintPaymentVoucherSheet,
};

export default api;
