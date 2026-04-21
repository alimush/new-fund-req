// models/RequestOldData.js
import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  {
    desc: { type: String, default: "" },
    qty: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    type: { type: String, default: "" },
    size: { type: Number, default: 0 },
    url: { type: String, default: "" },
  },
  { _id: false }
);

const StepSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "", trim: true },
    tag: { type: String, default: "", trim: true },
    attachment: { type: AttachmentSchema, default: null },
    tagAttachments: {
      type: [AttachmentSchema],
      default: [],
    },
  },
  { _id: false }
);

const PaymentVoucherSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0 },
    amountWords: { type: String, default: "" },
    currency: { type: String, default: "" },
    date: { type: Date, default: null },
    description: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    createdAt: { type: Date, default: null },
  },
  { _id: false }
);

const ApprovalHistorySchema = new mongoose.Schema(
  {
    user: { type: String, default: "" },
    action: { type: String, default: "" },
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RequestOldDataSchema = new mongoose.Schema(
  {
    companyKey: { type: String, index: true, required: true },
    company: { type: String, default: "" },

    requestCode: {
      type: String,
      index: true,
      sparse: true,
    },

    requestType: { type: String, default: "" },
    description: { type: String, default: "" },
    currency: { type: String, default: "" },
    department: { type: String, default: "" },

    items: {
      type: [ItemSchema],
      default: [],
    },

    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    workflow: {
      name: { type: String, default: "" },
      steps: {
        type: [StepSchema],
        default: [],
      },
    },

    currentStep: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },

    paymentVoucher: {
      type: PaymentVoucherSchema,
      default: null,
    },

    projectName: { type: String, default: "", trim: true },
    cancelledAt: { type: Date, default: null },
    cancelledNote: { type: String, default: "" },

    approvalHistory: {
      type: [ApprovalHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: false,
    collection: "requests_old-data",
  }
);

const RequestOldData =
  mongoose.models.RequestOldData ||
  mongoose.model("RequestOldData", RequestOldDataSchema);

export default RequestOldData;