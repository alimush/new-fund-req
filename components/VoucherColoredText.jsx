"use client";

import { useMemo } from "react";
import { splitTextByStyleRuns } from "@/lib/voucher/fieldColorRuns";

export default function VoucherColoredText({
  text = "",
  colorRuns = [],
  defaultColor = "#111827",
  defaultFontSize = 16,
  defaultFontWeight = 700,
  style,
  className,
  as: Tag = "span",
}) {
  const defaults = useMemo(
    () => ({
      color: defaultColor,
      fontSize: defaultFontSize,
      fontWeight: defaultFontWeight,
    }),
    [defaultColor, defaultFontSize, defaultFontWeight]
  );

  const parts = useMemo(
    () => splitTextByStyleRuns(text, colorRuns, defaults),
    [text, colorRuns, defaults]
  );

  if (!parts.length) return null;

  return (
    <Tag className={className} style={style}>
      {parts.map((part, index) => {
        const spanStyle = {};
        if (part.color !== defaults.color) spanStyle.color = part.color;
        if (part.fontSize !== defaults.fontSize) spanStyle.fontSize = `${part.fontSize}px`;
        if (part.fontWeight !== defaults.fontWeight) spanStyle.fontWeight = part.fontWeight;

        const hasOverride = Object.keys(spanStyle).length > 0;
        if (!hasOverride) {
          return <span key={`${index}-default`}>{part.text}</span>;
        }

        return (
          <span key={`${index}-styled`} style={spanStyle}>
            {part.text}
          </span>
        );
      })}
    </Tag>
  );
}
