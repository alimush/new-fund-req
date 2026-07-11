import mongoose from "mongoose";
import { getModelForCompany } from "@/models/Request";
import RequestOldData from "@/models/RequestOldData";

/** شركات طلبات الصرف المعروفة (نفس /home + approval-only) */
export const REQUEST_COMPANY_KEYS = [
  "Al-Ghadeer",
  "Badur-Baghdad",
  "Ghadeer-Karbala",
  "Tiba-Al-najaf",
  "badur-Al-najaf",
  "010",
  "alleanza",
  "Al-Rida",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/** فلتر منشئ الطلب: بالمعرّف أو بالاسم (للطلبات القديمة) */
export function buildCreatorMatchFilter({ userId, username }) {
  const parts = [];
  if (userId && isValidObjectId(userId)) {
    parts.push({ createdById: new mongoose.Types.ObjectId(String(userId)) });
  }
  const name = String(username || "").trim();
  if (name) parts.push({ createdBy: name });
  if (!parts.length) return { createdBy: "__never_match__" };
  return parts.length === 1 ? parts[0] : { $or: parts };
}

/** فلتر عدة منشئين (تقارير — فلتر المستخدمين) */
export function buildCreatorsMatchFilter(entries = []) {
  const orParts = [];
  for (const entry of entries) {
    const sub = buildCreatorMatchFilter({
      userId: entry?.userId || entry?._id || entry?.id,
      username: entry?.username,
    });
    if (sub.$or) orParts.push(...sub.$or);
    else orParts.push(sub);
  }
  if (!orParts.length) return { createdBy: "__never_match__" };
  const uniq = new Map();
  for (const p of orParts) {
    uniq.set(JSON.stringify(p), p);
  }
  const list = [...uniq.values()];
  return list.length === 1 ? list[0] : { $or: list };
}

/** هل المستخدم الحالي منشئ الطلب؟ */
export function isRequestCreator(doc, { userId, username }) {
  if (!doc) return false;
  const uid = String(userId || "").trim();
  const docUid = doc?.createdById
    ? String(
        typeof doc.createdById === "object" && doc.createdById._id
          ? doc.createdById._id
          : doc.createdById
      ).trim()
    : "";
  if (uid && docUid && uid === docUid) return true;
  const name = String(username || "").trim();
  const createdBy = String(doc?.createdBy || "").trim();
  return Boolean(name && createdBy && name === createdBy);
}

async function updateWorkflowUsernameFields(Model, oldUsername, newUsername) {
  if (!oldUsername || !newUsername || oldUsername === newUsername) return 0;

  const fields = [
    "voucherDelegateToUsername",
    "voucherDelegatedByUsername",
    "voucherProcessedByUsername",
  ];
  let touched = 0;

  for (const field of fields) {
    const path = `workflow.steps.$[s].${field}`;
    const res = await Model.updateMany(
      { [`workflow.steps.${field}`]: oldUsername },
      { $set: { [path]: newUsername } },
      { arrayFilters: [{ [`s.${field}`]: oldUsername }] }
    );
    touched += res.modifiedCount || 0;
  }

  return touched;
}

/**
 * بعد تغيير username: ربط الطلبات بالمعرّف وتحديث الاسم المعروض.
 */
export async function syncRequestsAfterUsernameChange({
  userId,
  oldUsername,
  newUsername,
}) {
  if (!userId || !isValidObjectId(userId)) {
    return { createdByUpdated: 0, workflowFieldsUpdated: 0 };
  }

  const uid = new mongoose.Types.ObjectId(String(userId));
  const oldName = String(oldUsername || "").trim();
  const newName = String(newUsername || "").trim();
  if (!newName) {
    return { createdByUpdated: 0, workflowFieldsUpdated: 0 };
  }

  const ownerMatch = {
    $or: [{ createdById: uid }, ...(oldName ? [{ createdBy: oldName }] : [])],
  };
  const ownerSet = { createdBy: newName, createdById: uid };

  let createdByUpdated = 0;
  let workflowFieldsUpdated = 0;

  for (const companyKey of REQUEST_COMPANY_KEYS) {
    try {
      const Model = getModelForCompany(companyKey);
      const res = await Model.updateMany(ownerMatch, { $set: ownerSet });
      createdByUpdated += res.modifiedCount || 0;
      workflowFieldsUpdated += await updateWorkflowUsernameFields(Model, oldName, newName);
    } catch {
      /* collection may not exist */
    }
  }

  try {
    const res = await RequestOldData.updateMany(ownerMatch, { $set: ownerSet });
    createdByUpdated += res.modifiedCount || 0;
    workflowFieldsUpdated += await updateWorkflowUsernameFields(
      RequestOldData,
      oldName,
      newName
    );
  } catch {
    /* ignore */
  }

  return { createdByUpdated, workflowFieldsUpdated };
}
