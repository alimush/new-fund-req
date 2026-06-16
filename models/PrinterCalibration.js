import mongoose from "mongoose";

const PrintCalibNestedSchema = new mongoose.Schema(
  {
    pageTopMm: { type: Number, default: 0 },
    pageLeftMm: { type: Number, default: 0 },
    widthMm: { type: Number, default: 0 },
    heightMm: { type: Number, default: 0 },
    offsetXmm: { type: Number, default: 0 },
    offsetYmm: { type: Number, default: 0 },
    scaleX: { type: Number, default: 100 },
    scaleY: { type: Number, default: 100 },
    sheetRotationDeg: { type: Number, default: 0 },
    flipHorizontal: { type: Boolean, default: false },
    flipVertical: { type: Boolean, default: false },
    globalFontSizeScale: { type: Number, default: 130 },
    globalTextColor: { type: String, default: "#0f172a" },
    fieldOffsets: { type: mongoose.Schema.Types.Mixed, default: {} },
    fieldFontStyles: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const PrinterCalibrationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    templateKey: {
      type: String,
      required: true,
      enum: ["real_estate_baghdad", "mustashar_ghadeer"],
      index: true,
    },
    printerName: { type: String, required: true, trim: true },
    printCalib: { type: PrintCalibNestedSchema, default: () => ({}) },
    isDefault: { type: Boolean, default: false },
    lastCalibratedAt: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

PrinterCalibrationSchema.index(
  { userId: 1, templateKey: 1, printerName: 1 },
  { unique: true }
);

if (mongoose.models.PrinterCalibration) {
  delete mongoose.models.PrinterCalibration;
}

export default mongoose.model("PrinterCalibration", PrinterCalibrationSchema);
