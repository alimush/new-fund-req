export const attachmentOnly = {
    key: "attachment-only",
    title: "معامله زبون",
  
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
    ],
  };