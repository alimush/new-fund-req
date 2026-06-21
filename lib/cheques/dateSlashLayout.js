import { slashPositionBetween } from "@/lib/cheques/dateUtils";

export const SLASH_LAYOUT_KEYS = ["slash_0", "slash_1"];
const DATE_ORDER = ["dateDay", "dateMonth", "dateYear"];

export const SLASH_LAYOUT_LABELS = {
  slash_0: "فاصل / (بعد اليوم)",
  slash_1: "فاصل / (بعد الشهر)",
};

export function isSlashLayoutKey(key) {
  return SLASH_LAYOUT_KEYS.includes(String(key || ""));
}

export function buildDefaultSlashFields(fields) {
  const byKey = Object.fromEntries((fields || []).map((f) => [f.key, f]));
  const slashes = [];
  for (let i = 0; i < DATE_ORDER.length - 1; i++) {
    const a = byKey[DATE_ORDER[i]];
    const b = byKey[DATE_ORDER[i + 1]];
    const pos = slashPositionBetween(a, b);
    if (!pos) continue;
    slashes.push({
      key: `slash_${i}`,
      label: SLASH_LAYOUT_LABELS[`slash_${i}`] || `/${i + 1}`,
      type: "dateSlash",
      layoutOnly: true,
      top: pos.top,
      left: pos.left,
      width: pos.width,
      height: pos.height,
      fontSize: byKey.dateDay?.fontSize ?? 14,
      fontWeight: byKey.dateDay?.fontWeight ?? 800,
    });
  }
  return slashes;
}

/** يضمن وجود slash_0 و slash_1 في قائمة الحقول مع مواضع افتراضية */
export function ensureSlashLayoutFields(fields) {
  const base = (fields || []).filter((f) => !isSlashLayoutKey(f.key));
  const saved = Object.fromEntries(
    (fields || []).filter((f) => isSlashLayoutKey(f.key)).map((f) => [f.key, f])
  );
  const defaults = buildDefaultSlashFields(base);
  const slashes = defaults.map((d) => ({ ...d, ...(saved[d.key] || {}) }));
  return [...base, ...slashes];
}

/** مواضع / للعرض والطباعة — من التخطيط المحفوظ أو محسوبة من أرقام التاريخ */
export function resolveSlashPositions(fields, dateShowSlashes = true) {
  if (!dateShowSlashes) return [];
  const list = ensureSlashLayoutFields(fields);
  const byKey = Object.fromEntries(list.map((f) => [f.key, f]));
  const out = [];
  for (let i = 0; i < DATE_ORDER.length - 1; i++) {
    const slashKey = `slash_${i}`;
    const saved = byKey[slashKey];
    if (saved) {
      out.push({
        id: `slash-${i}`,
        key: slashKey,
        top: saved.top,
        left: saved.left,
        width: saved.width,
        height: saved.height,
      });
      continue;
    }
    const a = byKey[DATE_ORDER[i]];
    const b = byKey[DATE_ORDER[i + 1]];
    const pos = slashPositionBetween(a, b);
    if (pos) out.push({ id: `slash-${i}`, key: slashKey, ...pos });
  }
  return out;
}

export function layoutEditableFields(fields, dateShowSlashes = true) {
  const list = fields || [];
  const canvas = list.filter((f) => f?.key && !f.sidebarOnly && !f.layoutOnly);
  if (!dateShowSlashes) return canvas;
  return [...canvas, ...list.filter((f) => isSlashLayoutKey(f.key))];
}

export function dateSpacingLayoutKeys(dateShowSlashes = true) {
  if (!dateShowSlashes) return DATE_ORDER;
  return [...DATE_ORDER.slice(0, 1), "slash_0", "dateMonth", "slash_1", "dateYear"];
}

export function spacingLayoutLabel(key, fields) {
  if (SLASH_LAYOUT_LABELS[key]) return SLASH_LAYOUT_LABELS[key];
  return fields?.find((f) => f.key === key)?.label || key;
}
