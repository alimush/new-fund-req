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

const PrintCalibSchema = new mongoose.Schema(
  {
    pageTopMm: { type: Number, default: 0 },
    pageLeftMm: { type: Number, default: 0 },
    widthMm: { type: Number, default: 0 },
    heightMm: { type: Number, default: 0 },
    offsetXmm: { type: Number, default: 0 },
    offsetYmm: { type: Number, default: 0 },
    scaleX: { type: Number, default: 100 },
    scaleY: { type: Number, default: 100 },
    fieldOffsets: { type: mongoose.Schema.Types.Mixed, default: {} },
    fieldFontStyles: { type: mongoose.Schema.Types.Mixed, default: {} },
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
    printCalib: { type: PrintCalibSchema, default: null },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.ChequeLayout) {
  delete mongoose.models.ChequeLayout;
}

export default mongoose.model("ChequeLayout", ChequeLayoutSchema);
