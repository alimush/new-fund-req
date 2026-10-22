/**
 * Client-safe helpers for portrait print of the daily cash voucher form.
 * Mirrors Excel report columns / settlement rules without ExcelJS.
 */

import { COMPANIES } from "@/lib/voucher/companies";
import {
  getCompanyExcelTheme,
  GHADEER_EXCEL_THEME,
} from "@/lib/voucher/companyExcelTheme";
import {
  getVoucherDocType,
  isAlGhadeerMain,
  isZeroNetVoucher,
  resolveCashCurrency,
} from "@/lib/voucher/utils";
import { formatVoucherDateDisplay } from "@/lib/voucher/voucherDate";
import { formatCategoryChecksText } from "@/lib/voucher/voucherLayout";

function isBadurSignatureKey(key) {
  return String(key || "").trim().toLowerCase() === "badur-signature";
}

function resolveCompany(key) {
  const n = String(key || "").trim().toLowerCase();
  return COMPANIES.find((c) => String(c.key).trim().toLowerCase() === n) || null;
}

export const PRINT_ROWS_PER_PAGE = 20;
/** الغدير الرئيسي (يورو / landscape): عدد صفوف ثابت يملأ الصفحة؛ الزيادة → صفحة جديدة */
export const PRINT_ROWS_PER_PAGE_EUR = 12;

const PRINT_FONT_BASE = 9;

export function clampPrintFontSize(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return PRINT_FONT_BASE;
  return Math.min(14, Math.max(7, Math.round(v)));
}

/**
 * عدد الصفوف حسب حجم الخط — عند التكبير نقلل الصفوف حتى يبقى الرصيد/الفوتر ظاهراً.
 */
export function printRowsPerPage(fontSize = PRINT_FONT_BASE, withEur = false) {
  const base = withEur ? PRINT_ROWS_PER_PAGE_EUR : PRINT_ROWS_PER_PAGE;
  const fs = clampPrintFontSize(fontSize);
  if (fs <= PRINT_FONT_BASE) return base;
  const scaled = Math.floor((base * PRINT_FONT_BASE) / fs);
  const minRows = withEur ? 8 : 12;
  return Math.max(minRows, scaled);
}

const ARABIC_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function argbToCss(argb) {
  const s = String(argb || "").replace(/^#/, "").toUpperCase();
  const hex = s.length === 8 ? s.slice(2) : s;
  return `#${hex}`;
}

function parseAmount(v) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase();
  if (m === "receipt" || m.includes("قبض")) return "receipt";
  return "payment";
}

