"use client";

import { useMemo } from "react";
import { splitTextByColorRuns } from "@/lib/voucher/fieldColorRuns";

export default function VoucherColoredText({
  text = "",
  colorRuns = [],
  defaultColor = "#111827",
  style,
  className,
  as: Tag = "span",
}) {
  const parts = useMemo(
    () => splitTextByColorRuns(text, colorRuns, defaultColor),
    [text, colorRuns, defaultColor]
  );

  if (!parts.length) return null;

  return (
    <Tag className={className} style={style}>
      {parts.map((part, index) => (
        <span key={`${index}-${part.color}`} style={{ color: part.color }}>
          {part.text}
        </span>
      ))}
    </Tag>
  );
}
