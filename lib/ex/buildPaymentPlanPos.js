/** يحوّل حقول التخطيط المحفوظة إلى بنية POS للطباعة */

export function fieldMapFromLayout(fields = []) {
  return Object.fromEntries((fields || []).map((f) => [f.key, f]));
}

export function buildPaymentPlanPos(fields = [], tableRowHeight = 2.75) {
  const m = fieldMapFromLayout(fields);
  const pick = (key) => {
    const f = m[key] || {};
    return {
      top: f.top ?? 0,
      left: f.left ?? 0,
      width: f.width ?? 10,
      height: f.height ?? 3,
      fontSize: f.fontSize ?? 14,
      fontWeight: f.fontWeight ?? 700,
      textAlign: f.textAlign || "center",
    };
  };

  const tableStart = m.tableStartTop?.top ?? 27.5;
  const rowH = Number(tableRowHeight) || 2.75;

  return {
    salesEmp: pick("salesEmp"),
    date: pick("date"),
    customer: pick("customer"),
    unitNo: pick("unitNo"),
    discount: pick("discount"),
    total: pick("total"),
    table: {
      startTop: tableStart,
      rowH,
      colPayName: pick("colPayName"),
      colDate: pick("colDate"),
      colAmount: pick("colAmount"),
      colPercent: pick("colPercent"),
    },
  };
}

export function rowTopForIndex(pos, index) {
  return pos.table.startTop + index * pos.table.rowH;
}
