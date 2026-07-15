import mongoose from "mongoose";

const FileSchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    url: { type: String, default: "" },
    name: { type: String, default: "" },
    type: { type: String, default: "" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkflowStepSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, default: "" },
    actedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actedAt: { type: Date, default: Date.now },
    comment: { type: String, default: "" },
    tag: { type: String, default: "" },
    tagAttachments: { type: [FileSchema], default: [] },
  },
  { _id: false }
);

const Schema = new mongoose.Schema(
  {
    pageKey: { type: String, default: "attachment-only", index: true },
    exCompanyKey: { type: String, default: "Badur-Baghdad", index: true },

    title: { type: String, default: "اتاج" },

    customerName: { type: String, default: "" },
    unitNo: { type: String, default: "" },
    transactionType: { type: String, default: "" },

    attachments: { type: [FileSchema], default: [] },

    requestCode: { type: String, trim: true, sparse: true, unique: true },

    status: { type: String, default: "" },
    currentStep: { type: Number, default: -1 },

    createdBy: { type: String, default: "" },
    createdById: { type: String, default: "" },

    workflow: {
      key: { type: String, default: "attachment-only" },
      name: { type: String, default: "" },
      steps: { type: [WorkflowStepSchema], default: [] },
      mergeDocAttachmentsThroughStep: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.models.AttachmentOnly ||
  mongoose.model("AttachmentOnly", Schema);