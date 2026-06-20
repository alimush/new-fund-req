import ChequeBranch from "@/models/ChequeBranch";
import {
  DEFAULT_MUSTASHAR_BRANCHES,
  MUSTASHAR_TEMPLATE_KEY,
} from "@/lib/cheques/chequeBranches";

/** upsert للافتراضيات + حذف السجلات المكررة لنفس branchKey */
export async function ensureMustasharBranchesSeeded() {
  for (const branch of DEFAULT_MUSTASHAR_BRANCHES) {
    await ChequeBranch.findOneAndUpdate(
      { templateKey: branch.templateKey, branchKey: branch.branchKey },
      { $set: branch },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  await dedupeChequeBranchesInDb(MUSTASHAR_TEMPLATE_KEY);
}

export async function dedupeChequeBranchesInDb(templateKey) {
  const rows = await ChequeBranch.find({ templateKey })
    .sort({ branchKey: 1, updatedAt: -1, createdAt: -1 })
    .select("_id branchKey")
    .lean();

  const seen = new Set();
  const removeIds = [];
  for (const row of rows) {
    const key = String(row.branchKey || "").trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      removeIds.push(row._id);
    } else {
      seen.add(key);
    }
  }

  if (removeIds.length) {
    await ChequeBranch.deleteMany({ _id: { $in: removeIds } });
  }

  return removeIds.length;
}
