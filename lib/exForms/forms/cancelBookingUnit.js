// /lib/exForms/forms/cancelBookingUnit.js

export const cancelBookingUnit = {
  key: "cancel-booking-unit",
  title: "الغاء حجز وحدة سكنية ضمن مشروع بدور بغداد السكني",

  template: {
    img: "/cancel-booking-unit-a4.jpg", // ✅ حط الصورة داخل /public
    url: "",
    id: "",
  },

  // POS (عدّل القيم بعد ما تشوف الصورة بالـ Preview)
  pos: {
    customerName: {
      top: 30.4,
      left: 44,
      width: 40,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },

    unitNo: {
      top: 30.4,
      left: 11,
      width: 30,
      height: 3.8,
      dir: "rtl",
      align: "center",
      fontSize: 16,
    },

    amountNumber: {
      top: 37,
      left: 69.6,
      width: 26,
      height: 3.8,
      dir: "ltr",
      align: "left",
      fontSize: 16,
      pinLeft: true,
    },

    amountWords: {
      top: 37,
      left: 12,
      width: 52,
      height: 4.2,
      dir: "rtl",
      align: "right",
      fontSize: 14,
    },

    dateDMY: {
      top: 78.8,
      left: -10,
      width: 30,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },

    phone: {
      top: 81.3,
      left: 8,
      width: 30,
      height: 3.8,
      dir: "ltr",
      align: "left",
      fontSize: 16,
    },
    createdBy: {
      top: 70.4,
      left: -34,
      width: 40,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },
  },

  fields: [
    { name: "customerName", label: "اسم الزبون", type: "text" },
    { name: "createdBy", label: "مقدم الطلب", type: "text", readOnly: true },
    { name: "unitNo", label: "رقم الوحدة المراد الغائها", type: "text" },
    { name: "amountNumber", label: "المبلغ رقماً", type: "moneyIQD" },
    {
      name: "amountWords",
      label: "المبلغ كتابة",
      type: "arabicWordsIQD",
      readOnly: true,
    },
    { name: "dateDMY", label: "التاريخ", type: "dateDMY" },
    { name: "phone", label: "رقم الهاتف", type: "phone" },
  ],
};
