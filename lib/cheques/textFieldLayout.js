/** موضع حقل text لهذا الصك فقط — لا يغيّر التخطيط الافتراضي المحفوظ */

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

export function fieldWithTextLayout(field, textLayout) {
  if (!field || field.key !== "text" || !textLayout) return field;
  return { ...field, ...textLayout };
}
