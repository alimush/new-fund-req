export function formatChequeDateParts(dateParts) {
  const dd = dateParts?.dd || "";
  const mm = dateParts?.mm || "";
  const yy = dateParts?.yy || "";
  if (!dd && !mm && !yy) return "—";
  return [dd, mm, yy].filter(Boolean).join(" / ");
}

export function formatChequeAmount(amount, currency = "IQD") {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toLocaleString("en-US")} ${currency || "IQD"}`;
}

export function formatSavedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-IQ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
