import mongoose from "mongoose";

const ChequePrintJobSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    templateKey: {
      type: String,
      required: true,
      enum: ["real_estate_baghdad", "mustashar_ghadeer", "rafidain_ghadeer"],
      index: true,
    },
    templateName: { type: String, default: "" },
    chequeId: { type: mongoose.Schema.Types.ObjectId, ref: "Cheque", default: null },
    printerName: { type: String, default: "" },
    printMode: {
      type: String,
      enum: ["data", "withImage", "imageOnly", "calibTest"],
      default: "data",
    },
    printMethod: { type: String, default: "pdf-native" },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    payee: { type: String, default: "" },
    amountNumeric: { type: Number, default: 0 },
    chequeNumber: { type: String, default: "" },
    appliedCalibration: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

ChequePrintJobSchema.index({ createdAt: -1 });

if (mongoose.models.ChequePrintJob) {
  delete mongoose.models.ChequePrintJob;
}

export default mongoose.model("ChequePrintJob", ChequePrintJobSchema);
