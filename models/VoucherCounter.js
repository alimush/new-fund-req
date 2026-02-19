import mongoose from "mongoose";

const VoucherCounterSchema = new mongoose.Schema(
  {
    companyKey: { type: String, required: true },
    mode: { type: String, enum: ["payment", "receipt"], required: true }, // صرف/قبض
    seq: { type: Number, default: 0 }, // الرقم الحالي
    prefix: { type: String, default: "" }, // اختياري PV/RV
  },
  { timestamps: true }
);

// unique per company+mode
VoucherCounterSchema.index({ companyKey: 1, mode: 1 }, { unique: true });

export default mongoose.models.VoucherCounter ||
  mongoose.model("VoucherCounter", VoucherCounterSchema);