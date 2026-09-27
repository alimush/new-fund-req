/**
 * Per-company Excel form theme colors for the daily cash report.
 * Al-Ghadeer (+ related sub-funds) keep the approved palette unchanged.
 * Other companies derive accents from their Excel form logo assets.
 */

/** Approved Al-Ghadeer theme — do not alter. */
export const GHADEER_EXCEL_THEME = Object.freeze({
  primary: "FF00487C",
  primaryDark: "FF00365C",
  primaryLight: "FF72B0DC",
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
  textOnPrimary: "FFFFFFFF",
});

/**
 * Company/fund keys that must retain the approved Al-Ghadeer Excel colors.
 */
export const AL_GHADEER_THEME_KEYS = new Set([
  "Al-Ghadeer",
  "Ghadeer-Karbala",
  "Ghadeer-Investments",
  "Ghadeer-Karbala-Sub",
  "Ghadeer-Najaf-Sub",
  "010",
]);

/**
 * Primary brand colors sampled from each company's Excel logo asset
 * (lib/voucher/assets/*.png referenced by companyFormConfig.json).
 *
 * Badur-Baghdad / Safebox / Elite → image4.png teal
 * Tiba-Al-najaf → image5.png teal accent
 * Badur-Al-Najaf → image2.png navy
 */
const LOGO_PRIMARY_ARGB = Object.freeze({
  "Badur-Baghdad": "FF087E8F",
  "Badur-Baghdad-Safebox-Istishar": "FF087E8F",
  "Badur-Baghdad-Elite": "FF087E8F",
  "Tiba-Al-najaf": "FF00A098",
  "Badur-Al-Najaf": "FF191A4E",
});

/** Logo file used for theme source (matches companyFormConfig). */
export const COMPANY_THEME_LOGO = Object.freeze({
  "Al-Ghadeer": "image3.png",
  "Badur-Baghdad": "image4.png",
  "Badur-Baghdad-Safebox-Istishar": "image4.png",
  "Badur-Baghdad-Elite": "image4.png",
  "Tiba-Al-najaf": "image5.png",
  "Ghadeer-Karbala": "image1.png",
  "Badur-Al-Najaf": "image2.png",
  "Ghadeer-Investments": "image3.png",
  "Ghadeer-Karbala-Sub": "image1.png",
  "Ghadeer-Najaf-Sub": "image3.png",
  "010": "image3.png",
});

function parseArgb(argb) {
  const s = String(argb || "").replace(/^#/, "").toUpperCase();
  const hex = s.length === 8 ? s.slice(2) : s;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function toArgb(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "FF" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
      .join("")
  );
}

/** Blend color toward white (t=0 → color, t=1 → white). */
function mixWhite(argb, t) {
  const { r, g, b } = parseArgb(argb);
  return toArgb(
    r + (255 - r) * t,
    g + (255 - g) * t,
    b + (255 - b) * t
  );
}

/** Blend color toward black. */
function mixBlack(argb, t) {
  const { r, g, b } = parseArgb(argb);
  return toArgb(r * (1 - t), g * (1 - t), b * (1 - t));
}

function relativeLuminance(argb) {
  const { r, g, b } = parseArgb(argb);
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Build a full theme palette from a logo primary, mirroring the Ghadeer
 * shade structure (primary + light fills + border).
 */
export function deriveExcelThemeFromPrimary(primaryArgb) {
  const primary = String(primaryArgb).toUpperCase();
  const primaryDark = mixBlack(primary, 0.22);
  const primaryLight = mixWhite(primary, 0.42);
  const textOnPrimary =
    relativeLuminance(primary) > 0.45 ? "FF111827" : "FFFFFFFF";

  return Object.freeze({
    primary,
    primaryDark,
    primaryLight,
    headerBg: mixWhite(primary, 0.88),
    headerBgDeep: mixWhite(primary, 0.72),
    white: "FFFFFFFF",
    soft: mixWhite(primary, 0.9),
    text: "FF000000",
    muted: "FF222222",
    // Semantic receipt/payment stay shared (not brand-dependent).
    receipt: GHADEER_EXCEL_THEME.receipt,
    payment: GHADEER_EXCEL_THEME.payment,
    boxBg: mixWhite(primary, 0.92),
    noteBg: mixWhite(primary, 0.91),
    border: primaryLight,
    textOnPrimary,
  });
}

const THEME_CACHE = new Map();

export function isAlGhadeerThemeKey(companyKey) {
  return AL_GHADEER_THEME_KEYS.has(String(companyKey || ""));
}

/**
 * Resolve Excel theme for a company/fund key.
 * Al-Ghadeer family → approved palette.
 * Others → derived from that company's logo primary.
 */
export function getCompanyExcelTheme(companyKey) {
  const key = String(companyKey || "Al-Ghadeer");
  if (THEME_CACHE.has(key)) return THEME_CACHE.get(key);

  let theme;
  if (isAlGhadeerThemeKey(key)) {
    theme = GHADEER_EXCEL_THEME;
  } else if (LOGO_PRIMARY_ARGB[key]) {
    theme = deriveExcelThemeFromPrimary(LOGO_PRIMARY_ARGB[key]);
  } else {
    theme = GHADEER_EXCEL_THEME;
  }

  THEME_CACHE.set(key, theme);
  return theme;
}

/** Compact theme summary for verification reports. */
export function describeCompanyExcelTheme(companyKey) {
  const key = String(companyKey || "Al-Ghadeer");
  const theme = getCompanyExcelTheme(key);
  const unchanged = isAlGhadeerThemeKey(key);
  return {
    companyKey: key,
    logoAsset: COMPANY_THEME_LOGO[key] || null,
    primary: theme.primary,
    primaryLight: theme.primaryLight,
    headerBg: theme.headerBg,
    border: theme.border,
    alGhadeerUnchanged: unchanged,
    changed: !unchanged,
  };
}

export default {
  GHADEER_EXCEL_THEME,
  AL_GHADEER_THEME_KEYS,
  COMPANY_THEME_LOGO,
  getCompanyExcelTheme,
  deriveExcelThemeFromPrimary,
  isAlGhadeerThemeKey,
  describeCompanyExcelTheme,
};
