"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

function shrinkAdjustments(chosen, max, min) {
  if (max <= min) {
    return { fontWeight: 700, paddingTop: 0, color: "#0f172a" };
  }
  const t = Math.min(1, Math.max(0, (max - chosen) / (max - min)));
  return {
    fontWeight: Math.round(700 + t * 200),
    paddingTop: Math.round(t * 5 * 10) / 10,
    color: t > 0.15 ? "#020617" : "#0f172a",
  };
}

/**
 * يقلّل حجم الخط تدريجياً حتى يلائم النص؛ كلما صغّر يزيد الغلظ وينزل قليلاً.
 */
export function useAutoFitFontSize({
  enabled,
  text,
  maxFontSize = 15,
  minFontSize = 7,
}) {
  const ref = useRef(null);
  const [fit, setFit] = useState(() => ({
    fontSize: maxFontSize,
    ...shrinkAdjustments(maxFontSize, maxFontSize, minFontSize),
  }));

  const runFit = useCallback(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    const max = Math.max(minFontSize, Number(maxFontSize) || 15);
    const min = Math.min(max, Number(minFontSize) || 7);
    let chosen = min;

    for (let size = max; size >= min; size -= 0.5) {
      const adj = shrinkAdjustments(size, max, min);
      el.style.fontSize = `${size}px`;
      el.style.lineHeight = "1.2";
      el.style.fontWeight = String(adj.fontWeight);
      el.style.paddingTop = `${adj.paddingTop}px`;
      el.style.color = adj.color;
      const overflowsW = el.scrollWidth > el.clientWidth + 1;
      const overflowsH = el.scrollHeight > el.clientHeight + 1;
      if (!overflowsW && !overflowsH) {
        chosen = size;
        break;
      }
      chosen = size;
    }

    setFit({
      fontSize: chosen,
      ...shrinkAdjustments(chosen, max, min),
    });
  }, [enabled, text, maxFontSize, minFontSize]);

  useLayoutEffect(() => {
    if (!enabled) return;
    runFit();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => runFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled, runFit]);

  return {
    ref,
    fit: enabled ? fit : null,
  };
}
