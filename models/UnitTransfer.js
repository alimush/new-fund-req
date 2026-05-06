// /models/UnitTransfer.js
import mongoose from "mongoose";

const AttachmentSchema = new mongoose.Schema(
  {
    key: String,
    name: String,
    url: String,
    type: String,
    size: Number,
  },
  { _id: false }
);

const StepSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, default: "Pending" }, // Pending | Approved | Rejected | Cancelled
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actedAt: { type: Date, default: null },
    comment: { type: String, default: "" },
    tag: { type: String, default: "" },
    tagAttachments: { type: [AttachmentSchema], default: [] },
  },
  { _id: false }
);

const WorkflowSnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    name: { type: String, default: "" },
    steps: { type: [StepSchema], default: [] },
    mergeDocAttachmentsThroughStep: { type: Number, default: null },
  },
  { _id: false }
);

const UnitTransferSchema = new mongoose.Schema(
  {
    pageKey: { type: String, default: "unit-transfer", index: true },
    exCompanyKey: { type: String, default: "Badur-Baghdad", index: true },

    status: { type: String, default: "Pending", index: true },
    currentStep: { type: Number, default: 0 },

    workflow: { type: WorkflowSnapshotSchema, default: null },

    createdBy: { type: String, default: "" },   // username
    createdById: { type: String, default: "" }, // optional (مثل ReplaceBookingTransfer)
    createdAt: { type: Date, default: Date.now },

    // ===== Fields حسب الفورمة =====
    dateDMY: { type: String, default: "" },
    customerName: { type: String, default: "" },
    oldUnitNo: { type: String, default: "" },
    newUnitNo: { type: String, default: "" },
    description: { type: String, default: "" },

    attachments: { type: [AttachmentSchema], default: [] },

    requestCode: { type: String, trim: true, sparse: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.UnitTransfer ||
  mongoose.model("UnitTransfer", UnitTransferSchema);