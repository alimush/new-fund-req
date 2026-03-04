// /lib/exForms/forms/unitTransfer.js

export const unitTransfer = {
    key: "unit-transfer",
    title: "تحويل وحدة — مرفقات فقط",
    template: { img: "/blank-a4.jpg" },
    pos: {},
    fields: [
      { name: "dateDMY", label: "التاريخ", type: "dateDMY" },
      { name: "description", label: "الوصف", type: "text", fullWidth: true },
    ],
  };