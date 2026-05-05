/**
 * Styling constants and helpers for the Voucher system.
 */

export const DEFAULT_GLOBAL_TEXT_STYLE = {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
  };
  
  export const DEFAULT_FIELD_STYLES = {
    amount: { fontSize: 16, fontWeight: 800, color: "#111827" },
    words: { fontSize: 16, fontWeight: 700, color: "#111827" },
    desc: { fontSize: 16, fontWeight: 600, color: "#111827" },
    bank: { fontSize: 16, fontWeight: 700, color: "#111827" },
    fxRate: { fontSize: 16, fontWeight: 800, color: "#111827" },
    receivedBy: { fontSize: 16, fontWeight: 600, color: "#111827" },
    beneficiary: { fontSize: 16, fontWeight: 700, color: "#111827" },
    notes: { fontSize: 16, fontWeight: 600, color: "#111827" },
    chequeNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
    nationalId: { fontSize: 16, fontWeight: 700, color: "#111827" },
    phone: { fontSize: 16, fontWeight: 700, color: "#111827" },
    sanadNo: { fontSize: 16, fontWeight: 700, color: "#111827" },
    date: { fontSize: 16, fontWeight: 800, color: "#111827" },
    voucherNo: { fontSize: 11, fontWeight: 800, color: "#111827" },
    currencyMark: { fontSize: 16, fontWeight: 800, color: "#111827" },
  };
  
  export function clampFontSize(value, fallback = 16) {
    const n = String(value ?? "").replace(/[^\d]/g, "");
    if (!n) return Number(fallback);
    return Math.max(8, Math.min(72, Number(n)));
  }
  
  export function clampFontWeight(value, fallback = 700) {
    const n = String(value ?? "").replace(/[^\d]/g, "");
    if (!n) return Number(fallback);
    const num = Number(n);
    const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    return steps.reduce((prev, curr) =>
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
  }
  
  export function normalizeHexColor(value, fallback = "#111827") {
    const s = String(value || "").trim();
    return /^#([0-9a-fA-F]{6})$/.test(s) ? s : fallback;
  }
  
  export function normalizeGlobalTextStyle(input = {}) {
    return {
      fontSize: clampFontSize(input?.fontSize, DEFAULT_GLOBAL_TEXT_STYLE.fontSize),
      fontWeight: clampFontWeight(input?.fontWeight, DEFAULT_GLOBAL_TEXT_STYLE.fontWeight),
      color: normalizeHexColor(input?.color, DEFAULT_GLOBAL_TEXT_STYLE.color),
    };
  }
  
  export function normalizeFieldStyles(input = {}, fallbackGlobal = DEFAULT_GLOBAL_TEXT_STYLE) {
    const out = {};
    for (const key of Object.keys(DEFAULT_FIELD_STYLES)) {
      const src = input?.[key] || {};
      const base = DEFAULT_FIELD_STYLES[key];
      out[key] = {
        fontSize: clampFontSize(src?.fontSize, base.fontSize ?? fallbackGlobal.fontSize),
        fontWeight: clampFontWeight(src?.fontWeight, base.fontWeight ?? fallbackGlobal.fontWeight),
        color: normalizeHexColor(src?.color, base.color ?? fallbackGlobal.color),
      };
    }
    return out;
  }
