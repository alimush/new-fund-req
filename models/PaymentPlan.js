import mongoose from "mongoose";

const { Schema } = mongoose;

const RowSchema = new Schema(
  {
    payType: { type: String, default: "" },
    amount: { type: String, default: "" },
    payDateYMD: { type: String, default: "" },
    payPercent: { type: String, default: "" },
  },
  { _id: false }
);

const StepAttachmentSchema = new Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    type: { type: String, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkflowStepSchema = new Schema(
  {
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, default: "Pending" }, // Pending | Approved | Rejected | Cancelled
    actedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "" },

    // ✅ مهمات مرفقات الستيب
    tag: { type: String, default: "" },
    tagAttachments: { type: [StepAttachmentSchema], default: [] },
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

const AttachmentSchema = new Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    type: { type: String, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, default: "" },
  },
  { _id: false }
);

const PaymentPlanSchema = new Schema(
  {
    createdBy: { type: String, default: "" },
    createdById: { type: Schema.Types.ObjectId, ref: "User", default: null },

    salesEmp: { type: String, default: "" },
    customer: { type: String, default: "" },
    unitNo: { type: String, default: "" },
    dateDMY: { type: String, default: "" },
    discount: { type: String, default: "" },
    signature: { type: String, default: "" },

    rows: { type: [RowSchema], default: [] },

    pageKey: { type: String, default: "exceptions" },
    exCompanyKey: { type: String, default: "Badur-Baghdad", index: true },
    workflow: { type: WorkflowSchema, default: () => ({}) },
    status: { type: String, default: "Pending" },
    currentStep: { type: Number, default: -1 },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    requestCode: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.PaymentPlan ||
  mongoose.model("PaymentPlan", PaymentPlanSchema);