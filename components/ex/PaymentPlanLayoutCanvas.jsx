"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import { PAYMENT_PLAN_TEMPLATE } from "@/lib/ex/paymentPlanTemplate";
import { rowTopForIndex, buildPaymentPlanPos } from "@/lib/ex/buildPaymentPlanPos";

const SAMPLE = {
  salesEmp: "أحمد علي",
  date: "01/06/2026",
  customer: "محمد حسن",
  unitNo: "A-12",
  discount: "500,000",
  total: "15,000,000",
  rows: [
    {
      payType: "الدفعة الأولى",
      amount: "5,000,000",
      payDateYMD: "2026-06-01",
      payPercent: "30%",
    },
  ],
};

function fieldBoxStyle(f) {
  return {
    position: "absolute",
    top: `${f.top}%`,
    left: `${f.left}%`,
    width: `${f.width}%`,
    height: `${f.height}%`,
  };
}

export default function PaymentPlanLayoutCanvas({
  fields,
  tableRowHeight,
  layoutMode = true,
  selectedKey,
  onSelectField,
  onFieldChange,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const pos = buildPaymentPlanPos(fields, tableRowHeight);
  const template = PAYMENT_PLAN_TEMPLATE;

  const getRect = () => containerRef.current?.getBoundingClientRect();

  const startDrag = useCallback(
    (e, fieldKey) => {
      if (!layoutMode || !containerRef.current) return;
      e.preventDefault();
      onSelectField?.(fieldKey);

      const field = fields.find((f) => f.key === fieldKey);
      if (!field) return;

      const rect = getRect();
      if (!rect) return;

      dragRef.current = {
        key: fieldKey,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: field.left,
        startTop: field.top,
        rectW: rect.width,
        rectH: rect.height,
      };

      const onMove = (ev) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ((ev.clientX - d.startX) / d.rectW) * 100;
        const dy = ((ev.clientY - d.startY) / d.rectH) * 100;
        onFieldChange?.(d.key, {
          left: Math.round((d.startLeft + dx) * 100) / 100,
          top: Math.round((d.startTop + dy) * 100) / 100,
        });
      };

      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [fields, layoutMode, onFieldChange, onSelectField]
  );

  const renderColumnPreview = (colKey, col, value, rowIndex = 0) => {
    const top = rowTopForIndex(pos, rowIndex);
    const isSelected = selectedKey === colKey;
    return (
      <div
        key={colKey}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => startDrag(e, colKey)}
        className={`absolute cursor-move border-2 rounded px-1 overflow-hidden ${
          isSelected
            ? "border-emerald-500 bg-emerald-50/80"
            : "border-blue-400/70 bg-blue-50/50"
        }`}
        style={{
          top: `${top}%`,
          left: `${col.left}%`,
          width: `${col.width}%`,
          fontSize: col.fontSize,
          fontWeight: col.fontWeight,
          textAlign: col.textAlign,
          direction: colKey === "colAmount" ? "ltr" : "rtl",
        }}
        title={colKey}
      >
        <span className="block truncate font-bold text-slate-800">{value}</span>
      </div>
    );
  };

  const renderStaticField = (key, value) => {
    const f = fields.find((x) => x.key === key);
    if (!f) return null;
    const isSelected = selectedKey === key;
    return (
      <div
        key={key}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => startDrag(e, key)}
        className={`absolute cursor-move border-2 rounded px-1 overflow-hidden ${
          isSelected
            ? "border-emerald-500 bg-emerald-50/80"
            : "border-amber-400/70 bg-amber-50/50"
        }`}
        style={{
          ...fieldBoxStyle(f),
          fontSize: f.fontSize,
          fontWeight: f.fontWeight,
          textAlign: f.textAlign,
          direction: "rtl",
        }}
      >
        <span className="block truncate font-extrabold text-slate-900">{value}</span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[900px] mx-auto bg-white shadow-xl rounded-lg overflow-hidden"
      style={{ aspectRatio: template.aspectRatio }}
    >
      <Image
        src={template.image}
        alt="payment plan template"
        fill
        className="object-contain pointer-events-none select-none"
        priority
      />

      <div className="absolute inset-0">
        {renderStaticField("salesEmp", SAMPLE.salesEmp)}
        {renderStaticField("date", SAMPLE.date)}
        {renderStaticField("customer", SAMPLE.customer)}
        {renderStaticField("unitNo", SAMPLE.unitNo)}

        {fields
          .filter((f) => f.key === "tableStartTop")
          .map((f) => (
            <div
              key={f.key}
              role="button"
              tabIndex={0}
              onMouseDown={(e) => startDrag(e, f.key)}
              className={`absolute cursor-ns-resize border-t-4 border-dashed ${
                selectedKey === f.key ? "border-emerald-500" : "border-violet-500"
              }`}
              style={{
                top: `${f.top}%`,
                left: `${f.left}%`,
                width: `${f.width}%`,
                height: "2px",
              }}
              title="بداية الجدول"
            />
          ))}

        {renderColumnPreview("colPayName", pos.table.colPayName, SAMPLE.rows[0].payType)}
        {renderColumnPreview("colDate", pos.table.colDate, "01/06/2026")}
        {renderColumnPreview("colAmount", pos.table.colAmount, SAMPLE.rows[0].amount)}
        {renderColumnPreview("colPercent", pos.table.colPercent, SAMPLE.rows[0].payPercent)}

        {renderStaticField("total", SAMPLE.total)}
        {renderStaticField("discount", SAMPLE.discount)}
      </div>
    </div>
  );
}