function fmtNum(n) {
  if (n == null || n === "" || !Number.isFinite(Number(n))) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function companyName(key) {
  const found = COMPANIES.find(
    (c) => String(c.key).toLowerCase() === String(key || "").toLowerCase()
  );
  return found?.name || key || "شركة";
}

function companyLogoPath(key) {
  const found = COMPANIES.find(
    (c) => String(c.key).toLowerCase() === String(key || "").toLowerCase()
  );
  return found?.logo || "/الغدير.png";
}

/** Absolute URL for a public logo path (encodes Arabic filenames). */
export function absolutePublicAssetUrl(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;

  // افصل query/hash حتى لا يُرمَّز ? داخل اسم الملف → 404
  const hashIdx = raw.indexOf("#");
  const queryIdx = raw.indexOf("?");
  let pathOnly = raw;
  let suffix = "";
  if (queryIdx >= 0 && (hashIdx < 0 || queryIdx < hashIdx)) {
    pathOnly = raw.slice(0, queryIdx);
    suffix = raw.slice(queryIdx);
  } else if (hashIdx >= 0) {
    pathOnly = raw.slice(0, hashIdx);
    suffix = raw.slice(hashIdx);
  }

  const withSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const encoded =
    withSlash
      .split("/")
      .map((seg) => (seg ? encodeURIComponent(seg) : ""))
      .join("/") + suffix;

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${encoded}`;
  }
  return encoded;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

/** Fetch logo and embed as data URL so print windows always show it. */
export async function fetchLogoDataUrl(companyKey) {
  const path = companyLogoPath(companyKey);
  const url = absolutePublicAssetUrl(path);
  if (!url) return "";
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return url;
    const blob = await res.blob();
    if (!blob || !blob.size) return url;
    return await blobToDataUrl(blob);
  } catch {
    return url;
  }
}

/**
 * Attach logoSrc (data URL preferred) onto each print package.
 */
export async function attachPrintLogos(packages) {
  const list = Array.isArray(packages) ? packages : [];
  const cache = new Map();
  for (const pkg of list) {
    const key = pkg.companyKey || "Al-Ghadeer";
    if (!cache.has(key)) cache.set(key, fetchLogoDataUrl(key));
    pkg.logoSrc = await cache.get(key);
  }
  return list;
}

function sortVouchers(list) {
  return [...(list || [])].sort((a, b) => {
    // مقبوضات أولاً، ثم المصروفات
    const ma = normalizeMode(a?.mode) === "payment" ? 1 : 0;
    const mb = normalizeMode(b?.mode) === "payment" ? 1 : 0;
    if (ma !== mb) return ma - mb;
    const da = String(formatVoucherDateDisplay(a) || "");
    const db = String(formatVoucherDateDisplay(b) || "");
    if (da !== db) return da.localeCompare(db);
    return Number(a?.seq || 0) - Number(b?.seq || 0);
  });
}

function dayLabelFromRange(dateFrom, dateTo) {
  const raw = dateFrom || dateTo;
  if (!raw) return ARABIC_DAYS[new Date().getDay()] || "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return ARABIC_DAYS[d.getDay()] || "";
}

function dateLabelFromRange(dateFrom, dateTo) {
  if (dateFrom && dateTo && dateFrom !== dateTo) return `${dateFrom} → ${dateTo}`;
  if (dateFrom || dateTo) return dateFrom || dateTo;
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Map one voucher into print row cells (same rules as Excel writeDataRow). */
export function mapVoucherPrintRow(
  voucher,
  index,
  { withEur = false, withCategory = false } = {}
) {
  const mode = normalizeMode(voucher?.mode);
  const amount = parseAmount(voucher?.amount);
  const bucket = resolveCashCurrency(voucher?.currency);
  const cash =
    bucket === "eur" && !withEur ? "iqd" : bucket; // غير الغدير: اليورو ينزل بدينار
  const zeroNet = isZeroNetVoucher(voucher);
  const { code, label } = getVoucherDocType(voucher);
  const voucherNo =
    voucher?.voucherNo || String(voucher?.seq ?? "").padStart(5, "0");
  const desc = String(voucher?.description || "").trim() || label;
  const fx = Number(String(voucher?.fxRate ?? "").replace(/,/g, "").trim());
  const category = withCategory
    ? formatCategoryChecksText(
        voucher?.categoryChecks,
        resolveCompany(voucher?.companyKey) || resolveCompany("Badur-Signature")
      )
    : "";

  const row = {
    index,
    details: desc,
    iqdIn: null,
    iqdOut: null,
    usdIn: null,
    usdOut: null,
    eurIn: null,
    eurOut: null,
    bank: voucher?.bank || "",
    chequeNo: voucher?.chequeNo || "",
    fx: Number.isFinite(fx) && fx > 0 ? fx : null,
    docType: code,
    voucherNo,
    category,
  };

  const applyPair = (inKey, outKey) => {
    if (zeroNet) {
      row[inKey] = amount;
      row[outKey] = amount;
    } else if (mode === "receipt") {
      row[inKey] = amount;
    } else {
      row[outKey] = amount;
    }
  };

  if (cash === "usd") applyPair("usdIn", "usdOut");
  else if (cash === "eur") applyPair("eurIn", "eurOut");
  else applyPair("iqdIn", "iqdOut");

  return row;
}

function sumField(rows, key) {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

function countDocTypes(rows) {
  const counts = {
    قبض: 0,
    "قبض مصرفي": 0,
    صرف: 0,
    "صرف مصرفي": 0,
  };
  for (const r of rows) {
    if (counts[r.docType] != null) counts[r.docType] += 1;
  }
  return counts;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  if (!out.length) out.push([]);
  return out;
}

function parsePrevAmount(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Company keys for print prev-balance popup.
 * includeEmpty: include selected fund(s) even when there are no vouchers.
 */
export function listDailyCashPrintCompanies(
  vouchers,
  { companyFilter = "all", includeEmpty = false } = {}
) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const filter = String(companyFilter || "all").trim();
  const filterAll = !filter || filter.toLowerCase() === "all";
  const seen = new Set();

  for (const v of list) {
    const key = String(v?.companyKey || "Al-Ghadeer").trim() || "Al-Ghadeer";
    if (!filterAll && key.toLowerCase() !== filter.toLowerCase()) continue;
    seen.add(key);
  }

  if (includeEmpty) {
    if (!filterAll) {
      const match = COMPANIES.find(
        (c) => String(c.key).toLowerCase() === filter.toLowerCase()
      );
      seen.add(match?.key || filter);
    } else {
      for (const c of COMPANIES) {
        if (c.key === "010") continue;
        seen.add(c.key);
      }
    }
  }

  const ordered = [];
  for (const c of COMPANIES) {
    if (seen.has(c.key)) ordered.push({ key: c.key, name: c.name });
  }
  for (const key of seen) {
    if (!ordered.some((x) => x.key === key)) {
      ordered.push({ key, name: companyName(key) });
    }
  }
  return ordered;
}

/**
 * Build print packages: one per company, each with paginated row chunks.
 * prevBalances: { [companyKey]: { iqd, usd } } — included in receipt totals like Excel C7/C8.
 */
export function buildDailyCashPrintPackages(
  vouchers,
  {
    dateFrom = "",
    dateTo = "",
    companyFilter = "all",
    cashier = "",
    prevBalances = {},
    includeEmpty = false,
  } = {}
) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const byCompany = new Map();
  const filter = String(companyFilter || "all").trim();
  const filterAll = !filter || filter.toLowerCase() === "all";

  for (const v of list) {
    const key = String(v?.companyKey || "Al-Ghadeer").trim() || "Al-Ghadeer";
    if (!filterAll && key.toLowerCase() !== filter.toLowerCase()) {
      continue;
    }
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(v);
  }

  // صندوق بدون حركات: ورقة فارغة مع الرصيد السابق
  if (includeEmpty) {
    if (!filterAll) {
      const match = COMPANIES.find(
        (c) => String(c.key).toLowerCase() === filter.toLowerCase()
      );
      const key = match?.key || filter;
      if (!byCompany.has(key)) byCompany.set(key, []);
    } else {
      for (const c of COMPANIES) {
        if (c.key === "010") continue;
        if (!byCompany.has(c.key)) byCompany.set(c.key, []);
      }
    }
  }

  const orderedKeys = [];
  for (const c of COMPANIES) {
    if (byCompany.has(c.key)) orderedKeys.push(c.key);
  }
  for (const key of byCompany.keys()) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  return orderedKeys.map((companyKey) => {
    const showPrevEur = isAlGhadeerMain(companyKey);
    const withEur = false; // جدول دينار/دولار فقط؛ اليورو يبقى بالرصيد السابق
    const withCategory = isBadurSignatureKey(companyKey);
    const sorted = sortVouchers(byCompany.get(companyKey) || []);
    const rows = sorted.map((v, i) =>
      mapVoucherPrintRow(v, i + 1, { withEur, withCategory })
    );
    const rowsPerPage = PRINT_ROWS_PER_PAGE;
    const pages = chunk(rows, rowsPerPage);
    const theme = getCompanyExcelTheme(companyKey) || GHADEER_EXCEL_THEME;
    const bal = prevBalances?.[companyKey] || prevBalances?.[String(companyKey)] || {};
    const prevIqd = parsePrevAmount(bal.iqd ?? bal.prevIqd);
    const prevUsd = parsePrevAmount(bal.usd ?? bal.prevUsd);
    const prevEur = showPrevEur ? parsePrevAmount(bal.eur ?? bal.prevEur) : 0;
    // Same as Excel: مقبوضات totals = previous balance + column sum
    const totals = {
      iqdIn: prevIqd + sumField(rows, "iqdIn"),
      iqdOut: sumField(rows, "iqdOut"),
      usdIn: prevUsd + sumField(rows, "usdIn"),
      usdOut: sumField(rows, "usdOut"),
      eurIn: 0,
      eurOut: 0,
    };
    const balance = {
      iqd: totals.iqdIn - totals.iqdOut,
      usd: totals.usdIn - totals.usdOut,
      eur: prevEur,
    };

    return {
      companyKey,
      companyName: companyName(companyKey),
      withEur,
      withCategory,
      showPrevEur,
      logoSrc: absolutePublicAssetUrl(companyLogoPath(companyKey)),
      themeCss: {
        primary: argbToCss(theme.primary),
        headerBg: argbToCss(theme.headerBg),
        headerBgDeep: argbToCss(theme.headerBgDeep),
        soft: argbToCss(theme.soft),
        border: argbToCss(theme.border),
        receipt: argbToCss(theme.receipt),
        payment: argbToCss(theme.payment),
        boxBg: argbToCss(theme.boxBg),
        noteBg: argbToCss(theme.noteBg),
        textOnPrimary: argbToCss(theme.textOnPrimary || "FFFFFFFF"),
      },
      meta: {
        day: dayLabelFromRange(dateFrom, dateTo),
        date: dateLabelFromRange(dateFrom, dateTo),
        cashier: cashier || "",
        fundName: companyName(companyKey),
        prevIqd,
        prevUsd,
        prevEur,
      },
      rows,
      pages,
      totals,
      balance,
      docCounts: countDocTypes(rows),
    };
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function amountCell(n, kind) {
  if (n == null || n === "") return `<td class="num cell-amount"></td>`;
  const cls = kind === "payment" ? "num pay cell-amount" : "num rec cell-amount";
  return `<td class="${cls}">${esc(fmtNum(n))}</td>`;
}

/** خط واحد عام لكل خلايا الجدول — نفس الحجم والنتيجة من تحكم واحد */
function tableBodyFontCss(fontSize = 9, fontBold = true) {
  const chosen = clampPrintFontSize(fontSize);
  const fw = fontBold ? 800 : 500;
  return `
  table.grid tbody td {
    font-size: ${chosen}px !important;
    font-weight: ${fw} !important;
    line-height: 1.2 !important;
  }
  table.grid tfoot td,
  table.grid tfoot .num {
    font-size: ${chosen}px !important;
    font-weight: ${fw} !important;
    line-height: 1.2 !important;
  }`;
}

function thLabel(text) {
  return `<span class="th-flex">${text}</span>`;
}

function renderTableHeader(withEur = false, withCategory = false) {
  // Al-Ghadeer main (EUR): compact portrait column map
  if (withEur) {
    return `
  <table class="grid grid--eur">
    <colgroup>
      <col class="col-idx" />
      <col class="col-details" />
      <col class="col-cash" /><col class="col-cash" />
      <col class="col-cash" /><col class="col-cash" />
      <col class="col-cash" /><col class="col-cash" />
      <col class="col-bank" />
      <col class="col-cheque" />
      <col class="col-fx" />
      <col class="col-doctype" />
      <col class="col-vno" />
      ${withCategory ? `<col class="col-category" />` : ""}
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2" class="c deep">${thLabel("ت")}</th>
        <th rowspan="2" class="c">${thLabel("التفاصيل")}</th>
        <th colspan="2" class="c">${thLabel("دينار")}</th>
        <th colspan="2" class="c">${thLabel("دولار")}</th>
        <th colspan="2" class="c">${thLabel("يورو")}</th>
        <th rowspan="2" class="c">${thLabel("الحساب")}</th>
        <th rowspan="2" class="c">${thLabel("صك")}</th>
        <th colspan="3" class="c">${thLabel("المستندات")}</th>
        ${withCategory ? `<th rowspan="2" class="c">${thLabel("الفئة")}</th>` : ""}
      </tr>
      <tr>
        <th class="c rec">${thLabel("قبض")}</th>
        <th class="c pay">${thLabel("صرف")}</th>
        <th class="c rec">${thLabel("قبض")}</th>
        <th class="c pay">${thLabel("صرف")}</th>
        <th class="c rec">${thLabel("قبض")}</th>
        <th class="c pay">${thLabel("صرف")}</th>
        <th class="c">${thLabel("سعر")}</th>
        <th class="c">${thLabel("نوع")}</th>
        <th class="c">${thLabel("رقم")}</th>
      </tr>
    </thead>`;
  }

  // نفس فورمة باقي الصناديق؛ مع الفئة نوسّع أعمدة العناوين الطويلة قليلاً
  const detailsW = withCategory ? "9%" : "14%";
  const cashW = withCategory ? "9.5%" : "10.5%";
  const bankW = withCategory ? "8.5%" : "9%";
  const chequeW = withCategory ? "5.5%" : "5.5%";
  const fxW = withCategory ? "6%" : "6%";
  const docTypeW = withCategory ? "7.5%" : "7.5%";
  const vnoW = withCategory ? "7%" : "7%";
  const catCol = withCategory ? `<col style="width:8%" />` : "";
  const catHead = withCategory
    ? `<th rowspan="2" class="c">${thLabel("الفئة")}</th>`
    : "";

  return `
  <table class="grid${withCategory ? " grid--category" : ""}">
    <colgroup>
      <col style="width:2.5%" />
      <col style="width:${detailsW}" />
      <col style="width:${cashW}" />
      <col style="width:${cashW}" />
      <col style="width:${cashW}" />
      <col style="width:${cashW}" />
      <col style="width:${bankW}" />
      <col style="width:${chequeW}" />
      <col style="width:${fxW}" />
      <col style="width:${docTypeW}" />
      <col style="width:${vnoW}" />
      ${catCol}
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2" class="c deep">${thLabel("ت")}</th>
        <th rowspan="2" class="c">${thLabel("التفاصيل")}</th>
        <th colspan="2" class="c">${thLabel("صندوق - الدينار")}</th>
        <th colspan="2" class="c">${thLabel("صندوق - الدولار")}</th>
        <th rowspan="2" class="c">${thLabel("اسم الحساب المصرفي")}</th>
        <th rowspan="2" class="c">${thLabel("رقم الصك")}</th>
        <th colspan="3" class="c">${thLabel("المستندات")}</th>
        ${catHead}
      </tr>
      <tr>
        <th class="c rec">${thLabel("مقبوضات")}</th>
        <th class="c pay">${thLabel("مصروفات")}</th>
        <th class="c rec">${thLabel("مقبوضات")}</th>
        <th class="c pay">${thLabel("مصروفات")}</th>
        <th class="c">${thLabel("سعر الصرف")}</th>
        <th class="c">${thLabel("نوع المستند")}</th>
        <th class="c">${thLabel("رقم الوصل")}</th>
      </tr>
    </thead>`;
}

function renderDataRows(rows, { padTo = 0, withEur = false, withCategory = false } = {}) {
  const list = Array.isArray(rows) ? [...rows] : [];
  while (padTo > 0 && list.length < padTo) {
    list.push({
      index: "",
      details: "",
      iqdIn: null,
      iqdOut: null,
      usdIn: null,
      usdOut: null,
      eurIn: null,
      eurOut: null,
      bank: "",
      chequeNo: "",
      fx: null,
      docType: "",
      voucherNo: "",
      category: "",
    });
  }
  return list
    .map(
      (r) => `
    <tr>
      <td class="c cell-idx">${esc(r.index)}</td>
      <td class="details cell-details">${esc(r.details)}</td>
      ${amountCell(r.iqdIn, "receipt")}
      ${amountCell(r.iqdOut, "payment")}
      ${amountCell(r.usdIn, "receipt")}
      ${amountCell(r.usdOut, "payment")}
      ${
        withEur
          ? `${amountCell(r.eurIn, "receipt")}${amountCell(r.eurOut, "payment")}`
          : ""
      }
      <td class="c cell-bank">${esc(r.bank)}</td>
      <td class="c cell-cheque">${esc(r.chequeNo)}</td>
      <td class="c cell-fx">${r.fx != null ? esc(fmtNum(r.fx)) : ""}</td>
      <td class="c cell-doctype">${esc(r.docType)}</td>
      <td class="c cell-vno">${esc(r.voucherNo)}</td>
      ${
        withCategory
          ? `<td class="c cell-category">${esc(r.category || "")}</td>`
          : ""
      }
    </tr>`
    )
    .join("");
}

function renderMeta(pkg, { continuation = false, pageNo = 1, pageCount = 1 } = {}) {
  const { meta, companyName: name, logoSrc } = pkg;
  if (continuation) {
    return `
    <div class="cont-head">
      <div class="title-bar">${esc(`التقرير اليومي لصندوق ${name}`)} — متابعة (${pageNo}/${pageCount})</div>
    </div>`;
  }
  const logoHtml = logoSrc
    ? `<img class="logo-img" src="${esc(logoSrc)}" alt="${esc(name)}" />`
    : "";
  const prevEurRow = pkg.showPrevEur
    ? `<div class="meta-row"><span class="lbl">الرصيد السابق - يورو</span><span class="val">${esc(fmtNum(meta.prevEur))}</span></div>`
    : "";
  const prevIqdLabel = "الرصيد السابق - دينار";
  const prevUsdLabel = "الرصيد السابق - دولار";
  return `
  <div class="meta-wrap${pkg.showPrevEur ? " meta-wrap--prev-eur" : ""}">
    <div class="meta-side">
      <div class="meta-row"><span class="lbl">اليوم</span><span class="val">${esc(meta.day)}</span></div>
      <div class="meta-row"><span class="lbl">التاريخ</span><span class="val">${esc(meta.date)}</span></div>
      <div class="meta-row"><span class="lbl">أمين الصندوق</span><span class="val">${esc(meta.cashier)}</span></div>
      <div class="meta-row"><span class="lbl">اسم صندوق اليوم</span><span class="val">${esc(meta.fundName)}</span></div>
      <div class="meta-row"><span class="lbl">${prevIqdLabel}</span><span class="val">${esc(fmtNum(meta.prevIqd))}</span></div>
      <div class="meta-row"><span class="lbl">${prevUsdLabel}</span><span class="val">${esc(fmtNum(meta.prevUsd))}</span></div>
      ${prevEurRow}
    </div>
    <div class="title-block" style="background:var(--hb);border-color:var(--p)">
      <div class="title-text" style="color:var(--p)">التقرير اليومي لصندوق ${esc(name)}</div>
    </div>
    <div class="logo-box">${logoHtml}</div>
  </div>`;
}

function renderTableFoot(pkg) {
  const { totals, balance, withEur, withCategory } = pkg;
  const trail = withCategory ? 6 : 5;
  if (withEur) {
    return `
    <tfoot>
      <tr class="tot-row">
        <td colspan="2" class="tot-lbl" style="background:var(--p);color:var(--onp)">المجموع</td>
        <td class="num rec">${esc(fmtNum(totals.iqdIn))}</td>
        <td class="num pay">${esc(fmtNum(totals.iqdOut))}</td>
        <td class="num rec">${esc(fmtNum(totals.usdIn))}</td>
        <td class="num pay">${esc(fmtNum(totals.usdOut))}</td>
        <td class="num rec">${esc(fmtNum(totals.eurIn))}</td>
        <td class="num pay">${esc(fmtNum(totals.eurOut))}</td>
        <td colspan="${trail}"></td>
      </tr>
      <tr class="bal-row">
        <td colspan="2" class="tot-lbl" style="background:var(--p);color:var(--onp)">الرصيد</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.iqd))}</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.usd))}</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.eur))}</td>
        <td colspan="${trail}"></td>
      </tr>
    </tfoot>`;
  }
  return `
    <tfoot>
      <tr class="tot-row">
        <td colspan="2" class="tot-lbl" style="background:var(--p);color:var(--onp)">المجموع</td>
        <td class="num rec">${esc(fmtNum(totals.iqdIn))}</td>
        <td class="num pay">${esc(fmtNum(totals.iqdOut))}</td>
        <td class="num rec">${esc(fmtNum(totals.usdIn))}</td>
        <td class="num pay">${esc(fmtNum(totals.usdOut))}</td>
        <td colspan="${trail}"></td>
      </tr>
      <tr class="bal-row">
        <td colspan="2" class="tot-lbl" style="background:var(--p);color:var(--onp)">الرصيد</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.iqd))}</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.usd))}</td>
        <td colspan="${trail}"></td>
      </tr>
    </tfoot>`;
}

function renderFooter(pkg) {
  const { totals, balance, docCounts, meta } = pkg;
  return `
  <div class="foot">
    <div class="boxes">
      <div class="cash-box" style="background:var(--box)">
        <div class="box-title">الرصيد الحالي</div>
        <div class="box-row"><span class="cur">دينار</span><strong class="bal">${esc(fmtNum(balance.iqd))}</strong><span class="rec">استيرادات ${esc(fmtNum(totals.iqdIn))}</span><span class="pay">مصروفات ${esc(fmtNum(totals.iqdOut))}</span></div>
        <div class="box-row"><span class="cur">دولار</span><strong class="bal">${esc(fmtNum(balance.usd))}</strong><span class="rec">استيرادات ${esc(fmtNum(totals.usdIn))}</span><span class="pay">مصروفات ${esc(fmtNum(totals.usdOut))}</span></div>
        <div class="note" style="background:var(--note)">الرصيد الحالي = مجموع الاستيرادات − مجموع المصروفات والسحوبات</div>
      </div>
      <div class="summary-box">
        <div class="box-title" style="background:var(--hb)">ملخص الوصولات</div>
        <table class="sum-table">
          <tr><td>وصل قبض</td><td>${docCounts["قبض"]}</td></tr>
          <tr><td>قبض مصرفي</td><td>${docCounts["قبض مصرفي"]}</td></tr>
          <tr><td>وصل صرف</td><td>${docCounts["صرف"]}</td></tr>
          <tr><td>صرف مصرفي</td><td>${docCounts["صرف مصرفي"]}</td></tr>
          <tr><td>الإجمالي</td><td>${
            docCounts["قبض"] +
            docCounts["قبض مصرفي"] +
            docCounts["صرف"] +
            docCounts["صرف مصرفي"]
          }</td></tr>
        </table>
      </div>
    </div>

    <div class="signs">
      <div class="sign">
        <div class="sign-h" style="background:var(--soft)">أمين الصندوق</div>
        <div class="sign-b">${esc(meta.cashier) || "________________"}</div>
      </div>
      <div class="sign">
        <div class="sign-h" style="background:var(--soft)">المدير المالي</div>
        <div class="sign-b">________________</div>
      </div>
    </div>
  </div>`;
}

function printCss({
  landscape = false,
  fontSize = 9,
  fontBold = true,
} = {}) {
  const pageSize = landscape ? "A4 landscape" : "A4 portrait";
  const pageH = landscape ? "194mm" : "283mm";
  const chosen = clampPrintFontSize(fontSize);
  const fontScale = chosen / PRINT_FONT_BASE;
  // ارتفاع الصف يتناسب مع الخط حتى لا تُقص الأرقام/النصوص داخل الخلية
  const baseRowH = landscape ? 9.2 : 7.6;
  const baseRowHCont = landscape ? 11 : 10.4;
  const rowH = `${Math.round(baseRowH * fontScale * 100) / 100}mm`;
  const rowHCont = `${Math.round(baseRowHCont * fontScale * 100) / 100}mm`;
  const metaH = landscape ? "68px" : "112px";
  const titleH = landscape ? "64px" : "108px";
  // أبعاد الفورمة ثابتة — تحكم واحد يغيّر خط كل خلايا الجدول بنفس الحجم
  const s = (px) => `${Math.round(Math.max(5.5, Number(px)) * 10) / 10}px`;
  const fw = fontBold ? 800 : 500;
  const fwSoft = fontBold ? 700 : 500;
  const targetCss = tableBodyFontCss(chosen, fontBold);
  return `
  @page { size: ${pageSize}; margin: 7mm; }
  * { box-sizing: border-box; }
  html, body {
    width: 100%;
    height: auto;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    color: #111;
    direction: rtl;
    background: #fff;
    font-size: ${s(9)};
    font-weight: ${fwSoft};
  }
  .page {
    --p: #00487C;
    --hb: #E5F0F8;
    --hd: #C6DFF1;
    --soft: #EDF4FA;
    --bd: #72B0DC;
    --rec: #2E7D5B;
    --pay: #C44B4B;
    --box: #EEF7F6;
    --note: #F0F6F8;
    --onp: #FFFFFF;
    width: 100%;
    max-width: 100%;
    height: ${pageH};
    max-height: ${pageH};
    min-height: ${pageH};
    padding: 1.5mm;
    margin: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .meta-wrap {
    display: grid;
    grid-template-columns: 1.05fr 1.35fr 1fr;
    gap: 4px;
    margin: 0 0 4px;
    width: 100%;
    height: ${metaH};
    max-height: ${metaH};
    min-height: ${metaH};
    flex: 0 0 ${metaH};
    flex-shrink: 0;
    overflow: hidden;
  }
  .meta-side { display: flex; flex-direction: column; gap: 0; height: 100%; min-height: 0; overflow: hidden; }
  .meta-row {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    border: 1px solid var(--bd);
    font-size: ${s(10)};
    flex: 1 1 0;
    min-height: 0;
    align-items: stretch;
    overflow: hidden;
  }
  .meta-row .lbl {
    background: var(--soft);
    padding: 5px 6px;
    font-weight: ${fwSoft};
    color: var(--p);
    display: flex;
    align-items: center;
    overflow: visible;
    white-space: nowrap;
  }
  .meta-row .val {
    padding: 5px 6px;
    text-align: center;
    font-weight: ${fwSoft};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
    white-space: nowrap;
  }
  .title-block {
    border: 2px solid var(--p);
    display: flex;
    align-items: center;
    justify-content: center;
    height: ${titleH};
    min-height: ${titleH};
    max-height: ${titleH};
    padding: 8px;
    text-align: center;
    background: var(--hb);
    overflow: hidden;
  }
  .title-text { font-size: ${s(18)}; font-weight: ${fw}; line-height: 1.35; }
  .logo-box {
    border: 1px solid var(--bd);
    height: ${titleH};
    min-height: ${titleH};
    max-height: ${titleH};
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    overflow: hidden;
  }
  .logo-img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .cont-head { margin-bottom: 4px; flex: 0 0 auto; flex-shrink: 0; }
  .title-bar {
    background: var(--hd);
    color: var(--p);
    font-weight: ${fw};
    font-size: ${s(13)};
    text-align: center;
    padding: 8px;
    border: 1px solid var(--bd);
  }
  .table-shell {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  table.grid {
    width: 100% !important;
    height: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${s(9)};
  }
  table.grid col { min-width: 0; }
  table.grid thead { flex: 0 0 auto; }
  table.grid th, table.grid td {
    border: 1px solid var(--bd);
    padding: 3px 2px;
    vertical-align: middle;
    line-height: 1.2;
    overflow: visible;
  }
  table.grid thead th {
    font-size: ${s(8.5)} !important;
    font-weight: ${fw} !important;
    overflow: hidden;
    white-space: normal;
    padding: 2px 1px;
    height: auto;
  }
  /* عناوين الأعمدة: flex داخلي بدون تغيير لون/حدود الجدول */
  table.grid thead th .th-flex {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 1.6em;
    text-align: center;
    line-height: 1.25;
    word-break: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    padding: 1px 1px;
    box-sizing: border-box;
  }
  table.grid thead th[rowspan="2"] .th-flex {
    min-height: 2.6em;
  }
  /* عمود الفئة فقط — بدون تغيير شكل باقي الأعمدة */
  table.grid.grid--category .cell-category {
    font-size: ${s(8)};
    font-weight: ${fwSoft};
    word-break: break-word;
    white-space: normal;
    line-height: 1.15;
    overflow: hidden;
  }
  table.grid.grid--category thead th {
    font-size: ${s(8)} !important;
  }
  table.grid tbody tr {
    height: ${rowH} !important;
    min-height: ${rowH} !important;
  }
  .page--cont table.grid tbody tr {
    height: ${rowHCont} !important;
    min-height: ${rowHCont} !important;
  }
  table.grid tbody td {
    height: ${rowH};
    min-height: ${rowH};
    overflow: visible;
  }
  .page--cont table.grid tbody td {
    height: ${rowHCont};
    min-height: ${rowHCont};
  }
  table.grid th { background: var(--hb); color: var(--p); font-weight: ${fw}; }
  table.grid th.deep { background: var(--hd); }
  table.grid tfoot td,
  table.grid tfoot .num {
    height: auto !important;
    max-height: none !important;
    max-width: none !important;
    padding: 4px 2px !important;
    font-weight: ${fwSoft} !important;
    overflow: visible !important;
    white-space: nowrap;
  }
  table.grid tfoot .tot-lbl {
    text-align: center;
    font-weight: ${fw};
  }
  .c { text-align: center; }
  .details {
    text-align: right;
    font-weight: ${fwSoft};
    word-break: break-word;
    overflow: visible;
  }
  .num {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: ${fwSoft};
    font-size: ${s(7.5)};
    padding: 2px 1px !important;
    white-space: nowrap;
    overflow: visible;
    letter-spacing: -0.02em;
  }
  .rec { color: var(--rec) !important; }
  .pay { color: var(--pay) !important; }
  .foot {
    width: 100%;
    flex: 0 0 auto;
    flex-shrink: 0;
    margin-top: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: visible;
  }
  .boxes { display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px; margin-top: 5px; width: 100%; }
  .cash-box, .summary-box { border: 1px solid var(--bd); border-radius: 3px; overflow: visible; }
  .box-title { font-size: ${s(10)}; font-weight: ${fw}; text-align: center; padding: 4px; color: var(--p); }
  .box-row { display: grid; grid-template-columns: 0.6fr 1fr 1.1fr 1.1fr; gap: 4px; padding: 4px 6px; font-size: ${s(8.5)}; border-top: 1px solid var(--bd); align-items: center; overflow: visible; }
  .box-row .bal { overflow: visible; white-space: nowrap; }
  .note { font-size: ${s(7.5)}; padding: 3px 6px; color: #444; border-top: 1px solid var(--bd); }
  .sum-table { width: 100%; border-collapse: collapse; font-size: ${s(9)}; }
  .sum-table td { border-top: 1px solid var(--bd); padding: 3px 6px; }
  .sum-table td:last-child { text-align: center; font-weight: ${fw}; width: 40px; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; width: 100%; }
  .sign { border: 1px solid var(--bd); }
  .sign-h { text-align: center; font-size: ${s(9.5)}; font-weight: ${fw}; color: var(--p); padding: 4px; }
  .sign-b { min-height: 26px; text-align: center; padding: 6px 4px; font-size: ${s(11)}; font-weight: ${fwSoft}; }

  /* ——— Al-Ghadeer main: EUR landscape — footer always visible ——— */
  .page--eur .meta-wrap {
    grid-template-columns: 1.15fr 1.5fr 0.9fr;
    gap: 3px;
    margin-bottom: 2px;
    height: ${metaH};
    max-height: ${metaH};
    min-height: ${metaH};
    flex: 0 0 ${metaH};
  }
  .page--eur .meta-row { font-size: ${s(8.5)}; }
  .page--eur .meta-row .lbl,
  .page--eur .meta-row .val { padding: 2px 4px; }
  .page--eur .title-block,
  .page--eur .logo-box {
    height: ${titleH};
    min-height: ${titleH};
    max-height: ${titleH};
  }
  .page--eur .title-text { font-size: ${s(14)}; }
  .page--eur .logo-img { max-height: 100%; }
  .page--eur table.grid.grid--eur {
    font-size: ${s(8)};
  }
  .page--eur table.grid.grid--eur .col-idx { width: 2.5%; }
  .page--eur table.grid.grid--eur .col-details { width: 13%; }
  .page--eur table.grid.grid--eur .col-cash { width: 8%; }
  .page--eur table.grid.grid--eur .col-bank { width: 8%; }
  .page--eur table.grid.grid--eur .col-cheque { width: 4.5%; }
  .page--eur table.grid.grid--eur .col-fx { width: 4.5%; }
  .page--eur table.grid.grid--eur .col-doctype { width: 5.5%; }
  .page--eur table.grid.grid--eur .col-vno { width: 6%; }
  .page--eur table.grid tbody .num { font-size: ${s(7)}; }
  .page--eur table.grid th,
  .page--eur table.grid td {
    padding: 2px 2px;
  }
  .page--eur table.grid tbody tr {
    height: ${rowH} !important;
    min-height: ${rowH} !important;
  }
  .page--eur.page--cont table.grid tbody tr {
    height: ${rowHCont} !important;
    min-height: ${rowHCont} !important;
  }
  .page--eur table.grid tbody td {
    height: ${rowH};
    min-height: ${rowH};
    overflow: visible;
  }
  .page--eur table.grid tfoot td,
  .page--eur table.grid tfoot .num {
    padding: 4px 2px !important;
    overflow: visible !important;
  }
  /* الجدول يمدّ ليملأ المساحة، الفوتر يثبت أسفل الصفحة */
  .page--eur .table-shell {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .page--eur table.grid {
    height: 100% !important;
    flex: 1 1 auto;
  }
  .page--eur table.grid tbody {
    height: 100%;
  }
  .page--eur .foot--eur {
    flex: 0 0 auto;
    flex-shrink: 0;
    margin-top: 3px;
    padding-bottom: 1mm;
    overflow: visible;
  }
  .page--eur .boxes {
    gap: 6px;
    margin-top: 2px;
    grid-template-columns: 1.55fr 1fr;
    align-items: stretch;
  }
  .page--eur .cash-box,
  .page--eur .summary-box {
    min-height: 0;
  }
  .page--eur .box-title { font-size: ${s(10)}; padding: 4px; }
  .page--eur .box-row {
    display: grid;
    grid-template-columns: 0.55fr 1.15fr 1.15fr 1.15fr;
    gap: 3px;
    font-size: ${s(8.5)};
    padding: 4px 6px;
    align-items: center;
  }
  .page--eur .box-row .cur { font-weight: ${fw}; color: var(--p); }
  .page--eur .box-row .bal {
    font-size: ${s(10)};
    font-weight: ${fw};
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .page--eur .note { font-size: ${s(7.5)}; padding: 3px 6px; }
  .page--eur .sum-table { font-size: ${s(9)}; }
  .page--eur .sum-table td { padding: 3px 6px; }
  .page--eur .signs {
    margin-top: 5px;
    gap: 8px;
  }
  .page--eur .sign-h { font-size: ${s(10)}; padding: 4px; }
  .page--eur .sign-b {
    min-height: 24px;
    padding: 5px 4px;
    font-size: ${s(11)};
  }
  ${targetCss}

  @media print {
    html, body { width: 100%; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page {
      height: ${pageH};
      max-height: ${pageH};
      min-height: ${pageH};
    }
  }
  `;
}

function pageThemeStyle(themeCss) {
  const t = themeCss || {};
  return [
    `--p:${t.primary || "#00487C"}`,
    `--hb:${t.headerBg || "#E5F0F8"}`,
    `--hd:${t.headerBgDeep || "#C6DFF1"}`,
    `--soft:${t.soft || "#EDF4FA"}`,
    `--bd:${t.border || "#72B0DC"}`,
    `--rec:${t.receipt || "#2E7D5B"}`,
    `--pay:${t.payment || "#C44B4B"}`,
    `--box:${t.boxBg || "#EEF7F6"}`,
    `--note:${t.noteBg || "#F0F6F8"}`,
    `--onp:${t.textOnPrimary || "#FFFFFF"}`,
  ].join(";");
}

/**
 * Full printable HTML document for one or more company packages.
 * Al-Ghadeer main (withEur) → landscape so EUR columns stay neat.
 */
export function buildDailyCashPrintHtml(
  packages,
  {
    fontSize = 9,
    fontBold = true,
    autoPrint = true,
  } = {}
) {
  const list = Array.isArray(packages) ? packages : [];
  const landscape =
    list.length > 0 && list.every((pkg) => Boolean(pkg?.withEur));
  const chosenSize = clampPrintFontSize(fontSize);

  const pagesHtml = list
    .map((pkg) => {
      const themeStyle = pageThemeStyle(pkg.themeCss);
      const withEur = Boolean(pkg.withEur);
      const withCategory = Boolean(pkg.withCategory);
      const rowsPerPage = printRowsPerPage(chosenSize, withEur);
      // إعادة تقسيم الصفوف حسب حجم الخط حتى لا يُقص الرصيد/الفوتر
      const allRows = Array.isArray(pkg.rows)
        ? pkg.rows
        : (pkg.pages || []).flat();
      const pageChunks = chunk(allRows, rowsPerPage);
      const pages = pageChunks.length > 0 ? pageChunks : [[]];
      const pageCount = pages.length;
      return pages
        .map((chunkRows, pageIdx) => {
          const isFirst = pageIdx === 0;
          const isLast = pageIdx === pageCount - 1;
          const pageNo = pageIdx + 1;
          const pageClass = [
            "page",
            isLast ? "page--final" : "page--cont",
            withEur ? "page--eur" : "",
          ]
            .filter(Boolean)
            .join(" ");
          // نملأ الصفحة بعدد الصفوف المناسب لحجم الخط
          const padTo = rowsPerPage;
          return `
          <section class="${pageClass}" style="${themeStyle}">
            ${renderMeta(pkg, {
              continuation: !isFirst,
              pageNo,
              pageCount,
            })}
            <div class="table-shell">
            ${renderTableHeader(withEur, withCategory)}
            <tbody>
              ${renderDataRows(chunkRows, {
                padTo,
                withEur,
                withCategory,
              })}
            </tbody>
            ${isLast ? renderTableFoot(pkg) : ""}
            </table>
            </div>
            ${isLast ? renderFooter(pkg) : ""}
          </section>`;
        })
        .join("");
    })
    .join("");

  const printScript = autoPrint
    ? `<script>
  function whenImagesReady(cb) {
    var imgs = Array.prototype.slice.call(document.images || []);
    if (!imgs.length) { cb(); return; }
    var left = imgs.length;
    var done = function () { left -= 1; if (left <= 0) cb(); };
    imgs.forEach(function (img) {
      if (img.complete) done();
      else {
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      }
    });
    setTimeout(cb, 4000);
  }
  window.onload = function () {
    whenImagesReady(function () {
      setTimeout(function () { window.focus(); window.print(); }, 150);
    });
  };
</script>`
    : `<script>/* preview: no auto print */</script>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>التقرير اليومي للصندوق</title>
  <style>${printCss({ landscape, fontSize: chosenSize, fontBold })}</style>
</head>
<body>
${pagesHtml || `<section class="page"><p style="text-align:center">لا توجد بيانات</p></section>`}
${printScript}
</body>
</html>`;
}

function writeHtmlToWindow(win, html) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function printViaHiddenIframe(html) {
  const existing = document.getElementById("voucher-daily-cash-print-frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "voucher-daily-cash-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error("تعذر تجهيز الطباعة");
  }

  writeHtmlToWindow(iframe.contentWindow, html);

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000);
  };
  iframe.contentWindow.onafterprint = cleanup;
  setTimeout(cleanup, 60_000);
  return iframe.contentWindow;
}

/**
 * Open a blank print target immediately (must run in the click handler,
 * before any await) so popup blockers do not block it.
 */
export function openBlankDailyCashPrintWindow() {
  const w = window.open("", "_blank");
  if (!w) return null;
  try {
    writeHtmlToWindow(
      w,
      `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>جاري التحضير…</title></head><body style="font-family:Tahoma,Arial,sans-serif;padding:40px;text-align:center;color:#334155">جاري تحضير تقرير الصندوق للطباعة…</body></html>`
    );
  } catch {
    /* ignore */
  }
  return w;
}

/**
 * Write the daily cash form into an already-opened window, or fall back to a
 * hidden iframe print (no popup needed).
 * Prefers embedded logo data URLs so the logo always prints.
 */
/**
 * HTML معاينة فورمة الطباعة (صفوف تجريبية) لتعديل حجم/غمق الخط تفاعلياً.
 */
export function buildDailyCashPrintPreviewHtml({
  fontSize = 9,
  fontBold = true,
  companyName = "صندوق تجريبي",
  logoSrc = "",
  themeCss = null,
} = {}) {
  const theme = getCompanyExcelTheme("Al-Ghadeer") || GHADEER_EXCEL_THEME;
  const css = themeCss || {
    primary: argbToCss(theme.primary),
    headerBg: argbToCss(theme.headerBg),
    headerBgDeep: argbToCss(theme.headerBgDeep),
    soft: argbToCss(theme.soft),
    border: argbToCss(theme.border),
    receipt: argbToCss(theme.receipt),
    payment: argbToCss(theme.payment),
    boxBg: argbToCss(theme.boxBg),
    noteBg: argbToCss(theme.noteBg),
    textOnPrimary: argbToCss(theme.textOnPrimary || "FFFFFFFF"),
  };

  const sampleRows = [
    {
      index: 1,
      details: "استلام مبلغ — معاينة الخط",
      iqdIn: 1500000,
      iqdOut: null,
      usdIn: null,
      usdOut: null,
      eurIn: null,
      eurOut: null,
      bank: "",
      chequeNo: "",
      fx: null,
      docType: "قبض",
      voucherNo: "00001",
    },
    {
      index: 2,
      details: "صرف مصروف تشغيلي",
      iqdIn: null,
      iqdOut: 275000,
      usdIn: null,
      usdOut: null,
      eurIn: null,
      eurOut: null,
      bank: "",
      chequeNo: "",
      fx: null,
      docType: "صرف",
      voucherNo: "00002",
    },
    {
      index: 3,
      details: "قبض دولار عبر المصرف",
      iqdIn: null,
      iqdOut: null,
      usdIn: 500,
      usdOut: null,
      eurIn: null,
      eurOut: null,
      bank: "TBI",
      chequeNo: "",
      fx: 1480,
      docType: "قبض مصرفي",
      voucherNo: "00003",
    },
  ];

  const prevIqd = 1000000;
  const prevUsd = 1000;
  const totals = {
    iqdIn: prevIqd + sumField(sampleRows, "iqdIn"),
    iqdOut: sumField(sampleRows, "iqdOut"),
    usdIn: prevUsd + sumField(sampleRows, "usdIn"),
    usdOut: sumField(sampleRows, "usdOut"),
    eurIn: 0,
    eurOut: 0,
  };
  const balance = {
    iqd: totals.iqdIn - totals.iqdOut,
    usd: totals.usdIn - totals.usdOut,
    eur: 0,
  };

  const pkg = {
    companyKey: "preview",
    companyName: companyName || "صندوق تجريبي",
    withEur: false,
    showPrevEur: false,
    logoSrc: logoSrc || "",
    themeCss: css,
    meta: {
      day: "الأحد",
      date: "12/10/2026",
      cashier: "معاينة",
      fundName: companyName || "صندوق تجريبي",
      prevIqd,
      prevUsd,
      prevEur: 0,
    },
    totals,
    balance,
    docCounts: countDocTypes(sampleRows),
    pages: [sampleRows],
  };

  return buildDailyCashPrintHtml([pkg], {
    fontSize,
    fontBold,
    autoPrint: false,
  });
}

export async function openDailyCashPrintWindow(
  packages,
  existingWin = null,
  { fontSize = 9, fontBold = true } = {}
) {
  const withLogos = await attachPrintLogos(packages);
  const html = buildDailyCashPrintHtml(withLogos, {
    fontSize,
    fontBold,
    autoPrint: true,
  });
  let w = existingWin && !existingWin.closed ? existingWin : null;

  if (!w) {
    w = window.open("", "_blank");
  }

  if (w) {
    writeHtmlToWindow(w, html);
    try {
      w.focus();
    } catch {
      /* ignore */
    }
    return w;
  }

  return printViaHiddenIframe(html);
}
