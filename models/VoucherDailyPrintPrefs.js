import mongoose from "mongoose";

const VoucherDailyPrintPrefsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    /** آخر حجم عُرض في شريط التحكم (للتوافق / واجهة «كل الأعمدة») */
    fontSize: { type: Number, default: 9, min: 7, max: 14 },
    fontBold: { type: Boolean, default: true },
    /** all | details | amounts | bank | cheque | fx | doctype | vno */
    fontTarget: { type: String, default: "all", trim: true },
    /**
     * حجم مستقل لكل عمود — تعديل عمود لا يصغّر الباقي
     * { details, amounts, bank, cheque, fx, doctype, vno }
     */
    fontSizes: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

export default mongoose.models.VoucherDailyPrintPrefs ||
  mongoose.model("VoucherDailyPrintPrefs", VoucherDailyPrintPrefsSchema);
