/** تنسيق مبلغ بالفواصل أثناء الكتابة (مثال: 1,500,000) */
export function formatMoneyInput(value) {
  const numeric = String(value ?? "").replace(/[^\d]/g, "");
  if (!numeric) return "";
  const n = Number(numeric);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US").format(n);
}

export function parseMoneyNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** نسبة مئوية من المبلغ إلى المجموع الكلي (مثال: 25%) */
export function formatPayPercent(amount, total) {
  const rowTotal = parseMoneyNumber(amount);
  const grand = Number(total) || 0;
  if (!rowTotal || grand <= 0) return "";
  const pct = (rowTotal / grand) * 100;
  const rounded = Math.round(pct * 100) / 100;
  const text =
    rounded % 1 === 0
      ? String(Math.round(rounded))
      : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${text}%`;
}
