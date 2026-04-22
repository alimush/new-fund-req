import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema(
  { desc: String, qty: Number, price: Number },
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

const RequestSchema = new mongoose.Schema(
  {
    companyKey: { type: String, index: true, required: true },

    requestCode: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },

    requestType: String,
    description: String,
    currency: String,
    department: String,
    expenseType: {
      type: String,
      enum: ["", "مصروف", "غير مصروف"],
      default: "",
    },

    items: [ItemSchema],

    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    workflow: {
      name: String,
      steps: [StepSchema],
    },

    currentStep: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },

    paymentVoucher: {
      amount: Number,
      amountWords: String,
      currency: String,
      date: Date,
      description: String,
      createdBy: String,
      createdAt: Date,
    },

    projectName: { type: String, default: "", trim: true },

    cancelledAt: { type: Date, default: null },
    cancelledNote: { type: String, default: "" },

    approvalHistory: [
      { user: String, action: String, note: String, date: { type: Date, default: Date.now } },
    ],
  },
  { timestamps: true, strict: false }
);

export function getModelForCompany(companyKey) {
  const key = String(companyKey || "").toLowerCase();
  const collectionName = `requests_${key}`;
  return mongoose.models[collectionName] || mongoose.model(collectionName, RequestSchema, collectionName);
}