// /lib/exForms/forms/waiverReservation.js
export const waiverReservation = {
  key: "waiver-reservation",
  title: "التنازل عن حجز وحدة سكنية والمبالغ المسددة عنها",

  template: {
    img: "/waiver-reservation-a4.jpg",
    url: "",
    id: "",
  },

  // مواقع الحقول على الصورة (قيم تقريبية.. انت تزحلقها)
  pos: {
    customerName: {
      top: 25,
      left: 44,
      width: 40,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },
    customerName_2: {
      top: 64.8,
      left: -12,
      width: 40,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },

    unitNo: {
      top: 28.0,
      left: 35,
      width: 30,
      height: 3.8,
      dir: "rtl",
      align: "center",
      fontSize: 16,
    },

    receiptNo: {
      top: 33.7,
      left: 32,
      width: 30,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },
    receiptDateDMY: {
      top: 33.7,
      left: 8,
      width: 30,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },

    amountNumber: {
      top: 37.5,
      left: 74,
      width: 26,
      height: 3.8,
      dir: "ltr",
      align: "left",
      fontSize: 16,
      pinLeft: true,
    },
    amountWords: {
      top: 37.6,
      left: 16,
      width: 52,
      height: 4.2,
      dir: "rtl",
      align: "right",
      fontSize: 14,
    },

    transfereeName: {
      top: 40.3,
      left: 35,
      width: 40,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },

    // ✅ هذا التاريخ "ديفولت اليوم" ويكدر يغيره
    dateDMY: {
      top: 67.8,
      left: -1,
      width: 30,
      height: 3.8,
      dir: "rtl",
      align: "right",
      fontSize: 16,
    },
  },

  fields: [
    { name: "customerName", label: "اسم الزبون", type: "text" },

    {
      name: "unitNo",
      label: "رقم الوحدة المراد إلغاء حجزها",
      type: "text",
      fullWidth: true,
    },

    { name: "receiptNo", label: "رقم الوصل", type: "text" },
    { name: "receiptDateDMY", label: "تاريخ الوصل", type: "dateDMY" }, // ✅ المستخدم يختاره (مو ديفولت)

    { name: "amountNumber", label: "المبلغ رقماً", type: "moneyIQD" },
    {
      name: "amountWords",
      label: "المبلغ كتابة",
      type: "arabicWordsIQD",
      readOnly: true,
    },

    {
      name: "transfereeName",
      label: "الشخص المتنازل له",
      type: "text",
      fullWidth: true,
    },

    { name: "dateDMY", label: "التاريخ", type: "dateDMY" }, // ✅ ديفولت اليوم
  ],
};
