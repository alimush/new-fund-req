import mongoose from "mongoose";
import Cheque from "@/models/Cheque";
import { normalizeChequeNumber } from "@/lib/voucher/backfillVoucherChequeLinks";

/**
 * Resolve chequeId for a voucher from an explicit id and/or cheque number.
 * Prefers explicit chequeId when it matches the number; otherwise exact number match.
 */
export async function resolveVoucherChequeLink({
  chequeId = null,
  chequeNo = "",
} = {}) {
  const number = normalizeChequeNumber(chequeNo);
  const rawId = chequeId != null ? String(chequeId).trim() : "";

  if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
    const byId = await Cheque.findById(rawId)
      .select("_id chequeNumber status")
      .lean();
    if (byId && byId.status !== "void") {
      const byIdNo = normalizeChequeNumber(byId.chequeNumber);
      if (!number || byIdNo === number) {
        return {
          chequeId: byId._id,
          chequeNo: number || byIdNo,
        };
      }
    }
  }

  if (!number) {
    return { chequeId: null, chequeNo: "" };
  }

  // Exact match on stored chequeNumber (also try raw trimmed variants)
  const byNumber = await Cheque.findOne({
    status: { $ne: "void" },
    $or: [
      { chequeNumber: number },
      { chequeNumber: chequeNo },
      { chequeNumber: String(chequeNo || "").trim() },
    ],
  })
    .select("_id chequeNumber")
    .sort({ updatedAt: -1 })
    .lean();

  if (byNumber && normalizeChequeNumber(byNumber.chequeNumber) === number) {
    return { chequeId: byNumber._id, chequeNo: number };
  }

  return { chequeId: null, chequeNo: number };
}
