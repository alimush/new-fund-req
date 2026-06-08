import {
  PAYMENT_PLAN_TEMPLATE,
  getPaymentPlanFieldKeys,
} from "@/lib/ex/paymentPlanTemplate";

const DEFAULT_FONT = { fontSize: 14, fontWeight: 700 };

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

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
    textAlign: f.textAlign || "center",
  };
}

export function fieldsFromPaymentPlanTemplate(template = PAYMENT_PLAN_TEMPLATE) {
  return (template?.fields || []).map((f) => ({
    ...f,
    ...DEFAULT_FONT,
    top: f.top ?? 0,
    left: f.left ?? 0,
    width: f.width ?? 10,
    height: f.height ?? 5,
    fontSize: f.fontSize ?? DEFAULT_FONT.fontSize,
    fontWeight: f.fontWeight ?? DEFAULT_FONT.fontWeight,
    textAlign: f.textAlign || "center",
  }));
}

export function filterLayoutForPaymentPlan(layoutFields) {
  const allowed = getPaymentPlanFieldKeys();
  const list = Array.isArray(layoutFields) ? layoutFields : [];
  return list
    .filter((x) => x?.key && allowed.has(x.key))
    .map((x) => normalizeLayoutField(x))
    .filter(Boolean);
}

export function mergePaymentPlanFields(template, layoutFields) {
  const base = fieldsFromPaymentPlanTemplate(template);
  const scoped = filterLayoutForPaymentPlan(layoutFields);
  if (!scoped.length) return base;

  const byKey = Object.fromEntries(scoped.map((x) => [x.key, x]));
  return base.map((f) => {
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
      textAlign: o.textAlign ?? f.textAlign,
    };
  });
}

export function layoutPayloadFromPaymentPlanFields(fields) {
  const allowed = getPaymentPlanFieldKeys();
  return (fields || [])
    .filter((f) => f?.key && allowed.has(f.key))
    .map((f) => normalizeLayoutField(f))
    .filter(Boolean);
}
