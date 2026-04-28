// /lib/exForms/registry.js

import { replaceBookingTransfer } from "./forms/replaceBookingTransfer";
import { waiverReservation } from "./forms/waiverReservation";
import { cancelBookingUnit } from "./forms/cancelBookingUnit";
import { unitTransfer } from "./forms/unitTransfer";   // 👈 جديد
import { attachmentOnly } from "./forms/attachmentOnly";
export const EX_FORMS = {
  [replaceBookingTransfer.key]: replaceBookingTransfer,
  [waiverReservation.key]: waiverReservation,
  [cancelBookingUnit.key]: cancelBookingUnit,
  [unitTransfer.key]: unitTransfer,   
  [attachmentOnly.key]: attachmentOnly,
};

export function getExForm(key) {
  const k = String(key || "").trim();
  return EX_FORMS[k] || null;
}