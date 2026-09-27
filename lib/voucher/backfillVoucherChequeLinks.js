import mongoose from "mongoose";
import Cheque from "@/models/Cheque";
import Voucher from "@/models/Voucher";

/** Normalize cheque number for matching (trim + collapse spaces). */
export function normalizeChequeNumber(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

/**
 * Build map: normalized chequeNumber → best Cheque _id
 * Prefers non-void, then most recently updated.
 */
export async function buildChequeNumberIndex() {
  const docs = await Cheque.find({ status: { $ne: "void" } })
    .select("_id chequeNumber updatedAt createdAt status")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const byNumber = new Map();
  for (const doc of docs) {
    const key = normalizeChequeNumber(doc.chequeNumber);
    if (!key) continue;
    if (!byNumber.has(key)) {
      byNumber.set(key, doc._id);
    }
  }
  return byNumber;
}

/**
 * Backfill voucher.chequeId from voucher.chequeNo when the number exists in cheques.
 *
 * @param {{ dryRun?: boolean, limit?: number }} [options]
 * @returns {Promise<{ scanned: number, matched: number, updated: number, skippedLinked: number, noMatch: number, samples: Array }>}
 */
export async function backfillVoucherChequeLinks(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 0;

  const chequeIndex = await buildChequeNumberIndex();

  const filter = {
    chequeNo: { $exists: true, $nin: [null, ""] },
    $or: [{ chequeId: null }, { chequeId: { $exists: false } }],
  };

  let query = Voucher.find(filter)
    .select("_id companyKey mode voucherNo chequeNo chequeId")
    .sort({ updatedAt: -1 });

  if (limit) query = query.limit(limit);

  const vouchers = await query.lean();

  let matched = 0;
  let updated = 0;
  let noMatch = 0;
  const samples = [];

  const ops = [];

  for (const v of vouchers) {
    const key = normalizeChequeNumber(v.chequeNo);
    if (!key) {
      noMatch += 1;
      continue;
    }

    const chequeId = chequeIndex.get(key);
    if (!chequeId) {
      noMatch += 1;
      continue;
    }

    matched += 1;
    if (samples.length < 25) {
      samples.push({
        voucherId: String(v._id),
        companyKey: v.companyKey,
        voucherNo: v.voucherNo,
        mode: v.mode,
        chequeNo: key,
        chequeId: String(chequeId),
      });
    }

    if (!dryRun) {
      ops.push({
        updateOne: {
          filter: { _id: v._id },
          update: { $set: { chequeId } },
        },
      });
    }
  }

  if (!dryRun && ops.length) {
    const CHUNK = 500;
    for (let i = 0; i < ops.length; i += CHUNK) {
      const chunk = ops.slice(i, i + CHUNK);
      const res = await Voucher.bulkWrite(chunk, { ordered: false });
      updated += res.modifiedCount || 0;
    }
  } else if (dryRun) {
    updated = matched;
  }

  return {
    scanned: vouchers.length,
    matched,
    updated: dryRun ? 0 : updated,
    wouldUpdate: dryRun ? matched : undefined,
    noMatch,
    chequeIndexSize: chequeIndex.size,
    samples,
    dryRun,
  };
}
