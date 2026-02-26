"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { FiPrinter } from "react-icons/fi";
import { Cairo } from "next/font/google";

const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700", "800"] });

// ✅ صورة A4
const TEMPLATE_IMG = "/payment-plan-a4.jpg";

// ✅ Helpers
const pct = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    })
  );
}

function todayStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function PaymentPlanA4() {
  const paperRef = useRef(null);

  // ✅ Default date = today
  const [form, setForm] = useState(() => ({
    salesEmp: "",
    customer: "",
    unitNo: "",
    date: todayStr(),
    discount: "",
    signature: "",
    // 15 rows * 3 fields
    rows: Array.from({ length: 15 }).map(() => ({
      payDate: "",
      amount: "",
      payType: "",
    })),
  }));

  // ✅ show inputs boxes (for positioning) + auto hide when field empty
  const [showBoxes, setShowBoxes] = useState(true);

  // ✅ FOCUS helper
  const refs = useRef({});
  const setRef = (key) => (el) => {
    if (el) refs.current[key] = el;
  };
  const focus = (key) => refs.current[key]?.focus();

  // ✅ Editable positions (start values) — ظبطها على صورتك
  const POS = {
    // Header
    salesEmp: { top: 10.5, left: 2.5, width: 28, height: 3.8 },
    date: { top: 10.5, left: 48, width: 18, height: 3.8 },
    customer: { top: 13.6, left: 3, width: 28, height: 3.8 },
    unitNo: { top: 13.6, left: 47.5, width: 18, height: 3.8 },

    // Table geometry
    table: {
      startTop: 30,
      rowH: 3.20,
      // columns order in your template: نوع الدفعه | القيمه الماليه | التاريخ | (اسم الدفعة موجود بالصورة)
      colPayType: { left: 9.5, width: 22, height: 1 },
      colAmount: { left: 33.0, width: 18, height: 1 },
      colDate: { left: 52.5, width: 15, height: 1},
      // ✅ no colName: because "اسم الدفعة" is already printed in the image
    },

    // Footer fields
    discount: { top: 79, left: 7, width: 39, height: 3.6 },
    signature: { top: 88.8, left: 30.0, width: 40, height: 3.8 },
  };

  const rowTop = (i) => POS.table.startTop + i * POS.table.rowH;

  // ✅ Generic field setter
  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ Row field setter
  const setRowField = (i, key, value) => {
    setForm((prev) => {
      const rows = [...prev.rows];
      rows[i] = { ...rows[i], [key]: value };
      return { ...prev, rows };
    });
  };

  // ✅ Print A4 Portrait
  const printA4 = async () => {
    if (!paperRef.current) return;
    await waitForImages(paperRef.current);

    const dataUrl = await toPng(paperRef.current, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#ffffff",
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 0; }
            html, body {
              margin: 0; padding: 0;
              width: 210mm; height: 297mm;
              background: #fff; overflow: hidden;
            }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            img { width: 210mm; height: 297mm; display: block; object-fit: cover; }
          </style>
        </head>
        <body>
          <img id="p" />
          <script>
            const img = document.getElementById("p");
            img.src = ${JSON.stringify(dataUrl)};
            img.onload = () => setTimeout(() => { window.focus(); window.print(); }, 60);
            window.onafterprint = () => { try { parent.postMessage({ type: "A4_DONE" }, "*"); } catch(e){} };
          </script>
        </body>
      </html>
    `);
    doc.close();

    const onMsg = (ev) => {
      if (ev?.data?.type !== "A4_DONE") return;
      window.removeEventListener("message", onMsg);
      try {
        iframe.remove();
      } catch {}
    };
    window.addEventListener("message", onMsg);
  };

  // ✅ “Box visible now, but hides when you clear a single field”
  // rule: box visible if showBoxes is ON OR field has value
  const showBox = (val) => showBoxes || String(val || "").trim().length > 0;

  const Box = ({ style, visible }) => {
    if (!visible) return null;
    return (
      <div
        className="absolute pointer-events-none"
        style={{ ...style, zIndex: 60 }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px dashed rgba(220,38,38,0.95)", // red dashed
            borderRadius: 10,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.8) inset",
          }}
        />
      </div>
    );
  };

  return (
    <div className={`min-h-screen p-6 ${cairo.className}`}>
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="text-right">
            <div className="text-2xl font-extrabold">نموذج خطة الدفعات (A4)</div>
            <div className="text-sm font-bold text-gray-600 mt-1">
              حالياً مربعات الإدخال مرئية حتى تظبط أماكنها — وإذا تمسح قيمة حقل واحد يرجع مربعها غير مرئي
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBoxes((v) => !v)}
              className="px-4 py-2 rounded-2xl bg-white ring-1 ring-black/10 shadow-sm font-extrabold"
            >
              {showBoxes ? "إخفاء كل المربعات" : "إظهار كل المربعات"}
            </button>

            <button
              onClick={printA4}
              className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-white ring-1 ring-black/10 shadow-sm font-extrabold"
            >
              <FiPrinter /> طباعة A4
            </button>
          </div>
        </div>

        {/* ✅ A4 preview */}
        <div className="w-full overflow-auto">
          <div
            ref={paperRef}
            className="relative bg-white ring-1 ring-black/10 rounded-2xl overflow-hidden"
            style={{
              width: "100%",
              maxWidth: 900,
              aspectRatio: "210/297", // A4 portrait
            }}
          >
            {/* Background */}
            <img
              src={TEMPLATE_IMG}
              alt="template"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />

            {/* ======================
                ✅ Overlay (text)
               ====================== */}
            <div className="absolute inset-0 pointer-events-none text-gray-900">
              {/* Header */}
              {form.salesEmp && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.salesEmp),
                    width: `${POS.salesEmp.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.salesEmp}
                </div>
              )}

              {/* Date default today */}
              {form.date && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.date),
                    width: `${POS.date.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.date}
                </div>
              )}

              {form.customer && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.customer),
                    width: `${POS.customer.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.customer}
                </div>
              )}

              {form.unitNo && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.unitNo),
                    width: `${POS.unitNo.width}%`,
                    fontSize: 16,
                    direction: "rtl",
                    textAlign: "right",
                  }}
                >
                  {form.unitNo}
                </div>
              )}

              {/* Rows */}
              {form.rows.map((r, i) => (
                <div key={i}>
                  {/* Type */}
                  {r.payType && (
                    <div
                      className="absolute font-bold"
                      style={{
                        top: `${rowTop(i)}%`,
                        left: `${POS.table.colPayType.left}%`,
                        width: `${POS.table.colPayType.width}%`,
                        fontSize: 14,
                        direction: "rtl",
                        textAlign: "center",
                      }}
                    >
                      {r.payType}
                    </div>
                  )}

                  {/* Amount */}
                  {r.amount && (
                    <div
                      className="absolute font-bold"
                      style={{
                        top: `${rowTop(i)}%`,
                        left: `${POS.table.colAmount.left}%`,
                        width: `${POS.table.colAmount.width}%`,
                        fontSize: 14,
                        direction: "ltr",
                        textAlign: "center",
                      }}
                    >
                      {Number(String(r.amount).replace(/,/g, "") || 0).toLocaleString("en-US")}
                    </div>
                  )}

                  {/* Date */}
                  {r.payDate && (
                    <div
                      className="absolute font-bold"
                      style={{
                        top: `${rowTop(i)}%`,
                        left: `${POS.table.colDate.left}%`,
                        width: `${POS.table.colDate.width}%`,
                        fontSize: 14,
                        direction: "rtl",
                        textAlign: "center",
                      }}
                    >
                      {r.payDate}
                    </div>
                  )}
                </div>
              ))}

              {/* Footer */}
              {form.discount && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.discount),
                    width: `${POS.discount.width}%`,
                    fontSize: 15,
                    direction: "rtl",
                    textAlign: "center",
                  }}
                >
                  {form.discount}
                </div>
              )}

              {form.signature && (
                <div
                  className="absolute font-extrabold"
                  style={{
                    ...pct(POS.signature),
                    width: `${POS.signature.width}%`,
                    fontSize: 15,
                    direction: "rtl",
                    textAlign: "center",
                  }}
                >
                  {form.signature}
                </div>
              )}
            </div>

            {/* ======================
                ✅ Inputs (VISIBLE BOXES now)
               ====================== */}
            <div className="absolute inset-0">
              {/* Header boxes + inputs */}
              <Box
                visible={showBox(form.salesEmp)}
                style={{
                  ...pct(POS.salesEmp),
                  width: `${POS.salesEmp.width}%`,
                  height: `${POS.salesEmp.height}%`,
                  position: "absolute",
                }}
              />
              <input
                ref={setRef("salesEmp")}
                value={form.salesEmp}
                onChange={(e) => setField("salesEmp", e.target.value)}
                onFocus={() => setShowBoxes(true)}
                className="absolute"
                style={{
                  ...pct(POS.salesEmp),
                  width: `${POS.salesEmp.width}%`,
                  height: `${POS.salesEmp.height}%`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  direction: "rtl",
                  textAlign: "right",
                  padding: "0 8px",
                  fontWeight: 800,
                  fontSize: 16,
                  opacity: 0, // ✅ input hidden, box visible
                  position: "absolute",
                }}
              />

              <Box
                visible={showBox(form.date)}
                style={{
                  ...pct(POS.date),
                  width: `${POS.date.width}%`,
                  height: `${POS.date.height}%`,
                  position: "absolute",
                }}
              />
              <input
                ref={setRef("date")}
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                className="absolute"
                style={{
                  ...pct(POS.date),
                  width: `${POS.date.width}%`,
                  height: `${POS.date.height}%`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  direction: "rtl",
                  textAlign: "right",
                  padding: "0 8px",
                  fontWeight: 800,
                  fontSize: 16,
                  opacity: 0,
                  position: "absolute",
                }}
              />

              <Box
                visible={showBox(form.customer)}
                style={{
                  ...pct(POS.customer),
                  width: `${POS.customer.width}%`,
                  height: `${POS.customer.height}%`,
                  position: "absolute",
                }}
              />
              <input
                ref={setRef("customer")}
                value={form.customer}
                onChange={(e) => setField("customer", e.target.value)}
                className="absolute"
                style={{
                  ...pct(POS.customer),
                  width: `${POS.customer.width}%`,
                  height: `${POS.customer.height}%`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  direction: "rtl",
                  textAlign: "right",
                  padding: "0 8px",
                  fontWeight: 800,
                  fontSize: 16,
                  opacity: 0,
                  position: "absolute",
                }}
              />

              <Box
                visible={showBox(form.unitNo)}
                style={{
                  ...pct(POS.unitNo),
                  width: `${POS.unitNo.width}%`,
                  height: `${POS.unitNo.height}%`,
                  position: "absolute",
                }}
              />
              <input
                ref={setRef("unitNo")}
                value={form.unitNo}
                onChange={(e) => setField("unitNo", e.target.value)}
                className="absolute"
                style={{
                  ...pct(POS.unitNo),
                  width: `${POS.unitNo.width}%`,
                  height: `${POS.unitNo.height}%`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  direction: "rtl",
                  textAlign: "right",
                  padding: "0 8px",
                  fontWeight: 800,
                  fontSize: 16,
                  opacity: 0,
                  position: "absolute",
                }}
              />

              {/* Rows: each مربع موجود خليله input */}
              {form.rows.map((r, i) => {
                const top = rowTop(i);

                const typeBox = {
                  top,
                  left: POS.table.colPayType.left,
                  width: POS.table.colPayType.width,
                  height: POS.table.colPayType.height,
                };
                const amtBox = {
                  top,
                  left: POS.table.colAmount.left,
                  width: POS.table.colAmount.width,
                  height: POS.table.colAmount.height,
                };
                const dateBox = {
                  top,
                  left: POS.table.colDate.left,
                  width: POS.table.colDate.width,
                  height: POS.table.colDate.height,
                };

                return (
                  <div key={i}>
                    {/* payType */}
                    <Box
                      visible={showBox(r.payType)}
                      style={{
                        top: `${typeBox.top}%`,
                        left: `${typeBox.left}%`,
                        width: `${typeBox.width}%`,
                        height: `${typeBox.height}%`,
                        position: "absolute",
                      }}
                    />
                    <input
                      ref={setRef(`row_${i}_payType`)}
                      value={r.payType}
                      onChange={(e) => setRowField(i, "payType", e.target.value)}
                      className="absolute"
                      style={{
                        top: `${typeBox.top}%`,
                        left: `${typeBox.left}%`,
                        width: `${typeBox.width}%`,
                        height: `${typeBox.height}%`,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        direction: "rtl",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        opacity: 0,
                        position: "absolute",
                      }}
                    />

                    {/* amount */}
                    <Box
                      visible={showBox(r.amount)}
                      style={{
                        top: `${amtBox.top}%`,
                        left: `${amtBox.left}%`,
                        width: `${amtBox.width}%`,
                        height: `${amtBox.height}%`,
                        position: "absolute",
                      }}
                    />
                    <input
                      ref={setRef(`row_${i}_amount`)}
                      value={r.amount}
                      onChange={(e) => setRowField(i, "amount", e.target.value)}
                      className="absolute"
                      style={{
                        top: `${amtBox.top}%`,
                        left: `${amtBox.left}%`,
                        width: `${amtBox.width}%`,
                        height: `${amtBox.height}%`,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        direction: "ltr",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        opacity: 0,
                        position: "absolute",
                      }}
                    />

                    {/* payDate */}
                    <Box
                      visible={showBox(r.payDate)}
                      style={{
                        top: `${dateBox.top}%`,
                        left: `${dateBox.left}%`,
                        width: `${dateBox.width}%`,
                        height: `${dateBox.height}%`,
                        position: "absolute",
                      }}
                    />
                    <input
                      ref={setRef(`row_${i}_payDate`)}
                      value={r.payDate}
                      type="date"   // ✅ هذا المهم

                      onChange={(e) => setRowField(i, "payDate", e.target.value)}
                      className="absolute"
                      style={{
                        top: `${dateBox.top}%`,
                        left: `${dateBox.left}%`,
                        width: `${dateBox.width}%`,
                        height: `${dateBox.height}%`,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        direction: "rtl",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        opacity: 0,
                        position: "absolute",
                      }}
                    />
                  </div>
                );
              })}

              {/* Discount */}
              <Box
                visible={showBox(form.discount)}
                style={{
                  ...pct(POS.discount),
                  width: `${POS.discount.width}%`,
                  height: `${POS.discount.height}%`,
                  position: "absolute",
                }}
              />
              <input
                ref={setRef("discount")}
                value={form.discount}
                onChange={(e) => setField("discount", e.target.value)}
                className="absolute"
                style={{
                  ...pct(POS.discount),
                  width: `${POS.discount.width}%`,
                  height: `${POS.discount.height}%`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  direction: "rtl",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 15,
                  opacity: 0,
                  position: "absolute",
                }}
              />

              {/* Signature */}
              <Box
                visible={showBox(form.signature)}
                style={{
                  ...pct(POS.signature),
                  width: `${POS.signature.width}%`,
                  height: `${POS.signature.height}%`,
                  position: "absolute",
                }}
              />
              <input
                ref={setRef("signature")}
                value={form.signature}
                onChange={(e) => setField("signature", e.target.value)}
                className="absolute"
                style={{
                  ...pct(POS.signature),
                  width: `${POS.signature.width}%`,
                  height: `${POS.signature.height}%`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  direction: "rtl",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 15,
                  opacity: 0,
                  position: "absolute",
                }}
              />
            </div>
          </div>
        </div>

        {/* ✅ Quick focus buttons + clear one field => its box hides */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => focus("salesEmp")}
            className="px-4 py-2 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold"
          >
            اسم موظف المبيعات
          </button>
          <button
            onClick={() => focus("customer")}
            className="px-4 py-2 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold"
          >
            اسم الزبون
          </button>
          <button
            onClick={() => focus("unitNo")}
            className="px-4 py-2 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold"
          >
            رقم الوحدة
          </button>
          <button
            onClick={() => focus("discount")}
            className="px-4 py-2 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold"
          >
            الخصم
          </button>
          <button
            onClick={() => focus("signature")}
            className="px-4 py-2 rounded-2xl bg-white ring-1 ring-black/10 font-extrabold"
          >
            التوقيع
          </button>

          <button
            onClick={() => {
              // ✅ keep date default today
              setForm((prev) => ({
                ...prev,
                salesEmp: "",
                customer: "",
                unitNo: "",
                date: todayStr(),
                discount: "",
                signature: "",
                rows: Array.from({ length: 15 }).map(() => ({
                  payDate: "",
                  amount: "",
                  payType: "",
                })),
              }));
              // after full clear, keep boxes visible so you can align
              setShowBoxes(true);
            }}
            className="px-5 py-2 rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-200 font-extrabold"
          >
            🗑️ مسح الكل
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-600 font-bold text-right">
          ✅ ملاحظة: إذا تمسح قيمة حقل واحد (تخليه فارغ)، مربع هذا الحقل يصير غير مرئي تلقائياً (إذا زر “إظهار كل المربعات” مطفي).
        </div>
      </div>
    </div>
  );
}