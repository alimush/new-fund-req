// 🔥 كل الصلاحيات تُعرّف هنا فقط
export const PERMISSIONS = {
  CREATE_REQUEST: "CREATE_REQUEST",

  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  
  VIEW_REPORTS: "VIEW_REPORTS", 

  
};

// 🔥 حتى تقدر تعرض اسم حلو لكل صلاحية
export const PERMISSION_LABELS = Object.fromEntries(
  Object.entries(PERMISSIONS).map(([key, value]) => [
    value,
    key.replace(/_/g, " ").toLowerCase(),
  ])
);