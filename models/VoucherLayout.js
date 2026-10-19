import mongoose from "mongoose";

const FieldLayoutSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    top: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    width: { type: Number, default: 10 },
    height: { type: Number, default: 5 },
  },
  { _id: false }
);

/**
 * تخطيط حقول الوصل لكل شركة — مشترك بين الصرف والقبض.
 * تعديل بالإحداثيات على الصرف ينطبق على القبض والعكس.
 */
const VoucherLayoutSchema = new mongoose.Schema(
  {
    companyKey: { type: String, required: true, trim: true, unique: true },
    fields: { type: [FieldLayoutSchema], default: [] },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.VoucherLayout) {
  delete mongoose.models.VoucherLayout;
}

export default mongoose.model("VoucherLayout", VoucherLayoutSchema);
