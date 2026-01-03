// 🔥 كل الصلاحيات تُعرّف هنا فقط
export const PERMISSIONS = {
  CREATE_REQUEST: "CREATE_REQUEST",
  DELETE_REQUEST: "DELETE_REQUEST",  
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  CAN_SEE_REQUESTS: "CAN_SEE_REQUESTS",
  
};

// 🔥 حتى تقدر تعرض اسم حلو لكل صلاحية
export const PERMISSION_LABELS = Object.fromEntries(
  Object.entries(PERMISSIONS).map(([key, value]) => [
    value,
    key.replace(/_/g, " ").toLowerCase(),
  ])
);