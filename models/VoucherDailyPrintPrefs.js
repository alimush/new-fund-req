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
    /** حجم خط واحد عام لكل خلايا جدول الطباعة */
    fontSize: { type: Number, default: 9, min: 7, max: 14 },
    fontBold: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.VoucherDailyPrintPrefs ||
  mongoose.model("VoucherDailyPrintPrefs", VoucherDailyPrintPrefsSchema);
