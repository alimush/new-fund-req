export const attachmentOnly = {
    key: "attachment-only",
    title: "معامله زبون",
    hidePrint: true,
    hideWorkflow: true,
  
    template: {
      img: "",
      url: "",
      id: "",
    },
  
    pos: {},
  
    fields: [
      {
        name: "customerName",
        label: "اسم الزبون",
        type: "text",
      },
      {
        name: "unitNo",
        label: "رقم الوحدة",
        type: "text",
      },
      {
        name: "transactionType",
        label: "نوع المعاملة",
        type: "text",
      },
    ],
  };