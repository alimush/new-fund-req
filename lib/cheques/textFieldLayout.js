/** موضع/حجم حقول هذا الصك فقط — لا يغيّر التخطيط الافتراضي المحفوظ */

export function layoutFromField(field) {
  if (!field) return null;
  return {
    top: Number(field.top) || 0,
    left: Number(field.left) || 0,
    width: Number(field.width) || 10,
    height: Number(field.height) || 8,
    fontSize: Number(field.fontSize) || 14,
    fontWeight: Number(field.fontWeight) || 700,
  };
}

export function getDefaultFieldLayout(fields, key) {
  const f = (fields || []).find((x) => x.key === key);
  return layoutFromField(f);
}

export function clampTextLayout(partial, prev) {
  const p = { ...prev, ...partial };
  return {
    top: clamp(p.top, 0, 95),
    left: clamp(p.left, 0, 95),
    width: clamp(p.width, 4, 98),
    height: clamp(p.height, 3, 50),
    fontSize: clamp(p.fontSize, 8, 48),
    fontWeight: clamp(p.fontWeight, 400, 900),
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Number(n) || 0));
}

export function fieldWithChequeLayout(field, layout) {
  if (!field || !layout) return field;
  return { ...field, ...layout };
}

/** موضع/حجم فقط — لا يستبدل fontSize/fontWeight (خط القالب يبقى من الحقل) */
export function fieldWithChequePosition(field, layout) {
  if (!field || !layout) return field;
  return {
    ...field,
    top: layout.top ?? field.top,
    left: layout.left ?? field.left,
    width: layout.width ?? field.width,
    height: layout.height ?? field.height,
  };
}

/** @deprecated استخدم fieldWithChequeLayout */
export function fieldWithTextLayout(field, textLayout) {
  if (!field || field.key !== "text" || !textLayout) return field;
  return fieldWithChequeLayout(field, textLayout);
}

export const AMOUNT_WORDS_KEY = "amountWords";
export const AMOUNT_WORDS_LINE2_KEY = "amountWordsLine2";

/** حقول لها موضع خاص لكل صك في وضع الإدخال */
export const PER_CHEQUE_LAYOUT_KEYS = [
  "text",
  AMOUNT_WORDS_KEY,
  AMOUNT_WORDS_LINE2_KEY,
];

export function isPerChequeLayoutKey(key) {
  return PER_CHEQUE_LAYOUT_KEYS.includes(key);
}
