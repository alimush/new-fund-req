/** ضبط خط المبلغ كتابة عند الطباعة — أغمق وأنزل كلما صغر */
export function shrinkAdjustments(chosen, max, min) {
  if (max <= min) {
    return { fontWeight: 700, paddingTop: 0, color: "#0f172a" };
  }
  const t = Math.min(1, Math.max(0, (max - chosen) / (max - min)));
  return {
    fontWeight: Math.round(700 + t * 200),
    paddingTop: Math.round(t * 1.2 * 10) / 10,
    color: t > 0.15 ? "#020617" : "#0f172a",
  };
}
