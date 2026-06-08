"use client";

import { buildPaymentPlanPos, rowTopForIndex } from "@/lib/ex/buildPaymentPlanPos";
import { PAYMENT_PLAN_TEMPLATE } from "@/lib/ex/paymentPlanTemplate";

const TEMPLATE_IMG = PAYMENT_PLAN_TEMPLATE.image;
const pct = (p) => ({ top: `${p.top}%`, left: `${p.left}%` });

function ymdToDMY(v) {
  if (!v) return "";
  if (String(v).includes("/")) return v;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const fmtInt = (n) => new Intl.NumberFormat("en-US").format(Number(n || 0));

function headerStyle(field) {
  return {
    ...pct(field),
    width: `${field.width}%`,
    fontSize: field.fontSize,
    fontWeight: field.fontWeight,
    direction: "rtl",
    textAlign: field.textAlign || "right",
  };
}

function colStyle(col, top) {
  return {
    top: `${top}%`,
    left: `${col.left}%`,
    width: `${col.width}%`,
    fontSize: col.fontSize,
    fontWeight: col.fontWeight,
    textAlign: col.textAlign || "center",
  };
}

export default function PaymentPlanA4Sheets({
  form,
  layoutFields = [],
  tableRowHeight = PAYMENT_PLAN_TEMPLATE.defaultTableRowHeight,
  maxRowsPerPage = PAYMENT_PLAN_TEMPLATE.maxRowsPerPage,
  pages,
  setPageRef,
  totalAmount = 0,
}) {
  const POS = buildPaymentPlanPos(layoutFields, tableRowHeight);

  return (
    <>
      {pages.map((rowsChunk, pageIdx) => (
        <div
          key={pageIdx}
          ref={setPageRef(pageIdx)}
          className="relative bg-white overflow-hidden"
          style={{ width: 900, aspectRatio: "210/297" }}
        >
          <img
            src={TEMPLATE_IMG}
            alt="template"
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />

          <div className="absolute inset-0 text-gray-900">
            {form.salesEmp ? (
              <div className="absolute font-extrabold" style={headerStyle(POS.salesEmp)}>
                {form.salesEmp}
              </div>
            ) : null}

            {form.dateDMY ? (
              <div className="absolute font-extrabold" style={headerStyle(POS.date)}>
                {form.dateDMY}
              </div>
            ) : null}

            {form.customer ? (
              <div className="absolute font-extrabold" style={headerStyle(POS.customer)}>
                {form.customer}
              </div>
            ) : null}

            {form.unitNo ? (
              <div className="absolute font-extrabold" style={headerStyle(POS.unitNo)}>
                {form.unitNo}
              </div>
            ) : null}

            {rowsChunk.map((r, i) => {
              const top = rowTopForIndex(POS, i);
              return (
                <div key={`${pageIdx}_${i}`}>
                  {r.payType ? (
                    <div
                      className="absolute font-bold"
                      style={{
                        ...colStyle(POS.table.colPayName, top),
                        direction: "rtl",
                      }}
                    >
                      {r.payType}
                    </div>
                  ) : null}

                  {r.amount ? (
                    <div
                      className="absolute font-bold"
                      style={{
                        ...colStyle(POS.table.colAmount, top),
                        direction: "ltr",
                      }}
                    >
                      {fmtInt(String(r.amount).replace(/,/g, ""))}
                    </div>
                  ) : null}

                  {r.payDateYMD ? (
                    <div
                      className="absolute font-bold"
                      style={{
                        ...colStyle(POS.table.colDate, top),
                        direction: "rtl",
                      }}
                    >
                      {ymdToDMY(r.payDateYMD)}
                    </div>
                  ) : null}

                  {r.payPercent ? (
                    <div
                      className="absolute font-bold"
                      style={{
                        ...colStyle(POS.table.colPercent, top),
                        direction: "rtl",
                      }}
                    >
                      {r.payPercent}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {pageIdx === pages.length - 1 ? (
              <>
                {totalAmount > 0 ? (
                  <div
                    className="absolute font-extrabold"
                    style={{
                      ...pct(POS.total),
                      width: `${POS.total.width}%`,
                      fontSize: POS.total.fontSize,
                      fontWeight: POS.total.fontWeight,
                      direction: "ltr",
                      textAlign: POS.total.textAlign || "center",
                    }}
                  >
                    {fmtInt(totalAmount)}
                  </div>
                ) : null}

                {form.discount ? (
                  <div
                    className="absolute font-extrabold"
                    style={{
                      ...pct(POS.discount),
                      width: `${POS.discount.width}%`,
                      fontSize: POS.discount.fontSize,
                      fontWeight: POS.discount.fontWeight,
                      direction: "rtl",
                      textAlign: POS.discount.textAlign || "center",
                    }}
                  >
                    {form.discount}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}
