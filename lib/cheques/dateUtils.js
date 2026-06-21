/** تاريخ الصك — افتراضي اليوم، سنة كاملة */

export function getTodayDateParts() {
  const d = new Date();
  return {
    dateDay: String(d.getDate()).padStart(2, "0"),
    dateMonth: String(d.getMonth() + 1).padStart(2, "0"),
    dateYear: String(d.getFullYear()),
  };
}

export function onlyDatePart(val, maxLen = 2) {
  const n = String(val || "").replace(/\D/g, "");
  return n.slice(0, maxLen);
}

export function datePartsFromIso(iso) {
  if (!iso) {
    return { dateDay: "", dateMonth: "", dateYear: "" };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateDay: "", dateMonth: "", dateYear: "" };
  }
  return {
    dateDay: String(d.getDate()).padStart(2, "0"),
    dateMonth: String(d.getMonth() + 1).padStart(2, "0"),
    dateYear: String(d.getFullYear()),
  };
}

export function isoFromDateParts({ dateDay, dateMonth, dateYear }) {
  const y = String(dateYear || "").padStart(4, "0").slice(-4);
  const m = String(dateMonth || "").padStart(2, "0");
  const d = String(dateDay || "").padStart(2, "0");
  if (!y || Number(y) < 1000 || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

/** موضع فاصل / بين حقلين تاريخ — بين مركزَي الحقلين */
export function slashPositionBetween(fieldA, fieldB) {
  if (!fieldA || !fieldB) return null;
  const centerA = fieldA.left + fieldA.width / 2;
  const centerB = fieldB.left + fieldB.width / 2;
  return {
    top: (fieldA.top + fieldB.top) / 2,
    left: (centerA + centerB) / 2,
    width: Math.max(1.5, Math.abs(centerB - centerA)),
    height: Math.max(fieldA.height, fieldB.height),
  };
}

/** محاذاة نص جزء التاريخ — نحو الشرطة المجاورة */
export function datePartTextAlign(key) {
  if (key === "dateDay") return "right";
  if (key === "dateYear") return "left";
  return "center";
}

/** محاذاة flex لحقل التاريخ — نحو الشرطة المجاورة */
export function datePartJustifyContent(key) {
  const align = datePartTextAlign(key);
  if (align === "right") return "flex-end";
  if (align === "left") return "flex-start";
  return "center";
}
