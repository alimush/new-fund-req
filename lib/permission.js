// 🔥 كل الصلاحيات تُعرّف هنا فقط
export const PERMISSIONS = {
  CREATE_REQUEST: "CREATE_REQUEST",

  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  
  VIEW_REPORTS: "VIEW_REPORTS", 




  RECEIPTS: "RECEIPTS",

  MARKETING: "MARKETING",

  MARKETING_saad: "MARKETING_saad",


  EX: "EX",

  OPERATION: "OPERATION",

  EX_REPLACE_BOOKING_TRANSFER: "EX_REPLACE_BOOKING_TRANSFER",
  EX_WAIVER_RESERVATION: "EX_WAIVER_RESERVATION",
  EX_CANCEL_BOOKING_UNIT: "EX_CANCEL_BOOKING_UNIT",
  EX_UNIT_TRANSFER: "EX_UNIT_TRANSFER",
  EX_EXCEPTIONS: "EX_EXCEPTIONS",
  EX_Create_Request: "EX_Create_Request",
  DB_NEW_ACCESS: "DB_NEW_ACCESS",


  
};

// 🔥 حتى تقدر تعرض اسم حلو لكل صلاحية
export const PERMISSION_LABELS = Object.fromEntries(
  Object.entries(PERMISSIONS).map(([key, value]) => [
    value,
    key.replace(/_/g, " ").toLowerCase(),
  ])
);