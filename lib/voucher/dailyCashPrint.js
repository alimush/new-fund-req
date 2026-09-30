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

export const PRINT_ROWS_PER_PAGE = 20;
/** الغدير الرئيسي (يورو / landscape): عدد صفوف ثابت يملأ الصفحة؛ الزيادة → صفحة جديدة */
export const PRINT_ROWS_PER_PAGE_EUR = 12;

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
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const encoded = withSlash
    .split("/")
    .map((seg) => (seg ? encodeURIComponent(seg) : ""))
    .join("/");
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
export function mapVoucherPrintRow(voucher, index, { withEur = false } = {}) {
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
 * Company keys present in the voucher set (for print prev-balance popup).
 */
export function listDailyCashPrintCompanies(
  vouchers,
  { companyFilter = "all" } = {}
) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const seen = new Set();
  for (const v of list) {
    const key = String(v?.companyKey || "Al-Ghadeer").trim() || "Al-Ghadeer";
    if (
      companyFilter &&
      String(companyFilter).toLowerCase() !== "all" &&
      key.toLowerCase() !== String(companyFilter).toLowerCase()
    ) {
      continue;
    }
    seen.add(key);
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
  } = {}
) {
  const list = Array.isArray(vouchers) ? vouchers : [];
  const byCompany = new Map();

  for (const v of list) {
    const key = String(v?.companyKey || "Al-Ghadeer").trim() || "Al-Ghadeer";
    if (
      companyFilter &&
      String(companyFilter).toLowerCase() !== "all" &&
      key.toLowerCase() !== String(companyFilter).toLowerCase()
    ) {
      continue;
    }
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(v);
  }

  const orderedKeys = [];
  for (const c of COMPANIES) {
    if (byCompany.has(c.key)) orderedKeys.push(c.key);
  }
  for (const key of byCompany.keys()) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  return orderedKeys.map((companyKey) => {
    const withEur = isAlGhadeerMain(companyKey);
    const sorted = sortVouchers(byCompany.get(companyKey) || []);
    const rows = sorted.map((v, i) =>
      mapVoucherPrintRow(v, i + 1, { withEur })
    );
    const rowsPerPage = withEur ? PRINT_ROWS_PER_PAGE_EUR : PRINT_ROWS_PER_PAGE;
    const pages = chunk(rows, rowsPerPage);
    const theme = getCompanyExcelTheme(companyKey) || GHADEER_EXCEL_THEME;
    const bal = prevBalances?.[companyKey] || prevBalances?.[String(companyKey)] || {};
    const prevIqd = parsePrevAmount(bal.iqd ?? bal.prevIqd);
    const prevUsd = parsePrevAmount(bal.usd ?? bal.prevUsd);
    const prevEur = withEur ? parsePrevAmount(bal.eur ?? bal.prevEur) : 0;
    // Same as Excel: مقبوضات totals = previous balance + column sum
    const totals = {
      iqdIn: prevIqd + sumField(rows, "iqdIn"),
      iqdOut: sumField(rows, "iqdOut"),
      usdIn: prevUsd + sumField(rows, "usdIn"),
      usdOut: sumField(rows, "usdOut"),
      eurIn: prevEur + sumField(rows, "eurIn"),
      eurOut: sumField(rows, "eurOut"),
    };
    const balance = {
      iqd: totals.iqdIn - totals.iqdOut,
      usd: totals.usdIn - totals.usdOut,
      eur: totals.eurIn - totals.eurOut,
    };

    return {
      companyKey,
      companyName: companyName(companyKey),
      withEur,
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
  if (n == null || n === "") return `<td class="num"></td>`;
  const cls = kind === "payment" ? "num pay" : "num rec";
  return `<td class="${cls}">${esc(fmtNum(n))}</td>`;
}

function renderTableHeader(withEur = false) {
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
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2" class="c deep">ت</th>
        <th rowspan="2" class="c">التفاصيل</th>
        <th colspan="2" class="c">دينار</th>
        <th colspan="2" class="c">دولار</th>
        <th colspan="2" class="c">يورو</th>
        <th rowspan="2" class="c">الحساب</th>
        <th rowspan="2" class="c">صك</th>
        <th colspan="3" class="c">المستندات</th>
      </tr>
      <tr>
        <th class="c rec">قبض</th>
        <th class="c pay">صرف</th>
        <th class="c rec">قبض</th>
        <th class="c pay">صرف</th>
        <th class="c rec">قبض</th>
        <th class="c pay">صرف</th>
        <th class="c">سعر</th>
        <th class="c">نوع</th>
        <th class="c">رقم</th>
      </tr>
    </thead>`;
}

  return `
  <table class="grid">
    <colgroup>
      <col style="width:2.5%" />
      <col style="width:16%" />
      <col style="width:11%" />
      <col style="width:11%" />
      <col style="width:11%" />
      <col style="width:11%" />
      <col style="width:7%" />
      <col style="width:5%" />
      <col style="width:5%" />
      <col style="width:6.5%" />
      <col style="width:6%" />
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2" class="c deep">ت</th>
        <th rowspan="2" class="c">التفاصيل</th>
        <th colspan="2" class="c">صندوق - الدينار</th>
        <th colspan="2" class="c">صندوق - الدولار</th>
        <th rowspan="2" class="c">اسم الحساب المصرفي</th>
        <th rowspan="2" class="c">رقم الصك</th>
        <th colspan="3" class="c">المستندات</th>
      </tr>
      <tr>
        <th class="c rec">مقبوضات</th>
        <th class="c pay">مصروفات</th>
        <th class="c rec">مقبوضات</th>
        <th class="c pay">مصروفات</th>
        <th class="c">سعر الصرف</th>
        <th class="c">نوع المستند</th>
        <th class="c">رقم الوصل</th>
      </tr>
    </thead>`;
}

function renderDataRows(rows, { padTo = 0, withEur = false } = {}) {
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
    });
  }
  return list
    .map(
      (r) => `
    <tr>
      <td class="c">${esc(r.index)}</td>
      <td class="details">${esc(r.details)}</td>
      ${amountCell(r.iqdIn, "receipt")}
      ${amountCell(r.iqdOut, "payment")}
      ${amountCell(r.usdIn, "receipt")}
      ${amountCell(r.usdOut, "payment")}
      ${
        withEur
          ? `${amountCell(r.eurIn, "receipt")}${amountCell(r.eurOut, "payment")}`
          : ""
      }
      <td class="c">${esc(r.bank)}</td>
      <td class="c">${esc(r.chequeNo)}</td>
      <td class="c">${r.fx != null ? esc(fmtNum(r.fx)) : ""}</td>
      <td class="c">${esc(r.docType)}</td>
      <td class="c">${esc(r.voucherNo)}</td>
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
  const prevEurRow = pkg.withEur
    ? `<div class="meta-row"><span class="lbl">رصيد سابق — يورو</span><span class="val">${esc(fmtNum(meta.prevEur))}</span></div>`
    : "";
  const prevIqdLabel = pkg.withEur ? "رصيد سابق — دينار" : "الرصيد السابق - دينار";
  const prevUsdLabel = pkg.withEur ? "رصيد سابق — دولار" : "الرصيد السابق - دولار";
  return `
  <div class="meta-wrap${pkg.withEur ? " meta-wrap--eur" : ""}">
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
  const { totals, balance, withEur } = pkg;
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
        <td colspan="5"></td>
      </tr>
      <tr class="bal-row">
        <td colspan="2" class="tot-lbl" style="background:var(--p);color:var(--onp)">الرصيد</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.iqd))}</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.usd))}</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.eur))}</td>
        <td colspan="5"></td>
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
        <td colspan="5"></td>
      </tr>
      <tr class="bal-row">
        <td colspan="2" class="tot-lbl" style="background:var(--p);color:var(--onp)">الرصيد</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.iqd))}</td>
        <td class="num" colspan="2">${esc(fmtNum(balance.usd))}</td>
        <td colspan="5"></td>
      </tr>
    </tfoot>`;
}

function renderFooter(pkg) {
  const { totals, balance, docCounts, meta, withEur } = pkg;
  const eurBoxRow = withEur
    ? `<div class="box-row"><span class="cur">يورو</span><strong class="bal">${esc(fmtNum(balance.eur))}</strong><span class="rec">استيرادات ${esc(fmtNum(totals.eurIn))}</span><span class="pay">مصروفات ${esc(fmtNum(totals.eurOut))}</span></div>`
    : "";
  return `
  <div class="foot${withEur ? " foot--eur" : ""}">
    <div class="boxes">
      <div class="cash-box" style="background:var(--box)">
        <div class="box-title">الرصيد الحالي</div>
        <div class="box-row"><span class="cur">دينار</span><strong class="bal">${esc(fmtNum(balance.iqd))}</strong><span class="rec">استيرادات ${esc(fmtNum(totals.iqdIn))}</span><span class="pay">مصروفات ${esc(fmtNum(totals.iqdOut))}</span></div>
        <div class="box-row"><span class="cur">دولار</span><strong class="bal">${esc(fmtNum(balance.usd))}</strong><span class="rec">استيرادات ${esc(fmtNum(totals.usdIn))}</span><span class="pay">مصروفات ${esc(fmtNum(totals.usdOut))}</span></div>
        ${eurBoxRow}
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

function printCss({ landscape = false } = {}) {
  const pageSize = landscape ? "A4 landscape" : "A4 portrait";
  const pageH = landscape ? "194mm" : "283mm";
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
    flex: 0 0 auto;
  }
  .meta-side { display: flex; flex-direction: column; gap: 0; height: 100%; }
  .meta-row {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    border: 1px solid var(--bd);
    font-size: 10px;
    flex: 1 1 auto;
    align-items: stretch;
  }
  .meta-row .lbl {
    background: var(--soft);
    padding: 5px 6px;
    font-weight: 700;
    color: var(--p);
    display: flex;
    align-items: center;
  }
  .meta-row .val {
    padding: 5px 6px;
    text-align: center;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .title-block {
    border: 2px solid var(--p);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 108px;
    padding: 8px;
    text-align: center;
    background: var(--hb);
  }
  .title-text { font-size: 18px; font-weight: 800; line-height: 1.35; }
  .logo-box {
    border: 1px solid var(--bd);
    min-height: 108px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }
  .logo-img {
    max-width: 100%;
    max-height: 120px;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .cont-head { margin-bottom: 4px; flex: 0 0 auto; }
  .title-bar {
    background: var(--hd);
    color: var(--p);
    font-weight: 800;
    font-size: 13px;
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
  }
  table.grid {
    width: 100% !important;
    height: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 9px;
  }
  table.grid thead { flex: 0 0 auto; }
  table.grid th, table.grid td {
    border: 1px solid var(--bd);
    padding: 3px 2px;
    vertical-align: middle;
    line-height: 1.2;
  }
  table.grid tbody tr { height: 7.6mm; }
  .page--cont table.grid tbody tr { height: 10.4mm; }
  table.grid th { background: var(--hb); color: var(--p); font-weight: 800; }
  table.grid th.deep { background: var(--hd); }
  table.grid tfoot td {
    height: auto !important;
    padding: 3px 1px !important;
    font-size: 8px;
    font-weight: 700;
  }
  table.grid tfoot .tot-lbl {
    text-align: center;
    font-weight: 800;
  }
  .c { text-align: center; }
  .details { text-align: right; font-weight: 600; word-break: break-word; }
  .num {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 7.5px;
    padding: 2px 1px !important;
    white-space: nowrap;
    overflow: hidden;
    letter-spacing: -0.02em;
  }
  .rec { color: var(--rec) !important; }
  .pay { color: var(--pay) !important; }
  .foot {
    width: 100%;
    flex: 0 0 auto;
    margin-top: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .boxes { display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px; margin-top: 5px; width: 100%; }
  .cash-box, .summary-box { border: 1px solid var(--bd); border-radius: 3px; overflow: hidden; }
  .box-title { font-size: 10px; font-weight: 800; text-align: center; padding: 4px; color: var(--p); }
  .box-row { display: grid; grid-template-columns: 0.6fr 1fr 1.1fr 1.1fr; gap: 4px; padding: 4px 6px; font-size: 8.5px; border-top: 1px solid var(--bd); align-items: center; }
  .note { font-size: 7.5px; padding: 3px 6px; color: #444; border-top: 1px solid var(--bd); }
  .sum-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .sum-table td { border-top: 1px solid var(--bd); padding: 3px 6px; }
  .sum-table td:last-child { text-align: center; font-weight: 800; width: 40px; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; width: 100%; }
  .sign { border: 1px solid var(--bd); }
  .sign-h { text-align: center; font-size: 9.5px; font-weight: 800; color: var(--p); padding: 4px; }
  .sign-b { min-height: 26px; text-align: center; padding: 6px 4px; font-size: 11px; font-weight: 700; }

  /* ——— Al-Ghadeer main: EUR landscape — footer always visible ——— */
  .page--eur .meta-wrap {
    grid-template-columns: 1.15fr 1.5fr 0.9fr;
    gap: 3px;
    margin-bottom: 2px;
  }
  .page--eur .meta-row { font-size: 8.5px; }
  .page--eur .meta-row .lbl,
  .page--eur .meta-row .val { padding: 2px 4px; }
  .page--eur .title-block,
  .page--eur .logo-box { min-height: 64px; }
  .page--eur .title-text { font-size: 14px; }
  .page--eur .logo-img { max-height: 72px; }
  .page--eur table.grid.grid--eur {
    font-size: 8px;
    height: auto;
  }
  .page--eur table.grid.grid--eur .col-idx { width: 2.5%; }
  .page--eur table.grid.grid--eur .col-details { width: 13%; }
  .page--eur table.grid.grid--eur .col-cash { width: 8%; }
  .page--eur table.grid.grid--eur .col-bank { width: 8%; }
  .page--eur table.grid.grid--eur .col-cheque { width: 4.5%; }
  .page--eur table.grid.grid--eur .col-fx { width: 4.5%; }
  .page--eur table.grid.grid--eur .col-doctype { width: 5.5%; }
  .page--eur table.grid.grid--eur .col-vno { width: 6%; }
  .page--eur table.grid .num { font-size: 7px; }
  .page--eur table.grid th,
  .page--eur table.grid td {
    padding: 2px 2px;
  }
  .page--eur table.grid tbody tr { height: auto; }
  .page--eur.page--cont table.grid tbody tr { height: auto; }
  .page--eur .details { font-size: 7.5px; line-height: 1.2; }
  .page--eur table.grid tfoot td { font-size: 8px; padding: 3px 2px !important; }
  /* الجدول يمدّ ليملأ المساحة، الفوتر يثبت أسفل الصفحة */
  .page--eur .table-shell {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
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
    margin-top: 3px;
    padding-bottom: 1mm;
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
  .page--eur .box-title { font-size: 10px; padding: 4px; }
  .page--eur .box-row {
    display: grid;
    grid-template-columns: 0.55fr 1.15fr 1.15fr 1.15fr;
    gap: 3px;
    font-size: 8.5px;
    padding: 4px 6px;
    align-items: center;
  }
  .page--eur .box-row .cur { font-weight: 800; color: var(--p); }
  .page--eur .box-row .bal {
    font-size: 10px;
    font-weight: 800;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .page--eur .note { font-size: 7.5px; padding: 3px 6px; }
  .page--eur .sum-table { font-size: 9px; }
  .page--eur .sum-table td { padding: 3px 6px; }
  .page--eur .signs {
    margin-top: 5px;
    gap: 8px;
  }
  .page--eur .sign-h { font-size: 10px; padding: 4px; }
  .page--eur .sign-b {
    min-height: 24px;
    padding: 5px 4px;
    font-size: 11px;
  }

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
export function buildDailyCashPrintHtml(packages) {
  const list = Array.isArray(packages) ? packages : [];
  const landscape =
    list.length > 0 && list.every((pkg) => Boolean(pkg?.withEur));

  const pagesHtml = list
    .map((pkg) => {
      const pageCount = pkg.pages.length;
      const themeStyle = pageThemeStyle(pkg.themeCss);
      const withEur = Boolean(pkg.withEur);
      const rowsPerPage = withEur
        ? PRINT_ROWS_PER_PAGE_EUR
        : PRINT_ROWS_PER_PAGE;
      return pkg.pages
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
          // دائماً نملأ الصفحة بنفس عدد الصفوف؛ الزيادة تفتح صفحة جديدة
          const padTo = rowsPerPage;
          return `
          <section class="${pageClass}" style="${themeStyle}">
            ${renderMeta(pkg, {
              continuation: !isFirst,
              pageNo,
              pageCount,
            })}
            <div class="table-shell">
            ${renderTableHeader(withEur)}
            <tbody>
              ${renderDataRows(chunkRows, {
                padTo,
                withEur,
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

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>التقرير اليومي للصندوق</title>
  <style>${printCss({ landscape })}</style>
</head>
<body>
${pagesHtml || `<section class="page"><p style="text-align:center">لا توجد بيانات</p></section>`}
<script>
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
</script>
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
export async function openDailyCashPrintWindow(packages, existingWin = null) {
  const withLogos = await attachPrintLogos(packages);
  const html = buildDailyCashPrintHtml(withLogos);
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
