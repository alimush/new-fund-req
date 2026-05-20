export function computeRequestTotalAmount(doc) {
  if (!doc) return 0;
  if (typeof doc.totalAmount === "number" && Number.isFinite(doc.totalAmount)) {
    return doc.totalAmount;
  }
  const items = Array.isArray(doc.items) ? doc.items : [];
  if (items.length) {
    return items.reduce((sum, it) => {
      const q = Number(it?.qty ?? it?.quantity ?? 1);
      const p = Number(it?.price ?? 0);
      const qty = Number.isFinite(q) ? q : 1;
      const price = Number.isFinite(p) ? p : 0;
      return sum + qty * price;
    }, 0);
  }
  const pv = Number(doc.paymentVoucher?.amount);
  return Number.isFinite(pv) ? pv : 0;
}
