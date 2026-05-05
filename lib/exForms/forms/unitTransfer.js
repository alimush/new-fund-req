// /lib/exForms/forms/unitTransfer.js

export const unitTransfer = {
    key: "unit-transfer",
    title: "تحويل وحدة — مرفقات فقط",
    hidePrint: true,
    template: { img: "/blank-a4.jpg" },
    pos: {},
    fields: [
      { name: "dateDMY", label: "التاريخ", type: "dateDMY" },
      { name: "customerName", label: "اسم الزبون", type: "text" },
      { name: "oldUnitNo", label: "رقم الوحدة السكنية القديمة", type: "text" },
      { name: "newUnitNo", label: "رقم الوحدة السكنية الجديدة", type: "text" },
      { name: "description", label: "الوصف", type: "text", fullWidth: true },
    ],
  };