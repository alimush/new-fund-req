/**
 * قالب خطة الدفع A4 — مواضع افتراضية (تُعدَّل من /ex/payment-plan/layout)
 */

export const PAYMENT_PLAN_TEMPLATE_KEY = "payment-plan-a4";

export const PAYMENT_PLAN_TEMPLATE = {
  key: PAYMENT_PLAN_TEMPLATE_KEY,
  name: "خطة الدفع A4",
  image: "/payment-plan-a4.jpg",
  aspectRatio: "210 / 297",
  maxRowsPerPage: 15,
  defaultTableRowHeight: 2.75,
  fields: [
    {
      key: "salesEmp",
      label: "اسم موظف المبيعات",
      top: 11.2,
      left: 3,
      width: 42,
      height: 3.2,
      fontSize: 14,
      textAlign: "right",
    },
    {
      key: "date",
      label: "التاريخ",
      top: 11.2,
      left: 52,
      width: 18,
      height: 3.2,
      fontSize: 14,
      textAlign: "right",
    },
    {
      key: "customer",
      label: "اسم الزبون",
      top: 14.8,
      left: 3,
      width: 42,
      height: 3.2,
      fontSize: 14,
      textAlign: "right",
    },
    {
      key: "unitNo",
      label: "رقم الوحدة السكنية",
      top: 14.8,
      left: 52,
      width: 18,
      height: 3.2,
      fontSize: 14,
      textAlign: "right",
    },
    {
      key: "tableStartTop",
      label: "بداية صفوف الجدول (%)",
      top: 27.5,
      left: 5,
      width: 90,
      height: 1.2,
      fontSize: 12,
      textAlign: "center",
      isTableAnchor: true,
    },
    {
      key: "colPayName",
      label: "عمود اسم الدفعة",
      top: 27.5,
      left: 68,
      width: 24,
      height: 2.5,
      fontSize: 13,
      textAlign: "center",
      isColumn: true,
    },
    {
      key: "colDate",
      label: "عمود التاريخ",
      top: 27.5,
      left: 48,
      width: 16,
      height: 2.5,
      fontSize: 13,
      textAlign: "center",
      isColumn: true,
    },
    {
      key: "colAmount",
      label: "عمود القيمة المالية",
      top: 27.5,
      left: 28,
      width: 16,
      height: 2.5,
      fontSize: 13,
      textAlign: "center",
      isColumn: true,
    },
    {
      key: "colPercent",
      label: "عمود نسبة الدفعة",
      top: 27.5,
      left: 8,
      width: 16,
      height: 2.5,
      fontSize: 13,
      textAlign: "center",
      isColumn: true,
    },
    {
      key: "total",
      label: "المجموع الكلي",
      top: 76.5,
      left: 28,
      width: 16,
      height: 3,
      fontSize: 14,
      textAlign: "center",
    },
    {
      key: "discount",
      label: "قيمة الخصم",
      top: 79.5,
      left: 28,
      width: 16,
      height: 3,
      fontSize: 14,
      textAlign: "center",
    },
  ],
};

export function getPaymentPlanTemplate() {
  return PAYMENT_PLAN_TEMPLATE;
}

export function getPaymentPlanFieldKeys() {
  return new Set(PAYMENT_PLAN_TEMPLATE.fields.map((f) => f.key));
}
