import mongoose from "mongoose";
import Cheque from "@/models/Cheque";

/**
 * Resolve chequeId for a voucher from an explicit id and/or cheque number.
 * Prefers explicit chequeId when it matches the number; otherwise exact number match.
 */
export async function resolveVoucherChequeLink({
  chequeId = null,
  chequeNo = "",
} = {}) {
  const number = String(chequeNo || "").trim();
  const rawId = chequeId != null ? String(chequeId).trim() : "";

  if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
    const byId = await Cheque.findById(rawId)
      .select("_id chequeNumber status")
      .lean();
    if (byId && byId.status !== "void") {
      if (!number || String(byId.chequeNumber || "").trim() === number) {
        return {
          chequeId: byId._id,
          chequeNo: number || String(byId.chequeNumber || "").trim(),
        };
      }
    }
  }

  if (!number) {
    return { chequeId: null, chequeNo: "" };
  }

  const byNumber = await Cheque.findOne({
    chequeNumber: number,
    status: { $ne: "void" },
  })
    .select("_id chequeNumber")
    .sort({ updatedAt: -1 })
    .lean();

  if (byNumber) {
    return { chequeId: byNumber._id, chequeNo: number };
  }

  return { chequeId: null, chequeNo: number };
}
