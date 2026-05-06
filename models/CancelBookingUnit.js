import mongoose from "mongoose";

const CancelBookingUnitSchema = new mongoose.Schema(
  {
    pageKey: { type: String, default: "cancel-booking-unit", index: true },
    exCompanyKey: { type: String, default: "Badur-Baghdad", index: true },

    // بيانات الفورمة
    customerName: { type: String, default: "" },
    unitNo: { type: String, default: "" },
    amountNumber: { type: String, default: "" },
    amountWords: { type: String, default: "" },
    dateDMY: { type: String, default: "" },
    phone: { type: String, default: "" },

    // Workflow meta
    status: { type: String, default: "Pending" },
    currentStep: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    

    attachments: { type: Array, default: [] },

    workflow: {
      key: { type: String, default: "" },
      name: { type: String, default: "" },
      steps: { type: Array, default: [] },
    },
  },
  { timestamps: true }
);

export default mongoose.models.CancelBookingUnit ||
  mongoose.model("CancelBookingUnit", CancelBookingUnitSchema);