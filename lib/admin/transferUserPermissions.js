import mongoose from "mongoose";
import Permissions from "@/models/Permissions";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function oid(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function userIdString(u) {
  if (u == null) return "";
  if (typeof u === "object" && u._id != null) return String(u._id);
  return String(u);
}

function userInGroup(users, userId) {
  const target = String(userId);
  return (users || []).some((u) => userIdString(u) === target);
}

/** كروبات يظهر فيها المستخدم (يدعم users كـ ObjectId أو string) */
async function findGroupsContainingUser(userId) {
  const fromOid = oid(userId);
  const fromStr = String(userId);
  return Permissions.find({
    users: { $in: [fromOid, fromStr] },
  })
    .select("name permissions companies users")
    .lean();
}

function buildNextUsersList(currentUsers, fromUserId, toUserId) {
  const fromStr = String(fromUserId);
  const toStr = String(toUserId);
  const hadFrom = userInGroup(currentUsers, fromUserId);

  const seen = new Set();
  const next = [];

  for (const u of currentUsers || []) {
    const idStr = userIdString(u);
    if (!idStr || !isValidObjectId(idStr)) continue;
    if (idStr === fromStr) continue;
    if (!seen.has(idStr)) {
      seen.add(idStr);
      next.push(oid(idStr));
    }
  }

  let addedTo = false;
  if (!seen.has(toStr)) {
    next.push(oid(toUserId));
    addedTo = true;
  }

  const changed = hadFrom || addedTo;
  return { next, changed, hadFrom, addedTo };
}

export async function previewTransferUserPermissions({ fromUserId, toUserId }) {
  const groups = await findGroupsContainingUser(fromUserId);

  const items = groups.map((g) => {
    const toAlreadyMember = userInGroup(g.users, toUserId);
    const { changed } = buildNextUsersList(g.users, fromUserId, toUserId);
    return {
      id: String(g._id),
      name: g.name || "",
      permissions: Array.isArray(g.permissions) ? g.permissions : [],
      companies: Array.isArray(g.companies) ? g.companies : [],
      memberCount: Array.isArray(g.users) ? g.users.length : 0,
      toAlreadyMember,
      willAddToUser: !toAlreadyMember,
      willRemoveFromUser: true,
      willChange: changed,
    };
  });

  return {
    groupCount: items.length,
    groups: items,
    willAddCount: items.filter((g) => g.willAddToUser).length,
    alreadyMemberCount: items.filter((g) => g.toAlreadyMember).length,
    willChangeCount: items.filter((g) => g.willChange).length,
  };
}

export async function executeTransferUserPermissions({ fromUserId, toUserId }) {
  const groups = await findGroupsContainingUser(fromUserId);
  if (!groups.length) {
    return {
      groupCount: 0,
      groups: [],
      willAddCount: 0,
      alreadyMemberCount: 0,
      willChangeCount: 0,
      updatedGroups: 0,
    };
  }

  let updatedGroups = 0;
  const errors = [];
  const results = [];

  for (const g of groups) {
    const groupId = String(g._id);
    const groupName = g.name || "";
    try {
      const doc = await Permissions.findById(groupId);
      if (!doc) {
        errors.push({ groupId, groupName, error: "الكروب غير موجود" });
        continue;
      }

      const { next, changed } = buildNextUsersList(doc.users, fromUserId, toUserId);
      if (!changed) {
        results.push({ groupId, groupName, status: "skipped", reason: "لا تغيير مطلوب" });
        continue;
      }

      doc.users = next;
      doc.markModified("users");
      await doc.save();
      updatedGroups += 1;
      results.push({ groupId, groupName, status: "updated", memberCount: next.length });
    } catch (e) {
      errors.push({ groupId, groupName, error: e?.message || "خطأ" });
    }
  }

  const preview = await previewTransferUserPermissions({ fromUserId, toUserId });

  return {
    ...preview,
    updatedGroups,
    results,
    errors: errors.length ? errors : undefined,
  };
}

export function validateTransferUserIds(fromUserId, toUserId) {
  if (!isValidObjectId(fromUserId) || !isValidObjectId(toUserId)) {
    return { ok: false, error: "اختر مستخدم «من» و«إلى» بشكل صحيح" };
  }
  if (String(fromUserId) === String(toUserId)) {
    return { ok: false, error: "لا يمكن النقل لنفس المستخدم" };
  }
  return { ok: true };
}
