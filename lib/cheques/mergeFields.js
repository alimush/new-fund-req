/** دمج حقول القالب الافتراضي مع تخطيط محفوظ — لكل templateKey على حدة */

import { getTemplateFieldKeys, isCanvasField } from "@/lib/cheques/templates";
import {
  SLASH_LAYOUT_KEYS,
  buildDefaultSlashFields,
  ensureSlashLayoutFields,
} from "@/lib/cheques/dateSlashLayout";

const DEFAULT_FONT = { fontSize: 14, fontWeight: 700 };

export function normalizeLayoutField(f) {
  if (!f?.key) return null;
  return {
    key: f.key,
    top: round2(f.top ?? 0),
    left: round2(f.left ?? 0),
    width: round2(f.width ?? 10),
    height: round2(f.height ?? 5),
    fontSize: clamp(Number(f.fontSize) || DEFAULT_FONT.fontSize, 8, 48),
    fontWeight: clamp(Number(f.fontWeight) || DEFAULT_FONT.fontWeight, 400, 900),
  };
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** افتراضيات X/Y والخط من تعريف هذا القالب فقط */
export function fieldsFromTemplate(template) {
  return ensureSlashLayoutFields(
    (template?.fields || []).map((f) => ({
      ...f,
      ...DEFAULT_FONT,
      top: f.top ?? 0,
      left: f.left ?? 0,
      width: f.width ?? 10,
      height: f.height ?? 5,
      fontSize: f.fontSize ?? DEFAULT_FONT.fontSize,
      fontWeight: f.fontWeight ?? DEFAULT_FONT.fontWeight,
    }))
  );
}

/** مفاتيح التخطيط — حقول القالب + فواصل التاريخ */
function getLayoutFieldKeys(template) {
  const keys = getTemplateFieldKeys(template);
  for (const key of SLASH_LAYOUT_KEYS) keys.add(key);
  return keys;
}

/** يقبل فقط مفاتيح حقول هذا القالب — لا دمج من صك آخر */
export function filterLayoutForTemplate(template, layoutFields) {
  const allowed = getLayoutFieldKeys(template);
  const list = Array.isArray(layoutFields)
    ? layoutFields
    : Object.entries(layoutFields || {}).map(([key, v]) => ({ key, ...v }));

  return list
    .filter((x) => x?.key && allowed.has(x.key))
    .map((x) => normalizeLayoutField(x))
    .filter(Boolean);
}

export function mergeTemplateFields(template, layoutFields) {
  const base = fieldsFromTemplate(template);
  const scoped = filterLayoutForTemplate(template, layoutFields);
  if (!scoped.length) return base;

  const byKey = Object.fromEntries(scoped.map((x) => [x.key, x]));

  return ensureSlashLayoutFields(
    base.map((f) => {
      const o = byKey[f.key];
      if (!o) return f;
      return {
        ...f,
        top: o.top ?? f.top,
        left: o.left ?? f.left,
        width: o.width ?? f.width,
        height: o.height ?? f.height,
        fontSize: o.fontSize ?? f.fontSize,
        fontWeight: o.fontWeight ?? f.fontWeight,
      };
    })
  );
}

/** حمولة الحفظ — مرتبطة بقالب واحد */
export function layoutPayloadFromFields(fields, template) {
  const allowed = template ? getLayoutFieldKeys(template) : null;
  const withSlashes = ensureSlashLayoutFields(fields);
  const fromState = (withSlashes || [])
    .filter((f) => f?.key && (!allowed || allowed.has(f.key)))
    .map((f) => normalizeLayoutField(f))
    .filter(Boolean);

  const byKey = Object.fromEntries(fromState.map((f) => [f.key, f]));

  if (template?.fields) {
    for (const f of template.fields) {
      if (!isCanvasField(f)) continue;
      if (!byKey[f.key]) {
        const n = normalizeLayoutField(f);
        if (n) byKey[f.key] = n;
      }
    }
    for (const slash of buildDefaultSlashFields(Object.values(byKey))) {
      if (!byKey[slash.key]) {
        byKey[slash.key] = normalizeLayoutField(slash);
      }
    }
  }

  return Object.values(byKey);
}

export function exportLayoutForTemplatesFile(
  templateKey,
  fields,
  template,
  dateShowSlashes = true
) {
  return JSON.stringify(
    {
      templateKey,
      note: "تخطيط خاص بهذا الصك فقط — لا تنسخه لقالب آخر",
      dateShowSlashes,
      fields: layoutPayloadFromFields(fields, template),
    },
    null,
    2
  );
}
