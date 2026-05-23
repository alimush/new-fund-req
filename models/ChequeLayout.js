import mongoose from "mongoose";

const FieldLayoutSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    top: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    width: { type: Number, default: 10 },
    height: { type: Number, default: 5 },
    fontSize: { type: Number, default: 14 },
    fontWeight: { type: Number, default: 700 },
  },
  { _id: false }
);

const ChequeLayoutSchema = new mongoose.Schema(
  {
    templateKey: {
      type: String,
      required: true,
      unique: true,
      enum: ["real_estate_baghdad", "mustashar_ghadeer"],
    },
    fields: { type: [FieldLayoutSchema], default: [] },
    dateShowSlashes: { type: Boolean, default: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.ChequeLayout) {
  delete mongoose.models.ChequeLayout;
}

export default mongoose.model("ChequeLayout", ChequeLayoutSchema);
