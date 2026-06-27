import { slashPositionBetween } from "@/lib/cheques/dateUtils";

export const SLASH_LAYOUT_KEYS = ["slash_0", "slash_1"];
export const DATE_PART_KEYS = ["dateDay", "dateMonth", "dateYear"];
export const DATE_GROUP_KEY = "dateGroup";
const DATE_ORDER = DATE_PART_KEYS;

export const SLASH_LAYOUT_LABELS = {
  slash_0: "فاصل / (بعد اليوم)",
  slash_1: "فاصل / (بعد الشهر)",
};

export function isSlashLayoutKey(key) {
  return SLASH_LAYOUT_KEYS.includes(String(key || ""));
}

export function isDatePartKey(key) {
  return DATE_PART_KEYS.includes(String(key || ""));
}

export function isDateLayoutKey(key) {
  return isDatePartKey(key) || isSlashLayoutKey(key);
}

export function isDateGroupSelectionKey(key) {
  return String(key || "") === DATE_GROUP_KEY;
}

/** مفاتيح التاريخ في التخطيط — أرقام + فواصل */
export function getDateLayoutKeys(dateShowSlashes = true) {
  if (!dateShowSlashes) return [...DATE_PART_KEYS];
  return [...DATE_PART_KEYS, ...SLASH_LAYOUT_KEYS];
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** إزالة تكرار الحقول بنفس المفتاح — يُبقي آخر تعريف */
export function dedupeLayoutFieldsByKey(fields = []) {
  const byKey = new Map();
  for (const raw of fields || []) {
    const key = String(raw?.key || "").trim();
    if (!key) continue;
    const prev = byKey.get(key);
    byKey.set(key, prev ? { ...prev, ...raw } : { ...raw });
  }
  return Array.from(byKey.values());
}

function withSlashFieldMeta(f) {
  if (!isSlashLayoutKey(f?.key)) return f;
  return {
    ...f,
    type: "dateSlash",
    layoutOnly: true,
  };
}

/** تحريك التاريخ ككتلة واحدة — يوم/شهر/سنة والفواصل معاً */
export function applyDateGroupPositionChange(
  fields,
  anchorKey,
  partial,
  dateShowSlashes = true
) {
  const keys = getDateLayoutKeys(dateShowSlashes);
  const anchor = (fields || []).find((f) => f.key === anchorKey);
  if (!anchor || !keys.includes(anchorKey)) return fields || [];

  const deltaLeft = partial.left != null ? partial.left - anchor.left : 0;
  const deltaTop = partial.top != null ? partial.top - anchor.top : 0;
  const hasPosChange = partial.left != null || partial.top != null;

  if (!hasPosChange) {
    return (fields || []).map((f) =>
      keys.includes(f.key) && f.type === "datePart" ? { ...f, ...partial } : f
    );
  }

  return (fields || []).map((f) => {
    if (!keys.includes(f.key)) return f;
    return {
      ...f,
      ...(partial.left != null ? { left: round2(f.left + deltaLeft) } : {}),
      ...(partial.top != null ? { top: round2(f.top + deltaTop) } : {}),
    };
  });
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
  const deduped = dedupeLayoutFieldsByKey(fields);
  const base = deduped.filter((f) => !isSlashLayoutKey(f.key));
  const saved = Object.fromEntries(
    deduped.filter((f) => isSlashLayoutKey(f.key)).map((f) => [f.key, withSlashFieldMeta(f)])
  );
  const defaults = buildDefaultSlashFields(base);
  const slashes = defaults.map((d) => withSlashFieldMeta({ ...d, ...(saved[d.key] || {}) }));
  return dedupeLayoutFieldsByKey([...base, ...slashes].map(withSlashFieldMeta));
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
  const list = dedupeLayoutFieldsByKey(fields);
  const canvas = list.filter(
    (f) => f?.key && !f.sidebarOnly && !f.layoutOnly && !isSlashLayoutKey(f.key)
  );
  if (!dateShowSlashes) return canvas;
  const slashes = list.filter((f) => isSlashLayoutKey(f.key)).map(withSlashFieldMeta);
  return [...canvas, ...dedupeLayoutFieldsByKey(slashes)];
}

export function dateSpacingLayoutKeys(dateShowSlashes = true) {
  if (!dateShowSlashes) return DATE_ORDER;
  return [...DATE_ORDER.slice(0, 1), "slash_0", "dateMonth", "slash_1", "dateYear"];
}

export function spacingLayoutLabel(key, fields) {
  if (SLASH_LAYOUT_LABELS[key]) return SLASH_LAYOUT_LABELS[key];
  return fields?.find((f) => f.key === key)?.label || key;
}
