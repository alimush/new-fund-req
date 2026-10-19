"use client";

/**
 * جيك ليست الفئة على قالب الوصل.
 * مثل باقي الإنبتات: مخفية بالإدخال العادي، وتظهر واضحة فقط بوضع «ترتيب الحقول».
 */
export default function VoucherCategoryChecklist({
  items = [],
  values = {},
  onToggle,
  showMarks = true,
  showHits = false,
  markStyle = {},
  className = "",
}) {
  if (!Array.isArray(items) || !items.length) return null;

  return (
    <>
      {showMarks
        ? items.map((item) =>
            values?.[item.key] ? (
              <div
                key={`cat-mark-${item.key}`}
                className={`absolute leading-none ${className}`}
                style={{
                  top: `${item.pos?.top ?? 0}%`,
                  left: `${item.pos?.left ?? 0}%`,
                  fontSize: markStyle.fontSize,
                  fontWeight: markStyle.fontWeight,
                  color: markStyle.color || "#111827",
                  zIndex: 5,
                }}
              >
                ✓
              </div>
            ) : null
          )
        : null}

      {showHits && typeof onToggle === "function"
        ? items.map((item) => (
            <label
              key={`cat-hit-${item.key}`}
              className="absolute z-20"
              title={item.label || item.key}
              style={{
                top: `${item.pos?.top ?? 0}%`,
                left: `${item.pos?.left ?? 0}%`,
                width: `${item.hit?.width ?? 3}%`,
                height: `${item.hit?.height ?? 3}%`,
                opacity: 0,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(values?.[item.key])}
                onChange={(e) => onToggle(item.key, e.target.checked)}
                style={{
                  width: "100%",
                  height: "100%",
                  margin: 0,
                  cursor: "pointer",
                }}
              />
            </label>
          ))
        : null}
    </>
  );
}
