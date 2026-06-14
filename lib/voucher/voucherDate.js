/**
 * Voucher date helpers — single source of truth for date on the printed voucher.
 * Priority: vDateYY/MM/DD → dateParts → voucherDate → createdAt
 */

function pad2(v) {
  const s = String(v ?? "").replace(/[^\d]/g, "").slice(0, 2);
  return s ? s.padStart(2, "0") : "";
}

function fullYearFromShort(yy) {
  const n = Number(String(yy || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return null;
  return n >= 50 ? 1900 + n : 2000 + n;
}

/**
 * Build a UTC calendar Date from voucher day/month/year parts (timezone-safe).
 */
export function buildVoucherDateFromParts(yy, mm, dd) {
  const y = pad2(yy);
  const m = pad2(mm);
  const d = pad2(dd);
  if (!y || !m || !d) return null;

  const fullYear = fullYearFromShort(y);
  if (!fullYear) return null;

  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const dt = new Date(Date.UTC(fullYear, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== fullYear || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
}

/**
 * Month/day/year from voucherDate / createdAt (UTC — matches MongoDB report filter).
 */
function getLegacyVoucherDateParts(doc) {
  if (!doc) return { yy: "", mm: "", dd: "" };

  const raw = doc.voucherDate || doc.createdAt;
  if (!raw) return { yy: "", mm: "", dd: "" };

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { yy: "", mm: "", dd: "" };

  return {
    yy: String(d.getUTCFullYear()).slice(-2),
    mm: String(d.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(d.getUTCDate()).padStart(2, "0"),
  };
}

/** Single part from dateParts / vDate* if stored. */
function getStoredDatePart(doc, key) {
  if (!doc) return "";
  const sources = {
    yy: doc.vDateYY ?? doc.dateParts?.yy,
    mm: doc.vDateMM ?? doc.dateParts?.mm,
    dd: doc.vDateDD ?? doc.dateParts?.dd,
  };
  const raw = String(sources[key] ?? "").trim();
  return raw ? pad2(raw) : "";
}

function hasAnyStoredDatePart(doc) {
  return Boolean(
    getStoredDatePart(doc, "yy") ||
      getStoredDatePart(doc, "mm") ||
      getStoredDatePart(doc, "dd")
  );
}

/**
 * Reports date: each of dd/mm/yy from dateParts if set, else voucherDate/createdAt.
 * If nothing stored in dateParts → full legacy getVoucherDateParts.
 */
export function getReportVoucherDateParts(doc) {
  if (!hasAnyStoredDatePart(doc)) {
    return getVoucherDateParts(doc);
  }

  const legacy = getLegacyVoucherDateParts(doc);
  return {
    yy: getStoredDatePart(doc, "yy") || legacy.yy,
    mm: getStoredDatePart(doc, "mm") || legacy.mm,
    dd: getStoredDatePart(doc, "dd") || legacy.dd,
  };
}

/**
 * Read yy/mm/dd parts from a voucher document (same logic as voucher view page).
 */
export function getVoucherDateParts(doc) {
  if (!doc) return { yy: "", mm: "", dd: "" };

  const yy = String(doc.vDateYY || doc.dateParts?.yy || "").trim();
  const mm = String(doc.vDateMM || doc.dateParts?.mm || "").trim();
  const dd = String(doc.vDateDD || doc.dateParts?.dd || "").trim();

  if (yy && mm && dd) {
    return { yy: pad2(yy), mm: pad2(mm), dd: pad2(dd) };
  }

  const raw = doc.voucherDate || doc.createdAt;
  if (!raw) return { yy: "", mm: "", dd: "" };

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { yy: "", mm: "", dd: "" };

  return {
    yy: String(d.getUTCFullYear()).slice(-2),
    mm: String(d.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(d.getUTCDate()).padStart(2, "0"),
  };
}

/**
 * Effective date for reports sort/filter — same rules as formatVoucherDateDisplay.
 */
export function getVoucherEffectiveDate(doc) {
  const { yy, mm, dd } = getReportVoucherDateParts(doc);
  const fromParts = buildVoucherDateFromParts(yy, mm, dd);
  if (fromParts) return fromParts;

  const raw = doc?.voucherDate || doc?.createdAt;
  if (!raw) return null;

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Reports: dd/mm/yy each from dateParts when set, otherwise voucherDate/createdAt.
 */
export function formatVoucherDateDisplay(doc) {
  const { yy, mm, dd } = getReportVoucherDateParts(doc);
  if (yy && mm && dd) return `${dd}/${mm}/${yy}`;
  return "-";
}

export function parseFilterDayStart(isoDay) {
  if (!isoDay) return null;
  const dt = new Date(`${isoDay}T00:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseFilterDayEnd(isoDay) {
  if (!isoDay) return null;
  const dt = new Date(`${isoDay}T23:59:59.999Z`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function padDatePartExpr(fieldExpr) {
  return {
    $cond: [
      { $lt: [{ $strLenCP: { $toString: fieldExpr } }, 2] },
      { $concat: ["0", { $toString: fieldExpr }] },
      { $toString: fieldExpr },
    ],
  };
}

function dateFromYymmddParts(yyExpr, mmExpr, ddExpr) {
  return {
    $dateFromString: {
      dateString: {
        $concat: [
          {
            $cond: [
              { $gte: [{ $toInt: { $substrCP: [{ $toString: yyExpr }, 0, 2] } }, 50] },
              "19",
              "20",
            ],
          },
          { $substrCP: [{ $toString: yyExpr }, 0, 2] },
          "-",
          padDatePartExpr(mmExpr),
          "-",
          padDatePartExpr(ddExpr),
        ],
      },
      onError: null,
    },
  };
}

/**
 * MongoDB $addFields: _effDate matches getReportVoucherDateParts.
 */
export function voucherEffectiveDateAddFields() {
  const legacyDate = { $ifNull: ["$voucherDate", "$createdAt"] };

  const storedYy = { $ifNull: ["$vDateYY", { $ifNull: ["$dateParts.yy", ""] }] };
  const storedMm = { $ifNull: ["$vDateMM", { $ifNull: ["$dateParts.mm", ""] }] };
  const storedDd = { $ifNull: ["$vDateDD", { $ifNull: ["$dateParts.dd", ""] }] };

  const hasAnyStored = {
    $or: [
      { $gt: [{ $strLenCP: { $toString: storedYy } }, 0] },
      { $gt: [{ $strLenCP: { $toString: storedMm } }, 0] },
      { $gt: [{ $strLenCP: { $toString: storedDd } }, 0] },
    ],
  };

  const legacyYy = {
    $substrCP: [
      { $dateToString: { format: "%Y", date: legacyDate, timezone: "UTC", onNull: "0000" } },
      2,
      2,
    ],
  };
  const legacyMm = {
    $dateToString: { format: "%m", date: legacyDate, timezone: "UTC", onNull: "" },
  };
  const legacyDd = {
    $dateToString: { format: "%d", date: legacyDate, timezone: "UTC", onNull: "" },
  };

  const mergedYy = {
    $cond: [
      { $gt: [{ $strLenCP: { $toString: storedYy } }, 0] },
      storedYy,
      legacyYy,
    ],
  };
  const mergedMm = {
    $cond: [
      { $gt: [{ $strLenCP: { $toString: storedMm } }, 0] },
      storedMm,
      legacyMm,
    ],
  };
  const mergedDd = {
    $cond: [
      { $gt: [{ $strLenCP: { $toString: storedDd } }, 0] },
      storedDd,
      legacyDd,
    ],
  };

  const mergedEffDate = {
    $let: {
      vars: {
        built: dateFromYymmddParts(mergedYy, mergedMm, mergedDd),
      },
      in: { $ifNull: ["$$built", legacyDate] },
    },
  };

  return {
    $addFields: {
      _effDate: {
        $cond: {
          if: hasAnyStored,
          then: mergedEffDate,
          else: legacyDate,
        },
      },
    },
  };
}
