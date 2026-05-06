import mongoose from "mongoose";

const WaiverReservationSchema = new mongoose.Schema(
  {
    pageKey: { type: String, index: true },
    exCompanyKey: { type: String, default: "Badur-Baghdad", index: true },

    customerName: String,
    customerNo: String,
    unitNo: String,

    receiptNo: String,
    receiptDateDMY: String, // dd/mm/yyyy

    amountNumber: String,
    amountWords: String,

    transfereeName: String,

    dateDMY: String, // dd/mm/yyyy

    // workflow
    status: { type: String, default: "Pending" },
    currentStep: { type: Number, default: 0 },
    workflow: { type: Object, default: null },

    createdBy: String,
    createdById: String,
    attachments: { type: Array, default: [] },

    requestCode: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.WaiverReservation ||
  mongoose.model("WaiverReservation", WaiverReservationSchema);