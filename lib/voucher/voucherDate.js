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
 * Month/year (and fallback day) from voucherDate / createdAt — not dateParts.mm/yy.
 */
function getLegacyVoucherDateParts(doc) {
  if (!doc) return { yy: "", mm: "", dd: "" };

  const raw = doc.voucherDate || doc.createdAt;
  if (!raw) return { yy: "", mm: "", dd: "" };

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { yy: "", mm: "", dd: "" };

  return {
    yy: String(d.getFullYear()).slice(-2),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    dd: String(d.getDate()).padStart(2, "0"),
  };
}

/** Day only from dateParts / vDateDD (reports). */
function getStoredVoucherDay(doc) {
  if (!doc) return "";
  const dd = String(doc.vDateDD ?? doc.dateParts?.dd ?? "").trim();
  return dd ? pad2(dd) : "";
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
    yy: String(d.getFullYear()).slice(-2),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    dd: String(d.getDate()).padStart(2, "0"),
  };
}

/**
 * Effective date for reports sort/filter — same rules as formatVoucherDateDisplay.
 */
export function getVoucherEffectiveDate(doc) {
  const storedDay = getStoredVoucherDay(doc);
  if (storedDay) {
    const { yy, mm } = getLegacyVoucherDateParts(doc);
    const hybrid = buildVoucherDateFromParts(yy, mm, storedDay);
    if (hybrid) return hybrid;
  }

  const parts = getVoucherDateParts(doc);
  const fromParts = buildVoucherDateFromParts(parts.yy, parts.mm, parts.dd);
  if (fromParts) return fromParts;

  const raw = doc?.voucherDate || doc?.createdAt;
  if (!raw) return null;

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Reports: day from dateParts.dd if set; month/year from voucherDate/createdAt.
 * If no day in dateParts → legacy display (full date from parts or voucherDate).
 */
export function formatVoucherDateDisplay(doc) {
  const storedDay = getStoredVoucherDay(doc);
  if (storedDay) {
    const { yy, mm } = getLegacyVoucherDateParts(doc);
    if (yy && mm) return `${storedDay}/${mm}/${yy}`;
    return storedDay;
  }

  const { yy, mm, dd } = getVoucherDateParts(doc);
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
 * MongoDB $addFields: _effDate matches report display (day from dateParts.dd only).
 */
export function voucherEffectiveDateAddFields() {
  const legacyDate = { $ifNull: ["$voucherDate", "$createdAt"] };
  const storedDayRaw = { $ifNull: ["$vDateDD", { $ifNull: ["$dateParts.dd", ""] }] };
  const hasStoredDay = { $gt: [{ $strLenCP: { $toString: storedDayRaw } }, 0] };

  const legacyYear = {
    $dateToString: { format: "%Y", date: legacyDate, timezone: "UTC", onNull: "" },
  };
  const legacyMonth = {
    $dateToString: { format: "%m", date: legacyDate, timezone: "UTC", onNull: "" },
  };

  const hybridEffDate = {
    $dateFromString: {
      dateString: {
        $concat: [legacyYear, "-", legacyMonth, "-", padDatePartExpr(storedDayRaw)],
      },
      onError: legacyDate,
    },
  };

  const legacyElseDate = {
    $let: {
      vars: {
        yy: { $ifNull: ["$vDateYY", { $ifNull: ["$dateParts.yy", ""] }] },
        mm: { $ifNull: ["$vDateMM", { $ifNull: ["$dateParts.mm", ""] }] },
        dd: { $ifNull: ["$vDateDD", { $ifNull: ["$dateParts.dd", ""] }] },
      },
      in: {
        $cond: {
          if: {
            $and: [
              { $gt: [{ $strLenCP: { $toString: "$$yy" } }, 0] },
              { $gt: [{ $strLenCP: { $toString: "$$mm" } }, 0] },
              { $gt: [{ $strLenCP: { $toString: "$$dd" } }, 0] },
            ],
          },
          then: dateFromYymmddParts("$$yy", "$$mm", "$$dd"),
          else: legacyDate,
        },
      },
    },
  };

  return {
    $addFields: {
      _effDate: {
        $cond: {
          if: hasStoredDay,
          then: hybridEffDate,
          else: legacyElseDate,
        },
      },
    },
  };
}
