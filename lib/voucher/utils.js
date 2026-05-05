/**
 * Utility functions for the Voucher system.
 */

/**
 * Extracts only digits from a string (max 2). Used for date parts.
 */
export function only2Digits(val) {
  return String(val || "").replace(/[^\d]/g, "").slice(0, 2);
}

/**
 * Removes everything except digits and dots from a string.
 */
export function cleanAmount(value) {
  return String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");
}

/**
 * Formats a number string into a localized currency string.
 */
export function formatAmount(value) {
  const cleaned = cleanAmount(value);
  if (!cleaned) return "";

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";

  return n.toLocaleString("en-US", {
    maximumFractionDigits: 3,
  });
}

/**
 * Converts a number to Arabic words.
 */
export function numberToArabicWords(num) {
  num = parseInt(String(num).replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(num) || num === 0) return "";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const teens = [
    "عشرة",
    "أحد عشر",
    "اثنا عشر",
    "ثلاثة عشر",
    "أربعة عشر",
    "خمسة عشر",
    "ستة عشر",
    "سبعة عشر",
    "ثمانية عشر",
    "تسعة عشر",
  ];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  function below100(n) {
    if (n < 10) return ones[n];
    if (n === 10) return "عشرة";
    if (n > 10 && n < 20) return teens[n - 10];
    if (n % 10 === 0) return tens[Math.floor(n / 10)];
    return `${ones[n % 10]} و${tens[Math.floor(n / 10)]}`;
  }

  function below1000(n) {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const rest = n % 100;
    if (rest === 0) return hundreds[h];
    return `${hundreds[h]} و${below100(rest)}`;
  }

  function groupToWords(n, singular, dual, plural) {
    if (n === 0) return "";
    if (n === 1) return singular;
    if (n === 2) return dual;
    if (n >= 3 && n <= 10) return `${below1000(n)} ${plural}`;
    return `${below1000(n)} ${singular}`;
  }

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  const parts = [];
  if (billions) parts.push(groupToWords(billions, "مليار", "ملياران", "مليارات"));
  if (millions) parts.push(groupToWords(millions, "مليون", "مليونان", "ملايين"));
  if (thousands) parts.push(groupToWords(thousands, "ألف", "ألفان", "آلاف"));
  if (rest) parts.push(below1000(rest));

  return parts.join(" و");
}

/**
 * Ensures images are fully loaded and decoded before rendering to canvas.
 */
export async function waitForImages(node) {
  if (!node) return;
  const imgs = Array.from(node.querySelectorAll("img"));

  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    })
  );

  await Promise.all(
    imgs.map((img) =>
      typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve()
    )
  );
}
