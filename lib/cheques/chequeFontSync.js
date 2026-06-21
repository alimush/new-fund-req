import {
  DATE_GROUP_KEY,
  SLASH_GROUP_KEY,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  normalizePrintCalib,
  printFieldFontCalibKeys,
} from "@/lib/cheques/printCalib";
import {
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
} from "@/lib/cheques/textFieldLayout";

const TEXT_KEY = "text";

function clampWeight(n, fallback = 700) {
  const v = Math.round((Number(n) || fallback) / 100) * 100;
  return Math.min(FONT_WEIGHT_MAX, Math.max(FONT_WEIGHT_MIN, v));
}

function pickLayoutFont(layout, field) {
  const out = {};
  if (layout?.fontSize != null) out.fontSize = layout.fontSize;
  if (layout?.fontWeight != null) out.fontWeight = layout.fontWeight;
  if (field?.fontSize != null && out.fontSize == null) out.fontSize = field.fontSize;
  if (field?.fontWeight != null && out.fontWeight == null) out.fontWeight = field.fontWeight;
  return out;
}

function resolveFieldForPrintKey(key, fieldByKey, layouts) {
  if (key === DATE_GROUP_KEY || key === SLASH_GROUP_KEY) {
    return fieldByKey.dateDay || fieldByKey.dateMonth || fieldByKey.dateYear;
  }
  if (key === TEXT_KEY) {
    const base = fieldByKey[TEXT_KEY];
    if (!base) return null;
    return { ...base, ...pickLayoutFont(layouts.textFieldLayout, base) };
  }
  if (key === AMOUNT_WORDS_KEY) {
    const base = fieldByKey[AMOUNT_WORDS_KEY];
    if (!base) return null;
    return { ...base, ...pickLayoutFont(layouts.amountWordsLayout, base) };
  }
  if (key === AMOUNT_WORDS_LINE2_KEY) {
    const base = fieldByKey[AMOUNT_WORDS_LINE2_KEY];
    if (!base) return null;
    return { ...base, ...pickLayoutFont(layouts.amountWordsLine2Layout, base) };
  }
  return fieldByKey[key] || null;
}

/** سمك الخط الفعلي للحقل — نفس منطق الشاشة */
export function resolveFieldFontWeight(field, fallback = 700) {
  const n = Number(field?.fontWeight);
  if (Number.isFinite(n) && n >= FONT_WEIGHT_MIN) {
    return clampWeight(n, fallback);
  }
  return clampWeight(fallback, fallback);
}

/**
 * يزامن سماكة خط الطباعة مع تخطيط الحقول والشريط السفلي.
 * حجم الخط الأساسي من التخطيط (fieldFontSizeMm + layoutFontScale).
 * مقياس الحقل في ضبط الطباعة (fontSizeScale) والمقياس العام يُحفظان كما ضبطهما المستخدم.
 */
export function syncPrintCalibFontsFromLayout(
  printCalib,
  fields,
  template,
  layouts = {}
) {
  const list = fields?.length ? fields : template?.fields || [];
  const keys = printFieldFontCalibKeys(list, template);
  const fieldByKey = Object.fromEntries(list.map((f) => [f.key, f]));
  const fieldFontStyles = { ...(printCalib?.fieldFontStyles || {}) };

  for (const key of keys) {
    const field = resolveFieldForPrintKey(key, fieldByKey, layouts);
    if (!field) continue;
    const weight = resolveFieldFontWeight(field);
    const existing = fieldFontStyles[key] || {};
    fieldFontStyles[key] = {
      ...existing,
      fontWeight: weight,
    };
  }

  const line1Style = fieldFontStyles[AMOUNT_WORDS_KEY];
  if (line1Style) {
    fieldFontStyles[AMOUNT_WORDS_LINE2_KEY] = {
      ...(fieldFontStyles[AMOUNT_WORDS_LINE2_KEY] || {}),
      fontSizeScale: line1Style.fontSizeScale,
      fontWeight: line1Style.fontWeight,
      color: line1Style.color,
    };
  }

  return normalizePrintCalib(
    {
      ...printCalib,
      fieldFontStyles,
    },
    template,
    list
  );
}
