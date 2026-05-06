"use client";

/**
 * سبنر صغير لبادج الإشعارات (يعمل على الخلفية الحمراء/المتدرجة)
 */
export function ExBadgeInlineSpinner({ className = "" }) {
  return (
    <span
      className={`inline-block size-[14px] shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white ${className}`}
      aria-hidden
    />
  );
}
