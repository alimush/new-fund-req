import mongoose from "mongoose";

const { Schema } = mongoose;

const RowSchema = new Schema(
  {
    payType: { type: String, default: "" },
    amount: { type: String, default: "" },
    payDateYMD: { type: String, default: "" },
  },
  { _id: false }
);

const WorkflowStepSchema = new Schema(
  {
    users: [{ type: Schema.Types.ObjectId, ref: "User" }], // ✅
    status: { type: String, default: "Pending" }, // Pending | Approved | Rejected | Cancelled
    actedBy: { type: Schema.Types.ObjectId, ref: "User", default: null }, // ✅
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const WorkflowSchema = new Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    steps: { type: [WorkflowStepSchema], default: [] },
  },
  { _id: false }
);

const PaymentPlanSchema = new Schema(
  {
    createdBy: { type: String, default: "" },
    createdById: { type: Schema.Types.ObjectId, ref: "User", default: null }, // ✅

    salesEmp: { type: String, default: "" },
    customer: { type: String, default: "" },
    unitNo: { type: String, default: "" },
    dateDMY: { type: String, default: "" },
    discount: { type: String, default: "" },
    signature: { type: String, default: "" },

    rows: { type: [RowSchema], default: [] },

    // ✅ workflow snapshot داخل نفس الطلب
    pageKey: { type: String, default: "exceptions" },
    workflow: { type: WorkflowSchema, default: () => ({}) },
    status: { type: String, default: "Pending" }, // Pending | Approved | Rejected | Cancelled
    currentStep: { type: Number, default: -1 }, // 0..n-1 أو -1 = مغلق
  },
  { timestamps: true }
);

export default mongoose.models.PaymentPlan ||
  mongoose.model("PaymentPlan", PaymentPlanSchema);